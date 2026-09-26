@service:reservation
Feature: Calendar availability
  One-hour weekday slots per veterinarian in Central Time, excluding lunch.
  Only Accepted reservations consume capacity.
  Decisions: D-03, D-04, D-05. Domain: Calendar.

  Background:
    Given the clinic clock reads "2026-10-05 09:00" Central Time
    And the clinic veterinarians are Dr Avery Taylor and Dr Morgan Reed

  Scenario: An unbooked veterinarian offers eight slots on a weekday
    When Dr Avery Taylor's availability for Monday "2026-10-12" is viewed
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

  Scenario Outline: No slots on weekends
    When Dr Avery Taylor's availability for "<date>" is viewed
    Then no start times are available
    Examples:
      | date       |
      | 2026-10-10 |
      | 2026-10-11 |

  Scenario: Slots follow Central daylight saving time
    When Dr Avery Taylor's availability for Monday "2026-11-02" is viewed
    Then the 08:00 slot starts at "2026-11-02T08:00:00-06:00"
    When Dr Avery Taylor's availability for Monday "2026-10-12" is viewed
    Then the 08:00 slot starts at "2026-10-12T08:00:00-05:00"

  Scenario: A Requested reservation does not take a slot
    Given a Requested reservation with Dr Avery Taylor on "2026-10-12" at "09:00"
    When Dr Avery Taylor's availability for "2026-10-12" is viewed
    Then "09:00" is available

  Scenario: An Accepted reservation takes the slot for that veterinarian only
    Given an Accepted reservation with Dr Avery Taylor on "2026-10-12" at "09:00"
    When availability for "2026-10-12" is viewed
    Then "09:00" is not available for Dr Avery Taylor
    And "09:00" is available for Dr Morgan Reed

  Scenario: Past slots are not offered
    Given the clinic clock reads "2026-10-12 10:30" Central Time
    When Dr Avery Taylor's availability for "2026-10-12" is viewed
    Then the first available start time is "11:00"
