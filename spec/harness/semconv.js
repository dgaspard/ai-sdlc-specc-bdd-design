// OpenTelemetry semantic-convention checks (OTEL-01). Pinned reference: semantic
// conventions v1.44.0; only the stable HTTP subset (stable since v1.23) is enforced,
// so SDK version differences between languages do not matter. Protected scaffolding.
export const SEMCONV_VERSION = "1.44.0";

export const SERVER_REQUIRED = ["http.request.method", "http.route", "url.path", "url.scheme", "http.response.status_code"];
export const CLIENT_REQUIRED = ["http.request.method", "server.address", "server.port", "url.full", "http.response.status_code"];
export const RESOURCE_REQUIRED = ["service.name", "service.version", "telemetry.sdk.language"];
export const DEPRECATED = ["http.method", "http.status_code", "http.url", "http.target", "net.peer.name"];

const missing = (obj, keys) => keys.filter((k) => obj[k] === undefined || obj[k] === null || obj[k] === "");

/** Problems with an incoming-request (SERVER) span; [] when it conforms. */
export function serverSpanProblems(span) {
  const a = span.attributes;
  const out = missing(a, SERVER_REQUIRED).map((k) => `missing ${k}`);
  if (a["http.request.method"] && a["http.route"]) {
    const expected = `${a["http.request.method"]} ${a["http.route"]}`;
    if (span.name !== expected) out.push(`span name "${span.name}" should be "${expected}"`);
  }
  if (Number(a["http.response.status_code"]) >= 500 && !a["error.type"]) out.push("5xx response without error.type");
  return out.concat(deprecatedProblems(span));
}

/** Problems with an outgoing-call (CLIENT) span; [] when it conforms. */
export function clientSpanProblems(span) {
  const a = span.attributes;
  const out = missing(a, CLIENT_REQUIRED).map((k) => `missing ${k}`);
  if (Number(a["http.response.status_code"]) >= 500 && !a["error.type"]) out.push("5xx response without error.type");
  return out.concat(deprecatedProblems(span));
}

export function deprecatedProblems(span) {
  return DEPRECATED.filter((k) => k in span.attributes).map((k) => `deprecated attribute ${k}`);
}

/** Problems with a span's resource (OBS-042). */
export function resourceProblems(span, expectedServiceName) {
  const out = missing(span.resource, RESOURCE_REQUIRED).map((k) => `resource missing ${k}`);
  if (expectedServiceName && span.resource["service.name"] !== expectedServiceName) {
    out.push(`service.name "${span.resource["service.name"]}" should be "${expectedServiceName}"`);
  }
  return out;
}

/** A petclinic.* business span must be a child of the SERVER span for the same request. */
export function businessParentProblems(businessSpan, spans) {
  const parent = spans.find((s) => s.spanId === businessSpan.parentSpanId && s.traceId === businessSpan.traceId);
  if (!parent) return [`${businessSpan.name} has no parent span in the trace`];
  if (parent.kind !== "SERVER") return [`${businessSpan.name} parent is ${parent.kind}, expected the SERVER request span`];
  return [];
}
