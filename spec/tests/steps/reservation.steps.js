// Steps for spec/features/reservation. Reservation runs for real; Customer and Checkout
// are contract-validated stubs (D-28). Every "Given" state is reached through Reservation's
// published API. Protected test.
import { Before, Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import * as seed from "../../harness/seed.js";
import { cents, usd } from "../../harness/money.js";
import { central, instant } from "../../harness/clinic-time.js";
import { decodeJwt, serviceToken } from "../../harness/auth.js";
import { expectProblem } from "./common.steps.js";

const CUSTOMERS = { Jordan: "Jordan Rivera", Sam: "Sam Lee" };
const PET_OWNER = { Milo: "Jordan", Luna: "Jordan", Rex: "Sam" };
const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const chicagoHHMM = (iso) => new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit", hour12: false,
}).format(new Date(iso));

// ---------------------------------------------------------------------------
// Stubs: default answers, overridable per scenario through this.memo
// ---------------------------------------------------------------------------
function attemptFor(world, body, outcome, attemptId) {
  const a = {
    attemptId, customerId: body.customerId, reservationId: body.reservationId, purpose: "booking_fee",
    amount: body.amount, currency: "USD", outcome, timestamp: world.clinicNow,
  };
  if (body.method === "card") a.mockMethodReference = body.mockMethodReference;
  if (body.method === "cash") a.recordedByVeterinarianId = body.recordedByVeterinarianId;
  if (outcome === "authorized") a.authorizationReference = `fake-auth-${attemptId.slice(0, 8)}`;
  return a;
}

Before({ tags: "@service:reservation" }, function () {
  if (!this.stubs.customer || !this.stubs.checkout) return; // service not implemented
  const world = this;
  this.memo.eligibility = {}; // customerId -> { eligible, balance }
  this.memo.notOwned = new Set(); // petIds the Customer stub reports as not owned
  this.memo.bookingFee = { outcome: "paid" };

  this.stubs.customer.respond("GET", "/internal/customers/{customerId}/pets/{petId}/ownership", 200, (req) => {
    const [, , , customerId, , petId] = req.path.split("/");
    const pet = seed.pets.find((p) => p.id === petId);
    const owned = !!pet && pet.ownerId === customerId && !world.memo.notOwned.has(petId);
    return { customerId, petId, owned };
  });
  this.stubs.customer.respond("GET", "/customers/{customerId}/eligibility", 200, (req) => {
    const customerId = req.path.split("/")[2];
    const e = world.memo.eligibility[customerId] ?? { eligible: true, balance: 0 };
    return { customerId, eligible: e.eligible, outstandingBalance: e.balance };
  });
  this.stubs.checkout.respond("POST", "/internal/booking-fees", 200, (req) => {
    const body = req.body;
    const spec = world.memo.bookingFee;
    const attemptId = spec.paymentLabel ? paymentId(world, spec.paymentLabel) : crypto.randomUUID();
    const outcome = spec.outcome === "declined" ? "declined" : body.method === "cash" ? "cash_recorded" : "authorized";
    const paid = outcome !== "declined";
    return {
      reservationId: body.reservationId, paid, ...(paid ? { paymentId: attemptId } : {}),
      attempt: attemptFor(world, body, outcome, attemptId), replayed: false,
    };
  });
});

const paymentId = (world, label) => {
  world.memo.paymentIds ??= {};
  world.memo.paymentIds[label] ??= crypto.randomUUID();
  return world.memo.paymentIds[label];
};
const bookingFeeCalls = (world, reservationId) => world.stubs.checkout.received("POST", "/internal/booking-fees")
  .filter((r) => !reservationId || r.body?.reservationId === reservationId);

// ---------------------------------------------------------------------------
// Callers and API helpers
// ---------------------------------------------------------------------------
async function as(world, name) {
  const u = seed.userFor(name.replace(/^customer /, ""));
  return world.tokenFor(u.username);
}
async function vetToken(world) {
  world.memo.vetToken ??= await world.tokenFor("avery.taylor");
  return world.memo.vetToken;
}
async function getReservation(world, id) {
  const saved = world.response;
  const r = await world.api("GET", `/reservations/${id}`, { token: await vetToken(world) });
  world.response = saved;
  assert.equal(r.status, 200);
  return r.body;
}
async function listReservations(world, query) {
  const saved = world.response;
  const r = await world.api("GET", `/reservations?${new URLSearchParams(query)}`, { token: await vetToken(world) });
  world.response = saved;
  return r.body;
}
async function availability(world, date, vetName) {
  const q = new URLSearchParams({ date, ...(vetName ? { veterinarianId: seed.vet(vetName).id } : {}) });
  const saved = world.response;
  const r = await world.api("GET", `/availability?${q}`, { token: await vetToken(world) });
  world.memo.availability = r.body;
  world.response = saved;
  assert.equal(r.status, 200);
  return r.body;
}
const startsFor = (avail, vetName) => avail.slots
  .filter((s) => !vetName || s.veterinarianId === seed.vet(vetName).id)
  .map((s) => chicagoHHMM(s.start)).sort();

/** POST /reservations as the pet's owner; returns the response. */
async function request(world, { pet = "Milo", vet = "Dr Avery Taylor", start, end, services = ["Wellness"], as: caller } = {}) {
  const ownerName = caller && CUSTOMERS[caller] ? caller : PET_OWNER[pet]; // the requesting customer
  const customer = seed.customer(CUSTOMERS[ownerName]);
  const endIso = end ?? new Date(instant(start) + 3600_000).toISOString();
  const body = {
    customerId: customer.id, petId: seed.pet(pet).id, veterinarianId: seed.vet(vet).id,
    scheduledStart: start, scheduledEnd: endIso, requestedServices: services.map((s) => seed.service(s).id),
  };
  return world.api("POST", "/reservations", { body, token: await as(world, caller ?? ownerName) });
}
async function accept(world, reservationId, vetName, bookingFee = { method: "card", mockMethodReference: "fake-card-approve" }) {
  return world.api("POST", `/reservations/${reservationId}/accept`, {
    body: { bookingFee }, token: await as(world, vetName), headers: { "idempotency-key": crypto.randomUUID() },
  });
}
async function recordVisit(world, reservationId, vetName, body) {
  return world.api("POST", `/reservations/${reservationId}/visit`, { body, token: await as(world, vetName) });
}
const visitBody = (over = {}) => ({
  performedServices: [seed.service("Wellness").id], clinicalNotes: "Routine examination", diagnoses: [], medications: [], ...over,
});
When("Dr Avery Taylor records a visit with an unknown performed service", async function () {
  await doVisit(this, "Dr Avery Taylor", visitBody({ performedServices: ["ffffffff-ffff-4fff-8fff-ffffffffffff"] }));
});
async function complete(world, reservationId, financialOutcome) {
  return world.api("POST", `/internal/reservations/${reservationId}/complete`, {
    body: { financialOutcome }, token: serviceToken("checkout", { clinicNow: world.clinicNow }),
  });
}

/** Next free weekday slot after the clock's date (09:00..16:00, skipping lunch). */
function nextSlot(world) {
  if (!world.memo.cursor) {
    const d = new Date(`${world.clinicNow.slice(0, 10)}T12:00:00Z`);
    world.memo.cursor = { date: d, hour: 8 };
  }
  const c = world.memo.cursor;
  do {
    c.hour += 1;
    if (c.hour === 12) c.hour = 13;
    if (c.hour > 16) { c.hour = 9; c.date = new Date(c.date.getTime() + 86400_000); }
    while ([0, 6].includes(c.date.getUTCDay()) || c.date.toISOString().slice(0, 10) <= world.clinicNow.slice(0, 10)) {
      c.date = new Date(c.date.getTime() + 86400_000); c.hour = 9;
    }
  } while (false); // single advance; loop form keeps the skip rules together
  return central(`${c.date.toISOString().slice(0, 10)} ${String(c.hour).padStart(2, "0")}:00`);
}

async function requested(world, opts) {
  const r = await request(world, opts);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.reservationState, "Requested");
  return r.body;
}
async function accepted(world, opts) {
  const res = await requested(world, opts);
  const r = await accept(world, res.id, opts.vet ?? "Dr Avery Taylor");
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.reservationState, "Accepted");
  return r.body;
}
/** Moves the clock to 5 minutes after the start, records a visit, returns the visit. */
async function withVisit(world, reservation, vetName = "Dr Avery Taylor", body = visitBody()) {
  const after = new Date(instant(reservation.scheduledStart) + 5 * 60_000);
  const local = central(`${after.toLocaleDateString("en-CA", { timeZone: "America/Chicago" })} ${chicagoHHMM(after.toISOString())}`);
  if (instant(local) > instant(world.clinicNow)) await world.setClinicClock(local);
  const r = await recordVisit(world, reservation.id, vetName, body);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
}

/** Puts `this.memo.reservation` into a state, only through the published API. */
async function reachState(world, state) {
  const base = world.memo.reservation;
  if (["Requested", "Accepted", "Denied", "Canceled"].includes(state)) {
    const start = nextSlot(world);
    if (state === "Requested") world.memo.reservation = await requested(world, { start });
    if (state === "Accepted") world.memo.reservation = await accepted(world, { start });
    if (state === "Denied") {
      const res = await requested(world, { start });
      const r = await world.api("POST", `/reservations/${res.id}/deny`, { token: await as(world, "Dr Avery Taylor") });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      world.memo.reservation = r.body;
    }
    if (state === "Canceled") {
      const res = await accepted(world, { start });
      const r = await world.api("POST", `/reservations/${res.id}/cancel`, { token: await as(world, "Jordan") });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      world.memo.reservation = r.body;
    }
    return;
  }
  // CompletedSettled / CompletedOutstanding: complete the scenario's Accepted reservation.
  const before = world.clinicNow;
  let current = await getReservation(world, base.id);
  if (!current.visitId) await withVisit(world, current);
  const r = await complete(world, base.id, state === "CompletedSettled" ? "settled" : "outstanding");
  assert.equal(r.status, 200, JSON.stringify(r.body));
  if (instant(world.clinicNow) !== instant(before)) await world.setClinicClock(before); // keep only the state rule in play
  world.memo.reservation = r.body;
}

// ---------------------------------------------------------------------------
// Background reservations
// ---------------------------------------------------------------------------
Given("Jordan has a Requested reservation for Milo with Dr Avery Taylor on {string} at {string}", async function (date, time) {
  this.memo.reservation = await requested(this, { start: central(`${date} ${time}`) });
});
Given("Jordan has an Accepted reservation for Milo with Dr Avery Taylor on {string} at {string} with the booking fee paid", async function (date, time) {
  this.memo.reservation = await accepted(this, { start: central(`${date} ${time}`) });
  assert.equal(this.memo.reservation.bookingFeePaid, true);
});
Given("Jordan has an Accepted reservation for Milo with Dr Avery Taylor on {string} at {string} requesting {string}", async function (date, time, service) {
  this.memo.reservation = await accepted(this, { start: central(`${date} ${time}`), services: [service] });
});
Given("Jordan has an Accepted reservation for Milo with a recorded visit", async function () {
  this.memo.reservation = await accepted(this, { start: nextSlot(this) });
  this.memo.visit = await withVisit(this, this.memo.reservation);
});
Given("Jordan has an Accepted reservation for Luna with no recorded visit", async function () {
  this.memo.luna = await accepted(this, { pet: "Luna", start: nextSlot(this) });
});
Given("Sam has a Requested reservation for Rex with Dr Avery Taylor on {string} at {string}", async function (date, time) {
  this.memo.other = await requested(this, { pet: "Rex", start: central(`${date} ${time}`) });
});
Given("Jordan's other pet Luna has an Accepted reservation with Dr Avery Taylor on {string} at {string}", async function (date, time) {
  this.memo.luna = await accepted(this, { pet: "Luna", start: central(`${date} ${time}`) });
});
Given(/^(Milo|Luna|Rex) has an? (Accepted|Requested) reservation with (Dr [A-Za-z]+ [A-Za-z]+) on "([^"]+)" at "([^"]+)"$/,
  async function (pet, state, vet, date, time) {
    const opts = { pet, vet, start: central(`${date} ${time}`) };
    this.memo.existing = state === "Accepted" ? await accepted(this, opts) : await requested(this, opts);
  });
Given(/^an? (Accepted|Requested) reservation with (Dr [A-Za-z]+ [A-Za-z]+) on "([^"]+)" at "([^"]+)"$/,
  async function (state, vet, date, time) {
    const opts = { vet, start: central(`${date} ${time}`) };
    this.memo.existing = state === "Accepted" ? await accepted(this, opts) : await requested(this, opts);
  });

// Setup in a Given ("Context"), assertion in a Then ("Outcome").
Given("the reservation is {string}", async function (state) {
  if (this.stepType === "Context") return reachState(this, state);
  assert.equal((await getReservation(this, this.memo.reservation.id)).reservationState, state);
});
Then("the reservation remains {string}", async function (state) {
  assert.equal((await getReservation(this, this.memo.reservation.id)).reservationState, state);
});
Then("Luna's reservation is {string}", async function (state) {
  assert.equal((await getReservation(this, this.memo.luna.id)).reservationState, state);
});

// ---------------------------------------------------------------------------
// Customer stub facts
// ---------------------------------------------------------------------------
Given("the Customer service reports that {string} owns {string}", function (customerName, pet) {
  assert.equal(seed.pet(pet).ownerId, seed.customer(customerName).id);
});
Given("the Customer service reports that Jordan does not own {string}", function (pet) {
  this.memo.notOwned.add(seed.pet(pet).id);
});
Given("the Customer service reports Jordan is eligible", function () {
  this.memo.eligibility[seed.customer("Jordan").id] = { eligible: true, balance: 0 };
});
Given("the Customer service reports Jordan is ineligible with an outstanding balance of {string}", function (amount) {
  this.memo.eligibility[seed.customer("Jordan").id] = { eligible: false, balance: cents(amount) };
});
Given("Jordan prefers Dr Avery Taylor", function () {
  assert.equal(seed.customer("Jordan").preferredVeterinarianId, seed.vet("Dr Avery Taylor").id);
});

// ---------------------------------------------------------------------------
// Checkout stub facts and expectations
// ---------------------------------------------------------------------------
Given("Checkout will report the booking fee as paid with payment {string}", function (label) {
  this.memo.bookingFee = { outcome: "paid", paymentLabel: label };
});
Given("Checkout will report the cash booking fee as recorded with payment {string}", function (label) {
  this.memo.bookingFee = { outcome: "paid", paymentLabel: label };
});
Given("Checkout will report the booking fee as declined", function () {
  this.memo.bookingFee = { outcome: "declined" };
});
Given("Checkout will report booking fees as paid", function () {
  this.memo.bookingFee = { outcome: "paid" };
});

/** A call to another service must carry a service-role token signed with the shared secret, never the user's token. */
function assertServiceCall(call, userToken) {
  const auth = call.headers.authorization ?? "";
  assert.match(auth, /^Bearer /, "internal call without a bearer token");
  const token = auth.slice(7);
  assert.notEqual(token, userToken, "the user's token was forwarded to an internal operation");
  const { claims, signatureValid } = decodeJwt(token);
  assert.ok(signatureValid, "service token not signed with AUTH_TOKEN_SECRET");
  assert.equal(claims.role, "service");
  assert.equal(claims.sub, "reservation");
}
Then("Reservation asks Checkout to collect {string} for this reservation", function (amount) {
  const calls = bookingFeeCalls(this, this.memo.reservation.id);
  assert.equal(calls.length, 1);
  const c = calls[0];
  assert.deepEqual({ ...c.body, mockMethodReference: undefined }, {
    reservationId: this.memo.reservation.id, customerId: seed.customer("Jordan").id,
    amount: cents(amount), currency: "USD", method: "card", mockMethodReference: undefined,
  });
  assert.ok(c.body.mockMethodReference, "card booking fee needs a mock method reference");
  assert.ok(isUuid(c.headers["idempotency-key"] ?? ""), "booking fee call needs an Idempotency-Key");
  assertServiceCall(c, this.memo.userToken);
});
Then("Reservation asks Checkout to record {string} cash from Dr Avery Taylor", function (amount) {
  const calls = bookingFeeCalls(this, this.memo.reservation.id);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body, {
    reservationId: this.memo.reservation.id, customerId: seed.customer("Jordan").id, amount: cents(amount),
    currency: "USD", method: "cash", recordedByVeterinarianId: seed.vet("Dr Avery Taylor").id,
  });
  assertServiceCall(calls[0], this.memo.userToken);
});
Then("Checkout is not asked to collect a booking fee", function () {
  assert.equal(bookingFeeCalls(this, this.memo.reservation.id).length, 0);
});
Then("Checkout collected exactly one booking fee", function () {
  const ids = [this.memo.reservation.id, this.memo.other.id];
  assert.equal(bookingFeeCalls(this).filter((c) => ids.includes(c.body?.reservationId)).length, 1);
});
Then("Checkout is not asked for a refund", function () {
  assert.equal(this.stubs.checkout.requests.length, this.memo.checkoutCallsBefore);
});

// ---------------------------------------------------------------------------
// Accept / deny
// ---------------------------------------------------------------------------
When("Dr Avery Taylor accepts the reservation using Jordan's card", async function () {
  this.memo.userToken = await as(this, "Dr Avery Taylor");
  await accept(this, this.memo.reservation.id, "Dr Avery Taylor");
});
When("Dr Avery Taylor accepts the reservation with a cash booking fee", async function () {
  this.memo.userToken = await as(this, "Dr Avery Taylor");
  await accept(this, this.memo.reservation.id, "Dr Avery Taylor", { method: "cash" });
});
When(/^(Dr [A-Za-z]+ [A-Za-z]+) (accepts|denies) (?:the|Milo's) reservation$/, async function (vet, action) {
  if (action === "accepts") await accept(this, this.memo.reservation.id, vet);
  else await this.api("POST", `/reservations/${this.memo.reservation.id}/deny`, { token: await as(this, vet) });
});
When("Dr Avery Taylor accepts both reservations at the same time", async function () {
  this.memo.concurrent = await Promise.all([
    accept(this, this.memo.reservation.id, "Dr Avery Taylor"),
    accept(this, this.memo.other.id, "Dr Avery Taylor"),
  ]);
});
Then("exactly one reservation is {string}", async function (state) {
  const states = [await getReservation(this, this.memo.reservation.id), await getReservation(this, this.memo.other.id)]
    .map((r) => r.reservationState);
  assert.equal(states.filter((s) => s === state).length, 1, `states: ${states}`);
});
Then("the other reservation is {string}", async function (state) {
  const states = [await getReservation(this, this.memo.reservation.id), await getReservation(this, this.memo.other.id)]
    .map((r) => r.reservationState);
  assert.equal(states.filter((s) => s === state).length, 1, `states: ${states}`);
});
Then("the acceptance time is recorded", async function () {
  assert.equal(instant((await getReservation(this, this.memo.reservation.id)).acceptedAt), instant(this.clinicNow));
});
Then("the booking fee is paid with payment {string}", async function (label) {
  const r = await getReservation(this, this.memo.reservation.id);
  assert.equal(r.bookingFeePaid, true);
  assert.equal(r.bookingPaymentId, paymentId(this, label));
});
Then("the booking fee is not paid", async function () {
  const r = await getReservation(this, this.memo.reservation.id);
  assert.equal(r.bookingFeePaid, false);
  assert.equal(r.bookingPaymentId, null);
});
Then("the booking fee remains paid", async function () {
  const r = await getReservation(this, this.memo.reservation.id);
  assert.equal(r.bookingFeePaid, true);
  assert.ok(r.bookingPaymentId);
});
Then(/^the slot "([^"]+)" is (taken|available) for (Dr [A-Za-z]+ [A-Za-z]+)$/, async function (local, status, vet) {
  const [date, time] = local.split(" ");
  const starts = startsFor(await availability(this, date, vet), vet);
  assert.equal(starts.includes(time), status === "available", `open slots: ${starts}`);
});

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------
When(/^(Jordan|Dr [A-Za-z]+ [A-Za-z]+|customer Sam) cancels (?:the|Jordan's) reservation$/, async function (who) {
  this.memo.checkoutCallsBefore = this.stubs.checkout.requests.length;
  await this.api("POST", `/reservations/${this.memo.reservation.id}/cancel`, { token: await as(this, who) });
});
Given("Milo has an earlier recorded visit with clinical notes", async function () {
  const res = await accepted(this, { start: nextSlot(this) });
  this.memo.earlierVisit = await withVisit(this, res, "Dr Avery Taylor", visitBody({ clinicalNotes: "Earlier checkup: healthy", diagnoses: ["None"] }));
});
Then("Milo's earlier visit and its clinical notes are unchanged", async function () {
  const r = await this.api("GET", `/visits/${this.memo.earlierVisit.id}`, { token: await vetToken(this) });
  assert.deepEqual(r.body, this.memo.earlierVisit);
});

// ---------------------------------------------------------------------------
// Complete (internal, called by Checkout)
// ---------------------------------------------------------------------------
When(/^Checkout completes the reservation as (settled|outstanding)$/, async function (outcome) {
  await complete(this, this.memo.reservation.id, outcome);
});
When("Checkout completes Luna's reservation as settled", async function () {
  await complete(this, this.memo.luna.id, "settled");
});
Then("the completion is reported as already completed", function () {
  expectProblem(this, "already_completed", 409);
});

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------
async function countJordan(world) {
  return (await listReservations(world, { customerId: seed.customer("Jordan").id })).length;
}
async function doRequest(world, opts) {
  world.memo.countBefore = await countJordan(world);
  return request(world, opts);
}
When(/^Jordan requests a "([^"]+)" appointment for (Milo|Rex) with (Dr [A-Za-z]+ [A-Za-z]+) on "([^"]+)" at "([^"]+)"$/,
  async function (service, pet, vet, date, time) {
    await doRequest(this, { pet, vet, services: [service], start: central(`${date} ${time}`), as: "Jordan" });
  });
When(/^Jordan requests an appointment for (Milo|Rex) with (Dr [A-Za-z]+ [A-Za-z]+) on "([^"]+)" at "([^"]+)"$/,
  async function (pet, vet, date, time) {
    await doRequest(this, { pet, vet, start: central(`${date} ${time}`), as: "Jordan" });
  });
When("Jordan requests an appointment for Milo with Dr Avery Taylor starting {string} Central Time", async function (local) {
  await doRequest(this, { start: central(local), as: "Jordan" });
});
When("Jordan requests an appointment for Milo from {string} to {string}", async function (from, to) {
  await doRequest(this, { start: central(from), end: central(to), as: "Jordan" });
});
When("Jordan requests an appointment for Milo with no services", async function () {
  await doRequest(this, { start: central("2026-10-12 09:00"), services: [], as: "Jordan" });
});
When("Jordan requests an appointment for Milo with {string} listed twice", async function (service) {
  const start = central("2026-10-12 09:00");
  this.memo.countBefore = await countJordan(this);
  const body = {
    customerId: seed.customer("Jordan").id, petId: seed.pet("Milo").id, veterinarianId: seed.vet("Dr Avery Taylor").id,
    scheduledStart: start, scheduledEnd: new Date(instant(start) + 3600_000).toISOString(),
    requestedServices: [seed.service(service).id, seed.service(service).id],
  };
  await this.api("POST", "/reservations", { body, token: await as(this, "Jordan") });
});
Then("the reservation is saved as {string}", function (state) {
  assert.equal(this.response.status, 201, JSON.stringify(this.response.body));
  assert.equal(this.response.body.reservationState, state);
  this.memo.reservation = this.response.body;
});
Then("the reservation is saved as {string} with Dr Morgan Reed", function (state) {
  assert.equal(this.response.status, 201, JSON.stringify(this.response.body));
  assert.equal(this.response.body.reservationState, state);
  assert.equal(this.response.body.veterinarianId, seed.vet("Dr Morgan Reed").id);
});
Then("it is scheduled from {string} to {string}", function (from, to) {
  assert.equal(instant(this.response.body.scheduledStart), instant(from));
  assert.equal(instant(this.response.body.scheduledEnd), instant(to));
});
Then("the booking fee amount is {string} and is not paid", function (amount) {
  assert.equal(this.response.body.bookingFeeAmount, cents(amount));
  assert.equal(this.response.body.bookingFeePaid, false);
  assert.equal(this.response.body.bookingPaymentId, null);
});
Then("the request time is recorded", function () {
  assert.equal(instant(this.response.body.requestedAt), instant(this.clinicNow));
  assert.equal(this.response.body.acceptedAt, null);
});
Then("no slot is taken", async function () {
  const r = this.memo.reservation;
  const starts = startsFor(await availability(this, chicagoDate(r.scheduledStart), "Dr Avery Taylor"), "Dr Avery Taylor");
  assert.ok(starts.includes(chicagoHHMM(r.scheduledStart)), `open: ${starts}`);
});
const chicagoDate = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
Then("the denial reason is exactly {string}", function (message) {
  assert.equal(this.response.body.denialReason, message);
  assert.equal(message, `Please pay your full balance of ${usd(this.memo.eligibility[seed.customer("Jordan").id].balance)}`);
});
Then("the veterinarian's decision is not required", function () {
  assert.equal(this.response.body.reservationState, "Denied");
  assert.equal(this.response.body.acceptedAt, null);
  assert.equal(bookingFeeCalls(this).length, 0);
});
Then("no reservation is saved", async function () {
  assert.equal(await countJordan(this), this.memo.countBefore);
});
Then("the request is rejected as invalid", function () {
  expectProblem(this, "validation_error", 400);
});

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------
When(/^Dr Avery Taylor's availability for (?:Monday )?"([^"]+)" is viewed$/, async function (date) {
  this.memo.vetFilter = "Dr Avery Taylor";
  await availability(this, date, "Dr Avery Taylor");
});
When("availability for {string} is viewed", async function (date) {
  this.memo.vetFilter = null;
  await availability(this, date);
});
Then("the available start times are:", function (table) {
  assert.deepEqual(startsFor(this.memo.availability, this.memo.vetFilter), table.hashes().map((r) => r.start));
});
Then("each slot lasts one hour", function () {
  for (const s of this.memo.availability.slots) assert.equal(instant(s.end) - instant(s.start), 3600_000);
});
Then("no start times are available", function () {
  assert.deepEqual(this.memo.availability.slots, []);
});
Then("the 08:00 slot starts at {string}", function (iso) {
  const slot = this.memo.availability.slots.find((s) => chicagoHHMM(s.start) === "08:00");
  assert.ok(slot, "no 08:00 slot");
  assert.equal(instant(slot.start), instant(iso));
});
Then(/^"(\d\d:\d\d)" is (available|not available)(?: for (Dr [A-Za-z]+ [A-Za-z]+))?$/, function (time, status, vet) {
  const starts = startsFor(this.memo.availability, vet ?? this.memo.vetFilter);
  assert.equal(starts.includes(time), status === "available", `open: ${starts}`);
});
Then("the first available start time is {string}", function (time) {
  assert.equal(startsFor(this.memo.availability, this.memo.vetFilter)[0], time);
});

// ---------------------------------------------------------------------------
// Visits
// ---------------------------------------------------------------------------
async function doVisit(world, vet, body) {
  const pet = seed.pet("Milo").id;
  const saved = world.response;
  world.memo.visitCountBefore = (await world.api("GET", `/visits?petId=${pet}`, { token: await vetToken(world) })).body.length;
  world.response = saved;
  return recordVisit(world, world.memo.reservation.id, vet, body);
}
When("Dr Avery Taylor records a visit with performed service {string} and clinical notes {string}", async function (service, notes) {
  await doVisit(this, "Dr Avery Taylor", visitBody({ performedServices: [seed.service(service).id], clinicalNotes: notes }));
});
When("Dr Avery Taylor records a visit with performed services {string} and {string}", async function (a, b) {
  await doVisit(this, "Dr Avery Taylor", visitBody({ performedServices: [seed.service(a).id, seed.service(b).id] }));
});
When("Dr Avery Taylor records a visit with clinical notes but no diagnoses, medications, or follow-up", async function () {
  await doVisit(this, "Dr Avery Taylor", { performedServices: [seed.service("Wellness").id], clinicalNotes: "Healthy", diagnoses: [], medications: [] });
});
When(/^(Dr [A-Za-z]+ [A-Za-z]+) records a visit$/, async function (vet) {
  await doVisit(this, vet, visitBody());
});
Given("Dr Avery Taylor has recorded a visit for the reservation", async function () {
  const r = await recordVisit(this, this.memo.reservation.id, "Dr Avery Taylor", visitBody());
  assert.equal(r.status, 201, JSON.stringify(r.body));
});
When("Dr Avery Taylor records another visit for the reservation", async function () {
  await recordVisit(this, this.memo.reservation.id, "Dr Avery Taylor", visitBody());
});
When("Dr Avery Taylor records a visit with no performed services", async function () {
  await doVisit(this, "Dr Avery Taylor", visitBody({ performedServices: [] }));
});
When("Dr Avery Taylor records a visit with {string} performed twice", async function (service) {
  await doVisit(this, "Dr Avery Taylor", visitBody({ performedServices: [seed.service(service).id, seed.service(service).id] }));
});
When("Dr Avery Taylor records a visit with blank clinical notes", async function () {
  await doVisit(this, "Dr Avery Taylor", visitBody({ clinicalNotes: "   " }));
});
Then("the visit is saved with a new visit ID", function () {
  assert.equal(this.response.status, 201, JSON.stringify(this.response.body));
  assert.ok(isUuid(this.response.body.id));
  this.memo.visit = this.response.body;
});
Then("it references the reservation, Jordan, Milo, and Dr Avery Taylor", function () {
  const v = this.memo.visit;
  assert.equal(v.reservationId, this.memo.reservation.id);
  assert.equal(v.customerId, seed.customer("Jordan").id);
  assert.equal(v.petId, seed.pet("Milo").id);
  assert.equal(v.veterinarianId, seed.vet("Dr Avery Taylor").id);
  assert.equal(instant(v.startedAt), instant(this.clinicNow));
});
Then("the reservation references the visit", async function () {
  assert.equal((await getReservation(this, this.memo.reservation.id)).visitId, this.memo.visit.id);
});
Then("the visit's performed services are {string} and {string}", function (a, b) {
  assert.deepEqual([...this.response.body.performedServices].sort(), [seed.service(a).id, seed.service(b).id].sort());
});
Then("the reservation's requested services are still {string}", async function (service) {
  assert.deepEqual((await getReservation(this, this.memo.reservation.id)).requestedServices, [seed.service(service).id]);
});
Then("the visit is saved with empty diagnoses and medications", function () {
  assert.equal(this.response.status, 201, JSON.stringify(this.response.body));
  assert.deepEqual(this.response.body.diagnoses, []);
  assert.deepEqual(this.response.body.medications, []);
  assert.equal(this.response.body.followUpNotes, undefined);
});
Then("no visit is saved", async function () {
  const r = await this.api("GET", `/visits?petId=${seed.pet("Milo").id}`, { token: await vetToken(this) });
  assert.equal(r.body.length, this.memo.visitCountBefore);
});
Then("the visit is refused as invalid", function () {
  expectProblem(this, "validation_error", 400);
});

// History
async function labelledVisit(world, label, pet) {
  const res = await accepted(world, { pet, start: nextSlot(world) });
  const v = await withVisit(world, res, "Dr Avery Taylor", visitBody({ clinicalNotes: `Visit ${label}` }));
  (world.memo.labels ??= {})[label] = v.id;
}
Given("Milo has recorded visit {string}", async function (label) { await labelledVisit(this, label, "Milo"); });
Given("Jordan's other pet Luna has recorded visit {string}", async function (label) { await labelledVisit(this, label, "Luna"); });
Given("another customer's pet has recorded visit {string}", async function (label) { await labelledVisit(this, label, "Rex"); });
When("Milo's visit history is requested", async function () {
  await this.api("GET", `/visits?petId=${seed.pet("Milo").id}`, { token: await as(this, "Jordan") });
});
When("Jordan's visit history is requested", async function () {
  await this.api("GET", `/visits?customerId=${seed.customer("Jordan").id}`, { token: await as(this, "Jordan") });
});
const idsIn = (world) => world.response.body.map((v) => v.id);
Then("it contains {string}", function (label) {
  assert.ok(idsIn(this).includes(this.memo.labels[label]));
});
Then("it does not contain {string}", function (label) {
  assert.ok(!idsIn(this).includes(this.memo.labels[label]));
});
Then("it contains {string} and {string} exactly once each", function (a, b) {
  for (const label of [a, b]) assert.equal(idsIn(this).filter((id) => id === this.memo.labels[label]).length, 1, label);
});
