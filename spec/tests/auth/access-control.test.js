import { it } from "node:test";
import assert from "node:assert/strict";
import { signJwt, decodeJwt, clinicSeconds } from "../../harness/auth.js";
import { validateSchema } from "../../harness/schema.js";
import { ServiceFixture, tokenFor, jordan } from "../support/service-fixture.js";
import { operations, inputFor, ownership, collections, publicCatalog } from "../support/access-cases.js";

// morgan.reed, not avery.taylor: Avery is the dual-role administrator (D-44), so she would
// correctly pass administrator-only routes and mask a missing veterinarian check.
const actors = { customer: "jordan.rivera", veterinarian: "morgan.reed", service: "service" };
const badTokens = {
  missing: () => null,
  malformed: () => "not-a-jwt",
  "bad signature": () => signJwt(decodeJwt(tokenFor()).claims, { secret: "incorrect-demo-secret" }),
  "alg none": () => signJwt(decodeJwt(tokenFor()).claims, { header: { alg: "none", typ: "JWT" } }),
  expired: () => signJwt({ ...decodeJwt(tokenFor()).claims, iat: clinicSeconds() - 28800, exp: clinicSeconds() }),
};
function expectProblem(r, status, code) {
  assert.equal(r.status, status);
  assert.equal(r.body.code, code);
  assert.equal(r.body.status, status);
  assert.deepEqual(validateSchema("common.openapi.json", "Problem", r.body).errors, []);
}

for (const op of operations) {
  for (const [name, makeToken] of Object.entries(badTokens)) {
    it(`[AUTH-005] ${op.service}.${op.operationId}: ${name} token returns 401`, async (t) => {
      const f = new ServiceFixture(op.service); t.after(() => f.stop()); await f.start();
      const { path, body } = inputFor(op, f);
      for (const stub of Object.values(f.stubs)) stub.requests = [];
      const r = await f.call(op.method, path, { body, token: makeToken(), expected: 401 });
      expectProblem(r, 401, "unauthenticated");
      for (const stub of Object.values(f.stubs)) assert.equal(stub.requests.filter((r) => r.path !== "/health").length, 0);
    });
  }
  for (const [role, actor] of Object.entries(actors).filter(([r]) => !op["x-roles"].includes(r))) {
    it(`[AUTH-006] ${op.service}.${op.operationId}: ${role} role returns 403`, async (t) => {
      const f = new ServiceFixture(op.service); t.after(() => f.stop()); await f.start();
      const { path, body } = inputFor(op, f);
      for (const stub of Object.values(f.stubs)) stub.requests = [];
      const r = await f.call(op.method, path, { body, actor, expected: 403 });
      expectProblem(r, 403, "forbidden");
      for (const stub of Object.values(f.stubs)) assert.equal(stub.requests.filter((r) => r.path !== "/health").length, 0);
    });
  }
  if (ownership.has(op.operationId)) {
    it(`[AUTH-007] ${op.service}.${op.operationId}: another customer's existing record returns 404`, async (t) => {
      const f = new ServiceFixture(op.service); t.after(() => f.stop()); await f.start();
      if (op.service === "reservation") {
        if (op.operationId === "getVisit") await f.recordedVisit();
        else { await f.request(); if (op.operationId === "cancelReservation") await f.accept(); }
      }
      if (op.service === "checkout") await f.finalized();
      // Prove the protected target exists; otherwise an unconditional 404 could pass.
      const control = op.method === "GET" ? inputFor(op, f).path : op.service === "customer" ? `/customers/${jordan}` : op.service === "checkout"
        ? `/checkouts/${f.checkout.id}` : op.operationId === "getVisit" ? `/visits/${f.visit.id}` : `/reservations/${f.reservation.id}`;
      await f.call("GET", control, { actor: "jordan.rivera", expected: 200 });
      const { path, body } = inputFor(op, f);
      const before = (await f.call("GET", control, { expected: 200 })).body;
      const r = await f.call(op.method, path, { body, actor: "sam.lee", expected: 404 });
      expectProblem(r, 404, "not_found");
      assert.deepEqual((await f.call("GET", control, { expected: 200 })).body, before, "unauthorized request mutated the record");
    });
  }
  if (collections.has(op.operationId)) {
    it(`[AUTH-007] ${op.service}.${op.operationId}: lists never expose another customer's records`, async (t) => {
      const f = new ServiceFixture(op.service); t.after(() => f.stop()); await f.start();
      if (op.service === "checkout") await f.finalized();
      else if (op.operationId === "listVisits") await f.recordedVisit();
      else await f.request();
      const own = await f.call("GET", op.path, { actor: "jordan.rivera", expected: 200 });
      assert.ok(own.body.length > 0, "positive ownership control is empty");
      for (const path of [op.path, `${op.path}?customerId=${jordan}`]) {
        const r = await f.call("GET", path, { actor: "sam.lee", expected: 200 });
        assert.deepEqual(r.body, []);
      }
    });
  }
}

it("[AUTH-008] every customer-accessible operation has an explicit ownership or catalog classification", () => {
  for (const op of operations.filter((o) => o["x-roles"].includes("customer"))) {
    assert.ok(ownership.has(op.operationId) || collections.has(op.operationId) || publicCatalog.has(op.operationId), op.operationId);
  }
});
