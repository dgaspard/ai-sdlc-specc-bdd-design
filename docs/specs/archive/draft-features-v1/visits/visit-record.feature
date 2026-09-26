Feature: Visit records link the participants and service
  The veterinarian's clinical record identifies who received care and what service was provided.

  Scenario: View the participants and service of a visit
    Given customer "Jordan Rivera" owns pet "Milo"
    And veterinarian "Dr Taylor" recorded a Wellness service for Milo
    When that visit is viewed
    Then it references customer "Jordan Rivera"
    And it references pet "Milo"
    And it references veterinarian "Dr Taylor"
    And it references the "Wellness" veterinary service

  Scenario: Cancellation preserves recorded clinical history
    Given Milo has a recorded visit with interactions, medicines, diagnoses, and follow-up
    And Milo has a separate accepted future reservation with a paid booking fee
    When that reservation is canceled before its start
    Then the reservation is "Canceled"
    And its veterinarian's slot becomes available
    And the recorded visit and its clinical details remain unchanged
    And the paid booking fee is not refunded
