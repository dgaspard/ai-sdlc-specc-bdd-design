@service:veterinarian-services
Feature: Update a veterinary service
  Either seeded veterinarian may update a catalog service's name and USD fee.
  Existing IDs and finalized historical prices remain unchanged (SPEC-05).

  Scenario: A veterinarian updates a service name and fee
    Given "avery.taylor" is logged in
    When the Wellness service is updated to name "Annual wellness" and fee 6500 cents
    Then the updated Wellness catalog record has name "Annual wellness" and fee 6500 cents

  Scenario: The other veterinarian may update the catalog
    Given "morgan.reed" is logged in
    When the Wellness service is updated to name "Annual wellness" and fee 6500 cents
    Then the updated Wellness catalog record has name "Annual wellness" and fee 6500 cents

  Scenario: Customers cannot update service prices
    Given "jordan.rivera" is logged in
    When the Wellness service is updated to name "Annual wellness" and fee 6500 cents
    Then the service is refused as "forbidden"
    And the Wellness catalog record retains its original name and fee

  Scenario Outline: Reject invalid service changes
    Given "avery.taylor" is logged in
    When the Wellness service is patched with <payload>
    Then the service is refused as "validation error"
    And the Wellness catalog record retains its original name and fee
    Examples:
      | payload                                                      |
      | {}                                                           |
      | {"feeAmount":-1}                                             |
      | {"feeAmount":12.5}                                           |
      | {"name":""}                                                  |
      | {"currency":"EUR"}                                           |
      | {"id":"10000000-0000-4000-8000-000000000499"}                  |

  Scenario: Unknown service update does not create a new catalog entry
    Given "avery.taylor" is logged in
    When an unknown service is patched with a new fee
    Then the service is refused as "not found"
    And the catalog still has its original service IDs
