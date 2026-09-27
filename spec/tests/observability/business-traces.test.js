// Per-service business spans: real subject, contract-checked dependencies, real
// payment fake. Cross-process evidence is in business-workflows.test.js.
import { it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ServiceFixture, jordan, milo, avery, wellness, unknownId, reservationBody, visitBody, problem } from "../support/service-fixture.js";
import { context, readTrace, assertBusiness, spanName, rules, assertPropagation } from "../support/business-traces.js";
import { decodeJwt } from "../../harness/auth.js";
import * as seed from "../../harness/seed.js";

const cases = [];
const add = (id, outcome, arrange) => cases.push({ id, outcome, arrange });
const payAttrs = (f, r) => ({ "checkout.id": f.checkout.id, "visit.id": f.visit.id, "reservation.id": f.reservation.id,
  ...(r.body.attempt ? { "payment.attempt.id": r.body.attempt.attemptId } : {}), "checkout.replayed": r.body.replayed ?? false });
const payRequest = (f, card = "fake-card-approve", headers = {}) => ({ method: "POST", path: `/checkouts/${f.checkout.id}/payments`,
  options: { actor: "jordan.rivera", body: { amount: 5000, mockMethodReference: card }, headers, expected: 200 } });
const send = (f, q, headers = {}) => f.call(q.method, q.path, { ...q.options, headers: { ...q.options?.headers, ...headers } });

for (const [outcome, over, status] of [
  ["requested", {}, 201], ["invalid_slot", { scheduledStart: "2026-10-12T12:00:00-05:00", scheduledEnd: "2026-10-12T13:00:00-05:00" }, 422],
  ["past_start", { scheduledStart: "2026-10-02T09:00:00-05:00", scheduledEnd: "2026-10-02T10:00:00-05:00" }, 422],
  ["not_found", { petId: unknownId }, 404], ["denied_outstanding_balance", {}, 201],
]) add("OBS-023", outcome, async (f) => {
  if (outcome === "denied_outstanding_balance") f.stubs.customer.respond("GET", "/customers/{customerId}/eligibility", 200,
    { customerId: jordan, eligible: false, outstandingBalance: 5000 });
  return { method: "POST", path: "/reservations", options: { actor: "jordan.rivera", body: { ...reservationBody(), ...over }, expected: status },
    attributes: (r) => ({ "customer.id": jordan, "pet.id": over.petId ?? milo, "veterinarian.id": avery,
      ...(r.body.id ? { "reservation.id": r.body.id } : {}) }) };
});
for (const [id, action, good] of [["OBS-024", "accept", "accepted"], ["OBS-025", "deny", "denied"], ["OBS-026", "cancel", "canceled"]]) {
  for (const outcome of [good, "invalid_state", "not_found", ...(action === "accept" ? ["booking_payment_declined", "not_assigned_veterinarian"] : action === "deny" ? ["not_assigned_veterinarian"] : [])]) {
    add(id, outcome, async (f) => {
      await f.request();
      if (action === "cancel" && outcome !== "invalid_state") await f.accept();
      if (outcome === "invalid_state" && action !== "cancel") await f.call("POST", `/reservations/${f.reservation.id}/deny`, { expected: 200 });
      const rid = outcome === "not_found" ? unknownId : f.reservation.id;
      return { method: "POST", path: `/reservations/${rid}/${action}`, options: {
        actor: outcome === "not_assigned_veterinarian" ? "morgan.reed" : "avery.taylor",
        ...(action === "accept" ? { body: { bookingFee: { method: "card", mockMethodReference: outcome === "booking_payment_declined" ? "fake-card-decline" : "fake-card-approve" } } } : {}),
        expected: outcome === "not_found" ? 404 : outcome === "invalid_state" ? 409 : outcome === "booking_payment_declined" ? 422 : outcome === "not_assigned_veterinarian" ? 403 : 200 },
        attributes: () => action === "cancel" ? { "reservation.id": rid, ...(outcome === "not_found" ? {} : { "customer.id": jordan }) }
          : { "reservation.id": rid, "veterinarian.id": outcome === "not_assigned_veterinarian" ? "10000000-0000-4000-8000-000000000002" : avery } };
    });
  }
}
for (const outcome of ["recorded", "already_recorded", "invalid_state", "not_found"]) add("OBS-027", outcome, async (f) => {
  await f.request();
  if (outcome !== "invalid_state") { await f.accept(); await f.clock("2026-10-12T09:05:00-05:00"); }
  if (outcome === "already_recorded") await f.call("POST", `/reservations/${f.reservation.id}/visit`, { body: visitBody(), expected: 201 });
  const rid = outcome === "not_found" ? unknownId : f.reservation.id;
  return { method: "POST", path: `/reservations/${rid}/visit`, options: { body: visitBody(), expected: outcome === "recorded" ? 201 : outcome === "not_found" ? 404 : 409 },
    attributes: (r) => ({ "reservation.id": rid, "veterinarian.id": avery, ...(r.body.id ? { "visit.id": r.body.id } : {}) }) };
});
for (const outcome of ["found", "unknown_service"]) add("OBS-028", outcome, async () => ({ method: "GET",
  path: `/fees?serviceIds=${outcome === "found" ? wellness : unknownId}`, options: { expected: outcome === "found" ? 200 : 422 },
  attributes: () => ({ "veterinarian_service.count": 1 }) }));

for (const outcome of ["finalized", "already_finalized", "not_assigned_veterinarian", "unknown_service"]) add("OBS-029", outcome, async (f) => {
  if (outcome === "already_finalized") await f.finalized();
  if (outcome === "unknown_service") f.stubs["veterinarian-services"].respond("GET", "/fees", 422, problem(422, "unknown_service"));
  return { method: "POST", path: `/visits/${f.visit.id}/checkout`, options: { actor: outcome === "not_assigned_veterinarian" ? "morgan.reed" : "avery.taylor",
    expected: ({ finalized: 201, already_finalized: 409, not_assigned_veterinarian: 403, unknown_service: 422 })[outcome] },
    attributes: (r) => ({ "visit.id": f.visit.id, "reservation.id": f.reservation.id,
      "veterinarian.id": outcome === "not_assigned_veterinarian" ? seed.vet("Morgan Reed").id : avery,
      ...(outcome === "finalized" ? { "checkout.id": r.body.id, "checkout.remaining_amount_cents": 5000 } : {}) }) };
});
for (const outcome of ["applied", "already_applied", "nothing_owed"]) add("OBS-030", outcome, async (f) => {
  await f.finalized();
  if (outcome === "already_applied") await f.call("POST", `/checkouts/${f.checkout.id}/promotion`, { body: { amount: 100 }, expected: 201 });
  if (outcome === "nothing_owed") await send(f, payRequest(f));
  return { method: "POST", path: `/checkouts/${f.checkout.id}/promotion`, options: { body: { amount: 1000 }, expected: outcome === "applied" ? 201 : 409 },
    attributes: (r) => ({ "checkout.id": f.checkout.id, "visit.id": f.visit.id, "veterinarian.id": avery,
      ...(outcome === "applied" ? { "promotion.id": r.body.promotion.id, "promotion.amount_cents": 1000, "promotion.applied_amount_cents": 1000 } : {}) }) };
});
for (const outcome of ["settled", "declined", "already_settled", "idempotency_conflict", "authorized_completion_failed", "failed"]) add("OBS-031", outcome, async (f) => {
  await f.finalized();
  const key = randomUUID();
  if (["already_settled", "idempotency_conflict"].includes(outcome)) await send(f, payRequest(f, "fake-card-approve", { "idempotency-key": key }));
  if (outcome === "authorized_completion_failed") f.stubs.reservation.respond("POST", "/internal/reservations/{reservationId}/complete", 409, problem(409, "invalid_state"));
  const q = payRequest(f, outcome === "declined" ? "fake-card-decline" : outcome === "failed" ? "fake-card-error" : outcome === "idempotency_conflict" ? "fake-card-approve-2" : "fake-card-approve",
    outcome === "idempotency_conflict" ? { "idempotency-key": key } : {});
  q.options.expected = ["already_settled", "idempotency_conflict"].includes(outcome) ? 409 : ["failed", "authorized_completion_failed"].includes(outcome) ? 502 : 200;
  return { ...q, attributes: (r) => payAttrs(f, r) };
});
for (const purpose of ["booking_fee", "visit_balance"]) for (const outcome of ["authorized", "declined", "failed"]) add("OBS-032", outcome, async (f) => {
  const card = { authorized: "fake-card-approve", declined: "fake-card-decline", failed: "fake-card-error" }[outcome];
  let q;
  if (purpose === "visit_balance") { await f.finalized(); q = payRequest(f, card); }
  else q = { method: "POST", path: "/internal/booking-fees", options: { actor: "service", body: { reservationId: f.reservation.id,
    customerId: jordan, amount: 2000, currency: "USD", method: "card", mockMethodReference: card } } };
  q.options.expected = outcome === "failed" ? 502 : 200;
  return { ...q, label: purpose, attributes: async () => {
    const calls = await f.providerCalls(); assert.equal(calls.length, 1);
    return { "payment.attempt.id": calls[0].request.attemptId, "payment.purpose": purpose, "payment.provider": "fake", "payment.amount_cents": purpose === "booking_fee" ? 2000 : 5000 };
  } };
});
add("OBS-033", "recorded", async (f) => {
  await f.finalized();
  return { method: "POST", path: `/checkouts/${f.checkout.id}/cash-payments`, options: { body: { amount: 5000 }, expected: 200 },
    attributes: async (r) => { assert.equal((await f.providerCalls()).length, 0); return {
      "payment.attempt.id": r.body.attempt.attemptId, "veterinarian.id": avery, "reservation.id": f.reservation.id,
      "visit.id": f.visit.id, "payment.purpose": "visit_balance", "checkout.replayed": false }; } };
});
for (const type of ["charge", "credit", "discount"]) for (const outcome of ["applied", "already_applied", ...(type !== "charge" ? ["invalid_amount"] : [])]) add("OBS-034", outcome, async (f) => {
  const path = `/internal/customers/${jordan}/account-changes`;
  const body = { visitId: f.visit.id, type, amount: outcome === "invalid_amount" ? 8000 : 1000, currency: "USD", ...(type === "credit" ? { paymentId: randomUUID() } : {}) };
  if (type !== "charge") await f.call("POST", path, { actor: "service", body: { visitId: f.visit.id, type: "charge", amount: 7000, currency: "USD" }, expected: 200 });
  if (outcome === "already_applied") await f.call("POST", path, { actor: "service", body, expected: 200 });
  return { method: "POST", path, options: { actor: "service", body, expected: outcome === "applied" ? 200 : outcome === "invalid_amount" ? 422 : 409 },
    attributes: () => ({ "customer.id": jordan, "visit.id": f.visit.id, "account.change_type": type }) };
});
for (const outcome of ["completed_settled", "completed_outstanding", "already_completed", "invalid_state"]) add("OBS-035", outcome, async (f) => {
  if (outcome === "invalid_state") await f.request(); else await f.recordedVisit();
  const path = `/internal/reservations/${f.reservation.id}/complete`, body = { financialOutcome: outcome === "completed_outstanding" ? "outstanding" : "settled" };
  if (outcome === "already_completed") await f.call("POST", path, { actor: "service", body, expected: 200 });
  return { method: "POST", path, options: { actor: "service", body, expected: outcome.startsWith("completed_") ? 200 : 409 },
    attributes: () => ({ "reservation.id": f.reservation.id, ...(outcome === "invalid_state" ? {} : { "visit.id": f.visit.id }) }) };
});

add("OBS-026", "already_started", async (f) => {
  await f.request(); await f.accept(); await f.clock("2026-10-12T09:00:00-05:00");
  return { method: "POST", path: `/reservations/${f.reservation.id}/cancel`, options: { expected: 422 },
    attributes: () => ({ "reservation.id": f.reservation.id, "customer.id": jordan }) };
});
add("OBS-023", "pet_conflict", async (f) => {
  await f.request(); await f.accept();
  return { method: "POST", path: "/reservations", options: { body: { ...reservationBody(), veterinarianId: seed.vet("Morgan Reed").id }, expected: 422 },
    attributes: () => ({ "customer.id": jordan, "pet.id": milo, "veterinarian.id": seed.vet("Morgan Reed").id }) };
});
for (const outcome of ["slot_unavailable", "pet_conflict"]) add("OBS-024", outcome, async (f) => {
  await f.request(); const target = f.reservation.id;
  await f.request(outcome === "slot_unavailable" ? { petId: seed.pet("Luna").id } : { veterinarianId: seed.vet("Morgan Reed").id });
  await f.call("POST", `/reservations/${f.reservation.id}/accept`, { actor: outcome === "pet_conflict" ? "morgan.reed" : "avery.taylor",
    body: { bookingFee: { method: "card", mockMethodReference: "fake-card-approve" } }, expected: 200 });
  return { method: "POST", path: `/reservations/${target}/accept`, options: { body: { bookingFee: { method: "card", mockMethodReference: "fake-card-approve" } }, expected: 200 },
    attributes: () => ({ "reservation.id": target, "veterinarian.id": avery }) };
});
add("OBS-024", "failed", async (f) => {
  await f.request();
  f.stubs.checkout.respond("POST", "/internal/booking-fees", 502, problem(502, "dependency_failed"));
  return { method: "POST", path: `/reservations/${f.reservation.id}/accept`, options: { body: { bookingFee: { method: "card", mockMethodReference: "fake-card-approve" } }, expected: 502 },
    attributes: () => ({ "reservation.id": f.reservation.id, "veterinarian.id": avery }) };
});
add("OBS-029", "failed", async (f) => {
  // /fees has no 5xx response in its contract. A transport failure is unambiguous.
  await f.stubs["veterinarian-services"].stop();
  return { method: "POST", path: `/visits/${f.visit.id}/checkout`, options: { expected: 502 },
    attributes: () => ({ "visit.id": f.visit.id, "reservation.id": f.reservation.id }) };
});
for (const id of ["OBS-030", "OBS-031", "OBS-033", "OBS-034", "OBS-035"]) add(id, "not_found", async (f) => {
  const q = {
    "OBS-030": { path: `/checkouts/${unknownId}/promotion`, body: { amount: 500 } },
    "OBS-031": { path: `/checkouts/${unknownId}/payments`, body: { amount: 5000, mockMethodReference: "fake-card-approve" } },
    "OBS-033": { path: `/checkouts/${unknownId}/cash-payments`, body: { amount: 5000 } },
    "OBS-034": { path: `/internal/customers/${unknownId}/account-changes`, body: { visitId: f.visit.id, type: "charge", amount: 7000, currency: "USD" } },
    "OBS-035": { path: `/internal/reservations/${unknownId}/complete`, body: { financialOutcome: "settled" } },
  }[id];
  return { method: "POST", path: q.path, options: { body: q.body, actor: ["OBS-034", "OBS-035"].includes(id) ? "service" : "avery.taylor", expected: 404 },
    attributes: () => ({ [id === "OBS-034" ? "customer.id" : id === "OBS-035" ? "reservation.id" : "checkout.id"]: unknownId }) };
});
add("OBS-029", "not_found", async (f) => {
  f.stubs.reservation.respond("GET", "/visits/{visitId}", 404, problem(404, "not_found"));
  return { method: "POST", path: `/visits/${unknownId}/checkout`, options: { expected: 404 }, attributes: () => ({ "visit.id": unknownId }) };
});
add("OBS-033", "recorded", async (f) => ({ method: "POST", path: "/internal/booking-fees", options: { actor: "service", expected: 200,
  body: { reservationId: f.reservation.id, customerId: jordan, amount: 2000, currency: "USD", method: "cash", recordedByVeterinarianId: avery } },
  attributes: async (r) => { assert.equal((await f.providerCalls()).length, 0); return { "payment.attempt.id": r.body.attempt.attemptId,
    "veterinarian.id": avery, "reservation.id": f.reservation.id, "payment.purpose": "booking_fee", "checkout.replayed": false }; } }));

add("OBS-024", "past_start", async (f) => {
  await f.request(); await f.clock("2026-10-12T09:30:00-05:00");
  return { method: "POST", path: `/reservations/${f.reservation.id}/accept`, options: {
    body: { bookingFee: { method: "card", mockMethodReference: "fake-card-approve" } }, expected: 422 },
    attributes: () => { assert.equal(f.stubs.checkout.received("POST", "/internal/booking-fees").length, 0);
      return { "reservation.id": f.reservation.id, "veterinarian.id": avery }; } };
});
for (const id of ["OBS-026", "OBS-027"]) add(id, "not_assigned_veterinarian", async (f) => {
  await f.request(); await f.accept();
  if (id === "OBS-027") await f.clock("2026-10-12T09:05:00-05:00");
  return { method: "POST", path: `/reservations/${f.reservation.id}/${id === "OBS-026" ? "cancel" : "visit"}`,
    options: { actor: "morgan.reed", ...(id === "OBS-027" ? { body: visitBody() } : {}), expected: 403 },
    attributes: () => ({ "reservation.id": f.reservation.id, ...(id === "OBS-027" ? { "veterinarian.id": seed.vet("Morgan Reed").id } : { "customer.id": jordan }) }) };
});
add("OBS-027", "unknown_service", async (f) => {
  await f.request(); await f.accept(); await f.clock("2026-10-12T09:05:00-05:00");
  return { method: "POST", path: `/reservations/${f.reservation.id}/visit`, options: { body: { ...visitBody(), performedServices: [unknownId] }, expected: 422 },
    attributes: async () => {
      assert.equal((await f.call("GET", `/reservations/${f.reservation.id}`, { expected: 200 })).body.visitId, null);
      return { "reservation.id": f.reservation.id, "veterinarian.id": avery };
    } };
});
for (const mismatch of [false, true]) add("OBS-029", "invalid_state", async (f) => {
  if (mismatch) f.reservation.visitId = randomUUID(); else f.reservation.reservationState = "CompletedOutstanding";
  return { method: "POST", path: `/visits/${f.visit.id}/checkout`, options: { expected: 409 }, attributes: async () => {
    await f.call("GET", `/visits/${f.visit.id}/checkout`, { expected: 404 });
    assert.equal(f.stubs.customer.received("POST", "/internal/customers/{customerId}/account-changes").length, 0);
    return { "visit.id": f.visit.id, "reservation.id": f.reservation.id, "veterinarian.id": avery };
  } };
});
add("OBS-031", "invalid_amount", async (f) => {
  await f.finalized(); const q = payRequest(f); q.options.body.amount = 4000; q.options.expected = 422;
  return { ...q, attributes: async (r) => { assert.equal((await f.providerCalls()).length, 0); return payAttrs(f, r); } };
});
for (const outcome of ["recorded", "already_settled", "invalid_amount", "idempotency_conflict"]) add("OBS-033", outcome, async (f) => {
  await f.finalized(); const key = randomUUID(), path = `/checkouts/${f.checkout.id}/cash-payments`;
  let original;
  if (outcome !== "invalid_amount") original = await f.call("POST", path, { body: { amount: 5000 }, headers: { "idempotency-key": key }, expected: 200 });
  const replay = outcome === "recorded";
  const before = f.stubs.customer.received("POST", "/internal/customers/{customerId}/account-changes").length;
  const completed = f.stubs.reservation.received("POST", "/internal/reservations/{reservationId}/complete").length;
  return { method: "POST", path, options: { body: { amount: ["invalid_amount", "idempotency_conflict"].includes(outcome) ? 4000 : 5000 },
    headers: { "idempotency-key": outcome === "already_settled" ? randomUUID() : key }, expected: replay ? 200 : outcome === "invalid_amount" ? 422 : 409 },
    attributes: async (r) => {
      if (replay) { assert.equal(r.body.replayed, true); assert.deepEqual(r.body.attempt, original.body.attempt); }
      else assert.equal(r.body.code, outcome);
      assert.equal(f.stubs.customer.received("POST", "/internal/customers/{customerId}/account-changes").length, before);
      assert.equal(f.stubs.reservation.received("POST", "/internal/reservations/{reservationId}/complete").length, completed);
      assert.equal((await f.providerCalls()).length, 0);
      const stored = await f.call("GET", `/checkouts/${f.checkout.id}`, { expected: 200 });
      assert.deepEqual(stored.body.paymentAttempts, original ? [original.body.attempt] : [], "replay/rejection must not create a new attempt");
      return { "veterinarian.id": avery, "reservation.id": f.reservation.id, "visit.id": f.visit.id, "payment.purpose": "visit_balance",
        "checkout.replayed": replay, ...(replay ? { "payment.attempt.id": original.body.attempt.attemptId } : {}) };
    } };
});

add("OBS-029", "already_finalized", async (f) => {
  await f.finalized(); f.reservation.reservationState = "CompletedSettled";
  const before = f.stubs.customer.received("POST", "/internal/customers/{customerId}/account-changes").length;
  return { method: "POST", path: `/visits/${f.visit.id}/checkout`, options: { expected: 409 }, attributes: () => {
    assert.equal(f.stubs.customer.received("POST", "/internal/customers/{customerId}/account-changes").length, before);
    return { "visit.id": f.visit.id, "reservation.id": f.reservation.id, "veterinarian.id": avery };
  } };
});

for (const [index, c] of cases.entries()) it(`[${c.id}] ${rules[c.id][1]} emits ${c.outcome} (case ${index + 1})`, async (t) => {
  const f = new ServiceFixture(rules[c.id][0]); t.after(() => f.stop()); await f.start();
  const q = await c.arrange(f), ctx = context();
  const r = await send(f, q, ctx.headers);
  if (r.status >= 400) assert.equal(r.body.code, c.outcome === "failed" ? "dependency_failed" : c.outcome);
  const spans = await readTrace(ctx, [spanName(c.id)]);
  assertBusiness(spans, c.id, c.outcome, await q.attributes(r));
});

for (const service of ["reservation", "checkout"]) it(`[OBS-002] ${service} injects client trace parents${service === "reservation" ? " and isolates concurrent requests" : " on finalization"}`, async (t) => {
  const f = new ServiceFixture(service); t.after(() => f.stop()); await f.start();
  const contexts = service === "reservation" ? [context(), context()] : [context()];
  const bodies = [reservationBody(), { ...reservationBody(), petId: seed.pet("Luna").id }];
  const calls = service === "reservation"
    ? contexts.map((ctx, i) => f.call("POST", "/reservations", { actor: "jordan.rivera", body: bodies[i], headers: ctx.headers, expected: 201 }))
    : contexts.map((ctx) => f.call("POST", `/visits/${f.visit.id}/checkout`, { headers: ctx.headers, expected: 201 }));
  const results = await Promise.all(calls);
  for (const [i, ctx] of contexts.entries()) {
    const received = Object.values(f.stubs).flatMap((s) => s.requests).filter((r) => r.headers.traceparent?.includes(ctx.traceId));
    assert.ok(received.length > 0, "no dependency call carried this trace");
    const spans = await readTrace(ctx, [spanName(service === "reservation" ? "OBS-023" : "OBS-029")], received.map((r) => r.headers.traceparent.split("-")[2]));
    if (service === "reservation") {
      assertBusiness(spans, "OBS-023", "requested", { "reservation.id": results[i].body.id, "customer.id": jordan, "pet.id": bodies[i].petId, "veterinarian.id": avery });
      assert.ok(received.some((r) => r.path.includes(`/pets/${bodies[i].petId}/ownership`)), "ownership lookup used the wrong request's pet");
    }
    for (const call of received) {
      assertPropagation(call, ctx, spans);
      const { claims, signatureValid } = decodeJwt((call.headers.authorization ?? "").replace(/^Bearer /, ""));
      assert.ok(signatureValid); assert.equal(claims.role, "service"); assert.equal(claims.sub, service);
    }
  }
  // Also reject calls with no header; filtering above alone would hide them.
  const received = Object.values(f.stubs).flatMap((s) => s.requests).filter((r) => r.path !== "/health");
  for (const call of received) {
    assert.match(call.headers.traceparent ?? "", /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    assert.ok(contexts.some((ctx) => call.headers.traceparent.includes(ctx.traceId)), "dependency call escaped the initiating contexts");
  }
});

it("[OBS-002] acceptance propagates a client parent to the Checkout stub", async (t) => {
  const f = new ServiceFixture("reservation"); t.after(() => f.stop()); await f.start(); await f.request();
  const ctx = context();
  await f.call("POST", `/reservations/${f.reservation.id}/accept`, { headers: ctx.headers,
    body: { bookingFee: { method: "card", mockMethodReference: "fake-card-approve" } }, expected: 200 });
  const calls = f.stubs.checkout.received("POST", "/internal/booking-fees");
  assert.equal(calls.length, 1);
  const spans = await readTrace(ctx, [spanName("OBS-024")], calls.map((r) => r.headers.traceparent?.split("-")[2]));
  assertPropagation(calls[0], ctx, spans);
});
