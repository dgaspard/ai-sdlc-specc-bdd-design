import assert from "node:assert/strict";
import test from "node:test";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor
} from "@opentelemetry/sdk-trace-base";
import { seedVisit, startTestServer } from "../helpers/test-server.js";

test("cancelling a visit emits an operationally useful trace", async () => {
  const exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)]
  });
  trace.setGlobalTracerProvider(provider);

  const server = await startTestServer();
  let spans;

  try {
    await seedVisit(server.baseUrl);
    await fetch(`${server.baseUrl}/api/pets/1/visits/1`, { method: "DELETE" });
    await provider.forceFlush();
    spans = exporter.getFinishedSpans();
  } finally {
    await server.close();
    await provider.shutdown();
    trace.disable();
  }

  const cancellationSpan = spans.find(
    (span) => span.name === "petclinic.visit.cancel"
  );

  assert.ok(
    cancellationSpan,
    "expected a completed span named petclinic.visit.cancel"
  );
  assert.equal(cancellationSpan.status.code, SpanStatusCode.OK);
  assert.equal(cancellationSpan.attributes["petclinic.pet.id"], 1);
  assert.equal(cancellationSpan.attributes["petclinic.visit.id"], 1);
  assert.equal(
    cancellationSpan.attributes["petclinic.visit.outcome"],
    "cancelled"
  );
});
