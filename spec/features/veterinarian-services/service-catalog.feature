@service:veterinarian-services
Feature: Veterinary service catalog
  VeterinarianServices is the authority for service fees in USD.
  Decisions: D-07, fee catalog. Schema: VeterinarianServiceRead. Telemetry: OBS-028.

  Background:
    Given the clinic's veterinary service catalog is loaded

  Scenario: List the catalog
    When the catalog is listed
    Then it contains exactly these services with fees in USD:
      | service        | fee       |
      | Wellness       | $50.00    |
      | Sick           | $75.00    |
      | Vaccination    | $100.00   |
      | Spay or Neuter | $250.00   |
      | Surgery        | $2,000.00 |
    And each service has a stable service ID

  Scenario Outline: Look up one service fee
    When the fee for "<service>" is requested by its service ID
    Then the fee is <cents> cents in "USD"
    Examples:
      | service        | cents  |
      | Wellness       | 5000   |
      | Sick           | 7500   |
      | Vaccination    | 10000  |
      | Spay or Neuter | 25000  |
      | Surgery        | 200000 |

  Scenario: Look up several fees at once
    When fees for "Wellness" and "Vaccination" are requested together
    Then both fees are returned: "Wellness" 5000 cents and "Vaccination" 10000 cents

  Scenario: Unknown service ID
    When fees for "Wellness" and an unknown service ID are requested together
    Then the lookup is refused as "unknown service"
    And the unknown service ID is identified

  Scenario: Service IDs are stable
    When the catalog is listed twice
    Then each service has the same ID both times
