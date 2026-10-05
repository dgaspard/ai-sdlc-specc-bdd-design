// Steps for spec/features/reservation/manage-veterinarians.feature (MVP-02A, D-39, D-42,
// D-43, D-52). Reservation runs for real. Protected test.
import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import * as seed from "../../harness/seed.js";
import { adminToken } from "./common.steps.js";

function splitName(fullName) {
  const [firstName, ...rest] = fullName.split(" ");
  return { firstName, lastName: rest.join(" ") };
}
async function listVets(world, token) {
  return world.api("GET", "/veterinarians", { token: token ?? await adminToken(world) });
}
async function addVet(world, body, token) {
  return world.api("POST", "/veterinarians", { body, token: token ?? await adminToken(world) });
}
async function patchVet(world, vetId, body, token) {
  return world.api("PATCH", `/veterinarians/${vetId}`, { body, token: token ?? await adminToken(world) });
}
async function vetStatus(world, vetName) {
  const r = await listVets(world, await adminToken(world));
  const v = r.body.find((x) => x.id === seed.vet(vetName).id);
  assert.ok(v, `${vetName} not found in roster`);
  return v.active;
}

// ---------------------------------------------------------------------------
// Add
// ---------------------------------------------------------------------------
When("the administrator adds veterinarian {string} with office {string}", async function (name, officeId) {
  this.response = await addVet(this, { ...splitName(name), officeId });
});
When("the veterinarian attempts to add veterinarian {string} with office {string}", async function (name, officeId) {
  this.response = await addVet(this, { ...splitName(name), officeId }, this.token);
});
When("the customer attempts to add veterinarian {string} with office {string}", async function (name, officeId) {
  this.response = await addVet(this, { ...splitName(name), officeId }, this.token);
});
When(/^the administrator adds a veterinarian with (\{.*\})$/, async function (payload) {
  this.response = await addVet(this, JSON.parse(payload));
});
Then("a new veterinarian {string} is created with office {string}", function (name, officeId) {
  assert.equal(this.response.status, 201, JSON.stringify(this.response.body));
  const { firstName, lastName } = splitName(name);
  assert.equal(this.response.body.firstName, firstName);
  assert.equal(this.response.body.lastName, lastName);
  assert.equal(this.response.body.officeId, officeId);
  assert.equal(this.response.body.active, true);
  this.memo.newVet = this.response.body;
});
Then("the new veterinarian is active", async function () {
  const v = (await listVets(this, await adminToken(this))).body.find((x) => x.id === this.memo.newVet.id);
  assert.ok(v, "new veterinarian not found in roster");
  assert.equal(v.active, true);
});
const WORD_NUMBERS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5 };
Then(/^the clinic roster (?:now|still) has (\w+) veterinarians?$/, async function (word) {
  const n = WORD_NUMBERS[word] ?? Number(word);
  const r = await listVets(this, await adminToken(this));
  assert.equal(r.body.length, n, JSON.stringify(r.body));
});

// ---------------------------------------------------------------------------
// Deactivate / reactivate
// ---------------------------------------------------------------------------
Given(/^(Dr [A-Za-z]+ [A-Za-z]+) is deactivated$/, async function (vet) {
  const r = await patchVet(this, seed.vet(vet).id, { active: false });
  assert.equal(r.status, 200, JSON.stringify(r.body));
});
When(/^the administrator deactivates (Dr [A-Za-z]+ [A-Za-z]+)$/, async function (vet) {
  this.response = await patchVet(this, seed.vet(vet).id, { active: false });
});
When(/^the administrator reactivates (Dr [A-Za-z]+ [A-Za-z]+)$/, async function (vet) {
  this.response = await patchVet(this, seed.vet(vet).id, { active: true });
});
When(/^the veterinarian attempts to deactivate (Dr [A-Za-z]+ [A-Za-z]+)$/, async function (vet) {
  this.response = await patchVet(this, seed.vet(vet).id, { active: false }, this.token);
});
When(/^the customer attempts to deactivate (Dr [A-Za-z]+ [A-Za-z]+)$/, async function (vet) {
  this.response = await patchVet(this, seed.vet(vet).id, { active: false }, this.token);
});
When("the administrator attempts to deactivate an unknown veterinarian", async function () {
  this.response = await patchVet(this, "ffffffff-ffff-4fff-8fff-ffffffffffff", { active: false });
});
Then(/^(Dr [A-Za-z]+ [A-Za-z]+) is (active|inactive)$/, async function (vet, state) {
  assert.equal(await vetStatus(this, vet), state === "active");
});
Then(/^(Dr [A-Za-z]+ [A-Za-z]+) is still (active|inactive)$/, async function (vet, state) {
  assert.equal(await vetStatus(this, vet), state === "active");
});

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------
When("the administrator lists the clinic's veterinarians", async function () {
  this.response = await listVets(this, await adminToken(this));
});
Then(/^the list includes (Dr [A-Za-z]+ [A-Za-z]+) marked (active|inactive)$/, function (vet, state) {
  const v = this.response.body.find((x) => x.id === seed.vet(vet).id);
  assert.ok(v, `${vet} not in list`);
  assert.equal(v.active, state === "active");
});
