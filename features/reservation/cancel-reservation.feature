@service:reservation
Feature: Cancel a reservation
  The customer or the assigned veterinarian can cancel an Accepted reservation before it
  starts. The slot is released and the booking fee is kept.
  Decisions: D-05, D-07, D-14, D-30. Telemetry: OBS-026.

  Background:
    Given the clinic clock reads "2026-10-05 09:00" Central Time
    And the clinic veterinarians are Dr Avery Taylor and Dr Morgan Reed
    And Jordan has an Accepted reservation for Milo with Dr Avery Taylor on "2026-10-12" at "09:00" with the booking fee paid

  Scenario: The customer cancels before the start
    When Jordan cancels the reservation
    Then the reservation is "Canceled"
    And the slot "2026-10-12 09:00" is available for Dr Avery Taylor
    And the booking fee remains paid
    And Checkout is not asked for a refund

  Scenario: The assigned veterinarian cancels before the start
    When Dr Avery Taylor cancels the reservation
    Then the reservation is "Canceled"

  Scenario: Another veterinarian cannot cancel
    When Dr Morgan Reed cancels the reservation
    Then the cancellation is refused as "not assigned veterinarian"
    And the reservation is "Accepted"

  Scenario: Another customer cannot cancel
    When customer Sam cancels Jordan's reservation
    Then the cancellation is refused as "not found"
    And the reservation is "Accepted"

  Scenario: A reservation cannot be canceled once it has started
    Given the clinic clock reads "2026-10-12 09:00" Central Time
    When Jordan cancels the reservation
    Then the cancellation is refused as "already started"
    And the reservation is "Accepted"

  Scenario: Cancellation keeps the pet's earlier visit records
    Given Milo has an earlier recorded visit with clinical notes
    When Jordan cancels the reservation
    Then Milo's earlier visit and its clinical notes are unchanged

  Scenario Outline: Only Accepted reservations can be canceled
    Given the reservation is "<state>"
    When Jordan cancels the reservation
    Then the cancellation is refused as "invalid state"
    And the reservation is "<state>"
    Examples:
      | state                |
      | Requested            |
      | Denied               |
      | Canceled             |
      | CompletedSettled     |
      | CompletedOutstanding |
