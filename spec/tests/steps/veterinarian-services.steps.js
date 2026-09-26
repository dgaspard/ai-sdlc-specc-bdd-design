// Steps for spec/features/veterinarian-services. Black-box over HTTP. Protected test.
import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import * as seed from "../../harness/seed.js";
import { cents } from "../../harness/money.js";
import { asDefaultCaller } from "./common.steps.js";

const UNKNOWN_SERVICE_ID = "10000000-0000-4000-8000-000000000499";

Given("the clinic's veterinary service catalog is loaded", async function () {
  await asDefaultCaller(this);
});

When("the catalog is listed", async function () {
  await this.api("GET", "/services");
  assert.equal(this.response.status, 200);
});

Then("it contains exactly these services with fees in USD:", function (table) {
  const expected = table.hashes().map((r) => ({ name: r.service, feeAmount: cents(r.fee), currency: "USD" }));
  const actual = this.response.body.map((s) => ({ name: s.name, feeAmount: s.feeAmount, currency: s.currency }));
  const byName = (a, b) => a.name.localeCompare(b.name);
  assert.deepEqual(actual.sort(byName), expected.sort(byName));
});

Then("each service has a stable service ID", function () {
  for (const s of this.response.body) assert.equal(s.id, seed.service(s.name).id, `${s.name} id`);
});

When("the fee for {string} is requested by its service ID", async function (name) {
  await this.api("GET", `/services/${seed.service(name).id}`);
});

Then("the fee is {int} cents in {string}", function (amount, currency) {
  assert.equal(this.response.status, 200);
  assert.equal(this.response.body.feeAmount, amount);
  assert.equal(this.response.body.currency, currency);
});

When("fees for {string} and {string} are requested together", async function (a, b) {
  await this.api("GET", `/fees?serviceIds=${seed.service(a).id},${seed.service(b).id}`);
});

Then("both fees are returned: {string} {int} cents and {string} {int} cents", function (a, aCents, b, bCents) {
  assert.equal(this.response.status, 200);
  const fee = (n) => this.response.body.fees.find((f) => f.id === seed.service(n).id)?.feeAmount;
  assert.equal(this.response.body.fees.length, 2);
  assert.equal(fee(a), aCents);
  assert.equal(fee(b), bCents);
});

When("fees for {string} and an unknown service ID are requested together", async function (a) {
  await this.api("GET", `/fees?serviceIds=${seed.service(a).id},${UNKNOWN_SERVICE_ID}`);
});

Then("the unknown service ID is identified", function () {
  assert.deepEqual(this.response.body.unknownServiceIds, [UNKNOWN_SERVICE_ID]);
});

When("the catalog is listed twice", async function () {
  this.memo.first = (await this.api("GET", "/services")).body;
  this.memo.second = (await this.api("GET", "/services")).body;
});

Then("each service has the same ID both times", function () {
  const ids = (list) => Object.fromEntries(list.map((s) => [s.name, s.id]));
  assert.deepEqual(ids(this.memo.second), ids(this.memo.first));
});
