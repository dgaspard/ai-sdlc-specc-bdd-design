Feature: Schedule veterinary visits
  Pet owners need clear, reliable appointment scheduling so their pets can receive care.

  Background:
    Given the PetClinic is open

  Scenario: View the clinic's patients
    Then I should see the patient "Leo"
    And I should see the patient "Rosy"

  Scenario: Schedule a visit for a pet
    When I schedule a visit for "Leo" on "2026-10-10" for "Annual checkup"
    Then I should see "Visit scheduled successfully"
    And "Leo" should have 1 scheduled visit

  Scenario: Prevent two visits for the same pet on the same date
    Given "Leo" has a visit on "2026-10-10" for "Annual checkup"
    When I schedule a visit for "Leo" on "2026-10-10" for "Follow-up"
    Then I should see "A visit is already scheduled for this date"
    And "Leo" should have 1 scheduled visit

  Scenario: Cancel a scheduled visit
    Given "Leo" has a visit on "2026-10-10" for "Annual checkup"
    When I cancel the visit for "Leo" on "2026-10-10"
    Then I should see "Visit cancelled successfully"
    And "Leo" should have 0 scheduled visits
