@service:customer
Feature: Booking eligibility
  A customer may request appointments only when they owe nothing.
  Decisions: D-13, D-20, D-27. Telemetry: OBS-012.

  Background:
    Given customer "Jordan Rivera" owns the pets "Milo" and "Luna"

  Scenario: A customer who owes nothing is eligible
    Given Jordan's outstanding balance is "$0.00"
    When Jordan's booking eligibility is checked
    Then Jordan is eligible

  Scenario: Missing insurance does not affect eligibility
    Given Jordan has no insurance
    And Jordan's outstanding balance is "$0.00"
    When Jordan's booking eligibility is checked
    Then Jordan is eligible

  Scenario: A customer who owes money is ineligible and the balance is reported
    Given Milo's visit balance is "$35.00"
    And Luna's visit balance is "$75.00"
    When Jordan's booking eligibility is checked
    Then Jordan is ineligible
    And the reported outstanding balance is "$110.00"

  Scenario: Unknown customer
    When booking eligibility is checked for an unknown customer
    Then the customer is reported as not found
