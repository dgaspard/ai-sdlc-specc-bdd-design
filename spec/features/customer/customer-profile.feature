@service:customer
Feature: Customer profile
  A customer (pet owner) keeps one profile with contact details and a chosen veterinarian.
  Decisions: D-13, D-17, D-21, Q-02, A-09. Schema: CustomerCreate, CustomerRead.

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

  # ENG-02 REV-004: proves Customer checks Reservation's live roster, not a frozen
  # seed-time copy that could never see a veterinarian added after startup.
  Scenario: A veterinarian added after startup can be chosen as preferred
    Given a veterinarian has since been added to the roster who was not in the original seed data
    When a customer profile is created for "Jordan Rivera" with the newly added veterinarian as preferred
    Then the profile is saved

  # ENG-02 REV-004: proves a deactivated veterinarian is no longer accepted, instead of
  # remaining valid forever against the old seed-time copy.
  Scenario: A deactivated veterinarian can no longer be chosen as preferred
    Given Dr Morgan Reed has since been deactivated
    When a customer profile is created for "Jordan Rivera" with the deactivated Dr Morgan Reed as preferred
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

  Scenario: A veterinarian can view any customer
    Given "avery.taylor" is logged in
    When customer profile "Sam Lee" is requested
    Then the profile is returned

  Scenario: A customer can view their own profile
    Given "jordan.rivera" is logged in
    When customer profile "Jordan Rivera" is requested
    Then the profile is returned

  Scenario: A customer cannot see another customer's profile
    Given "jordan.rivera" is logged in
    When customer profile "Sam Lee" is requested
    Then the customer is reported as not found

  Scenario: A request without a token is refused
    When customer profile "Jordan Rivera" is requested without logging in
    Then the request is refused as unauthenticated

  Scenario: Only veterinarians create customer profiles
    Given "jordan.rivera" is logged in
    When a customer profile is created for "Casey Park" with Dr Avery Taylor as preferred veterinarian
    Then the request is refused as forbidden
