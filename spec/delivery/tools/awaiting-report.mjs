#!/usr/bin/env node
// Informational: runs the @awaiting scenarios and lists which already pass, grouped by
// backlog item. A passing awaiting scenario is a STATE CHANGE for a human: remove its
// tag at the next freeze so the control becomes required. Always exits 0.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PKG } from "./catalog.mjs";

const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "awaiting-")), "report.json");
spawnSync("npx", ["cucumber-js", "--profile", "awaiting", "--format", `json:${out}`], { cwd: PKG, stdio: "ignore" });
const features = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : [];
const byItem = {};
for (const feature of features) {
  for (const s of feature.elements ?? []) {
    const tags = s.tags.map((t) => t.name);
    const item = tags.find((t) => t.startsWith("@awaiting:"))?.slice(10) ?? "?";
    const ctl = tags.find((t) => /^@CTL-\d{3}$/.test(t))?.slice(1) ?? s.name;
    const passed = s.steps.every((st) => st.result.status === "passed");
    (byItem[item] ??= { passing: [], failing: [] })[passed ? "passing" : "failing"].push(ctl);
  }
}
for (const [item, { passing, failing }] of Object.entries(byItem).sort()) {
  console.log(`${item}: ${passing.length} passing, ${failing.length} still red`);
  for (const ctl of passing) console.log(`  STATE CHANGE ${ctl} passes: remove @awaiting:${item} at the next freeze`);
}
