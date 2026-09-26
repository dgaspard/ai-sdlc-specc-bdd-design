@service:reservation
Feature: Request a reservation
  A customer requests a one-hour appointment for one pet with one veterinarian.
  Reservation checks ownership and eligibility with the Customer service.
  Decisions: D-03, D-17, D-18, D-20, D-22, D-25, D-27, D-33. Telemetry: OBS-023.

  Background:
    Given the clinic clock reads "2026-10-05 09:00" Central Time
    And the clinic veterinarians are Dr Avery Taylor and Dr Morgan Reed
    And the Customer service reports that "Jordan Rivera" owns "Milo"

  Scenario: An eligible customer requests an appointment
    Given the Customer service reports Jordan is eligible
    When Jordan requests a "Wellness" appointment for Milo with Dr Avery Taylor on "2026-10-12" at "09:00"
    Then the reservation is saved as "Requested"
    And it is scheduled from "2026-10-12T09:00:00-05:00" to "2026-10-12T10:00:00-05:00"
    And the booking fee amount is "$20.00" and is not paid
    And the request time is recorded
    And no slot is taken

  Scenario: The customer may request a veterinarian other than their preferred one
    Given Jordan prefers Dr Avery Taylor
    And the Customer service reports Jordan is eligible
    When Jordan requests an appointment for Milo with Dr Morgan Reed on "2026-10-12" at "09:00"
    Then the reservation is saved as "Requested" with Dr Morgan Reed

  Scenario Outline: An outstanding balance denies the request with the balance amount
    Given the Customer service reports Jordan is ineligible with an outstanding balance of "<balance>"
    When Jordan requests an appointment for Milo with Dr Avery Taylor on "2026-10-12" at "09:00"
    Then the reservation is saved as "Denied"
    And the denial reason is exactly "<message>"
    And the veterinarian's decision is not required
    Examples:
      | balance   | message                                      |
      | $50.00    | Please pay your full balance of $50.00       |
      | $1,234.50 | Please pay your full balance of $1,234.50    |
      | $0.05     | Please pay your full balance of $0.05        |

  Scenario Outline: Requests outside the calendar are rejected and not saved
    Given the Customer service reports Jordan is eligible
    When Jordan requests an appointment for Milo with Dr Avery Taylor starting "<start>" Central Time
    Then the request is rejected as "<reason>"
    And no reservation is saved
    Examples:
      | start            | reason       |
      | 2026-10-10 09:00 | invalid slot |
      | 2026-10-11 09:00 | invalid slot |
      | 2026-10-12 07:00 | invalid slot |
      | 2026-10-12 12:00 | invalid slot |
      | 2026-10-12 17:00 | invalid slot |
      | 2026-10-12 08:30 | invalid slot |
      | 2026-10-05 08:00 | past start   |
      | 2026-10-02 09:00 | past start   |

  Scenario: The end time must be one hour after the start
    Given the Customer service reports Jordan is eligible
    When Jordan requests an appointment for Milo from "2026-10-12 09:00" to "2026-10-12 11:00"
    Then the request is rejected as "invalid slot"
    And no reservation is saved

  Scenario: A pet cannot be booked with both veterinarians at the same time
    Given the Customer service reports Jordan is eligible
    And Milo has an Accepted reservation with Dr Avery Taylor on "2026-10-12" at "09:00"
    When Jordan requests an appointment for Milo with Dr Morgan Reed on "2026-10-12" at "09:00"
    Then the request is rejected as "pet conflict"
    And no reservation is saved

  Scenario: A pet's pending request does not block another request
    Given the Customer service reports Jordan is eligible
    And Milo has a Requested reservation with Dr Avery Taylor on "2026-10-12" at "09:00"
    When Jordan requests an appointment for Milo with Dr Morgan Reed on "2026-10-12" at "09:00"
    Then the reservation is saved as "Requested"

  Scenario: A customer cannot book a pet they do not own
    Given the Customer service reports that Jordan does not own "Rex"
    When Jordan requests an appointment for Rex with Dr Avery Taylor on "2026-10-12" at "09:00"
    Then the request is rejected as "not found"
    And no reservation is saved

  Scenario: At least one service must be requested, each only once
    Given the Customer service reports Jordan is eligible
    When Jordan requests an appointment for Milo with no services
    Then the request is rejected as invalid
    When Jordan requests an appointment for Milo with "Wellness" listed twice
    Then the request is rejected as invalid
