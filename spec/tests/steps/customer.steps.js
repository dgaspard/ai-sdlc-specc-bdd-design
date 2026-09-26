// Steps for spec/features/customer. Black-box over HTTP against the Customer service.
// Internal operations are called with a service-role token, as another service would.
// Protected test.
import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import * as seed from "../../harness/seed.js";
import { cents } from "../../harness/money.js";
import { central } from "../../harness/clinic-time.js";
import { decodeJwt, serviceToken } from "../../harness/auth.js";
import { asDefaultCaller, expectProblem } from "./common.steps.js";

const UNKNOWN_ID = "10000000-0000-4000-8000-999999999999";
const JORDAN = () => seed.customer("Jordan Rivera");
const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

function validProfile(first = "Casey", last = "Park") {
  return {
    firstName: first,
    lastName: last,
    phoneNumber: "312-555-0199",
    address: { street: "5 Elm St", city: "Chicago", state: "IL", postalCode: "60602" },
    emergencyContact: { name: "Robin Park", phone: "312-555-0198", relationship: "sibling" },
    preferredVeterinarianId: seed.vet("Dr Avery Taylor").id,
  };
}
const splitName = (full) => { const [first, ...rest] = full.split(" "); return [first, rest.join(" ") || "Customer"]; };
const customerId = (nameOrId) => (isUuid(nameOrId) ? nameOrId : seed.customer(nameOrId).id);

async function customerCount(world) {
  const saved = world.token;
  world.token = await world.tokenFor("avery.taylor");
  const r = await world.api("GET", "/customers");
  world.token = saved;
  return r.body.length;
}

async function createProfile(world, body) {
  await asDefaultCaller(world);
  world.memo.countBefore = await customerCount(world);
  await world.api("POST", "/customers", { body });
}

// ---------- seeded facts (Given) ----------
Given("customer {string} exists", function (name) {
  this.memo.customer = seed.customer(name);
});
Given("customer {string} owns the pet {string}", function (name, petName) {
  assert.equal(seed.pet(petName).ownerId, seed.customer(name).id);
});
Given("customer {string} owns the pets {string} and {string}", function (name, a, b) {
  const id = seed.customer(name).id;
  assert.equal(seed.pet(a).ownerId, id);
  assert.equal(seed.pet(b).ownerId, id);
  this.memo.customer = seed.customer(name);
});
Given("Jordan owns the pet {string}", function (petName) {
  assert.equal(seed.pet(petName).ownerId, JORDAN().id);
});
Given("customer {string} prefers Dr Avery Taylor", function (name) {
  assert.equal(seed.customer(name).preferredVeterinarianId, seed.vet("Dr Avery Taylor").id);
  this.memo.customer = seed.customer(name);
});
Given("Jordan has no insurance", function () {
  assert.deepEqual(JORDAN().insurance, []);
});

// ---------- profile ----------
When("a customer profile is created for {string} with Dr Avery Taylor as preferred veterinarian", async function (full) {
  await createProfile(this, validProfile(...splitName(full)));
});
When("a customer profile is created for {string} without a preferred veterinarian", async function (full) {
  const { preferredVeterinarianId, ...body } = validProfile(...splitName(full));
  await createProfile(this, body);
});
When("a customer profile is created for {string} with an unknown veterinarian ID", async function (full) {
  await createProfile(this, { ...validProfile(...splitName(full)), preferredVeterinarianId: UNKNOWN_ID });
});
When("a customer profile is created without {string}", async function (field) {
  const body = validProfile();
  delete body[field];
  await createProfile(this, body);
});
When("a customer profile is created with no insurance and no secondary contact", async function () {
  await createProfile(this, validProfile());
});
When("a customer profile is created with state {string}", async function (state) {
  const body = validProfile();
  body.address = { ...body.address, state };
  await createProfile(this, body);
});
When("a customer profile is created with state {string} and postal code {string}", async function (state, postalCode) {
  const body = validProfile();
  body.address = { ...body.address, state, postalCode };
  await createProfile(this, body);
});
When("Jordan's preferred veterinarian is changed to Dr Morgan Reed", async function () {
  await asDefaultCaller(this);
  await this.api("PATCH", `/customers/${JORDAN().id}`, { body: { preferredVeterinarianId: seed.vet("Dr Morgan Reed").id } });
  assert.equal(this.response.status, 200);
});
When("a profile update includes an outstanding balance", async function () {
  await asDefaultCaller(this);
  await this.api("PATCH", `/customers/${this.memo.customer.id}`, { body: { outstandingBalance: 0 } });
});
When("customer profile {string} is requested", async function (nameOrId) {
  await asDefaultCaller(this);
  this.memo.requestedId = customerId(nameOrId);
  await this.api("GET", `/customers/${this.memo.requestedId}`);
});
When("customer profile {string} is requested without logging in", async function (nameOrId) {
  await this.api("GET", `/customers/${customerId(nameOrId)}`, { token: null });
});

Then("the profile is saved with a new customer ID", function () {
  assert.equal(this.response.status, 201);
  assert.ok(isUuid(this.response.body.id));
  assert.ok(!seed.customers.some((c) => c.id === this.response.body.id), "id must be new");
});
Then("the profile is saved", function () {
  assert.equal(this.response.status, 201, JSON.stringify(this.response.body));
});
Then("the first name is {string} and the last name is {string}", function (first, last) {
  assert.equal(this.response.body.firstName, first);
  assert.equal(this.response.body.lastName, last);
});
Then("the preferred veterinarian is Dr Avery Taylor", function () {
  assert.equal(this.response.body.preferredVeterinarianId, seed.vet("Dr Avery Taylor").id);
});
Then("the preferred veterinarian is Dr Morgan Reed", function () {
  assert.equal(this.response.body.preferredVeterinarianId, seed.vet("Dr Morgan Reed").id);
});
Then("the customer has no pets", function () {
  assert.deepEqual(this.response.body.pets, []);
});
Then("the customer's outstanding balance is {string}", function (amount) {
  assert.equal(this.response.body.outstandingBalance, cents(amount));
});
Then("the insurance collection is empty", function () {
  assert.deepEqual(this.response.body.insurance, []);
});
Then("the profile is rejected as invalid", function () {
  expectProblem(this, "validation_error", 400);
});
Then("the update is rejected as invalid", function () {
  expectProblem(this, "validation_error", 400);
});
Then("no customer is saved", async function () {
  const failed = this.response;
  assert.equal(await customerCount(this), this.memo.countBefore);
  this.response = failed;
});
Then("the customer is reported as not found", function () {
  expectProblem(this, "not_found", 404);
});
Then("the profile is returned", function () {
  assert.equal(this.response.status, 200);
  assert.equal(this.response.body.id, this.memo.requestedId);
});
Then("the request is refused as unauthenticated", function () {
  expectProblem(this, "unauthenticated", 401);
});
Then("the request is refused as forbidden", function () {
  expectProblem(this, "forbidden", 403);
});

// ---------- pets ----------
const petBody = (over = {}) => ({ name: "Pepper", type: "cat", breed: "Unknown", estimatedBirthDate: "2023-01-01", ...over });
async function addPet(world, body) {
  await world.actAs("jordan.rivera");
  await world.api("POST", `/customers/${JORDAN().id}/pets`, { body });
  if (world.response.status === 201) world.memo.pet = world.response.body;
}
When("Jordan adds a pet {string}, a {string} of breed {string} born about {string}", async function (name, type, breed, date) {
  await addPet(this, petBody({ name, type, breed, estimatedBirthDate: date }));
});
When("Jordan adds a pet {string}", async function (name) {
  await addPet(this, petBody({ name }));
});
When("Jordan adds a pet {string} born about {string}", async function (name, date) {
  await addPet(this, petBody({ name, estimatedBirthDate: date }));
});
When("Jordan adds a pet without {string}", async function (field) {
  const body = petBody();
  delete body[field];
  await addPet(this, body);
});
Then("the pet is saved with a new pet ID", function () {
  assert.equal(this.response.status, 201);
  assert.ok(isUuid(this.response.body.id));
  assert.ok(!seed.pets.some((p) => p.id === this.response.body.id), "id must be new");
});
Then("the pet is saved", function () {
  assert.equal(this.response.status, 201, JSON.stringify(this.response.body));
});
Then("the pet is rejected as invalid", function () {
  expectProblem(this, "validation_error", 400);
});
Then("Milo's owner is Jordan", function () {
  assert.equal(this.memo.pet.name, "Milo");
  assert.equal(this.memo.pet.ownerId, JORDAN().id);
});
Then("Jordan's pets include Milo", async function () {
  const r = await this.api("GET", `/customers/${JORDAN().id}/pets`);
  assert.ok(r.body.some((p) => p.id === this.memo.pet.id && p.name === "Milo"));
});
Then("Jordan's pets are {string} and {string}", async function (a, b) {
  const r = await this.api("GET", `/customers/${JORDAN().id}/pets`);
  assert.deepEqual([...new Set(r.body.map((p) => p.name))].sort(), [a, b].sort());
});

// ---------- ownership (internal, called by Reservation) ----------
async function ownership(world, petName) {
  const token = serviceToken("reservation", { clinicNow: world.clinicNow });
  await world.api("GET", `/internal/customers/${JORDAN().id}/pets/${seed.pet(petName).id}/ownership`, { token });
}
When("ownership of Milo by Jordan is checked", async function () { await ownership(this, "Milo"); });
When("ownership of Rex by Jordan is checked", async function () { await ownership(this, "Rex"); });
Then("ownership is confirmed", function () {
  assert.equal(this.response.status, 200);
  assert.equal(this.response.body.owned, true);
});
Then("ownership is refused", function () {
  assert.equal(this.response.status, 200);
  assert.equal(this.response.body.owned, false);
});

// ---------- account (internal changes, called by Checkout) ----------
const visitOf = (world, petName) => {
  world.memo.visits ??= {};
  world.memo.visits[petName] ??= crypto.randomUUID();
  return world.memo.visits[petName];
};
const paymentOf = (world, label) => {
  world.memo.payments ??= {};
  world.memo.payments[label] ??= crypto.randomUUID();
  return world.memo.payments[label];
};
async function change(world, petName, type, amount, paymentId) {
  const token = serviceToken("checkout", { clinicNow: world.clinicNow });
  const body = { visitId: visitOf(world, petName), type, amount, currency: "USD", ...(paymentId ? { paymentId } : {}) };
  await world.api("POST", `/internal/customers/${JORDAN().id}/account-changes`, { body, token });
  return world.response;
}
async function account(world) {
  const saved = world.response;
  const token = await world.tokenFor("avery.taylor");
  const r = await world.api("GET", `/customers/${JORDAN().id}/account`, { token });
  world.memo.lastAction = saved;
  return r.body;
}
const entryFor = (acct, world, petName) => acct.entries.find((e) => e.visitId === visitOf(world, petName));
const balanceOf = (e) => e.amountOwed - e.amountCredited - e.amountDiscounted;
const expectOk = (r) => assert.equal(r.status, 200, JSON.stringify(r.body));

When("a charge of {string} is recorded for Milo's visit", async function (amount) {
  expectOk(await change(this, "Milo", "charge", cents(amount)));
});
Given("Milo's visit entry owes {string}", async function (amount) {
  expectOk(await change(this, "Milo", "charge", cents(amount)));
});
Given("Milo's visit entry owes {string} with {string} credited", async function (owed, credited) {
  expectOk(await change(this, "Milo", "charge", cents(owed)));
  expectOk(await change(this, "Milo", "credit", cents(credited), paymentOf(this, "setup-credit")));
});
Given("Milo's visit entry has a {string} discount", async function (amount) {
  expectOk(await change(this, "Milo", "charge", cents("$70.00")));
  expectOk(await change(this, "Milo", "discount", cents(amount)));
});
Given("a credit of {string} from payment {string} was applied to Milo's visit", async function (amount, label) {
  expectOk(await change(this, "Milo", "credit", cents(amount), paymentOf(this, label)));
});
When("a credit of {string} from payment {string} is applied to Milo's visit", async function (amount, label) {
  this.memo.lastCredit = { amount: cents(amount), label };
  await change(this, "Milo", "credit", cents(amount), paymentOf(this, label));
});
When("the same credit from payment {string} is applied again", async function (label) {
  await change(this, "Milo", "credit", cents("$20.00"), paymentOf(this, label));
});
When("a credit of {string} is applied to Milo's visit", async function (amount) {
  await change(this, "Milo", "credit", cents(amount), crypto.randomUUID());
});
When("a discount of {string} is applied to Milo's visit", async function (amount) {
  await change(this, "Milo", "discount", cents(amount));
});
When("another discount is applied to Milo's visit", async function () {
  await change(this, "Milo", "discount", cents("$5.00"));
});
Then("the change is reported as already applied", function () {
  expectProblem(this, "already_applied", 409);
});
Then("the change is rejected as an invalid amount", function () {
  expectProblem(this, "invalid_amount", 422);
});

// Used both to set up ("Given ... is $35.00": creates the charge when Milo has no entry
// yet) and to check ("Then ... is $50.00": asserts the entry's balance).
for (const petName of ["Milo", "Luna"]) {
  Given(`${petName}'s visit balance is {string}`, async function (amount) {
    const acct = await account(this);
    const entry = entryFor(acct, this, petName);
    if (!entry) {
      expectOk(await change(this, petName, "charge", cents(amount)));
      return;
    }
    assert.equal(balanceOf(entry), cents(amount));
  });
}
Then("Jordan has an account entry for Milo's visit owing {string}", async function (amount) {
  const e = entryFor(await account(this), this, "Milo");
  assert.ok(e, "no entry for Milo's visit");
  assert.equal(e.amountOwed, cents(amount));
  assert.equal(e.customerId, JORDAN().id);
  assert.equal(e.currency, "USD");
});
Then("the entry shows {string} discounted", async function (amount) {
  assert.equal(entryFor(await account(this), this, "Milo").amountDiscounted, cents(amount));
});
When("Jordan's account is viewed", async function () {
  this.memo.account = await account(this);
});
Then("Jordan's outstanding balance is {string}", async function (amount) {
  const acct = await account(this);
  assert.equal(acct.outstandingBalance, cents(amount));
  assert.equal(acct.outstandingBalance, acct.entries.reduce((s, e) => s + balanceOf(e), 0), "balance must equal the sum of entries");
});

// ---------- eligibility ----------
When("Jordan's booking eligibility is checked", async function () {
  await asDefaultCaller(this);
  await this.api("GET", `/customers/${JORDAN().id}/eligibility`);
});
When("booking eligibility is checked for an unknown customer", async function () {
  await asDefaultCaller(this);
  await this.api("GET", `/customers/${UNKNOWN_ID}/eligibility`);
});
Then("Jordan is eligible", function () {
  assert.equal(this.response.status, 200);
  assert.equal(this.response.body.eligible, true);
});
Then("Jordan is ineligible", function () {
  assert.equal(this.response.status, 200);
  assert.equal(this.response.body.eligible, false);
});
Then("the reported outstanding balance is {string}", function (amount) {
  assert.equal(this.response.body.outstandingBalance, cents(amount));
});

// ---------- login ----------
When("{string} logs in with password {string}", async function (username, password) {
  const r = await this.api("POST", "/auth/login", { body: { username, password }, token: null });
  (this.memo.logins ??= []).push(r);
});
Then("the login succeeds with role {string}", function (role) {
  const r = this.memo.logins.at(-1);
  assert.equal(r.status, 200);
  assert.equal(r.body.user.role, role);
  assert.equal(decodeJwt(r.body.token).claims.role, role);
  assert.ok(decodeJwt(r.body.token).signatureValid, "token must be signed with AUTH_TOKEN_SECRET");
});
Then("the token identifies {string}", function (displayName) {
  const r = this.memo.logins.at(-1);
  const u = seed.userFor(displayName);
  const { claims } = decodeJwt(r.body.token);
  assert.equal(claims.sub, u.id);
  assert.equal(r.body.user.displayName, u.displayName);
  if (u.role === "customer") assert.equal(claims.customerId, u.customerId);
  else assert.equal(claims.veterinarianId, u.veterinarianId);
});
Then("the response does not include the password", function () {
  assert.equal(JSON.stringify(this.memo.logins.at(-1).body).includes("petclinic-demo"), false);
});
Then("both logins are refused with the same response", function () {
  const [a, b] = this.memo.logins.slice(-2);
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.equal(a.body.code, "unauthenticated");
  assert.deepEqual(a.body, b.body);
});
Then("the token expires at {string} Central Time", function (local) {
  const { claims } = decodeJwt(this.memo.logins.at(-1).body.token);
  assert.equal(claims.exp, Date.parse(central(local)) / 1000);
});
