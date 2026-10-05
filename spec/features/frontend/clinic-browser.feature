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

  # MVP-02A (D-53, D-54): administrator-only account, no veterinarian identity.
  Scenario: FE-006 Administrator manages the veterinarian roster
    Given Riley is signed in as an administrator with no veterinarian identity
    Then Jordan and Morgan's sign-ins show no Veterinarians or Reports link
    When Riley opens Veterinarians and adds a new veterinarian
    Then the roster shows the new veterinarian as Active
    When Riley deactivates an existing veterinarian
    Then that row shows Inactive without a confirmation dialog
    When Riley reactivates that veterinarian
    Then that row shows Active again

  # MVP-02A (D-50, D-54).
  Scenario: FE-007 Administrator reads the visits-missing-notes report
    Given a visit for Milo was closed without clinical notes
    When Riley opens Reports
    Then that visit appears with Milo, Jordan, and its veterinarian
    When Jordan attempts to open the Reports route directly
    Then access is denied

  # MVP-02A (D-41, D-47, D-53, D-55): the dual-role owner acts as administrator
  # on a reservation she is not assigned to, and as an ordinary veterinarian on
  # her own, in the same signed-in session, with no view toggle.
  Scenario: FE-008 Administrator bypass actions require no separate login
    Given a requested appointment assigned to Morgan for Luna
    When Avery, signed in with her own dual role, accepts it on Morgan's behalf
    Then it becomes Accepted without Avery signing out
    When Avery records that visit with no clinical notes available to enter
    Then the visit is saved and flagged as missing clinical notes
    And Avery can still record her own assigned visit with clinical notes in the same session

  # MVP-02A (D-48, D-51, D-56 revised): the backend accepts only a caller's own
  # veterinarianId here; there is no "assign to someone else" capability for
  # any caller, administrator included.
  Scenario: FE-009 Reassigning an appointment's veterinarian
    Given an Accepted appointment assigned to Morgan with no clinical notes yet
    When Riley, administrator only, opens that appointment
    Then Riley sees no reassignment control at all
    When Avery reassigns it to herself
    Then it is now assigned to Avery
    When a visit is recorded with clinical notes for that appointment
    Then the reassignment control no longer appears for anyone
