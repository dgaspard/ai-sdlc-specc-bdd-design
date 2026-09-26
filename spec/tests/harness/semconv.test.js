// Self-check for the semantic-convention helpers. Protected test.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { serverSpanProblems, clientSpanProblems, resourceProblems, businessParentProblems } from "../../harness/semconv.js";

const server = (attrs, name = "GET /customers/{customerId}") => ({
  name, kind: "SERVER", spanId: "a", traceId: "t",
  attributes: { "http.request.method": "GET", "http.route": "/customers/{customerId}", "url.path": "/customers/1", "url.scheme": "http", "http.response.status_code": 200, ...attrs },
  resource: { "service.name": "petclinic-customer", "service.version": "1.0.0", "telemetry.sdk.language": "nodejs" },
});

describe("semantic-convention helpers", () => {
  it("[SEMCONV] accepts a conforming server span", () => assert.deepEqual(serverSpanProblems(server({})), []));
  it("[SEMCONV] flags a wrong span name, deprecated names, and 5xx without error.type", () => {
    const p = serverSpanProblems(server({ "http.method": "GET", "http.response.status_code": 503 }, "GET"));
    assert.equal(p.length, 3);
  });
  it("[SEMCONV] flags missing client attributes", () => {
    assert.deepEqual(clientSpanProblems({ attributes: { "http.request.method": "POST" } }),
      ["missing server.address", "missing server.port", "missing url.full", "missing http.response.status_code"]);
  });
  it("[SEMCONV] checks resource attributes and service name", () => {
    assert.deepEqual(resourceProblems(server({}), "petclinic-customer"), []);
    assert.equal(resourceProblems(server({}), "petclinic-checkout").length, 1);
  });
  it("[SEMCONV] requires business spans to be children of the SERVER span", () => {
    const s = server({});
    assert.deepEqual(businessParentProblems({ name: "petclinic.customer.check_eligibility", parentSpanId: "a", traceId: "t" }, [s]), []);
    assert.equal(businessParentProblems({ name: "x", parentSpanId: "zzz", traceId: "t" }, [s]).length, 1);
  });
});
