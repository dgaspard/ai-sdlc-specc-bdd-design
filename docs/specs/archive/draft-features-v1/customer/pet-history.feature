Feature: Pet ownership and visit history
  A pet's history contains its own visits while the customer can view all their pets' visits.

  Scenario: View pet details and owner
    Given pet "Milo" is a cat of breed "Siamese" with estimated birth date "2022-05-01"
    And Milo belongs to customer "Jordan Rivera"
    When Milo's profile is viewed
    Then the pet name is "Milo"
    And the type is "cat" and breed is "Siamese"
    And the estimated birth date is "2022-05-01"
    And the owner references Jordan's customer profile

  Scenario: Pet history excludes another pet's visits
    Given Jordan owns the pets "Milo" and "Luna"
    And visit "milo-wellness" records a Wellness service for Milo
    And visit "luna-vaccination" records a Vaccination for Luna
    When Milo's visit history is viewed
    Then it contains visit "milo-wellness"
    And it does not contain visit "luna-vaccination"

  Scenario: Customer visit history aggregates all their pets
    Given Jordan owns the pets "Milo" and "Luna"
    And visit "milo-wellness" records a Wellness service for Milo
    And visit "luna-vaccination" records a Vaccination for Luna
    And another customer's pet has visit "other-wellness"
    When Jordan's visit collection is viewed
    Then it contains visit "milo-wellness" exactly once
    And it contains visit "luna-vaccination" exactly once
    And it does not contain visit "other-wellness"
