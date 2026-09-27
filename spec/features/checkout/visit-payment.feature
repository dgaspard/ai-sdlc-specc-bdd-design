@service:checkout
Feature: Pay the remaining visit balance
  Checkout collects part or all of a visit balance by card or records cash, then tells
  Customer and Reservation the result.
  Decisions: D-05, D-08, D-09, D-10, D-19, D-36, SCH-011. Telemetry: OBS-031, OBS-032, OBS-033.

  Background:
    Given Milo's finalized Wellness checkout has a remaining balance of "$50.00"
    And the visit was performed by Dr Avery Taylor

  Scenario: Card payment authorized
    Given the fake payment provider will authorize the card
    When Jordan pays the visit balance by card with a new attempt key
    Then the fake payment provider is asked to authorize "$50.00" for purpose "visit_balance"
    And a payment attempt is recorded as "authorized"
    And the remaining balance is "$0.00"
    And Checkout sends Customer a credit of "$50.00" for Milo's visit
    And Checkout asks Reservation to complete the reservation as settled

  Scenario: Card payment declined
    Given the fake payment provider will decline the card
    When Jordan pays the visit balance by card with a new attempt key
    Then a payment attempt is recorded as "declined"
    And the remaining balance is "$50.00"
    And Checkout sends Customer no credit
    And Checkout asks Reservation to complete the reservation as outstanding

  Scenario: Pay with a different card after a decline
    Given a card payment for the visit was declined
    And the fake payment provider will authorize a different card
    When Jordan pays the visit balance with the different card and a new attempt key
    Then the checkout has two payment attempts: "declined" then "authorized"
    And Checkout sends Customer a credit of "$50.00" for Milo's visit
    And Checkout asks Reservation to complete the reservation as settled

  Scenario: A second decline does not add debt again
    Given a card payment for the visit was declined
    And the fake payment provider will decline a different card
    When Jordan pays the visit balance with the different card and a new attempt key
    Then the remaining balance is "$50.00"
    And Customer receives no additional charge

  Scenario: The veterinarian records a cash payment after a decline
    Given a card payment for the visit was declined
    When Dr Avery Taylor records a "$50.00" cash payment for the visit
    Then the fake payment provider is not called
    And a payment attempt is recorded as "cash_recorded" by Dr Avery Taylor
    And the remaining balance is "$0.00"
    And Checkout sends Customer a credit of "$50.00" for Milo's visit
    And Checkout asks Reservation to complete the reservation as settled

  Scenario: Partial card payment reduces the debt without settling the visit
    When Jordan pays "$30.00" of the visit balance
    Then the fake payment provider is asked to authorize "$30.00" for purpose "visit_balance"
    And a payment attempt is recorded as "authorized"
    And the remaining balance is "$20.00"
    And Checkout sends Customer a credit of "$30.00" for Milo's visit
    And Checkout asks Reservation to complete the reservation as outstanding

  Scenario: Partial cash payment reduces the debt without calling the provider
    When Dr Avery Taylor records a "$20.00" cash payment for the visit
    Then the fake payment provider is not called
    And a payment attempt is recorded as "cash_recorded" by Dr Avery Taylor
    And the remaining balance is "$30.00"
    And Checkout sends Customer a credit of "$20.00" for Milo's visit
    And Checkout asks Reservation to complete the reservation as outstanding

  Scenario: A partial payment decline leaves the full debt
    Given the fake payment provider will decline the card
    When Jordan pays "$30.00" of the visit balance
    Then a payment attempt is recorded as "declined"
    And the remaining balance is "$50.00"
    And Checkout sends Customer no credit

  Scenario: Overpayments are rejected before authorization
    When Jordan pays "$60.00" of the visit balance
    Then the payment is refused as invalid
    And the fake payment provider is not called

  Scenario: Cash overpayment is rejected
    When Dr Avery Taylor records a "$60.00" cash payment for the visit
    Then the payment is refused as invalid
    And the fake payment provider is not called

  Scenario: A settled visit cannot be paid again
    Given the visit's remaining balance has been paid
    When Jordan pays the visit balance by card with a new attempt key
    Then the payment is reported as already settled
    And the fake payment provider is not called

  Scenario: Payment succeeds but completion fails
    Given the fake payment provider will authorize the card
    And Reservation will fail to complete the reservation
    When Jordan pays the visit balance by card with a new attempt key
    Then the payment attempt is recorded as "authorized"
    And the result is reported as authorized but completion failed, needing manual recovery
    And the result is not reported as settled or declined
    And no new payment is attempted automatically
