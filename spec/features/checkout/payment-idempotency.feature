@service:checkout
Feature: Duplicate payment protection
  Repeating a payment request with the same attempt key returns the original result
  without repeating its effects.
  Decisions: D-12. Telemetry: OBS-031, OBS-038.

  Background:
    Given Milo's finalized Wellness checkout has a remaining balance of "$50.00"

  Scenario: Replay an authorized payment
    Given the fake payment provider will authorize the card
    And Jordan paid the visit balance with attempt key "key-1"
    When the identical request is sent again with attempt key "key-1"
    Then both requests return the same result
    And the second result is marked as a replay
    And the fake payment provider was called only once
    And Customer received one credit and Reservation one completion request

  Scenario: Concurrent identical requests share one authorization
    Given the fake payment provider will authorize the card
    When two identical requests with attempt key "key-1" arrive at the same time
    Then both requests return the same authorized result
    And the fake payment provider was called only once
    And Customer received one credit and Reservation one completion request

  Scenario: Replay a declined payment
    Given the fake payment provider will decline the card
    And Jordan paid the visit balance with attempt key "key-1"
    When the identical request is sent again with attempt key "key-1"
    Then both requests return the same declined result
    And the fake payment provider was called only once

  Scenario: Changed input under the same key is a conflict
    Given Jordan paid the visit balance with card "card-A" and attempt key "key-1"
    When a request with card "card-B" and attempt key "key-1" is sent
    Then the request is refused as an idempotency conflict
    And the fake payment provider receives no additional request
    And the original attempt is unchanged

  Scenario: Repeated cash recording credits only once
    Given Dr Avery Taylor recorded a "$50.00" cash payment with attempt key "cash-1"
    When the same cash recording is sent again with attempt key "cash-1"
    Then the same result is returned
    And Customer received one credit
