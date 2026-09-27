// Self-check the new specification fixtures and fault detection without app code.
import { it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PROJECTS, REPO_ROOT } from "../../harness/config.js";
import { StubServer } from "../../harness/stub-server.js";
import { validateRequest, validateResponse } from "../../harness/schema.js";
import { ServiceFixture, jordan, milo, wellness } from "../support/service-fixture.js";
import { operations, inputFor } from "../support/access-cases.js";
import { assertBusiness, assertPropagation, assertCrossProcessParents, context, rules, spanName } from "../support/business-traces.js";

it("[TEST-01] generated access requests conform to every operation's request schema", () => {
  assert.ok(operations.length > 0);
  for (const op of operations) {
    const f = new ServiceFixture(op.service), { path, body } = inputFor(op, f);
    assert.ok(!path.includes("{"), op.operationId);
    assert.ok(op.responses[401], `${op.operationId}: missing unauthorized response`);
    if (["customer", "veterinarian", "service"].some((role) => !op["x-roles"].includes(role))) {
      assert.ok(op.responses[403], `${op.operationId}: excluded role requires a documented 403`);
    }
    if (op.requestBody) assert.deepEqual(validateRequest(op.contract, op.method, path, body).errors, [], op.operationId);
  }
});

it("[TEST-01] every programmed fixture response conforms to its dependency contract", async () => {
  for (const service of ["reservation", "checkout"]) {
    const f = new ServiceFixture(service);
    for (const dep of PROJECTS[service].dependsOn.filter((n) => n !== "payment")) f.stubs[dep] = new StubServer(dep);
    f.programStubs();
    for (const stub of Object.values(f.stubs)) for (const route of stub.routes) {
      const ids = { customerId: jordan, petId: milo, visitId: f.visit.id, reservationId: f.reservation.id, serviceId: wellness };
      const p = route.pathTemplate.replace(/\{([^}]+)\}/g, (_, key) => ids[key]);
      const request = { path: p, url: p + (p === "/fees" ? `?serviceIds=${wellness}` : ""), body: {
        visitId: f.visit.id, reservationId: f.reservation.id, customerId: jordan, method: "card", mockMethodReference: "fake-card-approve",
        amount: 2000, currency: "USD", type: "charge", financialOutcome: "settled",
      } };
      const body = typeof route.body === "function" ? await route.body(request) : route.body;
      assert.deepEqual(validateResponse(stub.contract, route.method, p, route.status, body).errors, [], `${stub.name} ${p}`);
    }
  }
});

it("[TEST-01] business span names and outcome registries match the observability document", () => {
  const doc = fs.readFileSync(path.join(REPO_ROOT, "docs/observability.md"), "utf8");
  for (const [id, rule] of Object.entries(rules)) {
    const row = doc.split("\n").find((line) => line.startsWith(`| ${id} | \``));
    assert.ok(row, id);
    assert.ok(row.includes(`\`${spanName(id)}\``), id);
    const outcomes = [...row.split("|").at(-2).matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    assert.deepEqual(outcomes, rule[2].split(" "), id);
  }
});

function sample() {
  const ctx = context();
  const server = { traceId: ctx.traceId, spanId: "1111111111111111", parentSpanId: ctx.parentId, kind: "SERVER" };
  const business = { traceId: ctx.traceId, spanId: "2222222222222222", parentSpanId: server.spanId, kind: "INTERNAL",
    name: spanName("OBS-031"), serviceName: "petclinic-checkout", startTimeUnixNano: "100", endTimeUnixNano: "200",
    status: { code: "OK" }, attributes: { "petclinic.operation.outcome": "settled", "petclinic.checkout.replayed": false } };
  const client = { traceId: ctx.traceId, spanId: "3333333333333333", parentSpanId: business.spanId, kind: "CLIENT", serviceName: "petclinic-checkout",
    attributes: { "http.request.method": "POST", "server.address": "localhost", "server.port": 4002,
      "url.full": "http://localhost:4002/internal/reservations/example/complete", "http.response.status_code": 200 } };
  const call = { method: "POST", path: "/internal/reservations/example/complete", headers: { traceparent: `00-${ctx.traceId}-${client.spanId}-01` } };
  return { ctx, server, business, client, call, spans: [server, business, client] };
}
it("[TEST-01] trace assertions accept a conforming business span and outgoing parent", () => {
  const s = sample();
  assertBusiness(s.spans, "OBS-031", "settled", { "checkout.replayed": false });
  assertPropagation(s.call, s.ctx, s.spans);
});
it("[OBS-004] [OBS-031] authorized completion failure requires ERROR and its stable error.type", () => {
  const s = sample();
  s.business.attributes["petclinic.operation.outcome"] = "authorized_completion_failed";
  s.business.attributes["error.type"] = "authorized_completion_failed";
  s.business.status.code = "ERROR";
  assertBusiness(s.spans, "OBS-031", "authorized_completion_failed");
  s.business.status.code = "OK";
  assert.throws(() => assertBusiness(s.spans, "OBS-031", "authorized_completion_failed"), assert.AssertionError);
  s.business.status.code = "ERROR";
  delete s.business.attributes["error.type"];
  assert.throws(() => assertBusiness(s.spans, "OBS-031", "authorized_completion_failed"), assert.AssertionError);
});
for (const [name, mutate] of [
  ["missing span", (s) => s.spans.splice(1, 1)],
  ["duplicate business span", (s) => s.spans.push(structuredClone(s.business))],
  ["wrong outcome", (s) => s.business.attributes["petclinic.operation.outcome"] = "declined"],
  ["wrong status", (s) => s.business.status.code = "UNSET"],
  ["wrong replay flag", (s) => s.business.attributes["petclinic.checkout.replayed"] = true],
  ["unended span", (s) => s.business.endTimeUnixNano = "0"],
  ["wrong server parent", (s) => s.business.parentSpanId = s.client.spanId],
]) it(`[TEST-01] business assertion detects ${name}`, () => {
  const s = sample(); mutate(s);
  assert.throws(() => assertBusiness(s.spans, "OBS-031", "settled", { "checkout.replayed": false }), assert.AssertionError);
});
for (const [name, mutate] of [
  ["missing header", (s) => delete s.call.headers.traceparent],
  ["crossed contexts", (s) => s.ctx.traceId = "a".repeat(32)],
  ["forwarded incoming parent", (s) => s.call.headers.traceparent = s.ctx.headers.traceparent],
  ["non-client parent", (s) => s.client.kind = "INTERNAL"],
  ["wrong HTTP destination", (s) => s.client.attributes["url.full"] = "http://localhost:4002/wrong"],
]) it(`[TEST-01] propagation assertion detects ${name}`, () => {
  const s = sample(); mutate(s);
  assert.throws(() => assertPropagation(s.call, s.ctx, s.spans), assert.AssertionError);
});
it("[TEST-01] cross-process assertion rejects a server parented by a business span", () => {
  const s = sample();
  s.spans.push({ traceId: s.ctx.traceId, spanId: "4444444444444444", parentSpanId: s.business.spanId, kind: "SERVER", serviceName: "petclinic-reservation" });
  assert.throws(() => assertCrossProcessParents(s.spans), assert.AssertionError);
});
it("[TEST-01] cross-process assertion rejects forwarding the external parent to a second server", () => {
  const s = sample();
  s.spans.push({ traceId: s.ctx.traceId, spanId: "4444444444444444", parentSpanId: s.ctx.parentId, kind: "SERVER", serviceName: "petclinic-reservation" });
  assert.throws(() => assertCrossProcessParents(s.spans), assert.AssertionError);
});
