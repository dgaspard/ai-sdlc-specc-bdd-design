import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv from "ajv";
import { seedVisit, startTestServer } from "../helpers/test-server.js";

const contract = JSON.parse(
  await readFile(new URL("../../contracts/petclinic.openapi.json", import.meta.url))
);

test("DELETE visit implements the published cancellation contract", async () => {
  const server = await startTestServer();

  try {
    await seedVisit(server.baseUrl);

    const response = await fetch(`${server.baseUrl}/api/pets/1/visits/1`, {
      method: "DELETE"
    });
    assert.equal(response.status, 200, "cancelVisit must return HTTP 200");
    const body = await response.json();

    const schema = contract.components.schemas.CancelledVisit;
    const validate = new Ajv({ strict: true }).compile(schema);
    assert.equal(
      validate(body),
      true,
      `response violates CancelledVisit: ${JSON.stringify(validate.errors)}`
    );
    assert.deepEqual(body, { petId: 1, visitId: 1, status: "cancelled" });

    const pet = await (await fetch(`${server.baseUrl}/api/pets/1`)).json();
    assert.equal(pet.visits.length, 0, "the cancelled visit must be removed");
  } finally {
    await server.close();
  }
});
