import { setWorldConstructor, setDefaultTimeout, Before, After, AfterAll, Given, When, Then } from "@cucumber/cucumber";
import { request } from "@playwright/test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ServiceFixture, jordan, reservationBody } from "../support/service-fixture.js";
import { registration } from "../support/registration.js";
import { PROJECTS, projectUrl } from "../../harness/config.js";
import { validateRequest, validateResponse } from "../../harness/schema.js";
import { stopAll } from "../../harness/processes.js";
import * as seed from "../../harness/seed.js";

class Journey extends ServiceFixture {
  constructor() { super("checkout", { real: true }); this.tokens = new Map(); }
  async clock(now) { await super.clock(now); this.tokens.clear(); }
  async call(method, path, { body, actor = "avery.taylor", service = this.service, token, headers = {}, expected } = {}) {
    if (token === undefined) {
      if (!this.tokens.has(actor)) {
        const login = await this.call("POST", "/auth/login", { service: "customer", token: null,
          body: { username: actor, password: "petclinic-demo" }, expected: 200 });
        this.tokens.set(actor, login.body.token);
      }
      token = this.tokens.get(actor);
    }
    if (body !== undefined) assert.deepEqual(validateRequest(PROJECTS[service].contract, method, path, body).errors, []);
    const response = await this.http.fetch(`${projectUrl(service)}${path}`, { method, data: body,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "idempotency-key": randomUUID(), ...headers } });
    const data = await response.json(), status = response.status();
    if (expected !== undefined) assert.equal(status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
    assert.deepEqual(validateResponse(PROJECTS[service].contract, method, path, status, data).errors, []);
    await response.dispose();
    return { body: data, status };
  }
  async snapshot() {
    return {
      checkout: (await this.call("GET", `/checkouts/${this.checkout.id}`, { expected: 200 })).body,
      account: (await this.call("GET", `/customers/${jordan}/account`, { service: "customer", actor: "jordan.rivera", expected: 200 })).body,
    };
  }
  async payment(amount, card = "fake-card-approve", key = randomUUID()) {
    return this.call("POST", `/checkouts/${this.checkout.id}/payments`, { actor: "jordan.rivera",
      body: { amount, mockMethodReference: card }, headers: { "idempotency-key": key }, expected: 200 });
  }
}
setWorldConstructor(Journey);
setDefaultTimeout(30000);
Before(async function () {
  await this.start(); // asserts all implementations exist before opening ports
  this.http = await request.newContext({ timeout: 10000 });
});
After(async function () { await this.http?.dispose(); });
AfterAll(async function () { await stopAll(); });

Given("Jordan has booked and attended a Wellness visit with a finalized bill", async function () {
  await this.finalized(); assert.equal(this.checkout.remainingBalance, 5000);
});
When("Jordan pays {int} cents by card", async function (amount) {
  this.paymentKey = randomUUID(); this.paymentAmount = amount;
  this.firstPayment = await this.payment(amount, "fake-card-approve", this.paymentKey);
  assert.equal(this.firstPayment.body.attempt.outcome, "authorized");
});
When("Jordan attempts a declined payment of {int} cents", async function (amount) {
  const r = await this.payment(amount, "fake-card-decline"); assert.equal(r.body.attempt.outcome, "declined");
});
When("the assigned veterinarian records {int} cents in cash", async function (amount) {
  const before = (await this.providerCalls()).length;
  const r = await this.call("POST", `/checkouts/${this.checkout.id}/cash-payments`, { body: { amount }, expected: 200 });
  assert.equal(r.body.attempt.outcome, "cash_recorded");
  assert.equal((await this.providerCalls()).length, before);
});
Then("the visit and customer account show {int} cents due and {string}", async function (amount, state) {
  const s = await this.snapshot(); assert.equal(s.checkout.remainingBalance, amount);
  assert.equal(s.account.outstandingBalance, amount);
  const r = await this.call("GET", `/reservations/${this.reservation.id}`, { service: "reservation", expected: 200 });
  assert.equal(r.body.reservationState, state);
});
async function nextAppointment(world, allowed) {
  const r = await world.call("POST", "/reservations", { service: "reservation", actor: "jordan.rivera", expected: 201,
    body: { ...reservationBody(), petId: seed.pet("Luna").id, scheduledStart: "2026-10-13T10:00:00-05:00", scheduledEnd: "2026-10-13T11:00:00-05:00" } });
  assert.equal(r.body.reservationState, allowed ? "Requested" : "Denied");
  if (!allowed) assert.match(r.body.denialReason, /Please pay your full balance/);
}
Then("Jordan can request another appointment for Luna", async function () { await nextAppointment(this, true); });
Then("Jordan cannot request another appointment for Luna", async function () { await nextAppointment(this, false); });
When("Jordan retries the original partial card payment", async function () {
  this.callsBefore = (await this.providerCalls()).length;
  this.replay = await this.payment(this.paymentAmount, "fake-card-approve", this.paymentKey);
});
Then("the original payment is replayed without another provider call", async function () {
  assert.equal(this.replay.body.replayed, true);
  assert.deepEqual(this.replay.body.attempt, this.firstPayment.body.attempt);
  assert.equal((await this.providerCalls()).length, this.callsBefore);
});
When("the assigned veterinarian applies a {int} cent promotion", async function (amount) {
  this.callsBefore = (await this.providerCalls()).length;
  this.promotion = await this.call("POST", `/checkouts/${this.checkout.id}/promotion`, { body: { amount }, expected: 201 });
});
Then("only {int} cents are discounted and the provider is not called again", async function (amount) {
  assert.equal(this.promotion.body.promotion.appliedAmount, amount);
  assert.equal((await this.providerCalls()).length, this.callsBefore);
});
When("the assigned veterinarian corrects the clinical notes and updates the catalog fee", async function () {
  this.beforeCorrection = await this.snapshot();
  const beforeVisit = await this.call("GET", `/visits/${this.visit.id}`, { service: "reservation", expected: 200 });
  const corrected = await this.call("PATCH", `/visits/${this.visit.id}`, { service: "reservation", body: { clinicalNotes: "Corrected examination" }, expected: 200 });
  assert.deepEqual(corrected.body, { ...beforeVisit.body, clinicalNotes: "Corrected examination" });
  const read = await this.call("GET", `/visits/${this.visit.id}`, { service: "reservation", actor: "jordan.rivera", expected: 200 });
  assert.deepEqual(read.body, corrected.body);
  await this.call("PATCH", `/services/${seed.service("Wellness").id}`, { service: "veterinarian-services", body: { feeAmount: 6500 }, expected: 200 });
});
Then("the finalized bill, payments, and customer account remain unchanged", async function () {
  assert.deepEqual(await this.snapshot(), this.beforeCorrection);
});
When("Jordan concurrently attempts two {int} cent card payments", async function (amount) {
  this.callsBefore = (await this.providerCalls()).length;
  this.concurrent = await Promise.all([1, 2].map(() => this.call("POST", `/checkouts/${this.checkout.id}/payments`, {
    actor: "jordan.rivera", body: { amount, mockMethodReference: "fake-card-approve" } })));
});
Then("exactly one payment succeeds and the other is rejected before authorization", async function () {
  assert.deepEqual(this.concurrent.map(r => r.status).sort(), [200, 422]);
  assert.equal(this.concurrent.find(r => r.status === 422).body.code, "invalid_amount");
  assert.equal((await this.providerCalls()).length, this.callsBefore + 1);
});
Given("Jordan has an accepted appointment before its start", async function () {
  await this.request(); this.accepted = (await this.accept()).body;
});
When("Jordan cancels their appointment", async function () {
  this.canceled = (await this.call("POST", `/reservations/${this.reservation.id}/cancel`, { service: "reservation", actor: "jordan.rivera", expected: 200 })).body;
});
Then("the booking payment remains paid and the slot can be booked again", async function () {
  assert.equal(this.canceled.reservationState, "Canceled"); assert.equal(this.canceled.bookingFeePaid, true);
  assert.equal(this.canceled.bookingPaymentId, this.accepted.bookingPaymentId);
  assert.equal((await this.providerCalls()).length, 1);
  await this.request(); await this.accept(); assert.equal((await this.providerCalls()).length, 2);
});
When("Jordan and Sam book different pets with different veterinarians at the same time", async function () {
  await this.request(); const first = this.reservation;
  const second = await this.call("POST", "/reservations", { service: "reservation", actor: "sam.lee", expected: 201,
    body: { ...reservationBody(), customerId: seed.customer("Sam").id, petId: seed.pet("Rex").id, veterinarianId: seed.vet("Morgan Reed").id } });
  this.acceptances = await Promise.all([[first.id, "avery.taylor"], [second.body.id, "morgan.reed"]].map(([id, actor]) =>
    this.call("POST", `/reservations/${id}/accept`, { service: "reservation", actor, expected: 200,
      body: { bookingFee: { method: "card", mockMethodReference: "fake-card-approve" } } })));
});
Then("both reservations are accepted and each booking fee is paid once", async function () {
  for (const r of this.acceptances) { assert.equal(r.body.reservationState, "Accepted"); assert.equal(r.body.bookingFeePaid, true); }
  const calls = await this.providerCalls(); assert.equal(calls.length, 2);
  assert.equal(new Set(calls.map(c => c.request.attemptId)).size, 2);
});
When("Casey self-registers with all information and requests an appointment", async function () {
  this.registration = registration();
  this.customer = (await this.call("POST", "/auth/register", { service: "customer", token: null, body: this.registration, expected: 201 })).body;
  this.newRequest = (await this.call("POST", "/reservations", { service: "reservation", actor: "casey.park", expected: 201,
    body: { ...reservationBody(), customerId: this.customer.id, petId: this.customer.pets[0].id } })).body;
});
Then("the request belongs to Casey and their registered pet", function () {
  assert.equal(this.newRequest.reservationState, "Requested"); assert.equal(this.newRequest.customerId, this.customer.id);
  assert.equal(this.newRequest.petId, this.customer.pets[0].id);
});

// D-48 + ENG-02 REV-016: billing actions follow reassignment.
const vetUser = (first, last) => ({ vet: seed.vet(`${first} ${last}`), username: `${first}.${last}`.toLowerCase() });
Given("Jordan has a finalized Wellness bill for a visit Dr {word} {word} closed without clinical notes", async function (first, last) {
  const { vet, username } = vetUser(first, last);
  await this.request({ veterinarianId: vet.id });
  await this.accept();
  await this.clock("2026-10-12T09:05:00-05:00");
  this.visit = (await this.call("POST", `/reservations/${this.reservation.id}/visit`, { service: "reservation", actor: username,
    body: { performedServices: [seed.service("Wellness").id], diagnoses: [], medications: [] }, expected: 201 })).body;
  assert.equal(this.visit.notesMissing, true);
  this.checkout = (await this.call("POST", `/visits/${this.visit.id}/checkout`, { actor: username, expected: 201 })).body;
  assert.equal(this.checkout.remainingBalance, 5000);
});
When("Dr {word} {word} reassigns the visit to themselves", async function (first, last) {
  const { vet, username } = vetUser(first, last);
  await this.call("PATCH", `/reservations/${this.reservation.id}/veterinarian`, { service: "reservation", actor: username,
    body: { veterinarianId: vet.id }, expected: 200 });
});
When("Dr {word} {word} applies a {int} cent promotion", async function (first, last, amount) {
  const { username } = vetUser(first, last);
  await this.call("POST", `/checkouts/${this.checkout.id}/promotion`, { actor: username, body: { amount }, expected: 201 });
});
When("Dr {word} {word} attempts to record {int} cents in cash", async function (first, last, amount) {
  const { username } = vetUser(first, last);
  this.cashAttempt = await this.call("POST", `/checkouts/${this.checkout.id}/cash-payments`, { actor: username, body: { amount } });
});
Then("the cash payment is refused as {string}", function (code) {
  assert.equal(this.cashAttempt.status, 403);
  assert.equal(this.cashAttempt.body.code, code);
});
