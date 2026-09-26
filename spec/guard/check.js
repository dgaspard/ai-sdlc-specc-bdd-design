#!/usr/bin/env node
// npm run guard:check — fails if any protected file changed since the last human freeze,
// or if a test has been skipped. Protected scaffolding.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compare, scanSkips, MANIFEST } from "./guard.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const manifestPath = path.join(root, MANIFEST);
if (!fs.existsSync(manifestPath)) {
  console.error(`GUARD FAIL: ${MANIFEST} is missing. A human must run: npm --prefix spec run guard:freeze`);
  process.exit(1);
}
const { modified, missing, added } = compare(root, fs.readFileSync(manifestPath, "utf8"));
const skips = scanSkips(root);
const report = [
  ["Modified protected files", modified],
  ["Deleted protected files", missing],
  ["New files in protected paths", added],
  ["Skipped or focused tests", skips],
].filter(([, list]) => list.length);

if (!report.length) {
  console.log("GUARD PASS: protected specs and tests match the frozen manifest; no skipped tests.");
  process.exit(0);
}
console.error("GUARD FAIL: protected specs or tests changed.\n");
for (const [title, list] of report) console.error(`${title}:\n${list.map((f) => `  - ${f}`).join("\n")}\n`);
console.error("Protected files define correct behavior. Change the implementation, not the spec.\n"
  + "If the specification itself should change, a human reviews the diff and runs: npm --prefix spec run guard:freeze");
process.exit(1);
