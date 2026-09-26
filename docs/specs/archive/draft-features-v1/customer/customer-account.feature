Feature: Customer profile and account across pets
  A pet owner needs one profile and account covering all of their pets.

  Scenario: View a customer and their pets
    Given customer "Jordan Rivera" has a recorded phone number and address
    And Jordan owns the pets "Milo" and "Luna"
    When Jordan's customer profile is viewed
    Then the first name is "Jordan" and the last name is "Rivera"
    And the recorded phone number and address are shown
    And the customer pet collection contains "Milo" and "Luna"

  Scenario: Insurance is optional
    Given customer "Jordan Rivera" has no insurance
    And Jordan otherwise has a complete profile and owes "0.00" USD
    When Jordan's eligibility to reserve is checked
    Then the absence of insurance does not prevent booking

  Scenario: Outstanding balance includes unpaid visits across pets
    Given Jordan owns the pets "Milo" and "Luna"
    And Milo's visit has an outstanding amount of "35.00" USD
    And Luna's visit has an outstanding amount of "75.00" USD
    When Jordan's account is viewed
    Then the customer outstanding balance is "110.00" USD
    And Jordan cannot book another appointment

  Scenario: Settling one pet's visit preserves another pet's balance
    Given Jordan owns the pets "Milo" and "Luna"
    And Milo's visit has an outstanding amount of "35.00" USD
    And Luna's visit has an outstanding amount of "75.00" USD
    When Milo's outstanding visit amount is paid
    Then the customer outstanding balance is "75.00" USD
    And Jordan cannot book another appointment

  Scenario: A zero account balance preserves good standing
    Given Jordan otherwise has a complete profile
    And Jordan's outstanding balance across all pets is "0.00" USD
    When Jordan's eligibility to reserve is checked
    Then Jordan is in good standing for booking
