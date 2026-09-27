import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { waitForSpans } from "../../harness/traces.js";
import { businessParentProblems, clientSpanProblems } from "../../harness/semconv.js";
import { PROJECTS } from "../../harness/config.js";

export const rules = {
  "OBS-023": ["reservation", "request", "requested denied_outstanding_balance invalid_slot past_start pet_conflict not_found failed"],
  "OBS-024": ["reservation", "accept", "accepted past_start booking_payment_declined slot_unavailable pet_conflict not_assigned_veterinarian invalid_state not_found failed"],
  "OBS-025": ["reservation", "deny", "denied not_assigned_veterinarian invalid_state not_found failed"],
  "OBS-026": ["reservation", "cancel", "canceled already_started not_assigned_veterinarian invalid_state not_found failed"],
  "OBS-027": ["reservation", "record_visit", "recorded already_recorded not_assigned_veterinarian invalid_state unknown_service not_found failed"],
  "OBS-028": ["veterinarian-services", "get_fees", "found unknown_service failed"],
  "OBS-029": ["checkout", "finalize_bill", "finalized already_finalized not_assigned_veterinarian unknown_service invalid_state not_found failed"],
  "OBS-030": ["checkout", "apply_promotion", "applied already_applied nothing_owed not_found failed"],
  "OBS-031": ["checkout", "pay", "settled declined already_settled invalid_amount idempotency_conflict authorized_completion_failed not_found failed"],
  "OBS-032": ["checkout", "payment.authorize", "authorized declined failed"],
  "OBS-033": ["checkout", "record_cash", "recorded already_settled invalid_amount idempotency_conflict not_found failed"],
  "OBS-034": ["customer", "apply_account_change", "applied already_applied invalid_amount not_found failed"],
  "OBS-035": ["reservation", "complete", "completed_settled completed_outstanding already_completed invalid_state not_found failed"],
};
const success = new Set(["requested", "accepted", "canceled", "recorded", "found", "finalized", "applied", "settled", "authorized", "completed_settled", "completed_outstanding"]);
export const spanName = (id) => id === "OBS-032" ? "petclinic.payment.authorize"
  : `petclinic.${rules[id][0].replaceAll("-", "_")}.${rules[id][1]}`;
export function context() {
  const traceId = randomBytes(16).toString("hex"), parentId = randomBytes(8).toString("hex");
  return { traceId, parentId, headers: { traceparent: `00-${traceId}-${parentId}-01` } };
}
export async function readTrace(ctx, expectedNames, expectedIds = []) {
  return waitForSpans({ traceId: ctx.traceId }, (spans) =>
    spans.some((s) => s.kind === "SERVER" && s.parentSpanId === ctx.parentId)
    && expectedNames.every((name) => spans.some((s) => s.name === name))
    && expectedIds.every((id) => spans.some((s) => s.spanId === id))
    && spans.every((s) => s.parentSpanId === ctx.parentId || spans.some((p) => p.spanId === s.parentSpanId)));
}
export function assertBusiness(spans, id, outcome, attributes = {}) {
  const matches = spans.filter((s) => s.name === spanName(id) && s.serviceName === PROJECTS[rules[id][0]].otelName);
  assert.equal(matches.length, 1, `${id}: expected exactly one ${spanName(id)}, saw ${matches.length}`);
  const s = matches[0];
  assert.ok(rules[id][2].split(" ").includes(outcome), `undefined expectation: ${outcome}`);
  assert.equal(s.attributes["petclinic.operation.outcome"], outcome);
  const status = ["failed", "authorized_completion_failed"].includes(outcome) ? "ERROR" : success.has(outcome) ? "OK" : "UNSET";
  assert.equal(s.status.code, status);
  if (outcome === "authorized_completion_failed") assert.equal(s.attributes["error.type"], "authorized_completion_failed");
  if (outcome === "failed") assert.ok(s.attributes["error.type"], "unexpected failure needs error.type");
  assert.ok(BigInt(s.endTimeUnixNano) >= BigInt(s.startTimeUnixNano) && BigInt(s.endTimeUnixNano) > 0n, "span must be ended");
  for (const [key, value] of Object.entries(attributes)) assert.deepEqual(s.attributes[`petclinic.${key}`], value, key);
  if (id === "OBS-032") assert.equal(s.kind, "CLIENT");
  else assert.deepEqual(businessParentProblems(s, spans), []);
  return s;
}
export function assertPropagation(call, ctx, spans) {
  const match = /^00-([0-9a-f]{32})-([0-9a-f]{16})-01$/.exec(call.headers.traceparent ?? "");
  assert.ok(match, `missing/invalid traceparent on ${call.method} ${call.path}`);
  assert.equal(match[1], ctx.traceId);
  assert.notEqual(match[2], ctx.parentId, "incoming header was forwarded without a client span");
  const client = spans.find((s) => s.spanId === match[2] && s.traceId === ctx.traceId);
  assert.ok(client, "propagated parent is not an exported span");
  assert.equal(client.kind, "CLIENT");
  assert.deepEqual(clientSpanProblems(client), []);
  const url = new URL(client.attributes["url.full"]);
  assert.equal(url.pathname, call.path);
  assert.equal(client.attributes["http.request.method"], call.method);
}
export function assertCrossProcessParents(spans) {
  const roots = spans.filter((s) => s.kind === "SERVER" && !spans.some((p) => p.spanId === s.parentSpanId));
  assert.equal(roots.length, 1, "only the initiating SERVER may have an external parent");
  for (const server of spans.filter((s) => s.kind === "SERVER")) {
    const parent = spans.find((s) => s.spanId === server.parentSpanId);
    if (!parent) continue; // the single externally supplied initiating parent
    assert.equal(parent.kind, "CLIENT");
    assert.equal(parent.traceId, server.traceId);
    assert.notEqual(parent.serviceName, server.serviceName);
  }
}
