// Starts, checks, resets, and stops projects using only the runtime contract.
// Protected scaffolding: it knows nothing about how a project is built.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  PROJECTS, REPO_ROOT, LOG_DIR, HEALTH_TIMEOUT_MS, DEFAULT_CLINIC_NOW, projectEnv, projectUrl,
} from "./config.js";

export class NotImplementedError extends Error {}
export class StartupError extends Error {}

const running = new Map(); // name -> { child, clinicNow, testEndpoints, port }

export function projectDir(name) {
  return path.join(REPO_ROOT, PROJECTS[name].folder);
}

export function logFile(name) {
  return path.join(LOG_DIR, `${name}.log`);
}

export function logTail(name, lines = 40) {
  try {
    const text = fs.readFileSync(logFile(name), "utf8").trimEnd().split("\n");
    return text.slice(-lines).join("\n");
  } catch {
    return "(no log output)";
  }
}

/** Throws NotImplementedError when the project has no executable start script. */
export function assertImplemented(name) {
  const p = PROJECTS[name];
  const start = path.join(projectDir(name), "start");
  if (!fs.existsSync(start)) {
    throw new NotImplementedError(`${p.title} not implemented: ${p.folder}/start not found`);
  }
  try {
    fs.accessSync(start, fs.constants.X_OK);
  } catch {
    throw new NotImplementedError(`${p.title} not runnable: ${p.folder}/start is not executable`);
  }
}

export function freePort(port) {
  execFileSync(path.join(REPO_ROOT, "spec/harness/free-port.sh"), [String(port)], { stdio: "ignore" });
}

async function isHealthy(name, port) {
  try {
    const res = await fetch(`http://localhost:${port}/health`, { signal: AbortSignal.timeout(1000) });
    if (res.status !== 200) return false;
    const body = await res.json().catch(() => null);
    return body?.status === "ok";
  } catch {
    return false;
  }
}

/** Starts a project and waits for GET /health. */
export async function startProject(name, { clinicNow = DEFAULT_CLINIC_NOW, testEndpoints = true, port } = {}) {
  assertImplemented(name);
  const p = PROJECTS[name];
  const listenPort = port ?? p.port;
  await stopProject(name);
  freePort(listenPort);
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const log = fs.openSync(logFile(name), "a");
  fs.writeSync(log, `\n--- start ${new Date().toISOString()} CLINIC_NOW=${clinicNow} port=${listenPort} ---\n`);

  const child = spawn("./start", [], {
    cwd: projectDir(name),
    env: projectEnv(name, { clinicNow, testEndpoints, port: listenPort }),
    stdio: ["ignore", log, log],
    detached: true, // own process group so stop() also ends grandchildren
  });
  fs.closeSync(log);
  let exited = null;
  child.on("exit", (code, signal) => { exited = { code, signal }; });
  running.set(name, { child, clinicNow, testEndpoints, port: listenPort });

  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (exited) {
      running.delete(name);
      throw new StartupError(
        `${p.title} exited during startup (code ${exited.code}, signal ${exited.signal}).\n${logTail(name)}`);
    }
    if (await isHealthy(name, listenPort)) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  await stopProject(name);
  throw new StartupError(
    `${p.title} did not report healthy on port ${listenPort} within ${HEALTH_TIMEOUT_MS / 1000}s.\n${logTail(name)}`);
}

/** Starts the project unless it is already running with the same clock and mode. */
export async function ensureRunning(name, opts = {}) {
  const want = { clinicNow: opts.clinicNow ?? DEFAULT_CLINIC_NOW, testEndpoints: opts.testEndpoints ?? true };
  const cur = running.get(name);
  if (cur && cur.child.exitCode === null && cur.clinicNow === want.clinicNow
      && cur.testEndpoints === want.testEndpoints && (await isHealthy(name, cur.port))) {
    return false;
  }
  await startProject(name, { ...opts, ...want });
  return true;
}

/** Restarts a project only if its clinic clock differs (runtime contract: frozen clock). */
export async function setClinicClock(name, clinicNow) {
  return ensureRunning(name, { clinicNow });
}

export async function resetProject(name) {
  const res = await fetch(`${projectUrl(name)}/test/reset`, { method: "POST" });
  if (res.status !== 204) {
    throw new Error(`${PROJECTS[name].title} reset returned ${res.status}, expected 204`);
  }
}

export async function stopProject(name) {
  const cur = running.get(name);
  if (!cur) return;
  running.delete(name);
  const { child } = cur;
  if (child.exitCode !== null || child.signalCode !== null) return;
  const done = new Promise((r) => child.once("exit", r));
  try { process.kill(-child.pid, "SIGTERM"); } catch { /* already gone */ }
  const timer = setTimeout(() => { try { process.kill(-child.pid, "SIGKILL"); } catch { /* gone */ } }, 5000);
  await done;
  clearTimeout(timer);
}

export async function stopAll() {
  await Promise.all([...running.keys()].map(stopProject));
}

export function runningClock(name) {
  return running.get(name)?.clinicNow;
}
