Feature: Reconstructable clinic browser experience
  The desktop browser preserves the approved clinic identity and interactions.
  These scenarios map by FE ID to tests/browser/journeys.spec.js, not Cucumber steps.
  The actual services enforce business rules; only the payment provider is fake.

  Scenario: FE-001 Sign in and sign out
    Given the approved desktop login screen
    When a customer supplies incorrect credentials
    Then an accessible error explains that sign in failed
    When the customer signs in successfully and reloads
    Then their appointments remain available
    When they sign out and open a protected route
    Then sign in is required again

  Scenario: FE-002 Request, care, finalize, and pay
    Given Jordan has no outstanding debt
    When Jordan requests an available appointment for Milo with Avery and Wellness
    Then the appointment is Requested in the approved appointments layout
    When Avery accepts with an approved booking payment
    And records the visit after its start and finalizes the bill
    Then Jordan sees the approved bill layout with a 50 dollar balance
    When Jordan pays that balance
    Then the visit is CompletedSettled and customer debt is zero
    And exactly two provider requests exist for the booking fee and visit payment

  Scenario: FE-003 Decline and duplicate activation
    Given Jordan has a finalized unpaid visit
    When a payment is declined
    Then the balance remains unchanged
    When Jordan deliberately chooses an approved payment and activates twice rapidly
    Then one new payment intent settles the visit without duplicate collection

  Scenario: FE-004 Direct routes preserve ownership
    Given Jordan has a finalized unpaid visit
    When Sam opens its bill directly
    Then access is denied and payment is unavailable
    Given a fresh requested appointment assigned to Avery
    When Morgan opens its appointment and visit routes
    Then acceptance and visit recording are unavailable
    And no visit or provider request is created

  Scenario: FE-005 Retry after a lost payment response
    Given Jordan has a finalized unpaid visit
    When the provider authorizes payment but the browser loses the response
    Then the browser reports an uncertain outcome rather than paid in full
    When Jordan reloads and retries the same payment
    Then the original UUID and exact payload are reused
    And the settled outcome is displayed without another provider request
