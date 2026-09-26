@service:reservation
Feature: Complete a reservation
  Checkout tells Reservation how the visit ended financially. Reservation records the
  combined completion state.
  Decisions: D-05, D-09, completion follow-up 1. Telemetry: OBS-035.

  Background:
    Given Jordan has an Accepted reservation for Milo with a recorded visit

  Scenario: Complete as settled
    When Checkout completes the reservation as settled
    Then the reservation is "CompletedSettled"

  Scenario: Complete as outstanding
    When Checkout completes the reservation as outstanding
    Then the reservation is "CompletedOutstanding"

  Scenario: A later full payment settles an outstanding reservation
    Given the reservation is "CompletedOutstanding"
    When Checkout completes the reservation as settled
    Then the reservation is "CompletedSettled"

  Scenario: Repeating the same completion changes nothing
    Given the reservation is "CompletedSettled"
    When Checkout completes the reservation as settled
    Then the completion is reported as already completed
    And the reservation is "CompletedSettled"

  Scenario: A settled reservation cannot become outstanding
    Given the reservation is "CompletedSettled"
    When Checkout completes the reservation as outstanding
    Then the completion is refused as "invalid state"
    And the reservation is "CompletedSettled"

  Scenario: A reservation without a visit cannot be completed
    Given Jordan has an Accepted reservation for Luna with no recorded visit
    When Checkout completes Luna's reservation as settled
    Then the completion is refused as "invalid state"
    And Luna's reservation is "Accepted"

  Scenario Outline: Only Accepted or outstanding reservations can be completed
    Given the reservation is "<state>"
    When Checkout completes the reservation as settled
    Then the completion is refused as "invalid state"
    Examples:
      | state     |
      | Requested |
      | Denied    |
      | Canceled  |
