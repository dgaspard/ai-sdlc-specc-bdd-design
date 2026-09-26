// Verifies every runnable project follows spec/contracts/runtime-contract.md.
// Rule IDs RT-001..RT-007 are defined in that contract. Protected test.
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PROJECTS, FRONTEND_ORIGIN } from "../../harness/config.js";
import {
  assertImplemented, projectDir, startProject, stopProject, stopAll,
} from "../../harness/processes.js";

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

    it(`[RT-007] ${p.title} stops within 5 seconds of SIGTERM`, async () => {
      assertImplemented(name);
      await startProject(name);
      const started = Date.now();
      await stopProject(name);
      assert.ok(Date.now() - started < 5500, "did not stop within 5 seconds");
    });
  });
}
