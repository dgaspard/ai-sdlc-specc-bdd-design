// Steps for spec/features/checkout. Checkout runs for real; Customer, Reservation, and
// VeterinarianServices are contract-validated stubs; the fake payment provider is real,
// so its call log proves whether a card was actually charged. Protected test.
import { Before, Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import * as seed from "../../harness/seed.js";
import { cents } from "../../harness/money.js";
import { projectUrl } from "../../harness/config.js";
import { decodeJwt, serviceToken } from "../../harness/auth.js";
import { expectProblem } from "./common.steps.js";

const JORDAN = () => seed.customer("Jordan Rivera");
const APPROVE = "fake-card-approve";
const DECLINE = "fake-card-decline";

// ---------------------------------------------------------------------------
// Scenario model and stubs
// ---------------------------------------------------------------------------
const labelId = (world, label) => {
  world.memo.labels ??= {};
  world.memo.labels[label] ??= crypto.randomUUID();
  return world.memo.labels[label];
};

Before({ tags: "@service:checkout" }, function () {
  if (!this.stubs.reservation || !this.stubs.customer || !this.stubs["veterinarian-services"]) return;
  const world = this;
  const reservationId = crypto.randomUUID();
  const visitId = crypto.randomUUID();
  this.memo.card = APPROVE;
  this.memo.prices = Object.fromEntries(seed.services.map((s) => [s.id, s.feeAmount]));
  this.memo.unknownService = false;
  this.memo.failComplete = false;
  this.memo.ledger = {};
  this.memo.reservation = {
    id: reservationId, customerId: JORDAN().id, petId: seed.pet("Milo").id, veterinarianId: seed.vet("Dr Avery Taylor").id,
    scheduledStart: "2026-10-12T09:00:00-05:00", scheduledEnd: "2026-10-12T10:00:00-05:00",
    requestedServices: [seed.service("Wellness").id], requestedAt: "2026-10-05T09:00:00-05:00",
    acceptedAt: "2026-10-05T09:30:00-05:00", bookingFeeAmount: 2000, bookingFeePaid: true,
    bookingPaymentId: labelId(this, "pay-1"), reservationState: "Accepted", visitId, denialReason: null,
  };
  this.memo.visit = {
    id: visitId, reservationId, customerId: JORDAN().id, petId: seed.pet("Milo").id,
    veterinarianId: seed.vet("Dr Avery Taylor").id, performedServices: [seed.service("Wellness").id],
    clinicalNotes: "Routine examination", diagnoses: [], medications: [], startedAt: "2026-10-12T09:05:00-05:00",
    notesMissing: false, // MVP-02A (D-46, D-50): now a required VisitRead field.
  };

  // Reservation: visit and reservation reads, completion writes.
  this.stubs.reservation.respond("GET", "/visits/{visitId}", 200, () => world.memo.visit);
  this.stubs.reservation.respond("GET", "/reservations/{reservationId}", 200, () => world.memo.reservation);
  this.stubs.reservation.respond("POST", "/internal/reservations/{reservationId}/complete", 200, (req) => {
    world.memo.reservation = {
      ...world.memo.reservation,
      reservationState: req.body.financialOutcome === "settled" ? "CompletedSettled" : "CompletedOutstanding",
    };
    return world.memo.reservation;
  });
  // Used by "Reservation will fail to complete the reservation": a documented refusal.
  this.memo.completeFailure = { type: "about:blank", title: "Completion failed", status: 409, code: "invalid_state" };

  // Customer: a small ledger so answers stay consistent with what Checkout sent.
  this.stubs.customer.respond("POST", "/internal/customers/{customerId}/account-changes", 200, (req) => {
    const b = req.body;
    const e = world.memo.ledger[b.visitId] ??= {
      id: crypto.randomUUID(), customerId: req.path.split("/")[3], visitId: b.visitId,
      amountOwed: 0, amountCredited: 0, amountDiscounted: 0, currency: "USD", paymentIds: [],
    };
    if (b.type === "charge") e.amountOwed = b.amount;
    if (b.type === "credit") { e.amountCredited += b.amount; e.paymentIds.push(b.paymentId); }
    if (b.type === "discount") e.amountDiscounted += b.amount;
    return { ...e, paymentIds: [...e.paymentIds] };
  });

  // VeterinarianServices: fees from this.memo.prices; optionally reports an unknown id.
  const fees = (ids) => ids.map((id) => {
    const s = seed.services.find((x) => x.id === id);
    return { id, name: s.name, feeAmount: world.memo.prices[id], currency: "USD" };
  });
  this.stubs["veterinarian-services"].respond("GET", "/fees", 200, (req) => {
    const ids = new URL(req.url, "http://x").searchParams.get("serviceIds").split(",");
    return { fees: fees(ids) };
  });
  this.stubs["veterinarian-services"].respond("GET", "/services/{serviceId}", 200, (req) => fees([req.path.split("/")[2]])[0]);
});

/** Routes that should refuse instead of answering normally (set by specific Givens). */
function failComplete(world) {
  world.stubs.reservation.respond("POST", "/internal/reservations/{reservationId}/complete", 409, world.memo.completeFailure);
}
// ENG-02 REV-001: Customer refuses to record the credit/discount. Used to prove Checkout's
// own bill record does not optimistically reflect a payment/promotion the system of record
// never actually confirmed.
function failAccountChanges(world) {
  // 409/invalid_state is a status this internal contract actually documents (unlike 502,
  // which the stub harness would reject as undeclared); pay()'s catch block reports any
  // failure here as authorized_completion_failed regardless of the underlying status/code.
  world.stubs.customer.respond("POST", "/internal/customers/{customerId}/account-changes", 409, {
    type: "about:blank", title: "Account change failed", status: 409, code: "invalid_state",
  });
}
function unknownFees(world) {
  world.stubs["veterinarian-services"].respond("GET", "/fees", 422, (req) => {
    const ids = new URL(req.url, "http://x").searchParams.get("serviceIds").split(",");
    return { type: "about:blank", title: "Unknown service", status: 422, code: "unknown_service", unknownServiceIds: ids.slice(-1) };
  });
  world.stubs["veterinarian-services"].respond("GET", "/services/{serviceId}", 404,
    { type: "about:blank", title: "Not found", status: 404, code: "not_found" });
}

// ---------------------------------------------------------------------------
// Observations
// ---------------------------------------------------------------------------
async function providerCalls() {
  const r = await fetch(`${projectUrl("payment")}/test/calls`);
  return (await r.json()).calls;
}
const accountChanges = (world, type) => world.stubs.customer.received("POST", "/internal/customers/{customerId}/account-changes")
  .filter((r) => r.body?.visitId === world.memo.visit.id && (!type || r.body.type === type));
const completions = (world) => world.stubs.reservation.received("POST", "/internal/reservations/{reservationId}/complete");
const bookingCredit = (world) => labelId(world, "pay-1");

function assertCheckoutServiceCall(call) {
  const auth = call.headers.authorization ?? "";
  assert.match(auth, /^Bearer /, "internal call without a bearer token");
  const { claims, signatureValid } = decodeJwt(auth.slice(7));
  assert.ok(signatureValid, "service token not signed with AUTH_TOKEN_SECRET");
  assert.equal(claims.role, "service");
  assert.equal(claims.sub, "checkout");
}

async function checkout(world) {
  const saved = world.response;
  const r = await world.api("GET", `/checkouts/${world.memo.checkout.id}`, { token: await world.tokenFor("avery.taylor") });
  world.response = saved;
  assert.equal(r.status, 200);
  return r.body;
}

// ---------------------------------------------------------------------------
// Calls into Checkout
// ---------------------------------------------------------------------------
async function finalize(world, vet = "avery.taylor") {
  const token = await world.tokenFor(vet);
  const r = await world.api("POST", `/visits/${world.memo.visit.id}/checkout`, { token });
  if (r.status === 201) world.memo.checkout = r.body;
  return r;
}
async function pay(world, { card = world.memo.card, key = crypto.randomUUID(), amount } = {}) {
  world.memo.callsBefore = (await providerCalls()).length;
  const token = await world.tokenFor("jordan.rivera");
  const body = { amount: amount ?? world.memo.checkout.remainingBalance, mockMethodReference: card };
  const r = await world.api("POST", `/checkouts/${world.memo.checkout.id}/payments`, { body, token, headers: { "idempotency-key": key } });
  if (r.status === 200) world.memo.lastAttempt = r.body.attempt;
  (world.memo.results ??= []).push(r);
  return r;
}
async function payCash(world, { key = crypto.randomUUID(), amount } = {}, vet = "avery.taylor") {
  world.memo.callsBefore = (await providerCalls()).length;
  const token = await world.tokenFor(vet);
  const body = { amount: amount ?? world.memo.checkout.remainingBalance };
  const r = await world.api("POST", `/checkouts/${world.memo.checkout.id}/cash-payments`, { body, token, headers: { "idempotency-key": key } });
  if (r.status === 200) world.memo.lastAttempt = r.body.attempt;
  (world.memo.results ??= []).push(r);
  return r;
}
async function bookingFee(world, { method = "card", card = world.memo.card, key = crypto.randomUUID() } = {}) {
  world.memo.callsBefore = (await providerCalls()).length;
  const body = {
    reservationId: world.memo.reservation.id, customerId: JORDAN().id, amount: 2000, currency: "USD", method,
    ...(method === "card" ? { mockMethodReference: card } : { recordedByVeterinarianId: seed.vet("Dr Avery Taylor").id }),
  };
  const r = await world.api("POST", "/internal/booking-fees", {
    body, token: serviceToken("reservation", { clinicNow: world.clinicNow }), headers: { "idempotency-key": key },
  });
  if (r.status === 200) world.memo.lastAttempt = r.body.attempt;
  (world.memo.results ??= []).push(r);
  return r;
}
const expect200 = (r) => assert.equal(r.status, 200, JSON.stringify(r.body));

// ---------------------------------------------------------------------------
// Background and card behavior
// ---------------------------------------------------------------------------
Given("Jordan has a Requested reservation for Milo with Dr Avery Taylor", function () {
  this.memo.reservation = { ...this.memo.reservation, reservationState: "Requested", bookingFeePaid: false, bookingPaymentId: null, acceptedAt: null, visitId: null };
});
Given("Milo's finalized Wellness checkout has a remaining balance of {string}", async function (amount) {
  const r = await finalize(this);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.remainingBalance, cents(amount));
});
Given(/^the visit was performed by (Dr [A-Za-z]+ [A-Za-z]+)$/, function (vet) {
  assert.equal(this.memo.visit.veterinarianId, seed.vet(vet).id);
});
// MVP-02A (D-41 admin-bypass scenarios): reassigns the Background's visit so the
// bypass is actually exercised rather than coinciding with the default assignment.
Given(/^the visit was performed by (Dr [A-Za-z]+ [A-Za-z]+) instead$/, function (vet) {
  this.memo.visit.veterinarianId = seed.vet(vet).id;
  this.memo.reservation.veterinarianId = seed.vet(vet).id;
});
// The mock method token decides the provider's answer; "a different card" is a new token.
Given(/^the fake payment provider will (authorize|decline) (the|a different) card$/, function (outcome, which) {
  this.memo.card = `${outcome === "authorize" ? APPROVE : DECLINE}${which === "a different" ? "-2" : ""}`;
});
Given(/^Milo's visit was performed by (Dr [A-Za-z]+ [A-Za-z]+)$/, function (vet) {
  this.memo.visit.veterinarianId = seed.vet(vet).id;
  this.memo.reservation.veterinarianId = seed.vet(vet).id;
});

// ---------------------------------------------------------------------------
// Booking fee (internal, called by Reservation)
// ---------------------------------------------------------------------------
When("Reservation asks Checkout to collect the booking fee by card with a new attempt key", async function () {
  await bookingFee(this);
});
When("Reservation asks Checkout to record a {string} cash booking fee from Dr Avery Taylor", async function (amount) {
  assert.equal(cents(amount), 2000);
  await bookingFee(this, { method: "cash" });
});
Given("the booking fee was collected with attempt key {string}", async function (label) {
  expect200(await bookingFee(this, { key: labelId(this, label) }));
});
When("the same request is sent again with attempt key {string}", async function (label) {
  await bookingFee(this, { key: labelId(this, label) });
});
Given("the booking fee for the reservation has been paid", async function () {
  const r = await bookingFee(this, { card: APPROVE });
  expect200(r);
  assert.equal(r.body.paid, true);
  this.memo.firstPaymentId = r.body.paymentId;
});
When("Reservation asks Checkout to collect the booking fee with a new attempt key", async function () {
  await bookingFee(this);
});
Given("the booking fee was declined with attempt key {string}", async function (label) {
  expect200(await bookingFee(this, { card: DECLINE, key: labelId(this, label) }));
});
When("Reservation asks Checkout to collect the booking fee with a different card and attempt key {string}", async function (label) {
  await bookingFee(this, { key: labelId(this, label) });
});
Then("Checkout returns the payment ID as paid", function () {
  expect200(this.response);
  assert.equal(this.response.body.paid, true);
  assert.equal(this.response.body.paymentId, this.response.body.attempt.attemptId);
});
Then("Checkout returns the result as declined", function () {
  expect200(this.response);
  assert.equal(this.response.body.paid, false);
  assert.equal(this.response.body.paymentId, undefined);
});
Then("the declined attempt has no authorization reference", function () {
  assert.equal(this.memo.lastAttempt.authorizationReference, undefined);
});
Then("the same payment ID and result are returned", function () {
  const [a, b] = this.memo.results.slice(-2).map((r) => r.body);
  assert.equal(b.paymentId, a.paymentId);
  assert.deepEqual(b.attempt, a.attempt);
  assert.equal(b.replayed, true);
});
Then("the original paid payment ID is returned", function () {
  expect200(this.response);
  assert.equal(this.response.body.paymentId, this.memo.firstPaymentId);
});
Then("the reservation has two booking fee attempts: {string} then {string}", function (first, second) {
  const [a, b] = this.memo.results.slice(-2).map((r) => r.body.attempt);
  assert.deepEqual([a.outcome, b.outcome], [first, second]);
  assert.notEqual(a.attemptId, b.attemptId);
  assert.equal(a.reservationId, b.reservationId);
});

// Shared by booking-fee and visit-payment scenarios.
Then("a payment attempt is recorded as {string} for {string}", function (outcome, amount) {
  assert.equal(this.memo.lastAttempt.outcome, outcome);
  assert.equal(this.memo.lastAttempt.amount, cents(amount));
});
Then("a payment attempt is recorded as {string}", async function (outcome) {
  assert.equal(this.memo.lastAttempt.outcome, outcome);
  if (this.memo.checkout && this.memo.lastAttempt.purpose === "visit_balance") {
    assert.ok((await checkout(this)).paymentAttempts.some((a) => a.attemptId === this.memo.lastAttempt.attemptId && a.outcome === outcome));
  }
});
Then("a payment attempt is recorded as {string} by Dr Avery Taylor", function (outcome) {
  assert.equal(this.memo.lastAttempt.outcome, outcome);
  assert.equal(this.memo.lastAttempt.recordedByVeterinarianId, seed.vet("Dr Avery Taylor").id);
  assert.equal(this.memo.lastAttempt.authorizationReference, undefined);
});
Then("the fake payment provider is asked to authorize {string} for purpose {string}", async function (amount, purpose) {
  const calls = await providerCalls();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].request.amount, cents(amount));
  assert.equal(calls[0].request.currency, "USD");
  assert.equal(calls[0].request.purpose, purpose);
  assert.equal(calls[0].request.attemptId, this.memo.lastAttempt.attemptId, "provider attempt id matches the recorded attempt");
});
// Compared with the count taken when the scenario's last request to Checkout started.
Then("the fake payment provider is not called", async function () {
  assert.equal((await providerCalls()).length, this.memo.callsBefore ?? 0);
});
Then("the fake payment provider was called only once", async function () {
  assert.equal((await providerCalls()).length, 1);
});
Then("the fake payment provider receives no additional request", async function () {
  assert.equal((await providerCalls()).length, this.memo.callsBefore);
});

// ---------------------------------------------------------------------------
// Bill finalization
// ---------------------------------------------------------------------------
Given("the linked reservation for billing is not Accepted", function () {
  this.memo.reservation.reservationState = "CompletedOutstanding";
});
Given("the linked reservation for billing is linked to a different visit", function () {
  this.memo.reservation.visitId = crypto.randomUUID();
});
Given("Jordan's reservation for Milo has booking payment {string} of {string}", function (label, amount) {
  assert.equal(this.memo.reservation.bookingPaymentId, labelId(this, label));
  assert.equal(this.memo.reservation.bookingFeeAmount, cents(amount));
});
Given("VeterinarianServices prices {string} at {string} and {string} at {string}", function (a, pa, b, pb) {
  this.memo.prices[seed.service(a).id] = cents(pa);
  this.memo.prices[seed.service(b).id] = cents(pb);
});
Given("Milo's visit performed {string}", function (s) {
  this.memo.visit.performedServices = [seed.service(s).id];
});
Given("Milo's visit performed {string} and {string}", function (a, b) {
  this.memo.visit.performedServices = [seed.service(a).id, seed.service(b).id];
});
Given("Milo's visit performed only {string}", function (s) {
  this.memo.visit.performedServices = [seed.service(s).id];
});
Given("Milo's reservation requested {string}", function (s) {
  this.memo.reservation.requestedServices = [seed.service(s).id];
});
Given("the bill for Milo's visit has been finalized", async function () {
  const r = await finalize(this);
  assert.equal(r.status, 201, JSON.stringify(r.body));
});
Given("VeterinarianServices reports a performed service as unknown", function () {
  unknownFees(this);
});
When(/^(Dr [A-Za-z]+ [A-Za-z]+) finalizes the bill for Milo's visit(?: again)?$/, async function (vet) {
  await finalize(this, seed.userFor(vet).username);
});
When("VeterinarianServices later prices {string} at {string}", function (s, amount) {
  this.memo.prices[seed.service(s).id] = cents(amount);
});
Then("Checkout asks VeterinarianServices for the fee of {string}", function (s) {
  const id = seed.service(s).id;
  const asked = this.stubs["veterinarian-services"].requests.some((r) => r.url.includes(id));
  assert.ok(asked, "no fee lookup for the performed service");
});
Then("a checkout is saved with one billed line {string} at {string}", function (s, amount) {
  assert.equal(this.response.status, 201, JSON.stringify(this.response.body));
  assert.deepEqual(this.response.body.billedLines, [{ serviceId: seed.service(s).id, description: s, priceAmount: cents(amount) }]);
});
Then("the total is {string}, previously paid is {string}, and remaining is {string}", function (total, paid, remaining) {
  const b = this.memo.checkout;
  assert.equal(b.totalAmount, cents(total));
  assert.equal(b.previouslyPaidAmount, cents(paid));
  assert.equal(b.remainingBalance, cents(remaining));
  assert.equal(b.currency, "USD");
});
Then("the checkout has billed lines {string} at {string} and {string} at {string}", function (a, pa, b, pb) {
  const lines = [...this.memo.checkout.billedLines].sort((x, y) => x.description.localeCompare(y.description));
  const expected = [{ serviceId: seed.service(a).id, description: a, priceAmount: cents(pa) },
    { serviceId: seed.service(b).id, description: b, priceAmount: cents(pb) }].sort((x, y) => x.description.localeCompare(y.description));
  assert.deepEqual(lines, expected);
});
Then("the checkout has one billed line {string}", function (s) {
  assert.deepEqual(this.memo.checkout.billedLines.map((l) => l.serviceId), [seed.service(s).id]);
});
Then("the checkout still bills {string} at {string}", async function (s, amount) {
  const line = (await checkout(this)).billedLines.find((l) => l.serviceId === seed.service(s).id);
  assert.equal(line.priceAmount, cents(amount));
});
Then("the request is reported as already finalized", function () {
  expectProblem(this, "already_finalized", 409);
});
Then("no checkout is saved", async function () {
  const failed = this.response;
  const r = await this.api("GET", `/visits/${this.memo.visit.id}/checkout`, { token: await this.tokenFor("avery.taylor") });
  assert.equal(r.status, 404);
  this.response = failed;
});
Then("Customer receives no charge", function () {
  assert.equal(accountChanges(this, "charge").length, 0);
});
Then("Customer receives no additional charge", function () {
  assert.equal(accountChanges(this, "charge").length, 1);
});
Then("Checkout sends Customer a charge of {string} for Milo's visit", function (amount) {
  const charges = accountChanges(this, "charge");
  assert.equal(charges.length, 1);
  assert.equal(charges[0].path.split("/")[3], JORDAN().id);
  assert.deepEqual(charges[0].body, { visitId: this.memo.visit.id, type: "charge", amount: cents(amount), currency: "USD" });
  assertCheckoutServiceCall(charges[0]);
});
Then("Checkout sends Customer a credit of {string} from payment {string} for Milo's visit", function (amount, label) {
  const credits = accountChanges(this, "credit").filter((c) => c.body.paymentId === labelId(this, label));
  assert.equal(credits.length, 1);
  assert.equal(credits[0].body.amount, cents(amount));
  assertCheckoutServiceCall(credits[0]);
});

// ---------------------------------------------------------------------------
// Promotion
// ---------------------------------------------------------------------------
async function promote(world, body, vet = "avery.taylor") {
  const r = await world.api("POST", `/checkouts/${world.memo.checkout.id}/promotion`, { body, token: await world.tokenFor(vet) });
  return r;
}
When(/^(Dr [A-Za-z]+ [A-Za-z]+) applies an? "([^"]+)" promotion$/, async function (vet, amount) {
  await promote(this, { amount: cents(amount) }, seed.userFor(vet).username);
});
When("Dr Avery Taylor applies a promotion without entering an amount", async function () {
  await promote(this, {});
});
Given("Dr Avery Taylor has applied a {string} promotion", async function (amount) {
  const r = await promote(this, { amount: cents(amount) });
  assert.equal(r.status, 201, JSON.stringify(r.body));
});
// MVP-02A (D-41, D-44): "the administrator" is Dr Avery Taylor's account acting
// on its administrator role (checkout has no admin-only scenario).
When("the administrator applies a {string} promotion", async function (amount) {
  await promote(this, { amount: cents(amount) });
});
Then("the promotion is saved with amount {string} and applied amount {string}", function (amount, applied) {
  assert.equal(this.response.status, 201, JSON.stringify(this.response.body));
  const p = this.response.body.promotion;
  assert.equal(p.amount, cents(amount));
  assert.equal(p.appliedAmount, cents(applied));
  assert.equal(p.appliedByVeterinarianId, seed.vet("Dr Avery Taylor").id);
  assert.equal(p.visitId, this.memo.visit.id);
});
Then("the remaining balance is {string}", async function (amount) {
  assert.equal((await checkout(this)).remainingBalance, cents(amount));
});
Then("Checkout sends Customer a discount of {string} for Milo's visit", function (amount) {
  const d = accountChanges(this, "discount");
  assert.equal(d.length, 1);
  assert.equal(d[0].body.amount, cents(amount));
  assertCheckoutServiceCall(d[0]);
});
Then("Reservation is not asked to complete the reservation", function () {
  assert.equal(completions(this).length, 0);
});
/** Methods the contract does not define must be refused without changing anything. */
async function undefinedMethod(world, method, body) {
  const res = await fetch(`${projectUrl("checkout")}/checkouts/${world.memo.checkout.id}/promotion`, {
    method,
    headers: { authorization: `Bearer ${await world.tokenFor("avery.taylor")}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  world.memo.refusedStatus = res.status;
}
When("an attempt is made to change the promotion to {string}", async function (amount) {
  await undefinedMethod(this, "PUT", { amount: cents(amount) });
});
When("an attempt is made to remove the promotion", async function () {
  await undefinedMethod(this, "DELETE");
});
Then("the change is refused", function () {
  assert.equal(this.memo.refusedStatus, 405, "promotions are final: update and delete are not defined");
});
Then("the promotion is refused as invalid", function () {
  expectProblem(this, "validation_error", 400);
});
Given(/^a (?:card|checkout) payment for the visit was declined$/, async function () {
  const r = await pay(this, { card: DECLINE });
  expect200(r);
  assert.equal(r.body.attempt.outcome, "declined");
  this.memo.card = APPROVE;
});
Given("the visit's remaining balance has been paid", async function () {
  const r = await pay(this, { card: APPROVE });
  expect200(r);
  assert.equal(r.body.attempt.outcome, "authorized");
});

// ---------------------------------------------------------------------------
// Visit payments
// ---------------------------------------------------------------------------
When("Jordan pays the visit balance by card with a new attempt key", async function () {
  await pay(this);
});
When("Jordan pays the visit balance with the different card and a new attempt key", async function () {
  await pay(this);
});
When(/^(Dr [A-Za-z]+ [A-Za-z]+) records a "([^"]+)" cash payment for the visit$/, async function (vet, amount) {
  await payCash(this, { amount: cents(amount) }, seed.userFor(vet).username);
});
// MVP-02A (D-41, D-44): "the administrator" is Dr Avery Taylor's account acting
// on its administrator role (checkout has no admin-only scenario).
When("the administrator records a {string} cash payment for the visit", async function (amount) {
  await payCash(this, { amount: cents(amount) });
});
When("Jordan pays {string} of the visit balance", async function (amount) {
  await pay(this, { amount: cents(amount) });
});
Then("Checkout sends Customer a credit of {string} for Milo's visit", function (amount) {
  const credits = accountChanges(this, "credit").filter((c) => c.body.paymentId !== bookingCredit(this));
  assert.equal(credits.length, 1);
  assert.equal(credits[0].body.amount, cents(amount));
  assert.equal(credits[0].body.paymentId, this.memo.lastAttempt.attemptId);
  assertCheckoutServiceCall(credits[0]);
});
Then("Checkout sends Customer no credit", function () {
  assert.equal(accountChanges(this, "credit").filter((c) => c.body.paymentId !== bookingCredit(this)).length, 0);
});
Then(/^Checkout asks Reservation to complete the reservation as (settled|outstanding)$/, function (outcome) {
  const calls = completions(this);
  assert.ok(calls.length >= 1, "Reservation was not asked to complete");
  const last = calls.at(-1);
  assert.equal(last.path, `/internal/reservations/${this.memo.reservation.id}/complete`);
  assert.deepEqual(last.body, { financialOutcome: outcome });
  assertCheckoutServiceCall(last);
});
Then("the checkout has two payment attempts: {string} then {string}", async function (first, second) {
  assert.deepEqual((await checkout(this)).paymentAttempts.map((a) => a.outcome), [first, second]);
});
Then("the payment is refused as invalid", function () {
  expectProblem(this, "invalid_amount", 422);
});
Then("the payment is reported as already settled", function () {
  expectProblem(this, "already_settled", 409);
});
Given("Reservation will fail to complete the reservation", function () {
  failComplete(this);
});
Given("Customer will fail to record the account credit", function () {
  failAccountChanges(this);
});
Then("the payment attempt is recorded as {string}", async function (outcome) {
  const attemptId = this.response.body.paymentAttemptId;
  assert.ok(attemptId, "the failure must identify the payment attempt for manual recovery");
  assert.ok((await checkout(this)).paymentAttempts.some((a) => a.attemptId === attemptId && a.outcome === outcome));
});
Then("the result is reported as authorized but completion failed, needing manual recovery", function () {
  expectProblem(this, "authorized_completion_failed", 502);
});
Then("the result is not reported as settled or declined", function () {
  assert.notEqual(this.response.status, 200);
  assert.ok(!["declined", "already_settled"].includes(this.response.body.code));
});
Then("no new payment is attempted automatically", async function () {
  await new Promise((r) => setTimeout(r, 500));
  assert.equal((await providerCalls()).length, 1);
});

// ---------------------------------------------------------------------------
// Duplicate protection
// ---------------------------------------------------------------------------
Given("Jordan paid the visit balance with attempt key {string}", async function (label) {
  expect200(await pay(this, { key: labelId(this, label) }));
});
When("the identical request is sent again with attempt key {string}", async function (label) {
  await pay(this, { key: labelId(this, label) });
});
When("two identical requests with attempt key {string} arrive at the same time", async function (label) {
  const key = labelId(this, label);
  await Promise.all([pay(this, { key }), pay(this, { key })]);
});
Then("both requests return the same result", function () {
  const [a, b] = this.memo.results.slice(-2);
  expect200(a); expect200(b);
  assert.deepEqual(b.body.attempt, a.body.attempt);
});
Then("the second result is marked as a replay", function () {
  const [a, b] = this.memo.results.slice(-2);
  assert.equal(a.body.replayed, false);
  assert.equal(b.body.replayed, true);
});
Then("both requests return the same authorized result", function () {
  const [a, b] = this.memo.results.slice(-2);
  expect200(a); expect200(b);
  assert.deepEqual(b.body.attempt, a.body.attempt);
  assert.equal(a.body.attempt.outcome, "authorized");
  assert.deepEqual([a.body.replayed, b.body.replayed].sort(), [false, true]);
});
Then("both requests return the same declined result", function () {
  const [a, b] = this.memo.results.slice(-2);
  expect200(a); expect200(b);
  assert.deepEqual(b.body.attempt, a.body.attempt);
  assert.equal(a.body.attempt.outcome, "declined");
});
Then("Customer received one credit and Reservation one completion request", function () {
  assert.equal(accountChanges(this, "credit").filter((c) => c.body.paymentId !== bookingCredit(this)).length, 1);
  assert.equal(completions(this).length, 1);
});
Given("Jordan paid the visit balance with card {string} and attempt key {string}", async function (card, label) {
  const r = await pay(this, { card: `${APPROVE}-${card}`, key: labelId(this, label) });
  expect200(r);
  this.memo.originalAttempt = r.body.attempt;
});
When("a request with card {string} and attempt key {string} is sent", async function (card, label) {
  await pay(this, { card: `${APPROVE}-${card}`, key: labelId(this, label) });
});
Then("the request is refused as an idempotency conflict", function () {
  expectProblem(this, "idempotency_conflict", 409);
});
Then("the original attempt is unchanged", async function () {
  const attempts = (await checkout(this)).paymentAttempts;
  assert.deepEqual(attempts, [this.memo.originalAttempt]);
});
Given("Dr Avery Taylor recorded a {string} cash payment with attempt key {string}", async function (amount, label) {
  expect200(await payCash(this, { amount: cents(amount), key: labelId(this, label) }));
});
When("the same cash recording is sent again with attempt key {string}", async function (label) {
  await payCash(this, { key: labelId(this, label), amount: this.memo.results.at(-1).body.attempt.amount });
});
When("Dr Avery Taylor records {string} cash with attempt key {string}", async function (amount, label) {
  await payCash(this, { amount: cents(amount), key: labelId(this, label) });
});
Then("the same result is returned", function () {
  const [a, b] = this.memo.results.slice(-2);
  expect200(a); expect200(b);
  assert.deepEqual(b.body.attempt, a.body.attempt);
  assert.equal(b.body.replayed, true);
});
Then("Customer received one credit", function () {
  assert.equal(accountChanges(this, "credit").filter((c) => c.body.paymentId !== bookingCredit(this)).length, 1);
});
