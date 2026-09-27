import { it } from "node:test";
import assert from "node:assert/strict";
import { validateSchema } from "../../harness/schema.js";
import { registration } from "../support/registration.js";

const valid = (schema, body) => validateSchema("domain.openapi.json", schema, body);
it("[SPEC-05] complete registration fixture conforms to the published schema", () => {
  assert.deepEqual(valid("CustomerRegistration", registration()).errors, []);
});
for (const field of ["username", "password", "pets", "profile.firstName", "profile.lastName", "profile.phoneNumber",
  "profile.address", "profile.emergencyContact", "profile.secondaryContact", "profile.insurance", "profile.billing",
  "profile.billing.mockMethodReference", "profile.billing.billingAddress", "profile.preferredVeterinarianId"]) {
  it(`[SPEC-05] self-registration requires ${field}`, () => {
    const body = registration(), parts = field.split("."), last = parts.pop();
    delete parts.reduce((b, key) => b[key], body)[last];
    assert.equal(valid("CustomerRegistration", body).valid, false);
  });
}
it("[SPEC-05] registration rejects empty pets, insurance, and injected privileges", () => {
  for (const edit of [b => b.pets = [], b => b.profile.insurance = [], b => b.role = "veterinarian", b => b.pets[0].ownerId = "foreign-owner"]) {
    const b = registration(); edit(b); assert.equal(valid("CustomerRegistration", b).valid, false);
  }
});
it("[SPEC-05] completed corrections accept clinical text and reject financial or relationship edits", () => {
  assert.equal(valid("VisitUpdate", { clinicalNotes: "Corrected", diagnoses: [], medications: [], followUpNotes: "Review" }).valid, true);
  for (const body of [{}, { clinicalNotes: "   " }, { performedServices: [] }, { endedAt: "2026-10-12T16:00:00Z" }, { balanceDue: 0 }]) {
    assert.equal(valid("VisitUpdate", body).valid, false);
  }
});
