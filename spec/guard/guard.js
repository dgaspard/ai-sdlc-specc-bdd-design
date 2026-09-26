// Guard for protected specs and tests (GUARD-01). Fingerprints every protected file
// and scans tests for skip/only markers. Protected scaffolding.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CONFIG = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "protected-paths.json"), "utf8"));
export const MANIFEST = "spec/protected.sha256";

const isIgnored = (rel) => CONFIG.ignored.some((i) => (i.endsWith("/") ? rel.split("/").includes(i.slice(0, -1)) : rel === i || rel.endsWith(`/${i}`)));

/** Repo-relative paths of every protected file under root, sorted. */
export function listProtected(root) {
  const out = [];
  const walk = (rel) => {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs) || isIgnored(rel)) return;
    const st = fs.lstatSync(abs);
    if (st.isDirectory()) for (const e of fs.readdirSync(abs)) walk(rel ? `${rel}/${e}` : e);
    else if (st.isFile()) out.push(rel);
  };
  for (const p of CONFIG.protected) walk(p.replace(/\/$/, ""));
  return [...new Set(out)].sort();
}

export function manifestFor(root) {
  return listProtected(root)
    .map((rel) => `${crypto.createHash("sha256").update(fs.readFileSync(path.join(root, rel))).digest("hex")}  ${rel}`)
    .join("\n") + "\n";
}

function parse(text) {
  const map = new Map();
  for (const line of text.split("\n").filter(Boolean)) {
    const m = line.match(/^([0-9a-f]{64}) {2}(.+)$/);
    if (m) map.set(m[2], m[1]);
  }
  return map;
}

/** Compares current files with a manifest; returns { modified, missing, added }. */
export function compare(root, manifestText) {
  const expected = parse(manifestText);
  const actual = parse(manifestFor(root));
  return {
    modified: [...expected].filter(([f, h]) => actual.has(f) && actual.get(f) !== h).map(([f]) => f),
    missing: [...expected.keys()].filter((f) => !actual.has(f)),
    added: [...actual.keys()].filter((f) => !expected.has(f)),
  };
}

const SKIP_CODE = /\b(?:it|test|describe|suite)\.(?:skip|only|todo)\s*\(|\{\s*(?:skip|only|todo)\s*:\s*true/;
const SKIP_TAG = /(^|\s)@(?:skip|wip|ignore|only)\b/;

/** Finds skip/only markers in spec tests and features; returns ["file:line text"]. */
export function scanSkips(root) {
  const hits = [];
  for (const rel of listProtected(root).filter((f) => f.startsWith("spec/tests/") || f.startsWith("spec/features/"))) {
    const isFeature = rel.endsWith(".feature");
    if (!isFeature && !rel.endsWith(".js")) continue;
    fs.readFileSync(path.join(root, rel), "utf8").split("\n").forEach((line, i) => {
      if ((isFeature ? SKIP_TAG : SKIP_CODE).test(line)) hits.push(`${rel}:${i + 1} ${line.trim()}`);
    });
  }
  return hits;
}
