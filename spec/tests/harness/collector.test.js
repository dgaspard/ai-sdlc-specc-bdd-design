// Self-check for the OTLP test collector: accepts protobuf, rejects JSON (A-10). Protected test.
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { ensureRunning, resetProject, stopAll } from "../../harness/processes.js";
import { projectUrl } from "../../harness/config.js";
import { fetchSpans, waitForSpans, isChildOf, traceTree } from "../../harness/traces.js";
import { encodeRequest } from "../../harness/collector/otlp.js";

const url = () => `${projectUrl("collector")}/v1/traces`;
const bytes = (h) => Buffer.from(h, "hex");
const TRACE = "0af7651916cd43dd8448eb211c80319c";

function request(service, spans) {
  return {
    resourceSpans: [{
      resource: { attributes: [{ key: "service.name", value: { stringValue: service } }] },
      scopeSpans: [{ scope: { name: "selftest" }, spans }],
    }],
  };
}
const span = (id, parent, name, kind) => ({
  traceId: bytes(TRACE), spanId: bytes(id), parentSpanId: parent ? bytes(parent) : undefined, name, kind,
  startTimeUnixNano: "1790000000000000000", endTimeUnixNano: "1790000000005000000",
  attributes: [{ key: "petclinic.operation.outcome", value: { stringValue: "settled" } }],
  status: { code: 1 },
});

describe("OTLP test collector", () => {
  before(async () => { await ensureRunning("collector"); await resetProject("collector"); });
  after(stopAll);

  it("[COLLECTOR] accepts OTLP/HTTP protobuf and links spans across services", async () => {
    for (const [svc, s] of [
      ["petclinic-checkout", span("b7ad6b7169203331", null, "petclinic.checkout.pay", 2)],
      ["petclinic-customer", span("00f067aa0ba902b7", "b7ad6b7169203331", "petclinic.customer.apply_account_change", 2)],
    ]) {
      const res = await fetch(url(), { method: "POST", headers: { "content-type": "application/x-protobuf" }, body: encodeRequest(request(svc, [s])) });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("content-type"), "application/x-protobuf");
    }
    const spans = await waitForSpans({ traceId: TRACE }, (s) => s.length === 2);
    const parent = spans.find((s) => s.serviceName === "petclinic-checkout");
    const child = spans.find((s) => s.serviceName === "petclinic-customer");
    assert.equal(parent.kind, "SERVER");
    assert.equal(parent.attributes["petclinic.operation.outcome"], "settled");
    assert.ok(isChildOf(child, parent));
    assert.match(traceTree(spans), /petclinic-checkout {2}petclinic\.checkout\.pay[\s\S]*\n {2}petclinic-customer/);
  });

  it("[COLLECTOR] rejects OTLP/HTTP JSON with 415 and records it", async () => {
    const res = await fetch(url(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ resourceSpans: [] }) });
    assert.equal(res.status, 415);
    const { rejected } = await fetchSpans();
    assert.equal(rejected.at(-1).contentType, "application/json");
  });
});
