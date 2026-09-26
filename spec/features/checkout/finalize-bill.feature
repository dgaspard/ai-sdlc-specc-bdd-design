@service:checkout
Feature: Finalize the visit bill
  After a visit is recorded, the veterinarian who performed it finalizes the bill.
  Checkout prices the performed services using VeterinarianServices, credits the
  booking fee once, and records the charge on the customer's account.
  Decisions: D-02, D-07, D-36, D-37, Q-05, SCH-011. Schema: CheckoutCreate, BilledLine. Telemetry: OBS-028, OBS-029.

  Background:
    Given Jordan's reservation for Milo has booking payment "pay-1" of "$20.00"
    And VeterinarianServices prices "Wellness" at "$50.00" and "Vaccination" at "$100.00"
    And Milo's visit was performed by Dr Avery Taylor

  Scenario: Finalize a single-service bill
    Given Milo's visit performed "Wellness"
    When Dr Avery Taylor finalizes the bill for Milo's visit
    Then Checkout asks VeterinarianServices for the fee of "Wellness"
    And a checkout is saved with one billed line "Wellness" at "$50.00"
    And the total is "$70.00", previously paid is "$20.00", and remaining is "$50.00"
    And Checkout sends Customer a charge of "$70.00" for Milo's visit
    And Checkout sends Customer a credit of "$20.00" from payment "pay-1" for Milo's visit

  Scenario: Finalize a multi-service bill
    Given Milo's visit performed "Wellness" and "Vaccination"
    When Dr Avery Taylor finalizes the bill for Milo's visit
    Then the checkout has billed lines "Wellness" at "$50.00" and "Vaccination" at "$100.00"
    And the total is "$170.00", previously paid is "$20.00", and remaining is "$150.00"

  Scenario: Only performed services are billed
    Given Milo's reservation requested "Surgery"
    And Milo's visit performed only "Wellness"
    When Dr Avery Taylor finalizes the bill for Milo's visit
    Then the checkout has one billed line "Wellness"

  Scenario: Billed prices are frozen when finalized
    Given Milo's visit performed "Wellness"
    And the bill for Milo's visit has been finalized
    When VeterinarianServices later prices "Wellness" at "$60.00"
    Then the checkout still bills "Wellness" at "$50.00"

  Scenario: A visit has only one checkout
    Given the bill for Milo's visit has been finalized
    When Dr Avery Taylor finalizes the bill for Milo's visit again
    Then the request is reported as already finalized
    And Customer receives no additional charge

  Scenario: Unknown performed service
    Given VeterinarianServices reports a performed service as unknown
    When Dr Avery Taylor finalizes the bill for Milo's visit
    Then the bill is refused as "unknown service"
    And no checkout is saved
    And Customer receives no charge

  Scenario: Only the veterinarian who performed the visit can finalize the bill
    Given Milo's visit performed "Wellness"
    When Dr Morgan Reed finalizes the bill for Milo's visit
    Then the bill is refused as "not assigned veterinarian"
    And no checkout is saved
