@service:customer
Feature: Customer profile
  A customer (pet owner) keeps one profile with contact details and a chosen veterinarian.
  Decisions: D-13, D-17, D-21, Q-02. Schema: CustomerCreate, CustomerRead.

  Background:
    Given the clinic veterinarians are Dr Avery Taylor and Dr Morgan Reed

  Scenario: Create a customer profile with a chosen veterinarian
    When a customer profile is created for "Jordan Rivera" with Dr Avery Taylor as preferred veterinarian
    Then the profile is saved with a new customer ID
    And the first name is "Jordan" and the last name is "Rivera"
    And the preferred veterinarian is Dr Avery Taylor
    And the customer has no pets
    And the customer's outstanding balance is "$0.00"

  Scenario: A preferred veterinarian is required
    When a customer profile is created for "Jordan Rivera" without a preferred veterinarian
    Then the profile is rejected as invalid
    And no customer is saved

  Scenario: The preferred veterinarian must exist
    When a customer profile is created for "Jordan Rivera" with an unknown veterinarian ID
    Then the profile is rejected as invalid
    And no customer is saved

  Scenario Outline: Required profile fields
    When a customer profile is created without "<field>"
    Then the profile is rejected as invalid
    Examples:
      | field            |
      | firstName        |
      | lastName         |
      | phoneNumber      |
      | address          |
      | emergencyContact |

  Scenario: Insurance and secondary contact are optional
    When a customer profile is created with no insurance and no secondary contact
    Then the profile is saved
    And the insurance collection is empty

  Scenario: Addresses are US only
    When a customer profile is created with state "Illinois"
    Then the profile is rejected as invalid
    When a customer profile is created with state "IL" and postal code "60601-1234"
    Then the profile is saved

  Scenario: Change the preferred veterinarian
    Given customer "Jordan Rivera" prefers Dr Avery Taylor
    When Jordan's preferred veterinarian is changed to Dr Morgan Reed
    Then the preferred veterinarian is Dr Morgan Reed

  Scenario: The outstanding balance cannot be edited through the profile
    Given customer "Jordan Rivera" exists
    When a profile update includes an outstanding balance
    Then the update is rejected as invalid

  Scenario: Unknown customer
    When customer profile "10000000-0000-4000-8000-999999999999" is requested
    Then the customer is reported as not found
