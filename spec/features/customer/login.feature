@service:customer
Feature: Log in (demo security)
  Seeded users log in to the Customer service and receive a signed token that every
  service verifies locally. Demo-only security.
  Decisions: A-09, AUTH-01. Contract: spec/contracts/auth-contract.md.

  Scenario Outline: A seeded user logs in
    When "<username>" logs in with password "petclinic-demo"
    Then the login succeeds with role "<role>"
    And the token identifies "<linked>"
    And the response does not include the password
    Examples:
      | username      | role         | linked          |
      | avery.taylor  | veterinarian | Dr Avery Taylor |
      | morgan.reed   | veterinarian | Dr Morgan Reed  |
      | jordan.rivera | customer     | Jordan Rivera   |
      | sam.lee       | customer     | Sam Lee         |

  Scenario: Wrong password and unknown user look the same
    When "jordan.rivera" logs in with password "wrong-password"
    And "nobody" logs in with password "petclinic-demo"
    Then both logins are refused with the same response

  Scenario: The token lasts eight hours of clinic time
    Given the clinic clock reads "2026-10-05 09:00" Central Time
    When "jordan.rivera" logs in with password "petclinic-demo"
    Then the token expires at "2026-10-05 17:00" Central Time
