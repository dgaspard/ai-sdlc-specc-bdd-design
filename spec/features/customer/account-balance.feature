@service:customer
Feature: Customer account balance
  Customer owns per-visit account entries. The outstanding balance is derived from them
  and can never be negative.
  Decisions: D-09, D-13, D-19, D-26, SCH-011. Schema: AccountEntry.

  Background:
    Given customer "Jordan Rivera" owns the pets "Milo" and "Luna"

  Scenario: A visit charge creates an account entry
    When a charge of "$70.00" is recorded for Milo's visit
    Then Jordan has an account entry for Milo's visit owing "$70.00"
    And Jordan's outstanding balance is "$70.00"

  Scenario: Credits reduce the visit balance
    Given Milo's visit entry owes "$70.00"
    When a credit of "$20.00" from payment "booking-payment" is applied to Milo's visit
    Then Milo's visit balance is "$50.00"
    And Jordan's outstanding balance is "$50.00"

  Scenario: The same payment is credited only once
    Given Milo's visit entry owes "$70.00"
    And a credit of "$20.00" from payment "booking-payment" was applied to Milo's visit
    When the same credit from payment "booking-payment" is applied again
    Then the change is reported as already applied
    And Milo's visit balance is "$50.00"

  Scenario: A discount reduces the visit balance
    Given Milo's visit entry owes "$70.00" with "$20.00" credited
    When a discount of "$30.00" is applied to Milo's visit
    Then Milo's visit balance is "$20.00"
    And the entry shows "$30.00" discounted

  Scenario: A visit accepts only one discount
    Given Milo's visit entry has a "$10.00" discount
    When another discount is applied to Milo's visit
    Then the change is reported as already applied

  Scenario: A change can never make the balance negative
    Given Milo's visit entry owes "$70.00" with "$20.00" credited
    When a credit of "$60.00" is applied to Milo's visit
    Then the change is rejected as an invalid amount
    And Milo's visit balance is "$50.00"

  Scenario: Balance adds up unpaid visits across pets
    Given Milo's visit balance is "$35.00"
    And Luna's visit balance is "$75.00"
    When Jordan's account is viewed
    Then Jordan's outstanding balance is "$110.00"

  Scenario: Paying one pet's visit keeps the other pet's debt
    Given Milo's visit balance is "$35.00"
    And Luna's visit balance is "$75.00"
    When a credit of "$35.00" is applied to Milo's visit
    Then Jordan's outstanding balance is "$75.00"
