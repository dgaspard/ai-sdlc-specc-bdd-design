@service:reservation
Feature: Veterinarian accepts or denies a request
  The assigned veterinarian decides. Acceptance needs the $20 booking fee paid first,
  which Reservation asks Checkout to collect.
  Decisions: D-04, D-16, D-23, D-25, D-29, D-32. Telemetry: OBS-024, OBS-025.

  Background:
    Given the clinic clock reads "2026-10-05 09:00" Central Time
    And the clinic veterinarians are Dr Avery Taylor and Dr Morgan Reed
    And Jordan has a Requested reservation for Milo with Dr Avery Taylor on "2026-10-12" at "09:00"

  Scenario: Accept after the booking fee is paid by card
    Given Checkout will report the booking fee as paid with payment "pay-1"
    When Dr Avery Taylor accepts the reservation using Jordan's card
    Then Reservation asks Checkout to collect "$20.00" for this reservation
    And the reservation is "Accepted"
    And the acceptance time is recorded
    And the booking fee is paid with payment "pay-1"
    And the slot "2026-10-12 09:00" is taken for Dr Avery Taylor

  Scenario: Accept after the veterinarian records a cash booking fee
    Given Checkout will report the cash booking fee as recorded with payment "cash-1"
    When Dr Avery Taylor accepts the reservation with a cash booking fee
    Then Reservation asks Checkout to record "$20.00" cash from Dr Avery Taylor
    And the reservation is "Accepted"
    And the booking fee is paid with payment "cash-1"

  Scenario: A declined booking fee keeps the request pending
    Given Checkout will report the booking fee as declined
    When Dr Avery Taylor accepts the reservation using Jordan's card
    Then the acceptance is refused as "booking payment declined"
    And the reservation is "Requested"
    And the booking fee is not paid
    And the slot "2026-10-12 09:00" is available for Dr Avery Taylor

  Scenario: Only the assigned veterinarian can accept
    When Dr Morgan Reed accepts the reservation
    Then the acceptance is refused as "not assigned veterinarian"
    And Checkout is not asked to collect a booking fee
    And the reservation is "Requested"

  Scenario: A taken slot denies the request automatically
    Given Jordan's other pet Luna has an Accepted reservation with Dr Avery Taylor on "2026-10-12" at "09:00"
    When Dr Avery Taylor accepts Milo's reservation
    Then the reservation is "Denied"
    And Checkout is not asked to collect a booking fee

  Scenario: A pet already booked at that time denies the request automatically
    Given Milo has an Accepted reservation with Dr Morgan Reed on "2026-10-12" at "09:00"
    When Dr Avery Taylor accepts Milo's reservation
    Then the reservation is "Denied"
    And Checkout is not asked to collect a booking fee

  Scenario: Concurrent acceptances for one slot produce one winner
    Given Sam has a Requested reservation for Rex with Dr Avery Taylor on "2026-10-12" at "09:00"
    And Checkout will report booking fees as paid
    When Dr Avery Taylor accepts both reservations at the same time
    Then exactly one reservation is "Accepted"
    And the other reservation is "Denied"
    And Checkout collected exactly one booking fee

  Scenario: A request whose start has passed cannot be accepted
    Given the clinic clock reads "2026-10-12 09:30" Central Time
    When Dr Avery Taylor accepts the reservation
    Then the acceptance is refused as "past start"
    And the reservation is "Requested"

  Scenario: The assigned veterinarian denies a request
    When Dr Avery Taylor denies the reservation
    Then the reservation is "Denied"
    And Checkout is not asked to collect a booking fee

  Scenario: Only the assigned veterinarian can deny
    When Dr Morgan Reed denies the reservation
    Then the denial is refused as "not assigned veterinarian"
    And the reservation is "Requested"

  Scenario Outline: Only Requested reservations can be accepted or denied
    Given the reservation is "<state>"
    When Dr Avery Taylor <action> the reservation
    Then the <decision> is refused as "invalid state"
    And the reservation is "<state>"
    Examples:
      | state    | action  | decision   |
      | Accepted | accepts | acceptance |
      | Accepted | denies  | denial     |
      | Denied   | accepts | acceptance |
      | Canceled | denies  | denial     |

  # MVP-02A (D-41, D-44): "the administrator" is Dr Avery Taylor's account
  # acting on its administrator role. These scenarios use a reservation
  # assigned to Dr Morgan Reed specifically so the test actually exercises
  # the bypass, rather than coinciding with Dr Avery Taylor already being
  # the assigned veterinarian (as in the Background above).
  Scenario: An administrator can accept a request assigned to a different veterinarian
    Given Checkout will report the booking fee as paid with payment "pay-2"
    And Jordan has a Requested reservation for Luna with Dr Morgan Reed on "2026-10-12" at "11:00"
    When the administrator accepts Luna's reservation
    Then Luna's reservation is "Accepted"
    And Reservation asks Checkout to collect "$20.00" for Luna's reservation

  Scenario: An administrator can deny a request assigned to a different veterinarian
    Given Jordan has a Requested reservation for Luna with Dr Morgan Reed on "2026-10-12" at "11:00"
    When the administrator denies Luna's reservation
    Then Luna's reservation is "Denied"
    And Checkout is not asked to collect a booking fee
