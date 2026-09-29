import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { setTimeout as sleep } from "node:timers/promises";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import { ServiceFixture, avery, wellness, visitBody } from "../support/service-fixture.js";
import { registration } from "../support/registration.js";
import { PROJECTS, projectUrl } from "../../harness/config.js";
import { validateRequest, validateResponse } from "../../harness/schema.js";
import { POLICY, OPERATIONS, exchange, statistics, assertGate, assertPaid } from "./gate.js";

// Dates remain within daylight time; these fixture slots are unique across workers.
function slots(firstDate, count) {
  const result = [], day = new Date(`${firstDate}T12:00:00Z`);
  while (result.length < count) {
    if (![0, 6].includes(day.getUTCDay())) for (const hour of [8, 9, 10, 11, 13, 14, 15, 16]) {
      const start = `${day.toISOString().slice(0, 10)}T${String(hour).padStart(2, "0")}:00:00-05:00`;
      result.push({ scheduledStart: start, scheduledEnd: new Date(Date.parse(start) + 3600000).toISOString() });
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return result.slice(0, count);
}

test("[PERF-001] [PERF-002] five local workers preserve latency and financial correctness", { timeout: 60000 }, async () => {
  const started = performance.now(), fixture = new ServiceFixture("checkout", { real: true });
  const samples = Object.fromEntries(OPERATIONS.map(name => [name, []]));
  const report = { policy: POLICY, environment: { platform: os.platform(), release: os.release(), architecture: os.arch(), node: process.version, cpus: os.cpus().length }, samples, passed: false };
  let vetToken;
  async function call(service, method, path, body, token = vetToken, operation) {
    if (body !== undefined) assert.deepEqual(validateRequest(PROJECTS[service].contract, method, path, body).errors, []);
    const result = await exchange(`${projectUrl(service)}${path}`, { method,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json", "idempotency-key": randomUUID() },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (operation) samples[operation].push(result.durationMs);
    const expected = method === "POST" && (/^\/reservations$|\/visit$|\/checkout$|\/register$/.test(path)) ? 201 : 200;
    assert.equal(result.status, expected, `${method} ${path}: ${JSON.stringify(result.body)}`);
    assert.deepEqual(validateResponse(PROJECTS[service].contract, method, path, result.status, result.body).errors, []);
    return result.body;
  }
  const login = username => call("customer", "POST", "/auth/login", { username, password: "petclinic-demo" }, null).then(result => result.token);
  const reservation = (worker, slot) => ({ customerId: worker.customer.id, petId: worker.petId, veterinarianId: avery, requestedServices: [wellness], ...slot });
  const accept = (id, operation) => call("reservation", "POST", `/reservations/${id}/accept`, { bookingFee: { method: "card", mockMethodReference: "fake-card-approve" } }, vetToken, operation);
  async function workersTogether(workers, work) {
    const results = await Promise.allSettled(workers.map(work));
    const failed = results.find(result => result.status === "rejected");
    if (failed) throw failed.reason; // all in-flight workers finish before teardown
  }
  try {
    await fixture.start();
    await fixture.clock("2026-09-01T07:00:00-05:00");
    vetToken = await login("avery.taylor");
    const iterations = (POLICY.warmupMs + POLICY.measureMs) / POLICY.cadenceMs;
    const total = iterations * POLICY.workers;
    const past = slots("2026-09-07", total), future = slots("2026-10-12", total);
    const workers = [];
    for (let index = 0; index < POLICY.workers; index++) {
      const body = registration(); body.username = `perf-${index}`;
      const customer = await call("customer", "POST", "/auth/register", body, null);
      workers.push({ index, customer, petId: body.pets[0].id, username: body.username, token: await login(body.username), rows: [], visits: [], completed: [] });
    }
    await workersTogether(workers, async worker => {
      for (let i = 0; i < iterations; i++) {
        const row = await call("reservation", "POST", "/reservations", reservation(worker, past[i * POLICY.workers + worker.index]), worker.token);
        assert.equal(row.reservationState, "Requested");
        assert.equal((await accept(row.id)).reservationState, "Accepted"); worker.rows.push(row);
      }
    });
    await fixture.clock("2026-10-05T09:00:00-05:00");
    vetToken = await login("avery.taylor");
    await workersTogether(workers, async worker => {
      worker.token = await login(worker.username);
      for (const row of worker.rows) worker.visits.push(await call("reservation", "POST", `/reservations/${row.id}/visit`, visitBody()));
    });
    report.setupMs = performance.now() - started;
    async function phase(duration, offset, measured) {
      const start = performance.now(), deadline = start + duration;
      await workersTogether(workers, async worker => {
        let nextStart = start;
        for (let round = 0; round < duration / POLICY.cadenceMs; round++) {
          await sleep(Math.max(0, nextStart - performance.now()));
          if (performance.now() >= deadline) break;
          nextStart = performance.now() + POLICY.cadenceMs;
          const i = round + offset;
          const row = await call("reservation", "POST", "/reservations", reservation(worker, future[i * POLICY.workers + worker.index]), worker.token, measured ? "request" : undefined);
          assert.equal(row.reservationState, "Requested");
          const accepted = await accept(row.id, measured ? "accept" : undefined);
          assert.equal(accepted.reservationState, "Accepted"); assert.equal(accepted.bookingFeePaid, true);
          const checkout = await call("checkout", "POST", `/visits/${worker.visits[i].id}/checkout`, undefined, vetToken, measured ? "finalize" : undefined);
          assert.equal(checkout.remainingBalance, 5000);
          const paid = await call("checkout", "POST", `/checkouts/${checkout.id}/payments`, { amount: 5000, mockMethodReference: "fake-card-approve" }, worker.token, measured ? "pay" : undefined);
          assertPaid(paid); worker.completed.push({ checkout, visit: worker.visits[i] });
        }
      });
      await sleep(Math.max(0, deadline - performance.now()));
      return performance.now() - start;
    }
    report.warmupMs = await phase(POLICY.warmupMs, 0, false);
    report.measuredWallMs = await phase(POLICY.measureMs, POLICY.warmupMs / POLICY.cadenceMs, true);
    report.operations = assertGate(samples);
    await workersTogether(workers, async worker => {
      const account = await call("customer", "GET", `/customers/${worker.customer.id}/account`, undefined, worker.token);
      assert.equal(account.outstandingBalance, 0); assert.equal(account.entries.length, worker.completed.length);
      for (const { checkout, visit } of worker.completed) {
        const entry = account.entries.find(item => item.visitId === visit.id);
        assert.ok(entry); assert.equal(entry.amountOwed, 7000); assert.equal(entry.amountCredited, 7000);
        assert.equal(entry.amountDiscounted, 0); assert.equal(entry.paymentIds.length, 2);
        assert.equal(new Set(entry.paymentIds).size, 2);
        const row = await call("reservation", "GET", `/reservations/${checkout.reservationId}`, undefined, worker.token);
        assert.equal(row.reservationState, "CompletedSettled");
      }
    });
    const calls = await fixture.providerCalls();
    assert.equal(calls.length, total + 2 * workers.reduce((sum, worker) => sum + worker.completed.length, 0));
    assert.equal(new Set(calls.map(item => item.request.attemptId)).size, calls.length);
    assert.ok(calls.every(item => item.status === 200 && !item.replayed));
    report.passed = true;
  } catch (error) { report.error = error.message; throw error; }
  finally {
    await fixture.stop();
    report.totalMs = performance.now() - started;
    report.operations ??= Object.fromEntries(OPERATIONS.map(name => [name, statistics(samples[name])]));
    // Resolve from spec/tests/performance to repository test-results, not protected spec/.
    const output = new URL("../../../test-results/performance/", import.meta.url);
    await mkdir(output, { recursive: true });
    await writeFile(new URL("latest.json", output), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ passed: report.passed, operations: report.operations, totalMs: report.totalMs, error: report.error }));
  }
});
