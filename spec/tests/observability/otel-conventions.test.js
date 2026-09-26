// OpenTelemetry conventions for every service (OBS-041, OBS-042). Protected test.
// Business-span parenting and client-span checks run in TEST-01 once SPEC-04 defines
// endpoints that do business work and call other services.
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { PROJECTS } from "../../harness/config.js";
import { assertImplemented, ensureRunning, resetProject, startProject, stopAll } from "../../harness/processes.js";
import { waitForSpans, fetchSpans } from "../../harness/traces.js";
import { serverSpanProblems, resourceProblems, deprecatedProblems } from "../../harness/semconv.js";

after(stopAll);

async function healthSpans(name, p) {
  assertImplemented(name);
  await ensureRunning("collector");
  await resetProject("collector");
  await startProject(name);
  const res = await fetch(`http://localhost:${p.port}/health`);
  assert.equal(res.status, 200);
  return waitForSpans({ service: p.otelName }, (s) => s.some((x) => x.kind === "SERVER"));
}

for (const [name, p] of Object.entries(PROJECTS).filter(([, x]) => x.kind === "service")) {
  describe(`${p.title} OpenTelemetry conventions`, () => {
    it(`[OBS-041] ${p.title} incoming request spans use stable HTTP semantic conventions`, async () => {
      const spans = await healthSpans(name, p);
      const server = spans.find((s) => s.kind === "SERVER" && s.attributes["url.path"] === "/health")
        ?? spans.find((s) => s.kind === "SERVER");
      assert.deepEqual(serverSpanProblems(server), []);
      assert.equal(server.name, "GET /health");
    });

    it(`[OBS-041] ${p.title} spans use no deprecated HTTP attribute names`, async () => {
      await healthSpans(name, p);
      const { spans } = await fetchSpans({ service: p.otelName });
      assert.deepEqual(spans.flatMap(deprecatedProblems), []);
    });

    it(`[OBS-042] ${p.title} resource identifies service, version, and SDK language`, async () => {
      const spans = await healthSpans(name, p);
      assert.deepEqual(resourceProblems(spans[0], p.otelName), []);
    });
  });
}
