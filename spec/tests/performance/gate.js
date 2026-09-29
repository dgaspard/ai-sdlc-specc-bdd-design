import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

export const OPERATIONS = ["request", "accept", "finalize", "pay"];
export const POLICY = Object.freeze({ workers: 5, warmupMs: 2000, measureMs: 10000,
  cadenceMs: 500, p95Ms: 200, minSamples: 20, requestTimeoutMs: 2000 });

// Timing ends after the response body arrives; parsing and assertions are outside it.
export async function exchange(url, options = {}) {
  const start = performance.now();
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(POLICY.requestTimeoutMs) });
  const text = await response.text();
  return { status: response.status, durationMs: performance.now() - start, body: JSON.parse(text) };
}
export function statistics(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return { count: sorted.length, p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1] ?? null,
    maxMs: sorted.at(-1) ?? null };
}
export function assertGate(samples) {
  const result = Object.fromEntries(OPERATIONS.map(name => [name, statistics(samples[name])]));
  for (const [name, stats] of Object.entries(result)) {
    assert.ok(stats.count >= POLICY.minSamples, `${name}: insufficient samples (${stats.count})`);
    assert.ok(Number.isFinite(stats.p95Ms) && stats.p95Ms < POLICY.p95Ms,
      `${name}: p95 ${stats.p95Ms?.toFixed(1)} ms must be below ${POLICY.p95Ms} ms`);
  }
  return result;
}
export function assertPaid(result, amount = 5000) {
  assert.equal(result.attempt.outcome, "authorized");
  assert.equal(result.attempt.amount, amount);
  assert.equal(result.checkout.totalAmount, 7000);
  assert.equal(result.checkout.previouslyPaidAmount, 7000);
  assert.equal(result.checkout.remainingBalance, 0);
}
