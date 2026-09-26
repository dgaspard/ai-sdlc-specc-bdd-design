# Product and demonstration backlog

> Current business direction: see [SPEC-01 decisions](docs/specs/business-decisions.md).
> The user has specified four services, including VeterinarianServices, and checkout
> after a documented visit. Earlier held/pay-to-confirm targets below are historical
> proposals pending SPEC-02 revision, not approved requirements.

## Purpose and agreed direction

For the November talk, demonstrate that business behavior (BDD), service/API
contracts, and observability contracts can guide an agent to implement and
reconstruct software. Passing checks establish the specified behavior, not
complete enterprise correctness or identical source code.

- Preserve Git tag `1.0` (commit `897c9e4`) as the original baseline.
- Keep storage in memory. Restart recovery and durable transactions are out of scope.
- Evolve toward Customer, Reservation, VeterinarianServices, and Checkout services in one repository,
  running as separate local processes communicating over HTTP.
- Use a deterministic fake payment provider; test our integration behavior, not
  third-party internals. No real charges or payment credentials.
- Design API/service contracts, observability rules, and BDD feature files before
  implementation. Review the specification set with the user, then create executable
  checks, prove the expected failures, and implement against those checks.
- No service implementation is authorized merely by adding an item here.

## Current baseline

Tag `spec-schema-complete` locks the business decisions, domain model, schemas,
observability rules, and service feature files. The legacy single-app code, its
tests, and its API contract were removed (D-24); they remain available at tag `1.0`.
There is no application code and there are no step definitions. `npm test` runs
Cucumber, which reports every service scenario as undefined. That is the expected
state until TEST-01 creates protected tests, each of which must fail on creation.

## Ordered work

The [five-week project plan](PROJECT-PLAN.md) sequences these tasks and defines
milestone exit criteria. Task status remains recorded here.

Follow [the development workflow](docs/development-workflow.md) for every item.
As an item becomes active, record its stage, specification links, accepted
decisions, verification results, and next action using the handoff fields there.

### SPEC-01 — Agree service boundaries and business decisions

Status: user decisions recorded in [SPEC-01](docs/specs/business-decisions.md); follow-up semantics remain open.

| Service | Owns | Calls |
| --- | --- | --- |
| Customer | Customer identity and booking eligibility | None |
| Reservation | Scheduling, reservation lifecycle, and clinical Visit storage | Customer |
| VeterinarianServices | Veterinary service fees in USD | None |
| Checkout | Visit bills, payment attempts, and payment authorization outcomes | Customer, Reservation, VeterinarianServices, fake payment provider |

Acceptance: document ownership, allowed state transitions, error meanings, and
dependency failure behavior. Services must not read one another's in-memory stores.

Resolve before making executable requirements:

- How do existing pets/owners and visits map to customers and reservations?
- What makes a customer eligible? Which service owns price, currency, and fee rules?
- Does a declined payment retain or release a hold? Do holds expire?
- What happens when payment succeeds but reservation confirmation fails?
- What scopes an idempotency key, how long is it retained, and what happens when
  the same key is reused with different input or concurrently?
- What are the timeout and retry rules? How is an unknown payment outcome represented?

Suggested initial scope: success, decline, and duplicate checkout. Recovery after
payment succeeds but confirmation fails is a separate stretch item, not silently
treated as an ordinary failed payment.

### SPEC-02 — Publish the three specification layers

Status: initial Customer/Pet/Visit draft in progress; depends on remaining SPEC-01 decisions.

See [the domain model](docs/specs/domain-model.md) and its linked draft feature files.
These capture the user's field definitions, cross-pet account balance, history
aggregation, and record preservation. They are not yet executable coverage.
The draft now also includes Reservation, Calendar, and VeterinarianService models,
calendar/capacity scenarios, and the revised service catalog. Requested/accepted
time semantics and service collection definitions are now settled in the
domain model: scheduledStart/End, requestedAt/acceptedAt, requestedServices[], and
performedServices[]. Remaining domain decisions are listed at the end of that model.
Checkout now has a proposed record and draft payment/idempotency feature files:
remaining balance, authorization, unpaid completion, different-method retry, and
sequential/concurrent duplicate protection. Steps, API contracts, and updated OBS
assertions remain to be created after review; these drafts are not executable coverage.
Next action: formalize the accepted domain structure and field schemas,
then derive the corresponding API and telemetry contracts.
The [schema decision log](docs/specs/schema-decisions.md) records settled rules,
recommended defaults, and field requiredness. Q-01–Q-05 are now approved and reflected
in the domain model. Next schema deliverable: structural components and valid/invalid
examples, with cross-record constraints documented separately.

Latest model update includes stable IDs, two synthetic veterinarian seed records,
contact/insurance structures, estimated birth dates, reservation/visit cardinality,
per-visit account entries, payment attempts, and historical billed prices. User
accepted reservationState with CompletedSettled/CompletedOutstanding, unique
quantity-one services, independent performed services, finalized price snapshots,
full-balance payments, and one Checkout with multiple attempts per Visit. Reservation
is assigned clinical record storage. The core domain checkpoint is settled;
API schemas and executable assertions are not yet implemented.

- Write service OpenAPI contracts and the payment adapter contract, including
  schemas, identifiers, integer monetary units, currency, errors, and idempotency.
- Write BDD scenarios for eligible-customer booking, successful checkout, payment
  decline, and repeated checkout without duplicate charge or confirmation.
- Define exact workflow spans, attributes, statuses, and propagation checks using
  [the observability standard](docs/observability.md).
- Include unknown customers/reservations, ineligible customers, occupied slots,
  and dependency failures where the business decisions require them.
- Specify unknown-reservation checkout and reuse of an idempotency key with
  different input, including responses and absence of additional payment attempts.
- D-12 is approved for identical duplicate checkout requests: return the same
  result and authorize only once, including concurrent submissions. SPEC-01 now
  defines delegated mock defaults: UUID keys, visit scope, session retention,
  changed-input conflict, and a new key/method for retry after decline.
- Include the confirmed fee catalog, Customer-owned balances, veterinarian-owned
  records, Central Time schedule, and Accepted-only capacity. Confirmed: $20 paid
  at acceptance, zero balance remains in good standing, and post-visit decline means
  CompletedOutstanding. Cancellation releases the slot, preserves clinical
  records, and retains the fee. Resolve remaining details listed in SPEC-01.
- Review the complete specification set before implementing services. Proposed
  names in the observability document become binding only through this step.

### SPEC-03 — Trace observability rules to executable tests

Status: specification and initial mapping documented; future rule tests remain planned.

See [the traceability specification](docs/specs/observability-traceability.md).
Assign stable OBS IDs, include them in asserting test titles, and maintain the
rule → test → implementation status table in `docs/observability.md`. Preserve
proposed versus binding status and make missing coverage explicit. The existing
cancellation test is OBS-011; its assertions and intentional failure remain intact.

### ARCH-01 — Repository layout with separate projects

Status: done. Decision A-01. Phase: spec (human-directed).

Result: `spec/` holds features, contracts, seed data, cucumber config, and test tooling
(its own Node project); `services/<name>/` and `frontend/` contain README files only.
Root `npm test` runs the spec project. `npm --prefix spec ci` verified locally
(168 packages, 0 vulnerabilities).

- Create `services/<name>/` for each of the four services, `frontend/`, and `spec/`.
- Move `features/` and `contracts/` under `spec/` and update Cucumber and doc paths.
- Each service project has its own dependency file and `start` script and can be
  deleted without affecting any other project.
- Acceptance: deleting one service folder leaves every other project buildable.

### ARCH-02 — Language-neutral runtime contract

Status: next; priority 2. Decision A-02. Phase: spec.

Agreed values:

| Project | Port |
| --- | --- |
| frontend | 3000 |
| Customer | 4001 |
| Reservation | 4002 |
| VeterinarianServices | 4003 |
| Checkout | 4004 |
| Fake payment provider | 4010 |
| OTLP test collector | 4318 |

- Clinic clock: static `CLINIC_NOW` environment variable read at startup (ISO timestamp).
  Scenarios needing a different clock restart the affected services. Time rules in scope:
  no past appointments, hidden past slots, no acceptance after start, cancel only before
  start, visit only at/after start. No other ordering rules are in scope.
- Add a port-freeing script (for example `scripts/free-port.sh <port>`) used by the
  harness and the demo before starting or rebuilding a service on its static port.

- Specify the `start` convention, environment variables (port, dependency URLs,
  clinic clock, OTLP endpoint), health endpoint, and test-only reset endpoint.
- Specify how tests set the clinic clock so "past start" scenarios are repeatable.
- Publish this as a contract every service must satisfy in any language.

### ARCH-03 — Black-box test harness

Status: planned; priority 3. Decision A-03.

- Harness starts services through `start`, waits for health, resets state per scenario.
- Step definitions call services only over HTTP; responses are validated against schemas.
- Deterministic fake payment provider as its own process with inspectable call counts.
- No test imports application code.

### ARCH-04 — Cross-process telemetry capture

Status: planned; priority 4. Decision A-03.

- Test OTLP collector that receives traces from any language and exposes them to tests.
- OBS assertions read from the collector rather than an in-process exporter.

### OTEL-01 — OpenTelemetry specification conformance

Status: planned; with ARCH-04. Decision A-08.

- Use the official OpenTelemetry SDK in each service's language; OTLP export to the test collector.
- W3C Trace Context propagation on every inbound and outbound HTTP call.
- Resource attributes `service.name` (per OBS-001) and `service.version`.
- HTTP server/client spans and errors follow OpenTelemetry semantic conventions
  (for example `http.request.method`, `http.route`, `http.response.status_code`, `error.type`).
- Business attributes stay under `petclinic.*`; no custom names that duplicate a standard one.
- Tests check attribute names against the semantic conventions, not just presence.
- Update `docs/observability.md` to cite the conventions and version used.

### AUTH-01 — Simple local authentication and data access

Status: planned; before SPEC-04 so API contracts include it. Decision A-09.

- Users in `spec/seed-data/users.json`: username, plain-text demo password, role, and
  a link to a `customerId` or `veterinarianId` (the two seeded veterinarians).
- Customer service login endpoint returns a signed token carrying user ID, role, and
  linked ID. Shared demo secret comes from an environment variable.
- Every service verifies the token locally and applies the rules:
  veterinarian sees any data; customer sees only their own records.
- Missing or invalid token is rejected. The exact status codes are set in SPEC-04.
- Add service feature scenarios for login and for a customer being refused another
  customer's data (a deliberate SPEC update, per D-28).
- Tokens and passwords are never exported in telemetry (extends OBS-005).

### GUARD-01 — Protect specs and tests from agent modification

Status: planned; priority 5. Decision A-07. Phase: spec.

Protected paths: `spec/**`, `docs/specs/**`, `.github/**`, `.claude/**`, `AGENTS.md`.
Humans edit these deliberately; agents read them. Every backlog task states its phase:
**spec** (human-directed; agent may draft protected files only when the human asks) or
**build** (agent must not touch protected paths). Enforcement must not rely on AGENTS.md alone.

- Commit `.claude/settings.json` deny rules (Edit/Write) for every protected path, plus a
  PreToolUse hook that blocks shell commands writing to them.
- Add `CODEOWNERS` for protected paths.
- Add a required `guard` workflow: `protected.sha256` integrity check plus a frozen
  test-ID inventory that catches deleted or skipped tests.
- After the GitHub remote exists: branch ruleset requiring PR, `guard`, and code-owner review.

### SPEC-04 — Per-service API contracts

Status: planned; after ARCH-01..04, OTEL-01, AUTH-01, and GUARD-01.

- Derive each service's OpenAPI contract from its feature files and `domain.openapi.json`:
  endpoints, requests, responses, error codes, idempotency headers, test-only endpoints.
- Include the fake payment provider contract.

### FE-01 — Frontend project

Status: planned. Decision A-04.

- Plain HTML/JS in `frontend/`, calling services only through their published APIs.
- Accessible labels and roles so Playwright scenarios read like a user's actions.
- Playwright workflow scenarios live in `spec/` and stay unchanged across the language swap.

### PERF-01 — Minimum performance test

Status: planned. Decision A-06.

- Language-neutral HTTP load test against key endpoints (reservation request,
  acceptance, bill finalization, visit payment).
- Proposed budget: p95 under 200 ms, 10 concurrent users for 30 seconds, zero errors.
  Confirm thresholds before the test is frozen.
- Run against the JavaScript build and the Python rebuild with the same thresholds.

### DEMO-03 — Language swap demonstration

Status: planned; depends on IMPL-02, FE-01, PERF-01. Decision A-05.

- Show Playwright workflow and performance passing on the all-JavaScript build.
- Delete `services/checkout/`; the agent rebuilds it in Python from unchanged specs and tests.
- Rerun all suites, Playwright, and performance; show the connected trace.
- Stretch (recorded): rebuild the whole backend in Python.

### TEST-01 — Build independent executable verification

Status: planned; depends on ARCH-01..04, OTEL-01, AUTH-01, GUARD-01, and SPEC-04.

- Add real browser scenarios and provider/consumer contract checks over HTTP.
- Add a deterministic fake payment adapter with success, decline, and timeout
  outcomes, plus inspectable call counts for retry assertions.
- Verify distributed trace relationships across actual process boundaries using
  a test collector or equivalent shared capture; an in-process exporter alone
  cannot demonstrate cross-process propagation.
- Prove failures are caused by absent behavior, not broken fixtures or missing tools.
- Provide one start command and one verification command that reports all suites,
  even when an earlier suite fails. Preserve separate CI checks and evidence.

### IMPL-01 — Legacy visit cancellation (retired)

Status: retired by D-24. The legacy app was removed; its cancellation exercise is
preserved at tag `1.0`. Reservation cancellation is specified in
`spec/features/reservation/cancel-reservation.feature` and is built under IMPL-02.

### IMPL-02 — Build the four-service checkout workflow

Status: deferred until SPEC-01, SPEC-02, and TEST-01 are complete.

Implement successful checkout, declined payment, and idempotent retries against
the agreed expectations. Run real local service dependencies in integration tests;
fake only the payment boundary. Keep stores independent and in memory. Document
that restarting a process loses state and idempotency protection.

### DEMO-01 — Rehearse deletion and reconstruction

Status: planned after a passing implementation checkpoint.

- Create a tagged working checkpoint and a bounded deletion script or documented steps.
- Delete Checkout implementation only; retain contracts, features, tests, helpers,
  Customer, Reservation, and the fake payment provider.
- Rebuild in a fresh agent context to reduce reliance on remembered implementation.
- Review specification/test diffs and verify all suites plus the visible workflow.
- Rehearse timings, pin a supported runtime, preinstall browsers, and retain a
  recovery checkpoint and recorded fallback. No destructive deletion during planning.

## Experiment and presentation work

### EXP-01 — Measure service reconstruction

Status: planned; depends on a verified IMPL-02 checkpoint.

Follow the experiment protocol and run-record template in `PROJECT-PLAN.md`.
Perform at least three fresh Checkout reconstructions with frozen expectations,
no access to deleted source/history, and independent evaluation of published
requirements. Record failures, timings, interventions, and specification changes.
Two-service reconstruction and a prose-versus-executable comparison are stretch
experiments, not prerequisites for the primary demo.

### DEMO-02 — Prepare presentation and recovery

Status: planned; depends on DEMO-01 and EXP-01 evidence.

Confirm the talk duration and reconstruction time budget. Require three consecutive
rehearsals within budget and all required checks green for a live rebuild. Prepare
a clearly labeled recording, separate recovery checkpoint, and narrative explaining
retained scaffolding, limitations, and observed results. Freeze core scope in Week 5.

## Optional feature candidates

- Reschedule appointments: preserve ID, reject date conflicts, record success/conflict.
- Filter upcoming visits: define date range boundaries, ordering, and query outcomes.
- Register patients: define validation and identifiers; avoid owner details in telemetry.
- Complete visits: define allowed transitions and trace previous/new states.
- Recover payment-success/confirmation-failure cases using an agreed retry or refund policy.

## Definition of done for implementation

Reviewed requirements are implemented without weakening their checks; all BDD,
contract, and observability suites pass; the browser workflow works; trace evidence
is captured; known in-memory limitations are documented. Documentation of a proposed
feature or an intentionally failing baseline does not mean that feature is complete.
