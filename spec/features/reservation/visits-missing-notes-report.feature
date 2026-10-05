@service:reservation
Feature: Report — completed visits missing clinical notes
  The clinic's first report. Lists every completed visit whose veterinarian
  closed it without writing clinical notes (D-46), so someone can follow up.
  This is an oversight list: a veterinarian sees every such visit, not only
  their own — there is no assigned-veterinarian restriction on reading it.
  Decisions: D-46, D-50. Schema: VisitRead.

  Background:
    Given the clinic veterinarians are Dr Avery Taylor and Dr Morgan Reed

  Scenario: A completed visit closed without notes appears on the report
    Given Jordan has a completed visit for Milo with Dr Avery Taylor closed without clinical notes
    When "avery.taylor" is logged in
    And the administrator requests the visits-missing-notes report
    Then the report includes Milo's visit

  Scenario: A completed visit closed with notes does not appear on the report
    Given Jordan has a completed visit for Milo with Dr Avery Taylor closed with clinical notes "Healthy, weight stable"
    When "avery.taylor" is logged in
    And the administrator requests the visits-missing-notes report
    Then the report does not include Milo's visit

  Scenario: A veterinarian sees every missing-notes visit, not only their own
    Given Jordan has a completed visit for Milo with Dr Morgan Reed closed without clinical notes
    When "avery.taylor" is logged in
    And the administrator requests the visits-missing-notes report
    Then the report includes Milo's visit

  Scenario: A customer cannot request the report
    Given "jordan.rivera" is logged in
    When the customer attempts to request the visits-missing-notes report
    Then the request is refused as "forbidden"

  Scenario: An empty clinic produces an empty report
    When "avery.taylor" is logged in
    And the administrator requests the visits-missing-notes report
    Then the report is empty
