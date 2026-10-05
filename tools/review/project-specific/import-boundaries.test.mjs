// ENG-02 automated gate: no service imports another service's code, and the
// frontend never imports service code directly (it only talks over HTTP).
// Shared infrastructure (services/platform/) is the one allowed exception.
import { it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkImportBoundaries } from "../portable/check-import-boundaries.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const configPath = path.join(here, "import-boundaries.json");

it("[ENG-02] no service or the frontend imports another unit's code directly", () => {
  const violations = checkImportBoundaries(configPath, repoRoot);
  assert.deepEqual(
    violations,
    [],
    violations
      .map((v) => `${v.file}:${v.line}: ${v.owningUnit} imports ${v.importsUnit} directly: ${v.text}`)
      .join("\n"),
  );
});
