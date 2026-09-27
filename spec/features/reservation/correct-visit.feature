@service:reservation
Feature: Correct completed clinical records
  Only the assigned veterinarian corrects clinical text after completion.
  Recorded services and finalized billing remain unchanged.

  Background:
    Given Jordan has an Accepted reservation for Milo with a recorded visit

  Scenario Outline: Correct text after either financial completion outcome
    Given the reservation is "<state>"
    When "Dr Avery Taylor" corrects the visit with {"clinicalNotes":"Corrected examination","diagnoses":["Revised diagnosis"],"medications":[],"followUpNotes":"Review in two weeks"}
    Then the clinical correction is persisted without changing other visit fields or reservation state
    Examples:
      | state                |
      | CompletedSettled     |
      | CompletedOutstanding |

  Scenario Outline: Other users cannot correct a completed visit
    Given the reservation is "CompletedSettled"
    When "<actor>" corrects the visit with {"clinicalNotes":"Unauthorized correction"}
    Then the clinical correction returns status 403 and preserves the visit
    Examples:
      | actor          |
      | Dr Morgan Reed |
      | Jordan         |

  Scenario: An incomplete visit cannot use the correction endpoint
    When "Dr Avery Taylor" corrects the visit with {"clinicalNotes":"Premature correction"}
    Then the clinical correction returns status 409 and preserves the visit

  Scenario Outline: Corrections cannot rewrite services, references, timestamps, or billing
    Given the reservation is "CompletedOutstanding"
    When "Dr Avery Taylor" corrects the visit with <patch>
    Then the clinical correction returns status 400 and preserves the visit
    Examples:
      | patch                                                         |
      | {}                                                            |
      | {"clinicalNotes":"   "}                                       |
      | {"performedServices":[]}                                      |
      | {"customerId":"ffffffff-ffff-4fff-8fff-ffffffffffff"}          |
      | {"endedAt":"2026-10-12T16:00:00Z"}                            |
      | {"balanceDue":0}                                              |
      | {"clinicalNotes":"Valid text","performedServices":[]}        |
