// SPEC-07: @accepted-risk scenarios are expected to fail; they run only in the
// accepted-risks suite (guard/accepted-risks.js). @retired scenarios stay in and must pass.
module.exports = {
  default: {
    paths: ["features/customer/*.feature", "features/reservation/*.feature", "features/checkout/*.feature", "features/veterinarian-services/*.feature"],
    import: ["tests/support/**/*.js", "tests/steps/**/*.js"],
    tags: "not @accepted-risk",
    format: ["progress", "html:../test-results/cucumber-report.html"]
  },
  workflows: {
    paths: ["features/workflows/*.feature"],
    import: ["tests/workflows/*.js"],
    tags: "not @accepted-risk",
    format: ["progress", "html:../test-results/workflow-report.html"]
  }
};
