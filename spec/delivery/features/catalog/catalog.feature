@tier:static @meta
Feature: The environment catalog matches the executable spec
  catalog.yaml is the human-readable record of what runs in Local, Non-prod and Prod
  and why, so new work inherits the defaults instead of deciding them again. These
  checks keep it exact: no catalog claim without a scenario, no scenario outside the
  catalog, and the rendered guide can't drift.

  Scenario: Every control scenario is tagged completely
    Given every scenario in the delivery features
    Then each control scenario has one CTL tag, one tier tag, and at least one env, pillar, nist and ssdf tag
    And no CTL ID is used by more than one scenario
    And each awaiting tag names exactly one backlog item that exists in the backlog file

  Scenario: Every control scenario belongs to exactly one catalog entry
    Given the environment catalog
    And every scenario in the delivery features
    Then each CTL ID in the features is listed by exactly one catalog entry
    And each CTL ID in the catalog exists in the features
    And each scenario's env tags are environments where its catalog entry is used

  Scenario: Catalog entries say how each environment uses them
    Given the environment catalog
    Then every entry gives local, nonprod and prod a use of "required", "informational" or "not-used" with a reason
    And every enforced entry lists controls or existing checks, and every planned or deferred entry lists none
    And every existing check named in the catalog exists

  Scenario: The rendered environment guide is current
    Given the environment catalog
    Then rendering the catalog reproduces the committed environment guide exactly
