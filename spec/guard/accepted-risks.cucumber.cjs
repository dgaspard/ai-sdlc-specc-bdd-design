// SPEC-07: Cucumber config for the accepted-risks suite. Same features and support code as
// spec/cucumber.cjs, but selects only @accepted-risk scenarios and writes no reports of its
// own (spec/guard/accepted-risks.js adds a message formatter). Protected scaffolding.
const base = require("../cucumber.cjs");

module.exports = Object.fromEntries(Object.entries(base).map(([name, profile]) => [name, {
  paths: profile.paths,
  import: profile.import,
  tags: "@accepted-risk",
  format: [],
}]));
