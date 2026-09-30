# PERF-01 specification and baseline handoff

The user approved the local-demo defaults: five workers, short warm-up, ten seconds
of measured traffic, per-operation p95 below 200 ms, zero unexpected errors, and
financial correctness. Total runtime target is roughly 20–30 seconds. The same
frozen thresholds apply to JavaScript and Python on the same host.

Protected drafts: `spec/features/performance/local-demo.feature` and
`spec/tests/performance/`. The performance feature IDs map to the Node HTTP tests;
service Cucumber profiles remain unchanged. The command is
`npm --prefix spec run test:performance`, also included in the aggregate.

Five workers are paced at one iteration per 500 ms, each sequentially requesting,
accepting, finalizing, and paying. Historical visits are prepared via public APIs;
future appointments use separate unique slots. The shared clinic clock changes
only during preparation, then remains fixed. This avoids invalid simultaneous
booking/visit clocks and customer debt blocking later requests. The test imports
protected harness helpers, not application modules or private stores.

Initial baseline: all four performance tests passed in 17.37 seconds. Live workload
including preparation/cleanup: 16.05 seconds; 100 measured samples per operation.

| Operation | p95 | Maximum |
| --- | ---: | ---: |
| Request appointment | 16.9 ms | 20.9 ms |
| Accept appointment | 16.0 ms | 18.3 ms |
| Finalize bill | 9.5 ms | 11.9 ms |
| Pay visit | 6.5 ms | 8.1 ms |

Deliberate-fault evidence: a temporary HTTP server adds 250 ms before responding;
the unchanged latency gate rejects its measured p95. A one-cent remaining balance
on an allegedly settled bill fails the financial assertion. Empty samples are
rejected; nearest-rank p95 is checked with a known distribution. No production
service code was altered or delayed. This distinguishes gate rehearsal from an
application fault-injection experiment. Existing JavaScript already satisfies the
new requirement; no artificial application failure or optimization was invented.

Raw measurements and host metadata: `test-results/performance/latest.json`.
Full aggregate draft log: `test-results/performance/aggregate-draft.log`; all
suites except the (expected) guard passed before freeze.

Freeze (2026-09-28): the human reviewed the workload, assertions, and baseline,
kept the 200 ms budget, and ran `guard:freeze` and `guard:check`. `npm test` then
passed all ten suites, including the guard and local performance. The agent did
not freeze. Checkpoint: tag `perf-01`.

Purpose: PERF-01 is the project's representative performance test, one example of
each major enterprise test type, intended for later expansion and experiments.
Results demonstrate the agreed small local load, not maximum capacity, production
service levels, or cross-machine equality.

Next: DEMO-03 reruns this unchanged check against the Python Checkout rebuild.
