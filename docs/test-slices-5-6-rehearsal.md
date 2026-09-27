# TEST-01 slices 5–6: green and mutation rehearsal

Completed 2026-09-27 against commit `730a272` and the protected manifest already
present in the working tree. This is validation of the executable specifications,
not an application implementation milestone.

## Result

- All **310 checks passed**: 218 access-control checks and 92 business telemetry /
  cross-process workflow checks. No skipped, canceled, or todo tests.
- **13 isolated implementation defects were detected** by unchanged tests.
- Restoring the original temporary implementation made all **10 distinct mutation
  target tests pass again**. Multiple defects targeted the same test.
- No protected file was edited. The pre-existing uncommitted change to
  `spec/protected.sha256` was preserved byte-for-byte; `guard:check` passes.
- Temporary service launchers were removed. All four service folders again contain
  only their original README files. No frontend was created.

## Method and scope

Four separate Node.js HTTP processes used independent in-memory state. They
implemented the API behavior needed by the selected suites: authentication and
ownership, booking and clinical records, fees, account changes, finalization,
promotions, cash/card payments, and sequential/concurrent idempotency. State was
arranged through the published APIs. Dependency calls carried service tokens.

Per-service tests used the existing contract-checked stubs; workflow tests ran all
four temporary services with the existing fake payment provider. Traces were
created with the installed official OpenTelemetry SDK and sent through a small
protobuf exporter to the existing collector. The exporter reused the protected
protobuf encoder read-only. No test assertions or expected-result helpers were
imported into application behavior. Temporary code and defect controls lived
outside the service folders, under `/tmp/petclinic-rehearsal`.

An initial smoke run exposed a temporary exporter bug: SDK span-kind values needed
conversion to OTLP's enum values. This was fixed in the temporary implementation
before the full baseline. No specification change was needed. The initial sandbox
run also lacked permission to bind local ports; reported verification used local
port access.

The full baseline command, from the repository root:

```sh
node --test --test-concurrency=1 \
  spec/tests/auth/access-control.test.js \
  spec/tests/observability/business-traces.test.js \
  spec/tests/observability/business-workflows.test.js
```

Result: 310 passed / 0 failed, approximately 275 seconds, Node v24.21.0.
Mutation runs selected existing tests with `--test-name-pattern`; no test source
was changed, weakened, focused, or skipped. Each defect was enabled independently.

## Deliberate defects and observed failures

| Defect | Existing check | Observed failure |
| --- | --- | --- |
| Accept an invalid JWT signature | AUTH-005, Customer getCustomer | 200 instead of 401 |
| Ignore endpoint role restrictions | AUTH-006, Customer createCustomer | 201 instead of 403 |
| Ignore individual-record ownership | AUTH-007, Customer getCustomer | 200 instead of 404 |
| Leak another customer's collection records | AUTH-007, Reservation listReservations | Nonempty list instead of `[]` |
| Omit outgoing `traceparent` | OBS-002, concurrent Reservation requests | No dependency call carried the initiating trace |
| Emit the wrong business outcome | OBS-023, requested | `failed` instead of `requested` |
| Mark an expected rejection successful | OBS-028, unknown_service | `OK` instead of `UNSET` |
| Emit duplicate operation spans | OBS-023, requested | Two operation spans instead of one |
| Parent a business span under a CLIENT span | OBS-023, requested | Parent is CLIENT instead of SERVER |
| Disable checkout replay lookup | OBS-038, concurrent declined retries | Second completion fails; retry returns 502 instead of 200 |
| Return a false replay flag | OBS-038, sequential authorized retries | `[false, false]` instead of `[false, true]` |
| Omit customer account credit | OBS-036, successful checkout | Required downstream account-change span does not arrive |
| Authorize again while returning the correct replay result | OBS-038, concurrent declined retries | Provider count is 3 instead of 2, including the original booking payment |

The last case separately proves that payment invocation counts catch duplicate
work even when both responses have the correct attempt and replay flags. The
disabled-replay case alone would only prove detection through the erroneous HTTP
result, because that assertion fails before the provider-count assertion.

## Restoration and final verification

The restored temporary source had the same SHA-256 as the full green baseline:
`8c6ea5dd6fdcec8c8daefd0239d389f6c3d82706480e3d33de99a447a281f252`.
All 10 distinct mutation targets then passed in approximately 12 seconds.

After removing the four temporary `start` scripts, `npm test` was run with local
port access:

| Suite | Result after temporary implementation removal |
| --- | --- |
| Protected guard | Pass |
| Harness | 45 passed |
| Schema contracts | 131 passed |
| Runtime | 12 passed / 40 failed |
| Authentication | 1 passed / 227 failed |
| Observability | 104 failed |
| Service BDD | 166 scenarios failed |

Application-dependent failures report missing service/frontend implementations.
The aggregate command exits 1, as expected for the restored specification-only
baseline. This rehearsal does not claim a green application or completion of the
broader runtime, browser, performance, privacy, or exporter-failure test portfolio.

## Evidence and next action

Local evidence is retained in `test-results/slices-5-6-2026-09-27/` (ignored by Git):
`baseline.log`, individual `mutation-*.log` files, `mutation-results.json`,
`restored-controls.log`, `final-npm-test.log`, manifest identity, and the temporary
baseline/mutation source snapshots. This report is the versioned handoff; local
logs are not implied to exist on another checkout.
These source snapshots must remain outside any future blind reconstruction
workspace, just like other retained implementation history.

Slices 5–6 no longer need their first green/mutation rehearsal. TEST-01 is complete
as a specification-phase task, checkpoint tag `test-01`. Continue with TEST-02
workflow features/browser tests.
Existing broader observability coverage gaps remain explicit; this bounded
rehearsal does not make those rules exhaustively verified.
