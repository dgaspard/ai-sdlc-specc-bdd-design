// Meta checks: catalog.yaml, the feature tags and the rendered guide agree exactly.
import { Given, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import * as repo from "./support/repo.js";
import { ENVS, USES, ctlOf, isMeta, loadCatalog, render, scanScenarios, tagValues } from "../tools/catalog.mjs";

const none = (rule, items) => assert.deepEqual(items, [], `${rule}: ${items.join("; ")}`);
const TIERS = ["static", "template", "live"];
const PILLARS = ["security", "observability", "governance", "telemetry", "performance", "compliance", "cost"];

Given("every scenario in the delivery features", function () {
  this.scenarios = scanScenarios().filter((s) => !isMeta(s));
  assert.ok(this.scenarios.length > 0, "no control scenarios found");
});

Given("the environment catalog", function () {
  this.catalog = loadCatalog();
  assert.ok(Array.isArray(this.catalog?.entries) && this.catalog.entries.length > 0, "catalog.yaml has no entries");
});

Then("each control scenario has one CTL tag, one tier tag, and at least one env, pillar, nist and ssdf tag", function () {
  const bad = [];
  for (const s of this.scenarios) {
    const problems = [];
    if (ctlOf(s.tags).length !== 1) problems.push("CTL");
    const tiers = tagValues(s.tags, "tier");
    if (tiers.length !== 1 || !TIERS.includes(tiers[0])) problems.push("tier");
    const envs = tagValues(s.tags, "env");
    if (envs.length === 0 || envs.some((e) => !ENVS.includes(e))) problems.push("env");
    const pillars = tagValues(s.tags, "pillar");
    if (pillars.length === 0 || pillars.some((p) => !PILLARS.includes(p))) problems.push("pillar");
    if (tagValues(s.tags, "nist").length === 0) problems.push("nist");
    if (tagValues(s.tags, "ssdf").length === 0) problems.push("ssdf");
    if (problems.length) bad.push(`${s.file} "${s.name}" (${problems.join(", ")})`);
  }
  none("incomplete tags", bad);
});

Then("no CTL ID is used by more than one scenario", function () {
  const ids = this.scenarios.flatMap((s) => ctlOf(s.tags));
  none("duplicate CTL", [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))]);
});

Then("each awaiting tag names exactly one backlog item that exists in the backlog file", function () {
  const backlog = repo.read(loadCatalog().backlog_file);
  const bad = [];
  for (const s of this.scenarios) {
    const items = tagValues(s.tags, "awaiting");
    if (items.length > 1) bad.push(`${s.file} "${s.name}" has ${items.length} awaiting tags`);
    for (const id of items) if (!new RegExp(`^### ${id} — `, "m").test(backlog)) bad.push(`${s.file} "${s.name}" awaits unknown ${id}`);
  }
  none("awaiting tag", bad);
});

const owners = (catalog, id) => catalog.entries.filter((e) => (e.controls ?? []).includes(id));

Then("each CTL ID in the features is listed by exactly one catalog entry", function () {
  const bad = this.scenarios.flatMap((s) => ctlOf(s.tags)).filter((id) => owners(this.catalog, id).length !== 1);
  none("CTL not in exactly one catalog entry", bad);
});

Then("each CTL ID in the catalog exists in the features", function () {
  const inFeatures = new Set(this.scenarios.flatMap((s) => ctlOf(s.tags)));
  none("catalog names a CTL with no scenario", this.catalog.entries.flatMap((e) => e.controls ?? []).filter((id) => !inFeatures.has(id)));
});

Then("each scenario's env tags are environments where its catalog entry is used", function () {
  const bad = [];
  for (const s of this.scenarios) {
    const [entry] = owners(this.catalog, ctlOf(s.tags)[0]);
    if (!entry) continue;
    for (const env of tagValues(s.tags, "env")) {
      if (entry.environments?.[env]?.use === "not-used") bad.push(`${ctlOf(s.tags)[0]} @env:${env} but ${entry.id} is not-used there`);
    }
  }
  none("env mismatch", bad);
});

Then("every entry gives local, nonprod and prod a use of {string}, {string} or {string} with a reason", function (a, b, c) {
  assert.deepEqual([a, b, c], USES);
  const bad = [];
  for (const e of this.catalog.entries) {
    for (const env of ENVS) {
      const v = e.environments?.[env];
      // Extra keys mean an unquoted comma split the reason inside a YAML { } map.
      const extra = Object.keys(v ?? {}).filter((k) => k !== "use" && k !== "why");
      if (!v || !USES.includes(v.use) || !String(v.why ?? "").trim() || extra.length) bad.push(`${e.id}.${env}`);
    }
  }
  none("incomplete environment use", bad);
});

Then("every enforced entry lists controls or existing checks, and every planned or deferred entry lists none", function () {
  const bad = [];
  for (const e of this.catalog.entries) {
    const n = (e.controls ?? []).length + (e.existing_checks ?? []).length;
    if (!["enforced", "planned", "deferred"].includes(e.status)) bad.push(`${e.id}: unknown status ${e.status}`);
    else if (e.status === "enforced" && n === 0) bad.push(`${e.id}: enforced but nothing enforces it`);
    else if (e.status !== "enforced" && n > 0) bad.push(`${e.id}: ${e.status} but lists checks`);
  }
  none("status mismatch", bad);
});

Then("every existing check named in the catalog exists", function () {
  const bad = this.catalog.entries.flatMap((e) => e.existing_checks ?? []).filter((p) => !repo.exists(p));
  none("existing check not found", bad);
});

Then("rendering the catalog reproduces the committed environment guide exactly", function () {
  const rel = this.catalog.rendered_doc;
  assert.ok(repo.exists(rel), `${rel} is missing; run catalog:render`);
  assert.equal(repo.read(rel), render(this.catalog), `${rel} differs from catalog.yaml; run catalog:render`);
});
