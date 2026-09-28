import assert from "node:assert/strict";
import { ServiceFixture } from "../spec/tests/support/service-fixture.js";
import {
  context,
  readTrace,
  spanName,
  assertCrossProcessParents,
} from "../spec/tests/support/business-traces.js";
import { traceTree } from "../spec/harness/traces.js";

const fixture = new ServiceFixture("checkout", { real: true });
try {
  await fixture.start();
  await fixture.finalized();
  const trace = context();
  const result = await fixture.call(
    "POST",
    `/checkouts/${fixture.checkout.id}/payments`,
    {
      actor: "jordan.rivera",
      body: { amount: 5000, mockMethodReference: "fake-card-approve" },
      headers: trace.headers,
      expected: 200,
    },
  );
  assert.equal(result.body.checkout.remainingBalance, 0);
  const spans = await readTrace(
    trace,
    ["OBS-031", "OBS-032", "OBS-034", "OBS-035"].map(spanName),
  );
  assertCrossProcessParents(spans);
  console.log(
    `Trace ${trace.traceId} (${spans.length} spans)\n${traceTree(spans)}`,
  );
} finally {
  await fixture.stop();
}
