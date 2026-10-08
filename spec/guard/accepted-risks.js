#!/usr/bin/env node
// SPEC-07 accepted-risks suite. Runs every @accepted-risk scenario (excluded from the normal
// Cucumber runs) and inverts the result: an accepted risk is expected to FAIL in a Then step.
//   fails in a Then step        -> ACCEPTED (the risk is still present)
//   passes                      -> STATE CHANGE failing → passing (reported, not a failure)
//   back to failing after a pass-> STATE CHANGE passing → failing (reported, not a failure)
//   undefined/ambiguous/pending,
//   or fails in setup or a hook -> ERROR (the scenario never tested the risk; suite fails)
// Removing a tag is a human freeze decision; this suite never does it. Protected scaffolding.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { scanTags } from "./guard.js";

const SPEC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(SPEC, "..");
const OUT = path.join(ROOT, "test-results", "accepted-risks");
const LATEST = path.join(OUT, "latest.json");
const tree = process.env.PETCLINIC_TREE ?? "unknown";
const now = new Date().toISOString();

const register = scanTags(ROOT).register;
const metaFor = (uri, name) => register.find((r) => r.file === `spec/${uri}` && r.scenario === name);

/** Runs one Cucumber profile and returns its message envelopes. */
function run(profile) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "accepted-risks-")), `${profile}.ndjson`);
  const r = spawnSync("npx", ["cucumber-js", "--config", "guard/accepted-risks.cucumber.cjs", "--profile", profile,
    "--format", `message:${file}`], { cwd: SPEC, encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } });
  if (!fs.existsSync(file)) {
    console.error(r.stdout, r.stderr);
    throw new Error(`Cucumber profile ${profile} produced no messages (exit ${r.status})`);
  }
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

/** One entry per executed scenario: { uri, line, name, state, detail }. */
function classify(envelopes) {
  const pickles = new Map(), cases = new Map(), started = new Map(), steps = new Map(), lines = new Map();
  for (const e of envelopes) {
    if (e.gherkinDocument) {
      const walk = (children = []) => children.forEach((c) => {
        if (c.scenario) lines.set(c.scenario.id, c.scenario.location.line);
        if (c.rule) walk(c.rule.children);
      });
      walk(e.gherkinDocument.feature?.children);
    }
    if (e.pickle) pickles.set(e.pickle.id, e.pickle);
    if (e.testCase) cases.set(e.testCase.id, e.testCase);
    if (e.testCaseStarted) started.set(e.testCaseStarted.id, e.testCaseStarted.testCaseId);
    if (e.testStepFinished) {
      const list = steps.get(e.testStepFinished.testCaseStartedId) ?? [];
      list.push(e.testStepFinished);
      steps.set(e.testStepFinished.testCaseStartedId, list);
    }
  }
  return [...steps].map(([startedId, finished]) => {
    const tc = cases.get(started.get(startedId));
    const pickle = pickles.get(tc.pickleId);
    const stepOf = (id) => tc.testSteps.find((s) => s.id === id);
    const pickleStep = (s) => pickle.steps.find((p) => p.id === s?.pickleStepId);
    const statuses = finished.map((f) => f.testStepResult.status);
    const base = { uri: pickle.uri, line: lines.get(pickle.astNodeIds[0]), name: pickle.name };
    const broken = statuses.find((s) => ["UNDEFINED", "AMBIGUOUS", "PENDING"].includes(s));
    if (broken) return { ...base, state: "error", detail: `a step is ${broken.toLowerCase()}` };
    const failed = finished.find((f) => f.testStepResult.status === "FAILED");
    if (!failed) return { ...base, state: "passing" };
    const ps = pickleStep(stepOf(failed.testStepId));
    if (!ps) return { ...base, state: "error", detail: "failed in a hook, before testing the risk" };
    if (ps.type && ps.type !== "Outcome") return { ...base, state: "error", detail: `failed in setup ("${ps.text}"), before testing the risk` };
    return { ...base, state: "failing", detail: `fails at "${ps.text}"` };
  });
}

// History is kept only for runs through spec/run-all.js, which supplies the tree hash.
// Direct runs (tree "unknown") neither read nor write it.
const keepHistory = tree !== "unknown";
let previous = {};
if (keepHistory) {
  try {
    const all = JSON.parse(fs.readFileSync(LATEST, "utf8")).results ?? {};
    previous = Object.fromEntries(Object.entries(all).filter(([, v]) => v.tree !== "unknown"));
  } catch { /* no history */ }
}

const results = {};
const errors = [], changes = [];
for (const profile of Object.keys((await import("./accepted-risks.cucumber.cjs")).default)) {
  for (const s of classify(run(profile))) {
    const meta = metaFor(s.uri, s.name);
    const id = meta?.risk ?? "UNREGISTERED";
    const key = `${id} ${s.uri}:${s.name}`;
    const where = `spec/${s.uri}:${s.line}`;
    const prior = previous[key];
    results[key] = { risk: id, state: s.state, tree, at: now, where,
      lastFailing: s.state === "failing" ? { tree, at: now } : prior?.lastFailing ?? null };
    if (s.state === "error") { errors.push(`ERROR  ${id}  ${s.detail}  ${where}`); continue; }
    const was = prior?.state === "passing" ? "passing" : "failing"; // the declared baseline is failing
    if (s.state === "passing") {
      const since = prior?.state === "passing"
        ? prior.passingSince ?? { tree: prior.tree, at: prior.at }
        : { tree, at: now };
      results[key].passingSince = since;
      // The transition itself is reported once as STATE CHANGE; later runs keep saying so.
      if (prior?.state === "passing") {
        console.log(`NOT REPRODUCING  ${id}  passing since ${since.at} on tree ${since.tree.slice(0, 12)}; tag still in place  ${where}`);
      }
    }
    if (s.state === "failing") {
      console.log(`ACCEPTED      ${id}  still failing as expected, ${s.detail}  (owner ${meta?.owner}, review ${meta?.review})  ${where}`);
    }
    if (s.state !== was) {
      const since = prior?.lastFailing && s.state === "passing"
        ? `  last failing: ${prior.lastFailing.at} on tree ${prior.lastFailing.tree.slice(0, 12)}`
        : !prior ? "  (no earlier run here; compared with the declared state)" : "";
      changes.push(`STATE CHANGE  ${id}  ${was} → ${s.state} on tree ${tree.slice(0, 12)}  ${where}${since}`);
    }
  }
}
if (keepHistory) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(LATEST, JSON.stringify({ at: now, tree, results }, null, 2) + "\n");
}

for (const c of changes) console.log(c);
if (changes.some((c) => c.includes("→ passing"))) {
  console.log("An accepted risk no longer reproduces on this build. Tell the human; only a human removes @accepted-risk (freeze).");
}
for (const e of errors) console.log(e);
const total = Object.keys(results).length;
// Summary line in the format spec/run-all.js already parses: "passed" = behaved as declared or reported.
console.log(`\n${total} scenario${total === 1 ? "" : "s"} (${total - errors.length} passed${errors.length ? `, ${errors.length} failed` : ""})`);
process.exit(errors.length ? 1 : 0);
