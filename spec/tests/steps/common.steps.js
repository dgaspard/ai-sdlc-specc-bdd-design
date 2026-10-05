// Steps shared by every service feature. Protected test.
import { Given, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { central } from "../../harness/clinic-time.js";
import * as seed from "../../harness/seed.js";

/** Feature wording -> problem `code`, e.g. "invalid slot" -> "invalid_slot". */
export const codeFor = (reason) => reason.trim().toLowerCase().replace(/\s+/g, "_");

/** Asserts the last response is a problem with the given code (and optional status). */
export function expectProblem(world, code, status) {
  const r = world.response;
  assert.ok(r, "no request has been made");
  assert.ok(r.status >= 400, `expected a refusal, got ${r.status} ${JSON.stringify(r.body)}`);
  assert.equal(r.body?.code, code, `expected problem code ${code}, got ${r.status} ${JSON.stringify(r.body)}`);
  if (status) assert.equal(r.status, status);
}

/** Default caller for steps that do not name one: Dr Avery Taylor (may read anything). */
export async function asDefaultCaller(world) {
  if (!world.token) await world.actAs("avery.taylor");
}

/**
 * "the administrator" acting caller (MVP-02A, D-41, D-44): whoever an explicit
 * `Given "X" is logged in` already made the caller (covers the admin-only
 * "riley.chen" case, D-52), else Dr Avery Taylor's dual-role account by default,
 * since most admin-bypass scenarios name no separate login step.
 */
export async function adminToken(world) {
  if (world.token) return world.token;
  return world.tokenFor("avery.taylor");
}

Given("the clinic clock reads {string} Central Time", async function (local) {
  await this.setClinicClock(central(local));
});

Given("the clinic veterinarians are Dr Avery Taylor and Dr Morgan Reed", function () {
  assert.deepEqual(seed.veterinarians.map((v) => `${v.firstName} ${v.lastName}`).sort(), ["Avery Taylor", "Morgan Reed"]);
});

Given("{string} is logged in", async function (username) {
  await this.actAs(username);
});

Then(/^the ([a-z]+) is (?:refused|rejected) as "([^"]+)"$/, function (_subject, reason) {
  expectProblem(this, codeFor(reason));
});
