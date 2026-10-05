@service:reservation
Feature: A veterinarian fills in for a reservation or an unfinished visit
  Whoever the reservation was originally booked with is the default
  attributed veterinarian. Another veterinarian may claim it for themselves
  — self-claim only, never assigning it to someone else, and never
  performable by an administrator acting alone, dual-role or admin-only.
  Reassignment stays possible any time no clinical notes exist yet,
  including after a visit was closed without them (emergencies, appointment
  overruns, delayed paperwork, D-46) — not just before recording.
  Decisions: D-45, D-48, D-49, D-51, D-52. Telemetry: OBS-048.

  Background:
    Given the clinic veterinarians are Dr Avery Taylor and Dr Morgan Reed
    And Jordan has an Accepted reservation for Milo with Dr Avery Taylor on "2026-10-12" at "09:00" requesting "Wellness"

  Scenario: Another veterinarian fills in before the visit is recorded
    When Dr Morgan Reed reassigns Milo's reservation to themselves
    Then Milo's reservation is assigned to Dr Morgan Reed
    And the reservation remains "Accepted"

  Scenario: A veterinarian cannot reassign a reservation to someone else
    When Dr Morgan Reed attempts to reassign Milo's reservation to Dr Avery Taylor
    Then the reassignment is refused as invalid
    And Milo's reservation is still assigned to Dr Avery Taylor

  Scenario: A customer cannot reassign a reservation
    Given "jordan.rivera" is logged in
    When the customer attempts to reassign Milo's reservation to Dr Morgan Reed
    Then the request is refused as "forbidden"
    And Milo's reservation is still assigned to Dr Avery Taylor

  # MVP-02A (D-52): Riley Chen holds only the administrator role — no
  # veterinarian identity at all — distinct from the dual-role owner below.
  Scenario: An administrator-only account cannot reassign a reservation
    Given "riley.chen" is logged in
    When the administrator attempts to reassign Milo's reservation to Dr Morgan Reed
    Then the request is refused as "forbidden"
    And Milo's reservation is still assigned to Dr Avery Taylor

  Scenario: The dual-role owner can only reassign through her veterinarian identity, to herself
    Given Jordan has another Accepted reservation for Luna with Dr Morgan Reed on "2026-10-12" at "11:00" requesting "Wellness"
    When Dr Avery Taylor reassigns Luna's reservation to themselves
    Then Luna's reservation is assigned to Dr Avery Taylor

  # MVP-02A (D-48, revised): the real-world case — an emergency, an
  # overrunning prior appointment, or paperwork that didn't happen on time.
  # The visit was already closed (D-46 made that possible), but since no
  # notes exist yet, a different veterinarian can still step in.
  Scenario: A veterinarian can fill in after the visit was closed, as long as no notes were written yet
    Given Dr Avery Taylor has closed Milo's visit without clinical notes
    When Dr Morgan Reed reassigns Milo's reservation to themselves
    Then the visit's veterinarian is now Dr Morgan Reed
    And the visit is still flagged as missing clinical notes

  # MVP-02A (D-51): once notes exist, the lock is permanent — no matter the
  # reservation's financial state.
  Scenario: Once notes are written, no other veterinarian can claim the visit
    Given Dr Avery Taylor has closed Milo's visit with clinical notes "Healthy, weight stable"
    When Dr Morgan Reed attempts to reassign Milo's reservation to themselves
    Then the reassignment is refused as "invalid state"
    And the visit's veterinarian is still Dr Avery Taylor

  Scenario: Reassignment is only for reservations with a visit to claim
    Given Jordan has a Requested reservation for Luna with Dr Avery Taylor on "2026-10-12" at "11:00"
    When Dr Morgan Reed attempts to reassign Luna's reservation to themselves
    Then the reassignment is refused as "invalid state"

  Scenario: An unknown reservation cannot be reassigned
    When Dr Morgan Reed attempts to reassign an unknown reservation to themselves
    Then the reassignment is refused as "not found"
