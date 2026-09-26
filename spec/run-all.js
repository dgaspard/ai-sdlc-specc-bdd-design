// Runs every suite even when an earlier one fails, then prints one summary.
// Exit code is non-zero if any suite failed. Protected scaffolding.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cwd = path.dirname(fileURLToPath(import.meta.url));
const SUITES = [
  { name: "Guard (protected specs and tests)", cmd: "node", args: ["guard/check.js"] },
  { name: "Harness self-checks", cmd: "node", args: ["--test", "--test-concurrency=1", "tests/harness/**/*.test.js"] },
  { name: "Schema contracts", cmd: "node", args: ["--test", "--test-concurrency=1", "tests/contract/**/*.test.js"] },
  { name: "Runtime contract", cmd: "node", args: ["--test", "--test-concurrency=1", "tests/runtime/**/*.test.js"] },
  { name: "Authentication", cmd: "node", args: ["--test", "--test-concurrency=1", "tests/auth/**/*.test.js"] },
  { name: "Observability (OpenTelemetry)", cmd: "node", args: ["--test", "--test-concurrency=1", "tests/observability/**/*.test.js"] },
  { name: "Service features (Cucumber)", cmd: "npx", args: ["cucumber-js"] },
];

const results = [];
for (const s of SUITES) {
  console.log(`\n=== ${s.name} ===`);
  const r = spawnSync(s.cmd, s.args, { cwd, stdio: "inherit" });
  results.push({ name: s.name, ok: r.status === 0 });
}

console.log("\n=== Summary ===");
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
