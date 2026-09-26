module.exports = {
  default: {
    paths: ["features/**/*.feature"],
    import: ["tests/support/**/*.js", "tests/steps/**/*.js"],
    format: ["progress", "html:../test-results/cucumber-report.html"]
  }
};
