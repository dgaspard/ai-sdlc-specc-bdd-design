// Self-check for the guard, using a temporary copy; real files are never touched. Protected test.
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { manifestFor, compare, scanSkips, listProtected } from "../../guard/guard.js";

let root;
const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };

describe("guard", () => {
  before(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "guard-"));
    write("spec/tests/a.test.js", "it('[X] works', () => {});\n");
    write("spec/features/a.feature", "Feature: A\n  Scenario: B\n");
    write("docs/specs/decisions.md", "D-01\n");
    write("AGENTS.md", "rules\n");
    write("spec/node_modules/pkg/index.js", "ignored\n");
    write("services/checkout/app.js", "not protected\n");
  });
  after(() => fs.rmSync(root, { recursive: true, force: true }));

  it("[GUARD] fingerprints protected files only", () => {
    assert.deepEqual(listProtected(root), ["AGENTS.md", "docs/specs/decisions.md", "spec/features/a.feature", "spec/tests/a.test.js"]);
  });

  it("[GUARD] detects modified, deleted, and added protected files", () => {
    const frozen = manifestFor(root);
    assert.deepEqual(compare(root, frozen), { modified: [], missing: [], added: [] });
    write("spec/tests/a.test.js", "it('[X] works', () => { /* weakened */ });\n");
    fs.rmSync(path.join(root, "docs/specs/decisions.md"));
    write("spec/tests/extra.test.js", "// sneaky\n");
    write("services/checkout/app.js", "changed implementation is fine\n");
    assert.deepEqual(compare(root, frozen), {
      modified: ["spec/tests/a.test.js"], missing: ["docs/specs/decisions.md"], added: ["spec/tests/extra.test.js"],
    });
  });

  it("[GUARD] finds skipped or focused tests and tagged scenarios", () => {
    const skipCall = ["it", "skip"].join(".") + "('later', () => {});\n"; // built at runtime so the real scan ignores this file
    write("spec/tests/b.test.js", skipCall);
    write("spec/features/b.feature", "Feature: B\n  @wip\n  Scenario: C\n");
    assert.equal(scanSkips(root).length, 2);
  });
});
