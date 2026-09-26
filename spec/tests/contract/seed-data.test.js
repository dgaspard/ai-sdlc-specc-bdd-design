// Seed data matches the published schemas and references resolve. Protected test.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { SEED_DATA_DIR } from "../../harness/config.js";
import { validateSchema } from "../../harness/schema.js";

const load = (f) => JSON.parse(fs.readFileSync(path.join(SEED_DATA_DIR, f), "utf8"));
const vets = load("veterinarians.json");
const customers = load("customers.json");
const users = load("users.json");
const services = load("services.json");
const ok = (r) => assert.equal(r.valid, true, r.errors.join("; "));

describe("seed data", () => {
  it("[SEED] veterinarians match VeterinarianCreate", () => {
    for (const { id, ...v } of vets) ok(validateSchema("domain.openapi.json", "VeterinarianCreate", v));
  });
  it("[SEED] catalog services match VeterinarianServiceCreate", () => {
    for (const { id, ...s } of services) ok(validateSchema("domain.openapi.json", "VeterinarianServiceCreate", s));
  });
  it("[SEED] customers and pets match CustomerCreate and PetCreate", () => {
    for (const { id, pets, ...c } of customers) {
      ok(validateSchema("domain.openapi.json", "CustomerCreate", c));
      // Pets are nested under their owner in the seed file, so ownerId is the customer's id.
      for (const { id: petId, ...p } of pets) ok(validateSchema("domain.openapi.json", "PetCreate", { ...p, ownerId: id }));
    }
  });
  it("[SEED] customers prefer a seeded veterinarian", () => {
    const vetIds = new Set(vets.map((v) => v.id));
    for (const c of customers) assert.ok(vetIds.has(c.preferredVeterinarianId), c.id);
  });
  it("[SEED] users match SeedUser, have unique usernames, and link to seeded records", () => {
    const vetIds = new Set(vets.map((v) => v.id));
    const customerIds = new Set(customers.map((c) => c.id));
    for (const u of users) ok(validateSchema("auth.openapi.json", "SeedUser", u));
    assert.equal(new Set(users.map((u) => u.username)).size, users.length);
    for (const u of users) {
      if (u.role === "customer") assert.ok(customerIds.has(u.customerId) && !u.veterinarianId, u.username);
      if (u.role === "veterinarian") assert.ok(vetIds.has(u.veterinarianId) && !u.customerId, u.username);
    }
  });
  it("[SEED] every ID is unique across seed files", () => {
    const ids = [...vets, ...services, ...customers, ...customers.flatMap((c) => c.pets), ...users].map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});
