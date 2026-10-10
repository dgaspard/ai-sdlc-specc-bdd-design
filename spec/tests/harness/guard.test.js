// Self-check for the guard, using a temporary copy; real files are never touched. Protected test.
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { manifestFor, compare, scanSkips, scanTags, listProtected } from "../../guard/guard.js";

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

  it("[GUARD] A-20 protects the GitHub root of trust but permits delivery workflow changes", () => {
    write(".github/workflows/guard.yml", "guard\n");
    write(".github/CODEOWNERS", "owners\n");
    write(".github/workflows/delivery-prod.yml", "delivery\n");
    const frozen = manifestFor(root);
    assert.ok(listProtected(root).includes(".github/workflows/guard.yml"));
    assert.ok(listProtected(root).includes(".github/CODEOWNERS"));
    assert.ok(!listProtected(root).includes(".github/workflows/delivery-prod.yml"));
    write(".github/workflows/delivery-prod.yml", "updated delivery\n");
    assert.deepEqual(compare(root, frozen), { modified: [], missing: [], added: [] });
    write(".github/workflows/guard.yml", "changed guard\n");
    fs.rmSync(path.join(root, ".github/CODEOWNERS"));
    assert.deepEqual(compare(root, frozen), {
      modified: [".github/workflows/guard.yml"], missing: [".github/CODEOWNERS"], added: [],
    });
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

  // SPEC-07. Markers are assembled at runtime so the real scan of this file finds nothing.
  it("[SPEC-07] finds conditional skips, escape hatches, and new bare tags, but not comments or prose", () => {
    const s = (...p) => p.join("");
    write("spec/tests/c.test.js", [
      s("it('x', { sk", "ip: process.env.CI && 'later' }, () => {});"),
      s("Given('x', function () { return 'skip", "ped'; });"),
      s("test.fix", "me(true, 'flaky');"),
      s("// it.sk", "ip( in a comment is fine"),
      "const label = 'Administrator-only: no veterinarian identity';",
    ].join("\n"));
    write("spec/harness/h.js", s("t.sk", "ip('harness code is scanned too');\n"));
    write("spec/features/c.feature", s("Feature: C\n  # @pen", "ding in a comment\n  @pen", "ding\n  Scenario: D\n"));
    const hits = scanSkips(root).filter((h) => /\/c\.|\/h\.js/.test(h));
    assert.deepEqual(hits.map((h) => h.split(" ")[0]),
      ["spec/features/c.feature:3", "spec/harness/h.js:1", "spec/tests/c.test.js:1", "spec/tests/c.test.js:2", "spec/tests/c.test.js:3"]);
  });

  it("[SPEC-07] validates @accepted-risk and @retired tags, references, and expiry", () => {
    write("docs/specs/business-decisions.md", "| D-24 | Legacy app replaced. |\n");
    write("docs/engineering-reviews/rev-file.md", "REV-001 double charge\n");
    const ok = "@accepted-risk @risk:REV-001 @source:rev-file @owner:dustin @review:2027-01-31";
    write("spec/features/t.feature", [
      "Feature: T",
      `  ${ok}`, "  Scenario: valid risk",
      "  @retired @decision:D-24", "  Scenario: valid retirement",
      "  @accepted-risk @risk:REV-001 @source:rev-file @owner:dustin", "  Scenario: no review date",
      "  @accepted-risk @risk:REV-999 @source:rev-file @owner:dustin @review:2027-01-31", "  Scenario: unknown review id",
      "  @accepted-risk @risk:D-99 @owner:dustin @review:2027-01-31", "  Scenario: unknown decision",
      "  @accepted-risk @risk:REV-001 @source:rev-file @owner:dustin @review:2026-01-01", "  Scenario: expired",
      "  @retired", "  Scenario: retired without decision",
      "  @risk:REV-001", "  Scenario: metadata without the tag",
    ].join("\n"));
    write("spec/features/u.feature", "@retired @decision:D-24\nFeature: whole feature retired\n");
    const r = scanTags(root, "2026-10-07");
    assert.deepEqual(r.errors.map((e) => e.split(" ")[0]), [
      "spec/features/t.feature:7",  // no review date
      "spec/features/t.feature:9",  // REV-999 not in the review file
      "spec/features/t.feature:11", // D-99 not a decision
      "spec/features/t.feature:13", // review date passed
      "spec/features/t.feature:15", // @retired without @decision
      "spec/features/t.feature:17", // metadata tag without @accepted-risk
      "spec/features/u.feature:2",  // feature-level retirement
    ]);
    assert.ok(r.register.some((x) => x.scenario === "valid risk" && x.owner === "dustin" && x.review === "2027-01-31"));
    assert.equal(scanTags(root, "2027-01-20").warnings.filter((w) => w.includes("valid risk")).length, 1, "warns within 14 days");
    assert.equal(scanTags(root, "2027-02-01").errors.filter((e) => e.includes("valid risk")).length, 1, "fails after the review date");
  });
});
