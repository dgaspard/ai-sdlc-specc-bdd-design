@service:customer
Feature: Self-register with complete customer information
  Registration creates the customer account, complete profile and initial pets together.
  All profile information is collected now, without later setup flows.

  Scenario: Register and log in as a customer
    When a new customer self-registers with complete information
    Then the registered profile and initial pets match the submitted information
    And the new customer can log in and read only their own profile

  Scenario Outline: Registration requires every profile field
    When a new customer self-registers without "<field>"
    Then registration is rejected without saving the profile or login
    Examples:
      | field                            |
      | username                         |
      | password                         |
      | profile.firstName                |
      | profile.lastName                 |
      | profile.phoneNumber              |
      | profile.address                  |
      | profile.emergencyContact         |
      | profile.secondaryContact         |
      | profile.billing                  |
      | profile.billing.mockMethodReference |
      | profile.billing.billingAddress   |
      | profile.insurance                |
      | profile.preferredVeterinarianId  |
      | pets                             |

  Scenario Outline: Invalid relationships and privilege injection save nothing
    When a new customer self-registers with "<problem>"
    Then registration is rejected without saving the profile or login
    Examples:
      | problem                 |
      | no pets                 |
      | no insurance            |
      | unknown veterinarian    |
      | foreign insured pet     |
      | existing pet ID         |
      | repeated pet ID         |
      | seeded username         |
      | future pet birth date   |
      | veterinarian role       |
      | supplied customer ID    |
      | supplied pet owner      |

  Scenario: A duplicate username cannot create another customer or replace credentials
    Given a new customer has self-registered
    When the same username is registered again with a different password
    Then the duplicate registration is rejected and the original login still works
