// Verifies every runnable project follows spec/contracts/runtime-contract.md.
// Rule IDs RT-001..RT-009 are defined in that contract. Protected test.
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PROJECTS, FRONTEND_ORIGIN } from "../../harness/config.js";
import {
  assertImplemented, projectDir, startProject, stopProject, stopAll, ensureRunning, resetProject,
} from "../../harness/processes.js";
import { fetchSpans, waitForSpans } from "../../harness/traces.js";
import { login, bearer, decodeJwt } from "../../harness/auth.js";

const JORDAN = "10000000-0000-4000-8000-000000000201";

after(stopAll);

const hasTestEndpoints = (p) => p.kind === "service" || p.kind === "fake";

for (const [name, p] of Object.entries(PROJECTS)) {
  describe(`${p.title} (${p.folder})`, () => {
    it(`[RT-001] ${p.title} has executable setup and start scripts`, () => {
      for (const script of ["setup", "start"]) {
        const file = path.join(projectDir(name), script);
        assert.ok(fs.existsSync(file), `${p.title} not implemented: ${p.folder}/${script} not found`);
        fs.accessSync(file, fs.constants.X_OK);
      }
    });

    it(`[RT-002] ${p.title} reports healthy on port ${p.port}`, async () => {
      assertImplemented(name);
      await startProject(name);
      const res = await fetch(`http://localhost:${p.port}/health`);
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { status: "ok" });
    });

    it(`[RT-003] ${p.title} listens on the PORT environment variable`, async () => {
      assertImplemented(name);
      const alt = p.port + 100;
      await startProject(name, { port: alt });
      const res = await fetch(`http://localhost:${alt}/health`);
      assert.equal(res.status, 200);
      await stopProject(name);
    });

    if (hasTestEndpoints(p)) {
      it(`[RT-004] ${p.title} resets state with POST /test/reset when test endpoints are enabled`, async () => {
        assertImplemented(name);
        await startProject(name, { testEndpoints: true });
        const res = await fetch(`http://localhost:${p.port}/test/reset`, { method: "POST" });
        assert.equal(res.status, 204);
      });

      it(`[RT-005] ${p.title} hides /test endpoints when test endpoints are disabled`, async () => {
        assertImplemented(name);
        await startProject(name, { testEndpoints: false });
        const res = await fetch(`http://localhost:${p.port}/test/reset`, { method: "POST" });
        assert.equal(res.status, 404);
        await stopProject(name);
      });
    }

    if (p.kind === "service") {
      it(`[RT-006] ${p.title} allows CORS only from FRONTEND_ORIGIN`, async () => {
        assertImplemented(name);
        await startProject(name);
        const preflight = await fetch(`http://localhost:${p.port}/health`, {
          method: "OPTIONS",
          headers: {
            Origin: FRONTEND_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type,idempotency-key",
          },
        });
        assert.equal(preflight.status, 204);
        assert.equal(preflight.headers.get("access-control-allow-origin"), FRONTEND_ORIGIN);
        const allowHeaders = (preflight.headers.get("access-control-allow-headers") ?? "").toLowerCase();
        for (const h of ["authorization", "content-type", "idempotency-key"]) assert.ok(allowHeaders.includes(h), `missing ${h}`);
        const allowMethods = (preflight.headers.get("access-control-allow-methods") ?? "").toUpperCase();
        for (const m of ["GET", "POST", "PUT", "PATCH", "DELETE"]) assert.ok(allowMethods.includes(m), `missing ${m}`);

        const other = await fetch(`http://localhost:${p.port}/health`, { headers: { Origin: "http://evil.example" } });
        assert.equal(other.headers.get("access-control-allow-origin"), null);
      });
    }

    if (p.kind === "service") {
      it(`[RT-008] [OBS-001] ${p.title} exports traces as OTLP/HTTP protobuf named ${p.otelName}`, async () => {
        assertImplemented(name);
        await ensureRunning("collector");
        await resetProject("collector");
        await startProject(name);
        await fetch(`http://localhost:${p.port}/health`);
        const spans = await waitForSpans({ service: p.otelName });
        assert.ok(spans.length > 0);
        const { rejected } = await fetchSpans();
        assert.deepEqual(rejected, [], "collector rejected exports that were not OTLP/HTTP protobuf");
      });
    }

    if (p.kind === "service") {
      it(`[RT-009] ${p.title} moves the clinic clock with POST /test/clock and reset restores it`, async () => {
        assertImplemented(name);
        await startProject(name, { clinicNow: "2026-10-05T09:00:00-05:00" });
        const set = (now) => fetch(`http://localhost:${p.port}/test/clock`, {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ now }),
        });
        assert.equal((await set("2026-10-12T09:05:00-05:00")).status, 204);
        assert.equal((await set("not-a-time")).status, 400);
        if (name === "customer") {
          // Data survives a clock change: a pet added before the change is still there after.
          await set("2026-10-05T09:00:00-05:00");
          const vet = (await login("avery.taylor", "petclinic-demo")).body.token;
          const added = await fetch(`http://localhost:${p.port}/customers/${JORDAN}/pets`, {
            method: "POST", headers: { "content-type": "application/json", ...bearer(vet) },
            body: JSON.stringify({ name: "Clock", type: "cat", breed: "Unknown", estimatedBirthDate: "2024-01-01" }),
          });
          assert.equal(added.status, 201);
          const petId = (await added.json()).id;
          assert.equal((await set("2026-10-12T09:05:00-05:00")).status, 204);
          assert.equal((await fetch(`http://localhost:${p.port}/pets/${petId}`, { headers: bearer(vet) })).status, 200);
          // The clock itself is observable through the clinic-clock iat of a login token.
          const t1 = decodeJwt((await login("jordan.rivera", "petclinic-demo")).body.token).claims.iat;
          assert.equal(t1, Date.parse("2026-10-12T09:05:00-05:00") / 1000);
          await fetch(`http://localhost:${p.port}/test/reset`, { method: "POST" });
          const t2 = decodeJwt((await login("jordan.rivera", "petclinic-demo")).body.token).claims.iat;
          assert.equal(t2, Date.parse("2026-10-05T09:00:00-05:00") / 1000);
        }
      });
    }

    it(`[RT-007] ${p.title} stops within 5 seconds of SIGTERM`, async () => {
      assertImplemented(name);
      await startProject(name);
      const started = Date.now();
      await stopProject(name);
      assert.ok(Date.now() - started < 5500, "did not stop within 5 seconds");
    });
  });
}
