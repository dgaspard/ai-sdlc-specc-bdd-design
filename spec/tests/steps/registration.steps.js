import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { registration } from "../support/registration.js";
import * as seed from "../../harness/seed.js";
import { decodeJwt } from "../../harness/auth.js";

async function list(world) {
  const r = await world.api("GET", "/customers", { token: await world.tokenFor("avery.taylor") });
  assert.equal(r.status, 200);
  return r.body;
}
async function submit(world, edit = () => {}) {
  world.memo.registrationBefore = await list(world);
  const body = registration(); edit(body);
  world.memo.registrationBody = body;
  world.memo.registrationResult = await world.api("POST", "/auth/register", { body, token: null });
}
When("a new customer self-registers with complete information", async function () { await submit(this); });
Given("a new customer has self-registered", async function () {
  await submit(this); assert.equal(this.memo.registrationResult.status, 201);
});
When("a new customer self-registers without {string}", async function (field) {
  await submit(this, body => {
    const keys = field.split("."); const last = keys.pop();
    delete keys.reduce((value, key) => value[key], body)[last];
  });
});
When("a new customer self-registers with {string}", async function (problem) {
  await submit(this, b => {
    const changes = {
      "no pets": () => { b.pets = []; },
      "no insurance": () => { b.profile.insurance = []; },
      "unknown veterinarian": () => { b.profile.preferredVeterinarianId = randomUUID(); },
      "foreign insured pet": () => { b.profile.insurance[0].coveredPetIds = [seed.pet("Milo").id]; },
      "existing pet ID": () => { b.pets[0].id = seed.pet("Milo").id; b.profile.insurance[0].coveredPetIds = [b.pets[0].id]; },
      "repeated pet ID": () => { b.pets.push({ ...b.pets[0] }); },
      "seeded username": () => { b.username = "avery.taylor"; b.password = "replacement-password"; },
      "future pet birth date": () => { b.pets[0].estimatedBirthDate = "2099-01-01"; },
      "veterinarian role": () => { b.role = "veterinarian"; },
      "supplied customer ID": () => { b.profile.id = seed.customer("Jordan").id; },
      "supplied pet owner": () => { b.pets[0].ownerId = seed.customer("Jordan").id; },
    }; assert.ok(changes[problem]); changes[problem]();
  });
});
Then("the registered profile and initial pets match the submitted information", function () {
  const r = this.memo.registrationResult, b = this.memo.registrationBody;
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.match(r.body.id, /^[0-9a-f-]{36}$/i);
  const expected = { ...b.profile, id: r.body.id, pets: b.pets.map(p => ({ ...p, ownerId: r.body.id })),
    outstandingBalance: 0, accountEntries: [] };
  assert.deepEqual(r.body, expected);
});
Then("the new customer can log in and read only their own profile", async function () {
  const b = this.memo.registrationBody, profile = this.memo.registrationResult.body;
  const r = await this.api("POST", "/auth/login", { body: { username: b.username, password: b.password }, token: null });
  assert.equal(r.status, 200); assert.equal(r.body.user.role, "customer");
  assert.equal(r.body.user.customerId, profile.id); assert.ok(!("password" in r.body.user));
  const jwt = decodeJwt(r.body.token); assert.ok(jwt.signatureValid);
  assert.equal(jwt.claims.role, "customer"); assert.equal(jwt.claims.customerId, profile.id);
  assert.equal(jwt.claims.exp - jwt.claims.iat, 28800);
  const own = await this.api("GET", `/customers/${profile.id}`, { token: r.body.token });
  assert.equal(own.status, 200); assert.deepEqual(own.body, profile);
  const other = await this.api("GET", `/customers/${seed.customer("Jordan").id}`, { token: r.body.token });
  assert.equal(other.status, 404);
});
Then("registration is rejected without saving the profile or login", async function () {
  const r = this.memo.registrationResult;
  assert.equal(r.status, 400); assert.equal(r.body.code, "validation_error");
  assert.deepEqual(await list(this), this.memo.registrationBefore);
  for (const pet of this.memo.registrationBody.pets ?? []) {
    if (seed.pets.some(p => p.id === pet.id)) continue;
    const read = await this.api("GET", `/pets/${pet.id}`, { token: await this.tokenFor("avery.taylor") });
    assert.equal(read.status, 404, "rejected registration left an orphan pet");
  }
  const login = await this.api("POST", "/auth/login", { body: { username: "casey.park", password: "petclinic-demo" }, token: null });
  assert.equal(login.status, 401);
});
When("the same username is registered again with a different password", async function () {
  this.memo.originalRegistration = this.memo.registrationResult.body;
  await submit(this, b => { b.password = "replacement-password"; });
});
Then("the duplicate registration is rejected and the original login still works", async function () {
  assert.equal(this.memo.registrationResult.status, 400);
  assert.deepEqual(await list(this), this.memo.registrationBefore);
  for (const [password, expected] of [["petclinic-demo", 200], ["replacement-password", 401]]) {
    const r = await this.api("POST", "/auth/login", { body: { username: "casey.park", password }, token: null });
    assert.equal(r.status, expected);
    if (expected === 200) assert.equal(r.body.user.customerId, this.memo.originalRegistration.id);
  }
});
