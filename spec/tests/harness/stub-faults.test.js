// Self-check for stub transport faults (SPEC-07, ENG-02 REV-001). Protected test.
import { it } from "node:test";
import assert from "node:assert/strict";
import { StubServer } from "../../harness/stub-server.js";
import { projectUrl } from "../../harness/config.js";

const call = (path, signal) => fetch(`${projectUrl("customer")}${path}`, { method: "POST", body: "{}", signal });

it("[SPEC-07] a reset fault drops the connection once, then normal routes answer", async (t) => {
  const stub = new StubServer("customer", { validate: false });
  t.after(() => stub.stop());
  await stub.start();
  stub.respond("POST", "/x", 200, { ok: true }).fault("POST", "/x", "reset");
  await assert.rejects(call("/x"), "the first request sees a transport error, not an HTTP status");
  const second = await call("/x");
  assert.equal(second.status, 200);
  assert.deepEqual(stub.requests.map((r) => r.fault ?? "answered"), ["reset", "answered"]);
});

it("[SPEC-07] a hang fault never answers, and stop() releases the connection", async (t) => {
  const stub = new StubServer("customer", { validate: false });
  t.after(() => stub.stop());
  await stub.start();
  stub.respond("POST", "/x", 200, { ok: true }).fault("POST", "/x", "hang");
  await assert.rejects(call("/x", AbortSignal.timeout(300)), (e) => e.name === "TimeoutError");
  assert.equal(stub.requests.length, 1);
  assert.equal(stub.requests[0].fault, "hang");
});

it("[SPEC-07] a fault on a route its contract lacks is refused", () => {
  const stub = new StubServer("customer");
  assert.throws(() => stub.fault("POST", "/not-in-contract", "reset"), /contract has no POST/);
  assert.throws(() => new StubServer("customer", { validate: false }).fault("POST", "/x", "slow"), /Unknown stub fault/);
});
