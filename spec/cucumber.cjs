module.exports = {
  default: {
    paths: ["features/customer/*.feature", "features/reservation/*.feature", "features/checkout/*.feature", "features/veterinarian-services/*.feature"],
    import: ["tests/support/**/*.js", "tests/steps/**/*.js"],
    format: ["progress", "html:../test-results/cucumber-report.html"]
  },
  workflows: {
    paths: ["features/workflows/*.feature"],
    import: ["tests/workflows/*.js"],
    format: ["progress", "html:../test-results/workflow-report.html"]
  }
};
