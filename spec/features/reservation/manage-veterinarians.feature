@service:reservation
Feature: Administrator manages the veterinarian roster
  An administrator adds and deactivates veterinarians, lifting D-04's original
  cap of exactly two. "avery.taylor" holds both the veterinarian and
  administrator roles (D-40); "riley.chen" (D-52) holds only administrator,
  proving roster management needs no veterinarian identity at all.
  Decisions: D-39, D-40, D-42, D-43, D-52. Telemetry: OBS-046, OBS-047.

  Scenario: An administrator adds a veterinarian beyond the original two-vet cap
    Given "avery.taylor" is logged in
    And the clinic veterinarians are Dr Avery Taylor and Dr Morgan Reed
    When the administrator adds veterinarian "Casey Nguyen" with office "office-3"
    Then a new veterinarian "Casey Nguyen" is created with office "office-3"

  # MVP-02A (D-52): an administrator-only account, no veterinarian role at
  # all, can still fully manage the roster — this capability never depended
  # on also being a veterinarian.
  Scenario: An administrator-only account can add and deactivate veterinarians
    Given "riley.chen" is logged in
    And the clinic veterinarians are Dr Avery Taylor and Dr Morgan Reed
    When the administrator adds veterinarian "Casey Nguyen" with office "office-3"
    Then a new veterinarian "Casey Nguyen" is created with office "office-3"
    When the administrator deactivates Dr Morgan Reed
    Then Dr Morgan Reed is inactive
    And the new veterinarian is active
    And the clinic roster now has three veterinarians

  Scenario: A veterinarian without the administrator role cannot add a veterinarian
    Given "morgan.reed" is logged in
    When the veterinarian attempts to add veterinarian "Casey Nguyen" with office "office-3"
    Then the request is refused as "forbidden"
    And the clinic roster still has two veterinarians

  Scenario: A customer cannot add a veterinarian
    Given "jordan.rivera" is logged in
    When the customer attempts to add veterinarian "Casey Nguyen" with office "office-3"
    Then the request is refused as "forbidden"
    And the clinic roster still has two veterinarians

  Scenario Outline: Reject invalid new-veterinarian payloads
    Given "avery.taylor" is logged in
    When the administrator adds a veterinarian with <payload>
    Then the request is refused as "validation error"
    And the clinic roster still has two veterinarians
    Examples:
      | payload                                                                  |
      | {}                                                                       |
      | {"firstName":"Casey","lastName":"Nguyen"}                                |
      | {"firstName":"","lastName":"Nguyen","officeId":"office-3"}               |
      | {"firstName":"Casey","lastName":"Nguyen","officeId":""}                  |
      | {"firstName":"Casey","lastName":"Nguyen","officeId":"office-3","active":false} |
      | {"firstName":"Casey","lastName":"Nguyen","officeId":"office-3","id":"10000000-0000-4000-8000-000000000499"} |

  Scenario: An administrator deactivates a veterinarian
    Given "avery.taylor" is logged in
    And the clinic veterinarians are Dr Avery Taylor and Dr Morgan Reed
    When the administrator deactivates Dr Morgan Reed
    Then Dr Morgan Reed is inactive
    And Dr Avery Taylor is still active

  Scenario: Deactivation has no cascading effect on an existing Accepted reservation
    Given "avery.taylor" is logged in
    And the clinic veterinarians are Dr Avery Taylor and Dr Morgan Reed
    And Jordan has an Accepted reservation for Milo with Dr Morgan Reed on "2026-10-12" at "09:00"
    When the administrator deactivates Dr Morgan Reed
    Then Jordan's reservation for Milo is still "Accepted"
    And the slot "2026-10-12 09:00" is still recorded as taken for Dr Morgan Reed

  Scenario: An administrator reactivates a deactivated veterinarian
    Given "avery.taylor" is logged in
    And Dr Morgan Reed is deactivated
    When the administrator reactivates Dr Morgan Reed
    Then Dr Morgan Reed is active

  Scenario: A veterinarian without the administrator role cannot deactivate another veterinarian
    Given "morgan.reed" is logged in
    When the veterinarian attempts to deactivate Dr Avery Taylor
    Then the request is refused as "forbidden"
    And Dr Avery Taylor is still active

  Scenario: A customer cannot deactivate a veterinarian
    Given "jordan.rivera" is logged in
    When the customer attempts to deactivate Dr Morgan Reed
    Then the request is refused as "forbidden"
    And Dr Morgan Reed is still active

  Scenario: Deactivating an unknown veterinarian is rejected
    Given "avery.taylor" is logged in
    When the administrator attempts to deactivate an unknown veterinarian
    Then the request is refused as "not found"

  Scenario: Listing veterinarians includes inactive ones with their status
    Given "avery.taylor" is logged in
    And Dr Morgan Reed is deactivated
    When the administrator lists the clinic's veterinarians
    Then the list includes Dr Morgan Reed marked inactive
    And the list includes Dr Avery Taylor marked active
