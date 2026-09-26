// Login and token format (AUTH-01, spec/contracts/auth-contract.md). Protected test.
// Token rejection by protected endpoints (none/expired/bad signature, 401/403/404 rules)
// is tested per service in TEST-01, once SPEC-04 defines those endpoints.
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { assertImplemented, ensureRunning, resetProject, stopAll } from "../../harness/processes.js";
import { validateResponse, validateSchema } from "../../harness/schema.js";
import { login, decodeJwt, seedUsers, clinicSeconds, USER_TOKEN_SECONDS } from "../../harness/auth.js";
import { DEFAULT_CLINIC_NOW } from "../../harness/config.js";

const users = seedUsers();
const ready = async () => {
  assertImplemented("customer");
  await ensureRunning("collector");
  await ensureRunning("customer");
  await resetProject("customer");
};

describe("Customer login", () => {
  after(stopAll);

  for (const u of users) {
    it(`[AUTH-001] ${u.username} (${u.role}) logs in and receives a valid response`, async () => {
      await ready();
      const r = await login(u.username, u.password);
      assert.equal(r.status, 200);
      const v = validateResponse("auth.openapi.json", "POST", "/auth/login", 200, r.body);
      assert.equal(v.valid, true, v.errors.join("; "));
      assert.equal(r.body.user.id, u.id);
      assert.equal(r.body.user.role, u.role);
      assert.equal(JSON.stringify(r.body).includes(u.password), false, "response must not include the password");
    });

    it(`[AUTH-002] ${u.username} token is HS256, signed with the shared secret, and carries the right claims`, async () => {
      await ready();
      const { body } = await login(u.username, u.password);
      const { header, claims, signatureValid } = decodeJwt(body.token);
      assert.deepEqual(validateSchema("auth.openapi.json", "TokenHeader", header).errors, []);
      assert.deepEqual(validateSchema("auth.openapi.json", "TokenClaims", claims).errors, []);
      assert.ok(signatureValid, "signature does not match AUTH_TOKEN_SECRET");
      assert.equal(claims.sub, u.id);
      assert.equal(claims.role, u.role);
      if (u.role === "customer") assert.equal(claims.customerId, u.customerId);
      if (u.role === "veterinarian") assert.equal(claims.veterinarianId, u.veterinarianId);
      assert.equal(claims.iat, clinicSeconds(DEFAULT_CLINIC_NOW), "iat must come from the clinic clock");
      assert.equal(claims.exp, claims.iat + USER_TOKEN_SECONDS);
    });
  }

  it("[AUTH-003] unknown username and wrong password get the same 401 response", async () => {
    await ready();
    const unknown = await login("nobody", "petclinic-demo");
    const wrong = await login(users[0].username, "wrong-password");
    assert.equal(unknown.status, 401);
    assert.equal(wrong.status, 401);
    assert.deepEqual(unknown.body, wrong.body);
  });

  it("[AUTH-004] malformed login requests get 400", async () => {
    await ready();
    const res = await fetch("http://localhost:4001/auth/login", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "avery.taylor" }),
    });
    assert.equal(res.status, 400);
  });
});
