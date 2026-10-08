@service:reservation
Feature: Retired reservation behavior
  Behavior that shipped in an earlier version and was deliberately removed. Each
  scenario proves the removed behavior does not exist. Do not implement it, even if
  it appears in tag 1.0, docs/history, or another earlier version.
  SPEC-07: only features that once shipped are listed here.

  Background:
    Given the clinic clock reads "2026-10-05 09:00" Central Time
    And Jordan has an Accepted reservation for Milo with Dr Avery Taylor on "2026-10-12" at "09:00" with the booking fee paid

  # Tag 1.0 shipped DELETE /api/pets/{petId}/visits/{visitId} (cancelVisit). D-24
  # replaced the legacy app; cancellation is now POST /reservations/{reservationId}/cancel.
  @retired @decision:D-24
  Scenario: The legacy visit-cancellation endpoint no longer exists
    When Jordan calls the retired endpoint "DELETE /api/pets/{petId}/visits/{visitId}" for that reservation
    Then the response is 404
    And the reservation is "Accepted"
