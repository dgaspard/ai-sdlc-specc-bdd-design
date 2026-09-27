// OBS-036..040 explicitly require real service processes. Only payment is fake.
import { it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ServiceFixture, jordan, avery } from "../support/service-fixture.js";
import { context, readTrace, assertBusiness, spanName, assertCrossProcessParents } from "../support/business-traces.js";

async function fixture(t) {
  const f = new ServiceFixture("checkout", { real: true });
  t.after(() => f.stop()); await f.start(); return f;
}
const pay = (f, ctx, card = "fake-card-approve", key = randomUUID()) => f.call("POST", `/checkouts/${f.checkout.id}/payments`, {
  actor: "jordan.rivera", body: { amount: 5000, mockMethodReference: card },
  headers: { ...ctx.headers, "idempotency-key": key }, expected: 200 });
async function state(f, remaining, stateName) {
  const reservation = await f.call("GET", `/reservations/${f.reservation.id}`, { service: "reservation", expected: 200 });
  assert.equal(reservation.body.reservationState, stateName);
  const account = await f.call("GET", `/customers/${jordan}/account`, { service: "customer", expected: 200 });
  assert.equal(account.body.outstandingBalance, remaining);
}
function downstream(spans, id, outcome, attributes) {
  const business = assertBusiness(spans, id, outcome, attributes);
  const server = spans.find((s) => s.spanId === business.parentSpanId);
  const client = spans.find((s) => s.spanId === server.parentSpanId);
  assert.ok(client, `${id} has no cross-process client parent`);
  assert.equal(client.kind, "CLIENT");
  assert.equal(client.traceId, business.traceId);
  assert.notEqual(client.serviceName, business.serviceName);
}

for (const declined of [false, true]) it(`[${declined ? "OBS-037" : "OBS-036"}] checkout ${declined ? "decline" : "success"} connects real services`, async (t) => {
  const f = await fixture(t); await f.finalized();
  const before = (await f.providerCalls()).length, ctx = context();
  const r = await pay(f, ctx, declined ? "fake-card-decline" : "fake-card-approve");
  const ids = ["OBS-031", "OBS-032", "OBS-035", ...(!declined ? ["OBS-034"] : [])];
  const spans = await readTrace(ctx, ids.map(spanName));
  assertBusiness(spans, "OBS-031", declined ? "declined" : "settled", { "checkout.id": f.checkout.id,
    "visit.id": f.visit.id, "reservation.id": f.reservation.id, "payment.attempt.id": r.body.attempt.attemptId, "checkout.replayed": false });
  assertBusiness(spans, "OBS-032", declined ? "declined" : "authorized", { "payment.attempt.id": r.body.attempt.attemptId,
    "payment.purpose": "visit_balance", "payment.provider": "fake", "payment.amount_cents": 5000 });
  downstream(spans, "OBS-035", declined ? "completed_outstanding" : "completed_settled", { "reservation.id": f.reservation.id, "visit.id": f.visit.id });
  if (declined) assert.equal(spans.filter((s) => s.name === spanName("OBS-034") && s.attributes["petclinic.account.change_type"] === "credit").length, 0);
  else downstream(spans, "OBS-034", "applied", { "customer.id": jordan, "visit.id": f.visit.id, "account.change_type": "credit" });
  assertCrossProcessParents(spans);
  const calls = await f.providerCalls(); assert.equal(calls.length, before + 1);
  assert.equal(calls.at(-1).request.attemptId, r.body.attempt.attemptId);
  await state(f, declined ? 5000 : 0, declined ? "CompletedOutstanding" : "CompletedSettled");
});

for (const concurrent of [false, true]) for (const declined of [false, true]) it(`[OBS-038] ${concurrent ? "concurrent" : "sequential"} ${declined ? "declined" : "authorized"} retries preserve outcome and authorize once`, async (t) => {
  const f = await fixture(t); await f.finalized();
  const before = (await f.providerCalls()).length, key = randomUUID(), contexts = [context(), context()];
  const card = declined ? "fake-card-decline" : "fake-card-approve";
  const results = concurrent ? await Promise.all(contexts.map((ctx) => pay(f, ctx, card, key)))
    : [await pay(f, contexts[0], card, key), await pay(f, contexts[1], card, key)];
  assert.deepEqual(results.map((r) => r.body.replayed).sort(), [false, true]);
  assert.deepEqual(results[0].body.attempt, results[1].body.attempt);
  assert.equal((await f.providerCalls()).length, before + 1, "replay must not reach the payment provider");
  for (let i = 0; i < contexts.length; i++) {
    const replayed = results[i].body.replayed;
    const spans = await readTrace(contexts[i], [spanName("OBS-031"), ...(!replayed ? [spanName("OBS-032")] : [])]);
    assertBusiness(spans, "OBS-031", declined ? "declined" : "settled", { "checkout.id": f.checkout.id,
      "visit.id": f.visit.id, "reservation.id": f.reservation.id, "payment.attempt.id": results[i].body.attempt.attemptId, "checkout.replayed": replayed });
    if (replayed) assert.equal(spans.filter((s) => s.name === spanName("OBS-032")).length, 0);
  }
  await state(f, declined ? 5000 : 0, declined ? "CompletedOutstanding" : "CompletedSettled");
});

for (const declined of [false, true]) it(`[OBS-039] booking ${declined ? "decline leaves capacity open" : "acceptance authorizes the booking fee"}`, async (t) => {
  const f = await fixture(t); await f.request();
  const ctx = context();
  await f.call("POST", `/reservations/${f.reservation.id}/accept`, { service: "reservation", headers: ctx.headers,
    body: { bookingFee: { method: "card", mockMethodReference: declined ? "fake-card-decline" : "fake-card-approve" } }, expected: declined ? 422 : 200 });
  const spans = await readTrace(ctx, [spanName("OBS-024"), spanName("OBS-032")]);
  const calls = await f.providerCalls(); assert.equal(calls.length, 1);
  assertBusiness(spans, "OBS-024", declined ? "booking_payment_declined" : "accepted", { "reservation.id": f.reservation.id,
    "veterinarian.id": avery, "payment.attempt.id": calls[0].request.attemptId });
  assertBusiness(spans, "OBS-032", declined ? "declined" : "authorized", { "payment.attempt.id": calls[0].request.attemptId,
    "payment.purpose": "booking_fee", "payment.provider": "fake", "payment.amount_cents": 2000 });
  assertCrossProcessParents(spans);
  const reservation = await f.call("GET", `/reservations/${f.reservation.id}`, { service: "reservation", expected: 200 });
  assert.equal(reservation.body.reservationState, declined ? "Requested" : "Accepted");
  assert.equal(reservation.body.bookingFeePaid, !declined);
  const availability = await f.call("GET", `/availability?date=2026-10-12&veterinarianId=${avery}`, { service: "reservation", expected: 200 });
  assert.equal(availability.body.slots.some((s) => s.veterinarianId === avery && Date.parse(s.start) === Date.parse(f.reservation.scheduledStart)), declined);
});

it("[OBS-040] promotion to zero completes settled across real services without authorization", async (t) => {
  const f = await fixture(t); await f.finalized();
  const before = (await f.providerCalls()).length, ctx = context();
  const r = await f.call("POST", `/checkouts/${f.checkout.id}/promotion`, { body: { amount: 6000 }, headers: ctx.headers, expected: 201 });
  const spans = await readTrace(ctx, [spanName("OBS-030"), spanName("OBS-034"), spanName("OBS-035")]);
  assertBusiness(spans, "OBS-030", "applied", { "checkout.id": f.checkout.id, "visit.id": f.visit.id,
    "promotion.id": r.body.promotion.id, "veterinarian.id": avery, "promotion.amount_cents": 6000, "promotion.applied_amount_cents": 5000 });
  downstream(spans, "OBS-034", "applied", { "customer.id": jordan, "visit.id": f.visit.id, "account.change_type": "discount" });
  downstream(spans, "OBS-035", "completed_settled", { "reservation.id": f.reservation.id, "visit.id": f.visit.id });
  assert.equal(spans.filter((s) => s.name === spanName("OBS-032")).length, 0);
  assert.equal((await f.providerCalls()).length, before);
  assert.equal(r.body.remainingBalance, 0);
  await state(f, 0, "CompletedSettled");
});
