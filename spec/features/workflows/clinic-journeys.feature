@workflow
Feature: Backend clinic journeys across real services
  Playwright sends HTTP requests without launching a browser.
  All four services run; only the external payment provider is fake.

  Scenario: Book, document, finalize, and pay for a visit
    Given Jordan has booked and attended a Wellness visit with a finalized bill
    When Jordan pays 5000 cents by card
    Then the visit and customer account show 0 cents due and "CompletedSettled"
    And Jordan can request another appointment for Luna

  Scenario: Partial card, declined card, and cash settle exactly one visit
    Given Jordan has booked and attended a Wellness visit with a finalized bill
    When Jordan pays 2000 cents by card
    Then the visit and customer account show 3000 cents due and "CompletedOutstanding"
    And Jordan cannot request another appointment for Luna
    When Jordan attempts a declined payment of 1000 cents
    Then the visit and customer account show 3000 cents due and "CompletedOutstanding"
    When the assigned veterinarian records 3000 cents in cash
    Then the visit and customer account show 0 cents due and "CompletedSettled"
    And Jordan can request another appointment for Luna

  Scenario: Replaying a partial payment after settlement cannot double-credit it
    Given Jordan has booked and attended a Wellness visit with a finalized bill
    When Jordan pays 2000 cents by card
    And the assigned veterinarian records 3000 cents in cash
    And Jordan retries the original partial card payment
    Then the original payment is replayed without another provider call
    And the visit and customer account show 0 cents due and "CompletedSettled"

  Scenario: A promotion after partial payment settles only the remaining amount
    Given Jordan has booked and attended a Wellness visit with a finalized bill
    When Jordan pays 2000 cents by card
    And the assigned veterinarian applies a 5000 cent promotion
    Then only 3000 cents are discounted and the provider is not called again
    And the visit and customer account show 0 cents due and "CompletedSettled"

  Scenario: Clinical corrections and catalog updates preserve a finalized bill
    Given Jordan has booked and attended a Wellness visit with a finalized bill
    When Jordan pays 2000 cents by card
    And the assigned veterinarian corrects the clinical notes and updates the catalog fee
    Then the finalized bill, payments, and customer account remain unchanged
    And the visit and customer account show 3000 cents due and "CompletedOutstanding"

  Scenario: Concurrent distinct payment keys cannot overcollect
    Given Jordan has booked and attended a Wellness visit with a finalized bill
    When Jordan concurrently attempts two 3000 cent card payments
    Then exactly one payment succeeds and the other is rejected before authorization
    And the visit and customer account show 2000 cents due and "CompletedOutstanding"

  Scenario: Customer cancellation retains the booking fee and releases capacity
    Given Jordan has an accepted appointment before its start
    When Jordan cancels their appointment
    Then the booking payment remains paid and the slot can be booked again

  Scenario: The two veterinarians can accept different pets at the same time
    When Jordan and Sam book different pets with different veterinarians at the same time
    Then both reservations are accepted and each booking fee is paid once

  Scenario: Self-registration enables a customer's first appointment request
    When Casey self-registers with all information and requests an appointment
    Then the request belongs to Casey and their registered pet
