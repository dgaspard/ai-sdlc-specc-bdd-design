import { randomUUID } from "node:crypto";
import * as seed from "../../harness/seed.js";

export function registration() {
  const petId = randomUUID();
  const address = { street: "5 Elm St", city: "Chicago", state: "IL", postalCode: "60602" };
  return {
    username: "casey.park", password: "petclinic-demo",
    profile: {
      firstName: "Casey", lastName: "Park", phoneNumber: "312-555-0199", address,
      emergencyContact: { name: "Robin Park", phone: "312-555-0198", relationship: "sibling" },
      secondaryContact: { name: "Alex Park", phone: "312-555-0197", relationship: "partner" },
      billing: { billingAddress: { ...address }, mockMethodReference: "fake-card-approve" },
      insurance: [{ provider: "Demo insurance", policyNumber: "DEMO-123", coveredPetIds: [petId] }],
      preferredVeterinarianId: seed.vet("Avery Taylor").id,
    },
    pets: [{ id: petId, name: "Pepper", type: "cat", breed: "Unknown", estimatedBirthDate: "2023-01-01" }],
  };
}
