import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { setTimeout as sleep } from "node:timers/promises";
import { OPERATIONS, exchange, statistics, assertGate, assertPaid } from "./gate.js";

test("[PERF-001] a real delayed HTTP response fails the unchanged latency gate", async () => {
  const server = http.createServer(async (_request, response) => {
    await sleep(250);
    response.writeHead(200, { "content-type": "application/json" }); response.end('{}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const slow = [];
    for (let batch = 0; batch < 4; batch++) {
      const results = await Promise.all(Array.from({ length: 5 }, () => exchange(`http://127.0.0.1:${server.address().port}`)));
      slow.push(...results.map(result => result.durationMs));
    }
    const samples = Object.fromEntries(OPERATIONS.map(name => [name, Array(20).fill(10)]));
    assert.doesNotThrow(() => assertGate(samples));
    samples.pay = slow;
    assert.throws(() => assertGate(samples), /pay: p95/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test("[PERF-001] nearest-rank p95 and minimum sample count cannot hide incomplete runs", () => {
  assert.equal(statistics(Array.from({ length: 100 }, (_, index) => index + 1)).p95Ms, 95);
  assert.throws(() => assertGate(Object.fromEntries(OPERATIONS.map(name => [name, []]))), /insufficient samples/);
});
test("[PERF-002] an incorrect financial outcome fails independently of speed", () => {
  const result = { attempt: { outcome: "authorized", amount: 5000 }, checkout: { totalAmount: 7000, previouslyPaidAmount: 7000, remainingBalance: 0 } };
  assert.doesNotThrow(() => assertPaid(result));
  result.checkout.remainingBalance = 1;
  assert.throws(() => assertPaid(result));
});
