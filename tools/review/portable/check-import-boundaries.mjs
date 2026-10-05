#!/usr/bin/env node
// Portable: no project-specific knowledge beyond the config file it's pointed
// at. Flags a unit importing another unit's code directly instead of going
// through whatever boundary that project declares (HTTP, a shared package,
// etc). The test to apply before adding anything here: would running this
// exact mechanism against a different project need new *parameters* (a
// different config file) or rewritten *logic*? New parameters only → stays
// here.
//
// Usage: check-import-boundaries.mjs <config.json> [repo-root]
//
// Config shape:
// {
//   "units": [{ "name": "customer", "root": "services/customer", "allow": ["other-unit-name"] }],
//   "shared": ["services/platform"],
//   "extensions": [".js", ".mjs"]
// }
// A unit may always import its own files, anything under "shared", and
// anything from a unit named in its own "allow" list (default: none — no
// cross-unit imports). Bare specifiers (npm packages, "node:*") are never a
// boundary concern and are skipped.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SPECIFIER_PATTERN =
  /(?:\bfrom\s+|\bimport\(|\brequire\()\s*["']([^"']+)["']/g;

function walk(dir, extensions, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, extensions, out);
    else if (extensions.some((ext) => entry.name.endsWith(ext))) out.push(full);
  }
  return out;
}

function unitFor(absPath, units, shared, repoRoot) {
  const rel = path.relative(repoRoot, absPath);
  for (const s of shared) if (rel === s || rel.startsWith(s + path.sep)) return { kind: "shared", name: s };
  for (const u of units) if (rel === u.root || rel.startsWith(u.root + path.sep)) return { kind: "unit", name: u.name };
  return null;
}

export function checkImportBoundaries(configPath, repoRoot = process.cwd()) {
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const extensions = config.extensions ?? [".js", ".mjs"];
  const violations = [];

  for (const unit of config.units) {
    const unitRoot = path.join(repoRoot, unit.root);
    let files;
    try {
      files = walk(unitRoot, extensions);
    } catch {
      continue; // unit root doesn't exist in this checkout; nothing to scan
    }
    const allowed = new Set([unit.name, ...(unit.allow ?? [])]);

    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const lines = text.split("\n");
      for (const match of text.matchAll(SPECIFIER_PATTERN)) {
        const specifier = match[1];
        if (!specifier.startsWith(".")) continue; // bare specifier: npm/node builtin, not a boundary concern
        const resolved = path.resolve(path.dirname(file), specifier);
        const target = unitFor(resolved, config.units, config.shared ?? [], repoRoot);
        if (!target) continue; // resolves outside any declared unit/shared path; not this check's concern
        if (target.kind === "shared") continue; // shared infra is always allowed
        if (allowed.has(target.name)) continue;
        const upTo = text.slice(0, match.index);
        const line = upTo.split("\n").length;
        violations.push({
          file: path.relative(repoRoot, file),
          line,
          text: lines[line - 1]?.trim(),
          specifier,
          importsUnit: target.name,
          owningUnit: unit.name,
        });
      }
    }
  }
  return violations;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , configArg, rootArg] = process.argv;
  if (!configArg) {
    console.error("usage: check-import-boundaries.mjs <config.json> [repo-root]");
    process.exit(2);
  }
  const repoRoot = rootArg ?? fileURLToPath(new URL("../../..", import.meta.url));
  const violations = checkImportBoundaries(configArg, repoRoot);
  if (violations.length) {
    for (const v of violations) {
      console.error(`${v.file}:${v.line}: ${v.owningUnit} imports ${v.importsUnit} directly: ${v.text}`);
    }
    console.error(`${violations.length} import-boundary violation(s).`);
    process.exit(1);
  }
  console.log("No import-boundary violations.");
}
