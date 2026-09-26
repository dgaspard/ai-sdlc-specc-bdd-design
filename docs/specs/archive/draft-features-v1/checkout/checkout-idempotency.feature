Feature: Duplicate checkout protection
  Repeating a payment attempt returns its original result without repeating its effects.

  Background:
    Given a recorded Wellness visit is ready for checkout
    And its booking fee is paid and its remaining balance is "50.00" USD

  Scenario: Replay a completed checkout request
    Given the fake payment provider authorizes a checkout attempt
    When that identical request is submitted again with the same attempt key
    Then both requests return the same checkout result
    And that attempt causes exactly one payment authorization
    And account settlement and reservation completion are applied only once

  Scenario: Concurrent duplicate requests share one authorization
    Given the fake payment provider will authorize payment
    When two identical checkout requests with the same attempt key arrive concurrently
    Then both requests return the same completed checkout result
    And that attempt causes exactly one payment authorization
    And account settlement and reservation completion are applied only once

  Scenario: Replay a declined attempt without contacting payment again
    Given the fake payment provider declines a checkout attempt
    When that identical request is submitted again with the same attempt key
    Then both requests return the same declined result
    And the provider was invoked only once for that attempt
    And the outstanding visit balance remains "50.00" USD

  Scenario: Reject changed input under the same attempt key
    Given a checkout attempt key has already been used with one payment method
    When checkout receives the same key with a different payment method
    Then the request is rejected as conflicting input
    And the provider receives no additional payment request
    And the original attempt result is preserved

  Scenario: A new key cannot charge an already settled visit again
    Given a checkout attempt has authorized payment and settled the visit
    When another checkout request for the settled visit uses a new attempt key
    Then no additional payment authorization occurs
    And the visit remains settled
    And no duplicate account credit is created
