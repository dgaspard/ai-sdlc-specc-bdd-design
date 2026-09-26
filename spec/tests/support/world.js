// Cucumber world and lifecycle for service features. Protected scaffolding.
// Service features (@service:<name>) run the real service under test, stubs for the
// services it calls (D-28), the real fake payment provider, and the OTLP test collector.
import {
  World, setWorldConstructor, setDefaultTimeout, Before, After, AfterAll, Status,
} from "@cucumber/cucumber";
import { PROJECTS, projectUrl, DEFAULT_CLINIC_NOW } from "../../harness/config.js";
import {
  assertImplemented, ensureRunning, resetProject, stopAll, logTail, setClinicClock,
} from "../../harness/processes.js";
import { StubServer } from "../../harness/stub-server.js";
import { validateResponse } from "../../harness/schema.js";
import { signJwt, clinicSeconds, USER_TOKEN_SECONDS } from "../../harness/auth.js";
import * as seed from "../../harness/seed.js";

setDefaultTimeout(30_000);

const stubs = new Map(); // project name -> StubServer (started once per run)

async function stubFor(name) {
  if (!stubs.has(name)) {
    const s = new StubServer(name);
    await s.start();
    stubs.set(name, s);
  }
  const s = stubs.get(name);
  s.reset();
  return s;
}

class PetClinicWorld extends World {
  constructor(options) {
    super(options);
    this.service = null; // project under test
    this.stubs = {};     // dependency name -> StubServer
    this.clinicNow = DEFAULT_CLINIC_NOW;
    this.token = null;   // bearer token used by api() unless overridden
    this.response = null; // last { status, body, headers }
    this.memo = {};      // scenario-local values (ids, results)
  }

  /**
   * Calls the service under test (or `service`) over HTTP and validates the response
   * against that service's published contract. A response the contract does not allow
   * fails the step, so every scenario also checks the API contract.
   */
  async api(method, path, { body, token = this.token, headers = {}, service = this.service } = {}) {
    const res = await fetch(`${projectUrl(service)}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let parsed = text;
    try { parsed = text ? JSON.parse(text) : undefined; } catch { /* keep text */ }
    this.response = { status: res.status, body: parsed, headers: Object.fromEntries(res.headers) };
    const contract = PROJECTS[service].contract;
    let check;
    try {
      check = validateResponse(contract, method, path, res.status, parsed);
    } catch (e) {
      throw new Error(`Contract violation: ${method} ${path} returned ${res.status}: ${e.message}`);
    }
    if (!check.valid) {
      throw new Error(`Contract violation: ${method} ${path} ${res.status} body does not match ${contract}: ${check.errors.join("; ")}`);
    }
    return this.response;
  }

  /**
   * Token for a seeded user. Against Customer the real login endpoint is used; other
   * services verify locally, so the harness signs an identical token with the demo secret.
   */
  async tokenFor(username) {
    const u = seed.user(username);
    if (this.service === "customer") {
      const r = await this.api("POST", "/auth/login", { body: { username, password: u.password }, token: null });
      if (r.status !== 200) throw new Error(`Login for ${username} returned ${r.status}`);
      return r.body.token;
    }
    const iat = clinicSeconds(this.clinicNow);
    const link = u.role === "customer" ? { customerId: u.customerId } : { veterinarianId: u.veterinarianId };
    return signJwt({ sub: u.id, role: u.role, ...link, iat, exp: iat + USER_TOKEN_SECONDS });
  }

  /** Makes a seeded user (by username or display name, e.g. "Jordan") the caller. */
  async actAs(nameOrUsername) {
    const u = seed.users.find((x) => x.username === nameOrUsername) ?? seed.userFor(nameOrUsername);
    this.token = await this.tokenFor(u.username);
    this.actor = u;
    return u;
  }

  url(name = this.service) {
    return projectUrl(name);
  }

  /** Step helper for "Given the clinic clock reads ...": moves the clock, keeps stored data. */
  async setClinicClock(isoTimestamp) {
    await setClinicClock(this.service, isoTimestamp);
    this.clinicNow = isoTimestamp;
  }
}
setWorldConstructor(PetClinicWorld);

function serviceTag(pickle) {
  const tag = pickle.tags.map((t) => t.name).find((t) => t.startsWith("@service:"));
  return tag ? tag.slice("@service:".length) : null;
}

Before(async function ({ pickle }) {
  const name = serviceTag(pickle);
  if (!name) return;
  if (!PROJECTS[name]) throw new Error(`Unknown service tag @service:${name}`);
  this.service = name;
  assertImplemented(name); // fails the scenario with "<Service> not implemented: ..."

  await ensureRunning("collector");
  await resetProject("collector");

  for (const dep of PROJECTS[name].dependsOn) {
    if (dep === "payment") {
      await ensureRunning("payment");
      await resetProject("payment");
    } else {
      this.stubs[dep] = await stubFor(dep);
    }
  }
  await ensureRunning(name, { clinicNow: DEFAULT_CLINIC_NOW });
  await resetProject(name);
});

After(function ({ result }) {
  if (result?.status === Status.FAILED && this.service) {
    try { assertImplemented(this.service); } catch { return; } // nothing to show yet
    this.attach(`Last log lines for ${this.service}:\n${logTail(this.service)}`, "text/plain");
  }
});

AfterAll(async function () {
  await stopAll();
  await Promise.all([...stubs.values()].map((s) => s.stop()));
});
