import { it } from "node:test";
import assert from "node:assert/strict";
import { owner } from "../../../services/platform/runtime.js";

it("a resource ID cannot substitute for its different customer owner", () => {
  const user = { role: "customer", customerId: "customer-one" };
  assert.throws(
    () => owner(user, { id: "customer-one", customerId: "customer-two" }),
    (error) => error.status === 404 && error.code === "not_found",
  );
});
