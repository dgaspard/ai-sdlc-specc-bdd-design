Feature: Checkout remaining visit balance
  Checkout completes the visit and keeps the customer's account consistent with payment authorization.

  Background:
    Given Jordan owns pet Milo
    And Milo has an Accepted reservation and a recorded Wellness visit ready for checkout
    And the reservation's "20.00" USD booking fee was paid
    And the authoritative Wellness service fee is "50.00" USD

  Scenario: Calculate the remaining amount without collecting the booking fee twice
    When checkout calculates the visit balance
    Then the total booking and service amount is "70.00" USD
    And the previously paid amount is "20.00" USD
    And the remaining visit balance is "50.00" USD

  Scenario: Authorized payment completes the reservation
    Given Jordan has no other outstanding visit balances
    And the fake payment provider will authorize the selected method
    When Jordan submits checkout for Milo's visit
    Then the provider authorizes "50.00" USD
    And the reservation becomes "CompletedSettled"
    And Milo's visit has no outstanding balance
    And Jordan's outstanding balance is "0.00" USD
    And Jordan is in good standing for booking

  Scenario: Successful checkout preserves debt from another pet
    Given Jordan's other pet Luna has an unpaid visit balance of "75.00" USD
    And the fake payment provider will authorize the selected method
    When Jordan submits checkout for Milo's visit
    Then Milo's reservation becomes "CompletedSettled"
    And Jordan's outstanding balance is "75.00" USD
    And Jordan cannot book another appointment

  Scenario: Decline records an unpaid completion
    Given Jordan has no other outstanding visit balances
    And the fake payment provider will decline the selected method
    When Jordan submits checkout for Milo's visit
    Then the reservation becomes "CompletedOutstanding"
    And Milo's outstanding visit balance is "50.00" USD
    And Jordan's outstanding balance is "50.00" USD
    And Jordan cannot book another appointment
    And Milo's clinical record remains unchanged

  Scenario: Pay an unpaid visit using a different method
    Given checkout previously declined Milo's visit payment
    And Jordan's outstanding balance is "50.00" USD for this visit only
    And the fake payment provider will authorize a different method
    When Jordan retries payment with that different method as a new attempt
    Then the provider authorizes the remaining "50.00" USD
    And Jordan's outstanding balance becomes "0.00" USD
    And Jordan is in good standing for booking

  Scenario: Another declined attempt does not duplicate debt
    Given checkout previously declined Milo's visit payment
    And Jordan's outstanding balance is "50.00" USD for this visit only
    And the fake payment provider will decline a different method
    When Jordan retries payment with that different method as a new attempt
    Then Jordan's outstanding balance remains "50.00" USD
    And the reservation remains "CompletedOutstanding"
