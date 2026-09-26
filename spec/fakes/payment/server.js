// Fake payment provider (protected test scaffolding). Contract: spec/contracts/payment-provider.openapi.json
import express from "express";
import { randomUUID } from "node:crypto";

const port = Number(process.env.PORT || 4010);
const testEndpoints = process.env.PETCLINIC_TEST_ENDPOINTS === "enabled";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let calls = [];
let results = new Map(); // attemptId -> { fingerprint, result }

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

function invalid(body) {
  if (!body || typeof body !== "object") return "body must be a JSON object";
  const allowed = ["attemptId", "amount", "currency", "mockMethodReference", "purpose"];
  const extra = Object.keys(body).filter((k) => !allowed.includes(k));
  if (extra.length) return `unexpected fields: ${extra.join(", ")}`;
  if (!UUID.test(body.attemptId ?? "")) return "attemptId must be a UUID";
  if (!Number.isInteger(body.amount) || body.amount < 1) return "amount must be a positive integer (cents)";
  if (body.currency !== "USD") return "currency must be USD";
  if (typeof body.mockMethodReference !== "string" || !body.mockMethodReference) return "mockMethodReference required";
  if (!["booking_fee", "visit_balance"].includes(body.purpose)) return "purpose must be booking_fee or visit_balance";
  return null;
}

app.post("/authorize", (req, res) => {
  const body = req.body;
  const record = (status, replayed, payload) => {
    calls.push({ request: body ?? null, status, replayed });
    res.status(status).json(payload);
  };
  const problem = invalid(body);
  if (problem) return record(400, false, { error: problem });

  const fingerprint = JSON.stringify([body.amount, body.currency, body.mockMethodReference, body.purpose]);
  const prior = results.get(body.attemptId);
  if (prior) {
    if (prior.fingerprint !== fingerprint) return record(409, false, { error: "attemptId reused with different input" });
    return record(200, true, { ...prior.result, replayed: true });
  }
  const token = body.mockMethodReference;
  if (token.startsWith("fake-card-error")) return record(500, false, { error: "simulated provider failure" });
  const result = token.startsWith("fake-card-decline")
    ? { attemptId: body.attemptId, outcome: "declined", authorizationReference: null }
    : token.startsWith("fake-card-approve")
      ? { attemptId: body.attemptId, outcome: "authorized", authorizationReference: `fake-auth-${randomUUID()}` }
      : null;
  if (!result) return record(400, false, { error: "unknown mock method token" });
  results.set(body.attemptId, { fingerprint, result });
  return record(200, false, { ...result, replayed: false });
});

if (testEndpoints) {
  app.post("/test/reset", (_req, res) => { calls = []; results = new Map(); res.status(204).end(); });
  app.get("/test/calls", (_req, res) => res.json({ calls, authorizations: results.size }));
}
app.use("/test", (_req, res) => res.status(404).json({ error: "not found" }));
app.use((err, _req, res, _next) => res.status(400).json({ error: err.type === "entity.parse.failed" ? "invalid JSON" : "bad request" }));

const server = app.listen(port, () => console.log(`fake payment provider listening on ${port}`));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
