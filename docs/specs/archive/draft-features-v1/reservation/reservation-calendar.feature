Feature: Reservation calendar and veterinarian capacity
  Customers reserve one-hour appointments with one of the clinic's two veterinarians.

  Scenario: Offer weekday slots outside lunch
    Given the clinic calendar uses America/Chicago time
    When availability for Monday "2026-10-12" is viewed for an unbooked veterinarian
    Then the available start times are:
      | start |
      | 08:00 |
      | 09:00 |
      | 10:00 |
      | 11:00 |
      | 13:00 |
      | 14:00 |
      | 15:00 |
      | 16:00 |
    And each slot lasts one hour

  Scenario Outline: Reject an appointment outside the calendar
    Given an eligible customer and an otherwise available veterinarian
    When an appointment starting at "<start>" Central Time is requested
    Then the appointment cannot be accepted
    Examples:
      | start            |
      | 2026-10-12 07:00 |
      | 2026-10-12 12:00 |
      | 2026-10-12 17:00 |
      | 2026-10-12 08:30 |
      | 2026-10-10 09:00 |
      | 2026-10-11 09:00 |

  Scenario: Requested reservations do not consume capacity
    Given a Requested reservation for Dr Taylor on "2026-10-12" at "09:00" Central Time
    And no Accepted reservation occupies that veterinarian's slot
    When the calendar is viewed
    Then that slot remains available for acceptance

  Scenario: Prevent double-booking of one veterinarian
    Given an Accepted reservation for Dr Taylor on "2026-10-12" at "09:00" Central Time
    When another reservation is considered for acceptance for Dr Taylor in that slot
    Then the second reservation is Denied
    And the original reservation remains Accepted

  Scenario: Different veterinarians can work at the same time
    Given an Accepted reservation for Dr Taylor on "2026-10-12" at "09:00" Central Time
    And Dr Morgan is available in the same slot
    When a different eligible customer's reservation for Dr Morgan is accepted with its booking fee paid
    Then both reservations are Accepted
    And each reservation has exactly one assigned veterinarian

  Scenario: Concurrent acceptance cannot double-book a veterinarian
    Given two Requested reservations compete for one available veterinarian and slot
    When their acceptance attempts run concurrently
    Then exactly one reservation is Accepted
    And the other reservation is Denied

  Scenario: Cancellation releases capacity and retains the booking payment
    Given an Accepted future reservation with its "20.00" USD booking fee paid
    When the customer cancels before its start
    Then the reservation is Canceled
    And its assigned veterinarian's slot becomes available
    And the booking fee remains paid and is not refunded
    And existing clinical visit records remain unchanged
