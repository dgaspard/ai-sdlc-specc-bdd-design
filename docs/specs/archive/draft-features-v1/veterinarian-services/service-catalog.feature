Feature: Authoritative veterinary service fees
  Checkout uses the service catalog's USD fees and accounts for the booking fee already paid.

  Scenario Outline: Read a service fee
    Given the clinic's current veterinary service catalog
    When the fee for "<service>" is requested
    Then its service fee is "<fee>" USD
    Examples:
      | service        | fee     |
      | Wellness       | 50.00   |
      | Sick           | 75.00   |
      | Vaccination    | 100.00  |
      | Spay or Neuter | 250.00  |
      | Surgery        | 2000.00 |

  Scenario: Account for the previously paid booking fee
    Given a Wellness reservation with the "20.00" USD booking fee already paid
    And the visit performed only the Wellness service
    When the remaining visit amount is calculated
    Then the total booking and service cost is "70.00" USD
    And the remaining amount is "50.00" USD
