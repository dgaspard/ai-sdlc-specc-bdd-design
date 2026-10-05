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

  # D-48 + ENG-02 REV-016: billing actions follow the visit's current veterinarian.
  # A fill-in veterinarian who claims a closed, unnoted visit can bill it; the
  # original veterinarian can't. (Dr Avery Taylor also holds administrator, so
  # the "loses access" direction uses Dr Morgan Reed as the original.)
  Scenario: A fill-in veterinarian can bill a visit they claimed after it was closed
    Given Jordan has a finalized Wellness bill for a visit Dr Avery Taylor closed without clinical notes
    When Dr Morgan Reed reassigns the visit to themselves
    And Dr Morgan Reed applies a 1000 cent promotion
    Then the visit and customer account show 4000 cents due and "Accepted"

  Scenario: The original veterinarian loses billing actions after a fill-in claims the visit
    Given Jordan has a finalized Wellness bill for a visit Dr Morgan Reed closed without clinical notes
    When Dr Avery Taylor reassigns the visit to themselves
    And Dr Morgan Reed attempts to record 5000 cents in cash
    Then the cash payment is refused as "not_assigned_veterinarian"
    And the visit and customer account show 5000 cents due and "Accepted"
