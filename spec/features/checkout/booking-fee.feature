@service:checkout
Feature: Collect the booking fee
  Reservation asks Checkout to collect the $20 booking fee before acceptance.
  Checkout owns every payment record.
  Decisions: D-07, D-12, D-19, D-23, D-32. Schema: PaymentAttempt. Telemetry: OBS-032, OBS-033.

  Background:
    Given Jordan has a Requested reservation for Milo with Dr Avery Taylor

  Scenario: Card booking fee authorized
    Given the fake payment provider will authorize the card
    When Reservation asks Checkout to collect the booking fee by card with a new attempt key
    Then the fake payment provider is asked to authorize "$20.00" for purpose "booking_fee"
    And a payment attempt is recorded as "authorized" for "$20.00"
    And Checkout returns the payment ID as paid

  Scenario: Card booking fee declined
    Given the fake payment provider will decline the card
    When Reservation asks Checkout to collect the booking fee by card with a new attempt key
    Then a payment attempt is recorded as "declined"
    And the declined attempt has no authorization reference
    And Checkout returns the result as declined

  Scenario: Cash booking fee recorded by the veterinarian
    When Reservation asks Checkout to record a "$20.00" cash booking fee from Dr Avery Taylor
    Then the fake payment provider is not called
    And a payment attempt is recorded as "cash_recorded" by Dr Avery Taylor
    And Checkout returns the payment ID as paid

  Scenario: Retrying the same booking fee request does not charge twice
    Given the fake payment provider will authorize the card
    And the booking fee was collected with attempt key "key-1"
    When the same request is sent again with attempt key "key-1"
    Then the same payment ID and result are returned
    And the fake payment provider was called only once

  Scenario: A paid booking fee is not collected again with a new key
    Given the booking fee for the reservation has been paid
    When Reservation asks Checkout to collect the booking fee with a new attempt key
    Then the fake payment provider is not called
    And the original paid payment ID is returned

  Scenario: A new card after a decline is a new attempt
    Given the booking fee was declined with attempt key "key-1"
    And the fake payment provider will authorize a different card
    When Reservation asks Checkout to collect the booking fee with a different card and attempt key "key-2"
    Then the reservation has two booking fee attempts: "declined" then "authorized"
