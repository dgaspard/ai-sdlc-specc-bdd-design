import { After, AfterAll, Before, BeforeAll, setDefaultTimeout } from "@cucumber/cucumber";
import { chromium } from "@playwright/test";
import { createApp } from "../../src/app.js";
import { runtime } from "./runtime.js";

setDefaultTimeout(15_000);

BeforeAll(async () => {
  const app = createApp({ enableTestRoutes: true });
  runtime.server = app.listen(0);
  await new Promise((resolve) => runtime.server.once("listening", resolve));
  const address = runtime.server.address();
  runtime.baseUrl = `http://127.0.0.1:${address.port}`;
  runtime.browser = await chromium.launch({ headless: process.env.HEADED !== "true" });
});

Before(async function () {
  await fetch(`${runtime.baseUrl}/api/test/reset`, { method: "POST" });
  this.context = await runtime.browser.newContext();
  this.page = await this.context.newPage();
});

After(async function ({ result }) {
  if (result?.status === "FAILED") {
    await this.page.screenshot({
      path: `test-results/failure-${Date.now()}.png`,
      fullPage: true
    });
  }
  await this.context.close();
});

AfterAll(async () => {
  await runtime.browser.close();
  await new Promise((resolve, reject) => {
    runtime.server.close((error) => error ? reject(error) : resolve());
  });
});
