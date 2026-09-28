// Supplemental implementation review checks; the frozen browser oracle stays in spec/.
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  chromium,
  expect,
} from "../spec/node_modules/@playwright/test/index.mjs";
import {
  ServiceFixture,
  jordan,
  visitBody,
} from "../spec/tests/support/service-fixture.js";
import { ensureRunning, stopAll } from "../spec/harness/processes.js";

let browser, api;
before(async () => {
  browser = await chromium.launch({ headless: true });
});
beforeEach(async () => {
  api = new ServiceFixture("checkout", { real: true });
  await api.start();
  await api.clock("2026-10-12T08:00:00-05:00");
  await ensureRunning("frontend");
});
after(async () => {
  await browser?.close();
  await stopAll();
});

async function withPage(action) {
  const context = await browser.newContext({
    baseURL: "http://localhost:3000",
  });
  try {
    await action(await context.newPage());
  } finally {
    await context.close();
  }
}
async function login(page) {
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill("jordan.rivera");
  await page.getByLabel("Password", { exact: true }).fill("petclinic-demo");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/appointments$/);
}
test("frontend required-field errors are associated and do not send login", async () => {
  await withPage(async (page) => {
    let writes = 0;
    page.on("request", (request) => {
      if (request.method() === "POST") writes++;
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "Check the highlighted fields.",
    );
    await expect(page.getByLabel("Username", { exact: true })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(
      page.getByLabel("Username", { exact: true }),
    ).toHaveAccessibleDescription("This field is required.");
    assert.equal(writes, 0);
  });
});
test("frontend rejects fractional cents and submits a partial payment exactly", async () => {
  await api.finalized();
  await withPage(async (page) => {
    await login(page);
    await page.goto(`/bills/${api.checkout.id}`);
    const amount = page.getByLabel("Payment amount", { exact: true });
    await amount.fill("12.345");
    await page.getByRole("button", { name: "Pay now", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "Check the highlighted fields.",
    );
    assert.equal((await api.providerCalls()).length, 1);
    await amount.fill("12.34");
    await page.getByRole("button", { name: "Pay now", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Payment received.");
    await expect(
      page.getByRole("region", { name: "Bill summary" }),
    ).toContainText(/Balance due\s*\$37\.66/);
    const account = await api.call("GET", `/customers/${jordan}/account`, {
      service: "customer",
      expected: 200,
    });
    assert.equal(account.body.outstandingBalance, 3766);
    assert.equal(account.body.entries[0].amountCredited, 3234);
    assert.equal((await api.providerCalls()).length, 2);
  });
});
test("frontend treats authorized-completion failure as uncertain even with zero GET balance", async () => {
  await api.finalized();
  await withPage(async (page) => {
    await login(page);
    await page.goto(`/bills/${api.checkout.id}`);
    const requests = [];
    // Inject only the browser-facing error shape after an actual payment. This tests
    // UI interpretation, not the backend's separately covered downstream failures.
    await page.route("**/checkouts/*/payments", async (route) => {
      requests.push({
        key: route.request().headers()["idempotency-key"],
        body: route.request().postDataJSON(),
      });
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({
          code: "authorized_completion_failed",
          paymentAttemptId: body.attempt.attemptId,
        }),
      });
    });
    await page.getByRole("button", { name: "Pay now", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Reference:");
    await expect(page.getByText("Paid in full", { exact: true })).toHaveCount(
      0,
    );
    await page.reload();
    await page
      .getByRole("button", { name: "Retry same payment", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Retry same payment", exact: true }),
    ).toBeEnabled();
    await expect(page.getByRole("alert")).toContainText(
      "Payment outcome needs attention.",
    );
    await expect(page.getByText("Paid in full", { exact: true })).toHaveCount(
      0,
    );
    assert.deepEqual(requests[1], requests[0]);
    assert.equal((await api.providerCalls()).length, 2);
  });
});
test("frontend renders API clinical text without interpreting markup", async () => {
  await api.request();
  await api.accept();
  await api.clock("2026-10-12T09:05:00-05:00");
  const clinicalNotes = '<img src=x onerror="window.clinicalScriptRan=true">';
  const result = await api.call(
    "POST",
    `/reservations/${api.reservation.id}/visit`,
    {
      service: "reservation",
      body: { ...visitBody(), clinicalNotes },
      expected: 201,
    },
  );
  await withPage(async (page) => {
    await login(page);
    await page.goto(`/visits/${result.body.id}`);
    await expect(page.getByText(clinicalNotes, { exact: true })).toBeVisible();
    assert.equal(await page.locator('img[src="x"]').count(), 0);
    assert.equal(
      await page.evaluate(() => globalThis.clinicalScriptRan),
      undefined,
    );
  });
});
