// OTLP/HTTP test collector (protected scaffolding). Accepts traces only as
// application/x-protobuf on POST /v1/traces (PROJECT-PLAN A-10). Anything else is
// rejected with 415 and recorded, so a service exporting the wrong format is caught.
import http from "node:http";
import zlib from "node:zlib";
import { decodeSpans, emptyResponse } from "./otlp.js";

const port = Number(process.env.PORT || 4318);
const testEndpoints = process.env.PETCLINIC_TEST_ENDPOINTS === "enabled";
let spans = [];
let rejected = [];

const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  let buf = Buffer.concat(chunks);
  if ((req.headers["content-encoding"] ?? "").toLowerCase() === "gzip") buf = zlib.gunzipSync(buf);
  return buf;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  try {
    if (req.method === "GET" && url.pathname === "/health") return json(res, 200, { status: "ok" });

    if (url.pathname === "/v1/traces" && req.method === "POST") {
      const type = (req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
      const body = await readBody(req);
      if (type !== "application/x-protobuf") {
        rejected.push({ contentType: type || "(none)", userAgent: req.headers["user-agent"] ?? null, bytes: body.length });
        return json(res, 415, { error: "OTLP/HTTP protobuf required (Content-Type: application/x-protobuf)" });
      }
      spans.push(...decodeSpans(body));
      res.writeHead(200, { "content-type": "application/x-protobuf" });
      return res.end(emptyResponse());
    }
    if (["/v1/metrics", "/v1/logs"].includes(url.pathname)) {
      return json(res, 404, { error: "traces only (OTEL_METRICS_EXPORTER and OTEL_LOGS_EXPORTER must be none)" });
    }

    if (url.pathname.startsWith("/test/")) {
      if (!testEndpoints) return json(res, 404, { error: "not found" });
      if (req.method === "POST" && url.pathname === "/test/reset") {
        spans = []; rejected = [];
        res.writeHead(204); return res.end();
      }
      if (req.method === "GET" && url.pathname === "/test/spans") {
        const q = Object.fromEntries(url.searchParams);
        const list = spans.filter((s) => (!q.traceId || s.traceId === q.traceId)
          && (!q.service || s.serviceName === q.service) && (!q.name || s.name === q.name));
        return json(res, 200, { spans: list, rejected });
      }
    }
    return json(res, 404, { error: "not found" });
  } catch (e) {
    return json(res, 400, { error: `could not decode OTLP protobuf: ${e.message}` });
  }
});

server.listen(port, () => console.log(`OTLP test collector listening on ${port}`));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
