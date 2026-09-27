# TEST-01 slices 5 and 6 review

Phase: specification. These tests add requirements checks, not service implementations.
Recent commits reviewed: `aba9d82` (Reservation steps), `a6f2cd2` (freeze), and
`1cfea69` (Checkout steps). Existing steps and features are unchanged.

## Slice 5: access control

[access-control.test.js](../spec/tests/auth/access-control.test.js) enumerates all
34 protected operations from the four OpenAPI documents and their `x-roles`.
It checks missing, malformed, bad-signature, unsigned (`alg: none`), and expired
tokens; every excluded known role; and ownership where applicable. Anonymous
login remains in the existing login suite. An operation allowing all three roles
has no wrong-role case; inventing an invalid JWT role would test authentication instead.

Ownership fixtures create real reservations, visits, and checkouts through public
APIs. A successful owner read proves the protected target exists before another
customer requests it. Mutation attempts also verify the original record is unchanged.
Lists must filter records by ownership; unlike individual records they return an
empty list, not 404. Catalog/calendar operations have no customer-owned record.
A classification assertion fails when a new customer-accessible operation is not
assigned an ownership, collection, or public-catalog test policy.

Shared support: [access-cases.js](../spec/tests/support/access-cases.js) and
[service-fixture.js](../spec/tests/support/service-fixture.js). Every request body
and documented response is schema checked. Dependencies are contract-checked stubs.

## Slice 6: telemetry

[business-traces.test.js](../spec/tests/observability/business-traces.test.js)
exercises a real service with dependency stubs and the real payment fake.
[business-workflows.test.js](../spec/tests/observability/business-workflows.test.js)
exercises all four real services for OBS-036–040, because stubs cannot prove
cross-process business spans. It adds no workflow feature files.

Each measured request supplies a fresh W3C context so setup traces cannot satisfy
the assertion. Checks include span names, outcomes, statuses, known entity IDs,
integer amounts/boolean replay flags, exactly one operation span, ended spans,
and the request SERVER parent. Payment authorization is a CLIENT span. Export
polling waits for required spans and their ancestry, not fixed generated IDs or durations.

OBS-002 inspects actual `traceparent` headers recorded by Customer, Checkout,
Reservation, and VeterinarianServices stubs, relates their parent IDs to exported
HTTP CLIENT spans, and checks service-token signatures and roles. Concurrent
reservation requests use different pets and trace IDs to detect context mixing.
Real-service evidence also checks customer balance, reservation state, slot
availability, and provider call counts. Retries cover success and decline,
sequentially and concurrently. Promotion checks entered versus applied amounts.

### Outcomes exercised

| Rule | Outcomes with runtime tests |
| --- | --- |
| OBS-023 | requested, denied_outstanding_balance, invalid_slot, past_start, pet_conflict, not_found |
| OBS-024 | accepted, booking_payment_declined, slot_unavailable, pet_conflict, not_assigned_veterinarian, invalid_state, not_found, failed |
| OBS-025 | denied, not_assigned_veterinarian, invalid_state, not_found |
| OBS-026 | canceled, already_started, invalid_state, not_found |
| OBS-027 | recorded, already_recorded, invalid_state, not_found |
| OBS-028 | found, unknown_service |
| OBS-029 | finalized, already_finalized, not_assigned_veterinarian, unknown_service, not_found, failed |
| OBS-030 | applied, already_applied, nothing_owed, not_found |
| OBS-031 | settled, declined, already_settled, idempotency_conflict, authorized_completion_failed, not_found, failed |
| OBS-032 | authorized, declined, failed; booking_fee and visit_balance |
| OBS-033 | recorded (booking_fee and visit_balance), not_found |
| OBS-034 | applied, already_applied for charge/credit/discount; invalid_amount for credit/discount; not_found |
| OBS-035 | completed_settled, completed_outstanding, already_completed, invalid_state, not_found |

`failed` is not exhaustively injectable through public APIs for every in-memory
operation. Covered injections are failed booking collection, disconnected fee
service, fake provider failure, and authorization followed by failed completion.
Internal storage faults need a deliberately specified fault boundary before tests
can drive them; do not add implementation-specific backdoors just for coverage.

## Contract gaps to settle before implementation

1. `updateCustomer`, `addPet`, and `getAvailability` exclude a role but omit 403
   from their operation responses. The tests use the binding shared authentication
   rule and validate the shared `Problem` schema for these three cases. Add the
   missing OpenAPI responses during a deliberate contract revision.
2. OBS-024 lacks `past_start`, although acceptance exposes that response. OBS-026
   lacks `not_assigned_veterinarian`, although cancellation exposes it. OBS-031
   lacks `invalid_amount`, although payment exposes it. Those business failures
   already have BDD checks; their telemetry outcome is not guessed here.
3. OBS-027 lists `unknown_service`, but visit recording has no documented 422
   response. OBS-029 lists `invalid_state` without defining the invalid bill state.
   Specify the trigger/response before adding those outcome cases.
4. Cash telemetry lists `already_recorded` and `nothing_owed`, while the general
   replay rule says to retain the original outcome. Define cash replay versus a
   new request against a settled checkout before testing those telemetry outcomes.
5. Define the span status for `authorized_completion_failed`: OBS-004's unexpected
   failure rule requires outcome `failed`, but OBS-031 intentionally requires the
   more specific outcome. The test asserts that specific outcome without guessing
   its status. Likewise, clarify whether `veterinarian.id` on assignment rejection
   names the caller or assignee; current tests use the rejecting request's caller.

These are review findings, not silent contract amendments. Untested outcomes above
remain coverage gaps. Privacy/exporter lifecycle/general storage-fault tests remain
outside these slices.

## Verification and handoff

Run `npm test`. All suites run even if the guard fails. The runtime suite and new
application assertions are intentionally red until the services exist.

Last verification (2026-09-26): `npm test` with local port access; 44 harness
checks and 131 schema checks passed. Runtime: 12 passed / 40 failed.
Authentication: 1 passed / 227 failed (includes 218 new tests: one classification
check and 217 runtime cases). Observability: 92 failed (80 new runtime cases).
All 161 existing BDD scenarios remain red. New runtime failures report missing
service `start` scripts, with no new import/syntax/fixture failures observed.
The guard correctly reports unfrozen protected additions. `git diff --check` passes.

[assertion-slices.test.js](../spec/tests/harness/assertion-slices.test.js) validates
request fixtures, programmed dependency responses, and alignment of the span/outcome
registry with the observability document. Synthetic positive controls and deliberate
mutations verify detection of missing/duplicate spans, wrong outcomes/statuses/replay
flags, unended spans, wrong parents, missing headers, mixed contexts, and wrong HTTP
destinations. These are harness checks, not proof that the application passes.

Unlike the earlier slices, these additions have not been run green against a complete
throwaway service implementation. Runtime arrangement paths and end-to-end assertions
still need a green/mutation rehearsal once that implementation is available.

Checkpoint `test-01-s5-s6`: the supplied protected manifest now includes these
additions and the preceding Checkout slice; `guard:check` passes. The assistant
did not regenerate the manifest. Per [AGENTS.md](../AGENTS.md), “Only a human runs
`npm --prefix spec run guard:freeze`, after reviewing a spec change.” Future
contract/test revisions require another human freeze.
