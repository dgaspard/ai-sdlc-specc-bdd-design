// SPEC-08 delivery suite. Tiers (see README): static and template run offline in the
// agent's local loop; live needs AWS credentials and runs only in CI (A-13).
// Scenarios tagged @awaiting:<backlog ID> describe delivery code not built yet. They are
// left out of the required profiles and run in `awaiting`, which reports any that
// already pass. Removing the tag (a human freeze) is what makes a control required.
const fs = require("node:fs");
const path = require("node:path");

const featuresDir = path.join(__dirname, "features");
const awaitingTags = [
  ...new Set(
    fs.readdirSync(featuresDir, { recursive: true })
      .filter((f) => f.endsWith(".feature"))
      .flatMap((f) => fs.readFileSync(path.join(featuresDir, f), "utf8").match(/@awaiting:[\w.-]+/g) ?? []),
  ),
].sort();
const awaiting = awaitingTags.length ? `(${awaitingTags.join(" or ")})` : "@awaiting-none";
const notAwaiting = awaitingTags.length ? `not ${awaiting}` : "not @awaiting-none";

const common = {
  paths: ["features/**/*.feature"],
  import: ["steps/**/*.js"],
};

module.exports = {
  default: { ...common, tags: `not @tier:live and ${notAwaiting}`, format: ["progress"] },
  static: { ...common, tags: `(@tier:static or @meta) and ${notAwaiting}`, format: ["progress"] },
  template: { ...common, tags: `@tier:template and ${notAwaiting}`, format: ["progress"] },
  live: { ...common, tags: `@tier:live and ${notAwaiting}`, format: ["progress"] },
  awaiting: { ...common, tags: `${awaiting} and not @tier:live`, format: ["progress"] },
};
