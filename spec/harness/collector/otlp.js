// Decodes and encodes OTLP/HTTP protobuf trace messages using the vendored .proto files.
import path from "node:path";
import { fileURLToPath } from "node:url";
import protobuf from "protobufjs";

const protoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "proto");
const root = new protobuf.Root();
root.resolvePath = (_origin, target) => path.join(protoRoot, target);
root.loadSync("opentelemetry/proto/collector/trace/v1/trace_service.proto", { keepCase: false });

export const ExportTraceServiceRequest = root.lookupType("opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest");
export const ExportTraceServiceResponse = root.lookupType("opentelemetry.proto.collector.trace.v1.ExportTraceServiceResponse");

const KINDS = ["UNSPECIFIED", "INTERNAL", "SERVER", "CLIENT", "PRODUCER", "CONSUMER"];
const STATUS = ["UNSET", "OK", "ERROR"];
const hex = (b) => (b && b.length ? Buffer.from(b).toString("hex") : null);

function anyValue(v) {
  if (!v) return null;
  switch (v.value) {
    case "stringValue": return v.stringValue;
    case "boolValue": return v.boolValue;
    case "intValue": return Number(v.intValue);
    case "doubleValue": return v.doubleValue;
    case "arrayValue": return (v.arrayValue?.values ?? []).map(anyValue);
    case "kvlistValue": return attrs(v.kvlistValue?.values);
    case "bytesValue": return hex(v.bytesValue);
    default: return null;
  }
}

function attrs(list = []) {
  const out = {};
  for (const kv of list) out[kv.key] = anyValue(kv.value);
  return out;
}

/** Decodes an ExportTraceServiceRequest body into flat, JSON-friendly spans. */
export function decodeSpans(buffer) {
  const msg = ExportTraceServiceRequest.decode(buffer);
  const obj = ExportTraceServiceRequest.toObject(msg, { longs: String, oneofs: true, defaults: false });
  const spans = [];
  for (const rs of obj.resourceSpans ?? []) {
    const resource = attrs(rs.resource?.attributes);
    for (const ss of rs.scopeSpans ?? []) {
      for (const s of ss.spans ?? []) {
        spans.push({
          traceId: hex(s.traceId),
          spanId: hex(s.spanId),
          parentSpanId: hex(s.parentSpanId),
          name: s.name ?? "",
          kind: KINDS[s.kind ?? 0] ?? String(s.kind),
          serviceName: resource["service.name"] ?? null,
          resource,
          scope: ss.scope?.name ?? null,
          attributes: attrs(s.attributes),
          status: { code: STATUS[s.status?.code ?? 0] ?? String(s.status?.code), message: s.status?.message ?? "" },
          startTimeUnixNano: s.startTimeUnixNano ?? "0",
          endTimeUnixNano: s.endTimeUnixNano ?? "0",
          events: (s.events ?? []).map((e) => ({ name: e.name, attributes: attrs(e.attributes) })),
        });
      }
    }
  }
  return spans;
}

export function emptyResponse() {
  return Buffer.from(ExportTraceServiceResponse.encode(ExportTraceServiceResponse.create({})).finish());
}

/** Test helper: encodes spans the way an SDK exporter would. */
export function encodeRequest(obj) {
  // fromObject converts string nanosecond timestamps to 64-bit values, as SDKs do.
  return Buffer.from(ExportTraceServiceRequest.encode(ExportTraceServiceRequest.fromObject(obj)).finish());
}
