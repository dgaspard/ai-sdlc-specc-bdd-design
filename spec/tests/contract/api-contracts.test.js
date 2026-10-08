// Structural checks for the per-service API contracts (SPEC-04). These verify the
// contracts themselves, so they pass before any service exists. Protected test.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PROJECTS, SPEC_ROOT } from "../../harness/config.js";
import { loadContract, responseTarget, validateResponse, validateRequest } from "../../harness/schema.js";
import { taggedElements } from "../../guard/guard.js";

const ROLES = ["veterinarian", "customer", "service", "anonymous", "administrator"]; // MVP-02A (D-39)
const IDEMPOTENT = ["collectBookingFee", "acceptReservation", "payVisitBalance", "recordCashPayment"];
const METHODS = ["get", "post", "put", "patch", "delete"];
const services = Object.entries(PROJECTS).filter(([, p]) => p.kind === "service");
const samplePath = (t) => t.replace(/\{[^}]+\}/g, "10000000-0000-4000-8000-000000000001");

function operations(file) {
  const { doc } = loadContract(file);
  return Object.entries(doc.paths).flatMap(([p, item]) => METHODS.filter((m) => item[m]).map((m) => ({ path: p, method: m, op: item[m] })));
}

describe("per-service API contracts", () => {
  it("[API] operationIds are unique across all services", () => {
    const ids = services.flatMap(([, p]) => operations(p.contract).map((o) => o.op.operationId));
    assert.equal(new Set(ids).size, ids.length);
  });

  for (const [name, p] of services) {
    describe(p.contract, () => {
      it(`[API] ${p.title} contract identifies its service`, () => {
        const { doc } = loadContract(p.contract);
        assert.equal(doc.openapi, "3.1.0");
        assert.equal(doc["x-service"], name);
        assert.equal(doc.servers[0].url, `http://localhost:${p.port}`);
      });

      for (const { path: route, method, op } of operations(p.contract)) {
        const label = `${method.toUpperCase()} ${route}`;
        it(`[API] ${label} declares roles, security, and standard errors`, () => {
          assert.ok(op.operationId, "operationId");
          assert.ok(Array.isArray(op["x-roles"]) && op["x-roles"].length, "x-roles");
          for (const r of op["x-roles"]) assert.ok(ROLES.includes(r), `unknown role ${r}`);
          const open = op["x-roles"].includes("anonymous");
          assert.deepEqual(op.security, open ? [] : [{ bearer: [] }]);
          if (route.startsWith("/internal/")) assert.deepEqual(op["x-roles"], ["service"], "internal operations are service-only");
          if (!open) assert.ok(op.responses["401"], "secured operations declare 401");
          if (op.requestBody) assert.ok(op.responses["400"], "operations with a body declare 400");
          if (IDEMPOTENT.includes(op.operationId)) {
            assert.ok((op.parameters ?? []).some((x) => x.$ref?.endsWith("/parameters/IdempotencyKey")), "requires Idempotency-Key");
          }
        });

        it(`[API] ${label} response schemas compile and errors use problem details`, () => {
          for (const status of Object.keys(op.responses)) {
            const t = responseTarget(p.contract, method, samplePath(route), status);
            if (Number(status) >= 400) assert.equal(t.contentType, "application/problem+json", `${status} must be problem+json`);
            if (t.hasJson) validateResponse(p.contract, method, samplePath(route), status, {}); // throws if the schema cannot compile
          }
          if (op.requestBody) validateRequest(p.contract, method, samplePath(route), {});
        });

        it(`[API] ${label} feature references exist`, () => {
          for (const f of op["x-features"] ?? []) assert.ok(fs.existsSync(path.join(SPEC_ROOT, "..", f)), f);
        });
      }

      it(`[API] every ${p.title} feature file is covered by an operation`, () => {
        const dir = path.join(SPEC_ROOT, "features", name);
        const covered = new Set(operations(p.contract).flatMap((o) => o.op["x-features"] ?? []));
        // SPEC-07: a file whose scenarios are all @retired describes behavior that must
        // NOT exist, so by design no current operation covers it.
        const allRetired = (f) => {
          const scenarios = taggedElements(fs.readFileSync(path.join(dir, f), "utf8"))
            .filter((e) => ["Scenario", "Scenario Outline", "Scenario Template", "Example"].includes(e.keyword));
          return scenarios.length > 0 && scenarios.every((e) => e.tags.includes("@retired"));
        };
        for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".feature"))) {
          if (allRetired(f)) continue;
          assert.ok(covered.has(`spec/features/${name}/${f}`), `${f} has no operation`);
        }
      });
    });
  }

  it("[API] problem responses validate a sample problem", () => {
    const sample = { type: "about:blank", title: "Invalid slot", status: 422, code: "invalid_slot" };
    const r = validateResponse("reservation.openapi.json", "POST", "/reservations", 422, sample);
    assert.equal(r.valid, true, r.errors.join("; "));
    assert.equal(validateResponse("reservation.openapi.json", "POST", "/reservations", 422, { ...sample, code: "made_up" }).valid, false);
  });

  it("[API] accept request allows card or cash booking fees only", () => {
    const ok = (b) => validateRequest("reservation.openapi.json", "POST", "/reservations/x/accept", b).valid;
    assert.equal(ok({ bookingFee: { method: "card", mockMethodReference: "fake-card-approve" } }), true);
    assert.equal(ok({ bookingFee: { method: "cash" } }), true);
    assert.equal(ok({ bookingFee: { method: "card" } }), false);
    assert.equal(ok({ bookingFee: { method: "check" } }), false);
  });
});
