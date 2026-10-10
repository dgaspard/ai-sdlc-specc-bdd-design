// Shared by the catalog checks and the renderer: loads catalog.yaml, scans feature
// tags, and renders the human guide. Deterministic output so drift is detectable.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

export const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ENVS = ["local", "nonprod", "prod"];
export const ENV_TITLES = { local: "Local", nonprod: "Non-prod", prod: "Prod" };
export const USES = ["required", "informational", "not-used"];

export const loadCatalog = () => YAML.parse(fs.readFileSync(path.join(PKG, "catalog.yaml"), "utf8"));

// Feature tags apply to every scenario in the feature, as in Cucumber.
export function scanScenarios(dir = path.join(PKG, "features")) {
  const files = fs.readdirSync(dir, { recursive: true }).filter((f) => f.endsWith(".feature")).sort();
  const scenarios = [];
  for (const rel of files) {
    let pending = [];
    let featureTags = [];
    for (const raw of fs.readFileSync(path.join(dir, rel), "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (line.startsWith("@")) pending.push(...line.split(/\s+/).filter((t) => t.startsWith("@")));
      else if (line.startsWith("Feature:")) [featureTags, pending] = [pending, []];
      else if (/^Scenario( Outline)?:/.test(line)) {
        scenarios.push({ file: rel, name: line.replace(/^Scenario( Outline)?:\s*/, ""), tags: [...featureTags, ...pending] });
        pending = [];
      } else if (line && !line.startsWith("#")) pending = [];
    }
  }
  return scenarios;
}

export const tagValues = (tags, prefix) => tags.filter((t) => t.startsWith(`@${prefix}:`)).map((t) => t.slice(prefix.length + 2));
export const ctlOf = (tags) => tags.filter((t) => /^@CTL-\d{3}$/.test(t)).map((t) => t.slice(1));
export const isMeta = (s) => s.tags.includes("@meta");

const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ").trim();
const enforcedBy = (e) => [...(e.controls ?? []), ...(e.existing_checks ?? []).map((c) => `\`${c}\``)].join(", ") || "—";

// CTL → backlog item it awaits, from the @awaiting tags.
const awaitingByCtl = () =>
  Object.fromEntries(scanScenarios().flatMap((s) => {
    const item = tagValues(s.tags, "awaiting")[0];
    return item ? ctlOf(s.tags).map((id) => [id, item]) : [];
  }));

function statusOf(entry, awaiting) {
  const items = [...new Set((entry.controls ?? []).map((id) => awaiting[id]).filter(Boolean))].sort();
  if (entry.status !== "enforced" || items.length === 0) return entry.status;
  const all = (entry.controls ?? []).every((id) => awaiting[id]);
  return `${all ? "specified" : "partly enforced"}, awaiting ${items.join(", ")}`;
}

export function render(catalog) {
  const entries = catalog.entries;
  const awaiting = awaitingByCtl();
  const out = [];
  out.push("# Delivery environments: what runs where");
  out.push("");
  out.push("<!-- Generated from spec/delivery/catalog.yaml by `npm --prefix spec/delivery run catalog:render`.");
  out.push("     Do not edit by hand: a delivery scenario fails when this file and the catalog differ. -->");
  out.push("");
  out.push("Every tool, service and check used to build, run and govern the system, sorted by environment.");
  out.push("**Required** means new work gets it by default and the pipeline enforces it. **Informational**");
  out.push("means it runs and reports but does not block. Each enforced row names the executable scenarios");
  out.push("(`CTL-xxx` in `spec/delivery/features/`) or existing checks that prove it; a planned row has none yet.");
  out.push("**Specified, awaiting X** means the scenarios exist but the delivery code is built in backlog item X;");
  out.push("until then they run as information only.");
  out.push("");
  out.push(`Region: \`${catalog.region}\`. Monthly budget ceiling: $${catalog.budget_usd}.`);
  for (const env of ENVS) {
    out.push("");
    out.push(`## ${ENV_TITLES[env]}`);
    out.push("");
    out.push(cell(catalog.environments?.[env]));
    out.push("");
    out.push("| Practice | Tools | Use | Why here | Enforced by | Status |");
    out.push("| --- | --- | --- | --- | --- | --- |");
    for (const e of entries.filter((x) => x.environments[env].use !== "not-used")) {
      const use = e.environments[env].use;
      out.push(`| ${cell(e.name)} | ${cell((e.tools ?? []).join(", "))} | ${use} | ${cell(e.environments[env].why)} | ${enforcedBy(e)} | ${statusOf(e, awaiting)} |`);
    }
    const required = entries.filter((x) => x.environments[env].use === "required");
    out.push("");
    out.push(`### Defaults for new work in ${ENV_TITLES[env]}`);
    out.push("");
    for (const e of required) {
      const status = statusOf(e, awaiting);
      out.push(`- [${status === "enforced" ? "x" : " "}] ${e.name}${status === "enforced" ? "" : ` (${status})`}`);
    }
    const notUsed = entries.filter((x) => x.environments[env].use === "not-used");
    if (notUsed.length) {
      out.push("");
      out.push(`### Deliberately not used in ${ENV_TITLES[env]}`);
      out.push("");
      for (const e of notUsed) out.push(`- **${e.name}**: ${cell(e.environments[env].why)}`);
    }
  }
  out.push("");
  out.push("## Cost notes");
  out.push("");
  out.push("| Practice | Cost |");
  out.push("| --- | --- |");
  for (const e of entries.filter((x) => x.cost)) out.push(`| ${cell(e.name)} | ${cell(e.cost)} |`);
  out.push("");
  return out.join("\n");
}
