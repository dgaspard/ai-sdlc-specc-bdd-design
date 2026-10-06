@service:checkout
Feature: Apply a promotion
  The veterinarian may apply one final promotion to a visit to reduce what is still owed.
  The amount owed never goes below $0.
  Decisions: D-26, D-34, D-36, D-59, D-65. Schema: PromotionCreate, PromotionRead. Telemetry: OBS-030, OBS-040.

  Background:
    Given Milo's finalized Wellness checkout has a remaining balance of "$50.00"
    And the visit was performed by Dr Avery Taylor

  Scenario: A promotion reduces the remaining balance
    When Dr Avery Taylor applies a "$15.00" promotion
    Then the promotion is saved with amount "$15.00" and applied amount "$15.00"
    And the remaining balance is "$35.00"
    And Checkout sends Customer a discount of "$15.00" for Milo's visit
    And Reservation is not asked to complete the reservation

  Scenario: A promotion larger than the balance brings it to $0
    When Dr Avery Taylor applies an "$80.00" promotion
    Then the promotion is saved with amount "$80.00" and applied amount "$50.00"
    And the remaining balance is "$0.00"
    And Checkout sends Customer a discount of "$50.00" for Milo's visit
    And Checkout asks Reservation to complete the reservation as settled
    And the fake payment provider is not called

  Scenario: GAP-15 rejects a missing promotion amount
    When Dr Avery Taylor applies a promotion without entering an amount
    Then the promotion is refused as invalid
    And no promotion or discount is recorded
    And the remaining balance is "$50.00"

  Scenario: Only one promotion per visit
    Given Dr Avery Taylor has applied a "$1.00" promotion
    When Dr Avery Taylor applies a "$10.00" promotion
    Then the promotion is refused as "already applied"
    And the remaining balance is "$49.00"

  # ENG-02 REV-002: a failure recording the discount with Customer must not leave the
  # promotion attached locally -- otherwise a retry reads as "already applied" even though
  # Customer never recorded the discount, with no way to tell the two states apart.
  Scenario: A promotion that fails to record with Customer is not left applied
    Given Customer will fail to record the account credit
    When Dr Avery Taylor applies a "$15.00" promotion
    Then the remaining balance is "$50.00"
    Given Customer now records account changes normally
    When Dr Avery Taylor applies a "$15.00" promotion
    Then the promotion is saved with amount "$15.00" and applied amount "$15.00"

  Scenario: An applied promotion cannot be changed or removed
    Given Dr Avery Taylor has applied a "$15.00" promotion
    When an attempt is made to change the promotion to "$25.00"
    Then the change is refused
    When an attempt is made to remove the promotion
    Then the change is refused
    And the remaining balance is "$35.00"

  Scenario: A promotion after a declined payment can settle the visit
    Given a checkout payment for the visit was declined
    When Dr Avery Taylor applies a "$50.00" promotion
    Then the remaining balance is "$0.00"
    And Checkout asks Reservation to complete the reservation as settled

  Scenario: Nothing owed means no promotion
    Given the visit's remaining balance has been paid
    When Dr Avery Taylor applies a "$10.00" promotion
    Then the promotion is refused as "nothing owed"

  Scenario: A negative promotion is invalid
    When Dr Avery Taylor applies a "-$5.00" promotion
    Then the promotion is refused as invalid

  # GAP-08: this restriction was never previously covered by a scenario here,
  # even though finalize-bill.feature and record-visit.feature already test
  # the equivalent rule for their own operations. Making it explicit now
  # alongside the MVP-02A admin-bypass work below, not introducing a new rule.
  Scenario: Only the assigned veterinarian may apply a promotion
    When Dr Morgan Reed applies a "$15.00" promotion
    Then the promotion is refused as "not assigned veterinarian"
    And the remaining balance is "$50.00"

  # MVP-02A (D-41, D-44): "the administrator" is Dr Avery Taylor's account
  # acting on its administrator role. The Background assigns this visit to
  # Dr Avery Taylor, so this scenario reassigns it to Dr Morgan Reed first —
  # otherwise the administrator would already be the assigned veterinarian
  # and the scenario wouldn't exercise the actual bypass.
  # Resolved: PromotionRequest's schema exposes no veterinarian-attribution
  # field at all (the applying veterinarian "comes from the token" only for
  # the assigned-veterinarian check; nothing about who applied it is stored
  # or returned) — there is no attribution to decide either way.
  Scenario: An administrator may apply a promotion even when not the assigned veterinarian
    Given the visit was performed by Dr Morgan Reed instead
    When the administrator applies a "$15.00" promotion
    Then the promotion is saved with amount "$15.00" and applied amount "$15.00"
    And the remaining balance is "$35.00"

  Scenario: GAP-15 rejects a zero promotion without consuming the one promotion
    When Dr Avery Taylor applies a "$0.00" promotion
    Then the promotion is refused as invalid
    And no promotion or discount is recorded
    And the remaining balance is "$50.00"
    When Dr Avery Taylor applies a "$0.01" promotion
    Then the promotion is saved with amount "$0.01" and applied amount "$0.01"

  Scenario: GAP-09 promotion succeeds but completion fails
    Given Reservation will fail to complete the reservation
    When Dr Avery Taylor applies a "$50.00" promotion
    Then Checkout reports a "dependency_failed" problem with status 502
    And the remaining balance is "$0.00"
    And the stored promotion has amount "$50.00"
    And Checkout sends Customer a discount of "$50.00" for Milo's visit
    And Checkout asks Reservation to complete the reservation as settled
    And the fake payment provider is not called
