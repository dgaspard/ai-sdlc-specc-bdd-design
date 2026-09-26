// Checks that the domain contract is self-consistent: every published example
// validates (or fails) against the schema it illustrates. Protected test.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadContract, validateSchema } from "../../harness/schema.js";

const FILE = "domain.openapi.json";
const { doc } = loadContract(FILE);

// Example name -> [schema it illustrates, expected validity]
const EXAMPLES = {
  ValidCustomer: ["CustomerCreate", true],
  InvalidCustomer: ["CustomerCreate", false],
  ValidReservation: ["ReservationRead", true],
  BalanceDeniedReservation: ["ReservationRead", true],
  InvalidReservation: ["ReservationRead", false],
  ValidCheckout: ["CheckoutRead", true],
  ValidCheckoutPromotionExceedsBalance: ["CheckoutRead", true],
  InvalidPaymentAttempt: ["PaymentAttempt", false],
};

describe("domain contract examples", () => {
  it("[SCHEMA] every published example is mapped to a schema", () => {
    assert.deepEqual(Object.keys(doc.components.examples).sort(), Object.keys(EXAMPLES).sort());
  });

  for (const [name, [schema, expected]] of Object.entries(EXAMPLES)) {
    it(`[SCHEMA] ${name} is ${expected ? "valid" : "invalid"} against ${schema}`, () => {
      const r = validateSchema(FILE, schema, doc.components.examples[name].value);
      assert.equal(r.valid, expected, r.valid ? `${name} unexpectedly valid` : r.errors.join("; "));
    });
  }
});
