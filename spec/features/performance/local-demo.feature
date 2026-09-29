Feature: A responsive local demonstration across implementation languages
  These PERF IDs map to tests/performance; they are outside the service Cucumber profile.

  Scenario: PERF-001 Key operations remain responsive under a small concurrent load
    Given the real services, payment fake, and telemetry collector are healthy
    And five independent customers have prepared visits and distinct future booking slots
    When five workers warm up for two seconds then generate traffic for ten seconds
    Then each worker requests and accepts appointments and finalizes and pays prepared visits
    And each operation has at least twenty measured samples
    And the nearest-rank p95 for each operation is below 200 milliseconds
    And no unexpected HTTP or schema error occurs

  Scenario: PERF-002 Speed preserves financial correctness
    When the measured workflows settle their prepared visits
    Then each finalized bill totals 7000 cents including its prepaid 2000 cent booking fee
    And one 5000 cent visit payment settles each bill
    And customer account entries reconcile with no duplicate credit
    And each settled reservation is CompletedSettled
    And the provider receives exactly one request for each payment intent
