// Presenter-only view of the frozen browser suite (A-12). Reuses the protected
// config unchanged and only makes FE-002 visible and slower. Assertions, visual
// tolerances, and test code all come from spec/ and are not overridden here.
import path from "node:path";
import { fileURLToPath } from "node:url";
import base from "../../spec/tests/browser/playwright.config.js";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const slowMo = Number(process.env.DEMO_SLOWMO_MS ?? 400);

export default {
  ...base,
  testDir: path.join(root, "spec/tests/browser"),
  outputDir: path.join(root, "test-results/demo"),
  grep: /\[FE-002\]/,
  // Slowed actions need more wall-clock time than the frozen 30 s budget.
  timeout: 180000,
  use: {
    ...base.use,
    headless: process.env.DEMO_HEADLESS === "1",
    launchOptions: { ...base.use?.launchOptions, slowMo },
  },
};
