@service:reservation
Feature: Record a visit
  The assigned veterinarian documents the visit for an Accepted reservation once it starts.
  Reservation stores clinical visit records.
  Decisions: D-02, D-31, Q-04. Schema: VisitCreate, VisitRead. Telemetry: OBS-027.

  Background:
    Given the clinic veterinarians are Dr Avery Taylor and Dr Morgan Reed
    And Jordan has an Accepted reservation for Milo with Dr Avery Taylor on "2026-10-12" at "09:00" requesting "Wellness"
    And the clinic clock reads "2026-10-12 09:05" Central Time

  Scenario: Record a visit at the appointment
    When Dr Avery Taylor records a visit with performed service "Wellness" and clinical notes "Healthy, weight stable"
    Then the visit is saved with a new visit ID
    And it references the reservation, Jordan, Milo, and Dr Avery Taylor
    And the reservation references the visit
    And the reservation remains "Accepted"

  Scenario: Performed services can differ from requested services
    When Dr Avery Taylor records a visit with performed services "Wellness" and "Vaccination"
    Then the visit's performed services are "Wellness" and "Vaccination"
    And the reservation's requested services are still "Wellness"

  Scenario: Diagnoses, medications, and follow-up are optional
    When Dr Avery Taylor records a visit with clinical notes but no diagnoses, medications, or follow-up
    Then the visit is saved with empty diagnoses and medications

  Scenario: A visit cannot be recorded before the appointment starts
    Given the clinic clock reads "2026-10-12 08:59" Central Time
    When Dr Avery Taylor records a visit
    Then the visit is refused as "invalid state"
    And no visit is saved

  Scenario: Only the assigned veterinarian can record the visit
    When Dr Morgan Reed records a visit
    Then the visit is refused as "not assigned veterinarian"

  Scenario: One visit per reservation
    Given Dr Avery Taylor has recorded a visit for the reservation
    When Dr Avery Taylor records another visit for the reservation
    Then the visit is refused as "already recorded"

  Scenario: An unknown performed service cannot be recorded
    When Dr Avery Taylor records a visit with an unknown performed service
    Then the visit is refused as "unknown service"
    And no visit is saved

  Scenario Outline: Visits are recorded only for Accepted reservations
    Given the reservation is "<state>"
    When Dr Avery Taylor records a visit
    Then the visit is refused as "invalid state"
    Examples:
      | state     |
      | Requested |
      | Denied    |
      | Canceled  |

  Scenario Outline: Invalid visit content
    When Dr Avery Taylor records a visit with <problem>
    Then the visit is refused as invalid
    Examples:
      | problem                       |
      | no performed services         |
      | "Wellness" performed twice    |
      | blank clinical notes          |

  Scenario: A pet's history contains only that pet's visits
    Given Milo has recorded visit "milo-wellness"
    And Jordan's other pet Luna has recorded visit "luna-vaccination"
    When Milo's visit history is requested
    Then it contains "milo-wellness"
    And it does not contain "luna-vaccination"

  Scenario: A customer's history contains each of their pets' visits once
    Given Milo has recorded visit "milo-wellness"
    And Jordan's other pet Luna has recorded visit "luna-vaccination"
    And another customer's pet has recorded visit "other-wellness"
    When Jordan's visit history is requested
    Then it contains "milo-wellness" and "luna-vaccination" exactly once each
    And it does not contain "other-wellness"
