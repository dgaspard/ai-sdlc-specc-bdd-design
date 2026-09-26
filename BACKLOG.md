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

Status: done. Decision A-02. Phase: spec.

Result: [`spec/contracts/runtime-contract.md`](spec/contracts/runtime-contract.md) defines
`setup`/`start` scripts, static ports, environment variables (OpenTelemetry standard names
where they exist), frozen `CLINIC_NOW` clock, `GET /health`, `POST /test/reset` behind
`PETCLINIC_TEST_ENDPOINTS=enabled`, and seed files read from `SEED_DATA_DIR`. Added
`spec/seed-data/services.json` (fixed catalog IDs) and `spec/harness/free-port.sh`.
Reference runtimes: Node 22+ (24.21.0 in use), Python 3.12.

Browser access: CORS from `FRONTEND_ORIGIN` (default `http://localhost:3000`); no frontend proxy.

### ARCH-03 — Black-box test harness

Status: done. Decision A-03. Phase: spec.

Result: `spec/harness/` (config, process control, stub server, schema validator,
free-port), `spec/fakes/payment/` with its contract `spec/contracts/payment-provider.openapi.json`,
runtime-contract tests (RT-001..RT-007), domain-example schema tests, Cucumber
lifecycle (`spec/tests/support/world.js`), and `spec/run-all.js` reporting every suite.

Baseline (`npm test`):
- Runtime contract: fake payment provider passes; all four services and the frontend
  fail with "<Project> not implemented: <folder>/start not found".
- Service features: 150 of 150 scenarios fail with the same not-implemented message.
- Schema contracts: 9 of 9 pass after fixing two defects the harness found in
  `domain.openapi.json` (Read schemas rejected their own fields; declined payments could
  carry an authorization reference).

### ARCH-04 — Cross-process telemetry capture

Status: done. Decisions A-03, A-10. Phase: spec.

- OTLP/HTTP test collector in `spec/harness/collector/` (port 4318): protobuf only, rejects
  other formats with 415 and records them; `GET /test/spans`, `POST /test/reset`.
- Vendored OTLP .proto files (opentelemetry-proto, latest release v1.10.0) decoded with protobufjs.
- `spec/harness/traces.js` (wait for spans, find span, parent/child across services, trace tree)
  and `spec/harness/show-trace.js` for the demo.
- Runtime contract: OTLP protobuf env vars, traces only, `OTEL_BSP_SCHEDULE_DELAY=100`, and
  RT-008 [OBS-001]: each service exports protobuf traces under its `service.name`.
- Collector self-check tests in `spec/tests/harness/`.
- Dependency: protobufjs ^8.8.0 (dev, spec project).

Baseline (`npm test`): harness self-checks pass (collector accepts protobuf, rejects JSON
with 415); schema contracts pass; runtime contract: fake payment and collector pass, the
four services (including RT-008) and the frontend fail as not implemented; 150/150
service scenarios fail as not implemented.

### OTEL-01 — OpenTelemetry specification conformance

Status: done. Decision A-08. Phase: spec.

Result: semantic conventions reference v1.44.0 (stable HTTP subset enforced);
auto-instrumentation allowed, not required. New rules OBS-041 (HTTP span names and
attributes, deprecated names forbidden, business spans parented by the SERVER span) and
OBS-042 (`service.name`, `service.version`, `telemetry.sdk.language`). Checks in
`spec/harness/semconv.js`; tests in `spec/tests/observability/otel-conventions.test.js`
(12 failing: services not implemented) and helper self-checks in `spec/tests/harness/`.
Client-span, 5xx `error.type`, business-span parenting, and W3C propagation (OBS-002)
tests move to TEST-01, after SPEC-04 defines endpoints.

### AUTH-01 — Simple local authentication and data access

Status: done (specification and failing tests). Decision A-09. Phase: spec.

Result: [`spec/contracts/auth-contract.md`](spec/contracts/auth-contract.md) and
`auth.openapi.json`: JWT HS256 with the shared demo secret, 8-hour user tokens on the clinic
clock, identical 401 for unknown user or wrong password, `service` role tokens (5 minutes)
for internal operations, 401/403/404 rules, open endpoints. Seed data: `customers.json`
(Jordan Rivera with Milo and Luna, Sam Lee with Rex) and `users.json` (two veterinarians,
two customers, password `petclinic-demo`). Veterinarians create new customers; only seeded
users log in.

Tests: seed-data schema and reference checks (pass); `spec/tests/auth/login.test.js`
AUTH-001..AUTH-004 (fail: Customer not implemented); `login.feature` and access scenarios
in `customer-profile.feature`. Token rejection and per-endpoint access rules are tested in
TEST-01 once SPEC-04 defines the endpoints and marks internal ones.

### GUARD-01 — Protect specs and tests from agent modification

Status: done (GitHub ruleset waits for the remote). Decision A-07. Phase: spec.

Protected paths (`spec/guard/protected-paths.json`): `spec/`, `docs/specs/`, `.claude/`,
`.github/`, `AGENTS.md`. Humans edit them; agents read them.

- Build agent: `.claude/settings.json` deny rules plus `.claude/hooks/protect-paths.mjs`
  (edit tools and shell commands; blocks `guard:freeze`). The reason is shown to the user.
- Fingerprints: `spec/protected.sha256`, checked by `npm --prefix spec run guard:check`
  (first suite in `npm test`), refrozen only by a human with `guard:freeze`.
- Skip scan: rejects `.skip`/`.only`/`.todo` and `@skip`/`@wip`/`@ignore`/`@only` tags.
- GitHub: `.github/CODEOWNERS` and `.github/workflows/guard.yml` (guard job required; full
  suite informational). After the remote exists: branch ruleset requiring PR, the guard
  check, and code-owner review. Confirm the CODEOWNERS username.
- Self-checks: `spec/tests/harness/guard.test.js` and `protect-hook.test.js`.

### SPEC-04 — Per-service API contracts

Status: done. Phase: spec. Index: [`spec/contracts/README.md`](spec/contracts/README.md).

Decisions: plain REST paths, no version prefix or pagination; RFC 9457 problem details
with a stable `code`; 400 malformed, 401/403/404 per auth contract, 409 state conflicts,
422 business-rule rejections, 502 dependency failures; balance denial is 201 with the
saved Denied reservation; `/internal/` operations are service-only; the acting user comes
from the token, never the body; one OpenAPI file per service reusing domain schemas by
`$ref`; `Idempotency-Key` required on booking-fee, accept, card, and cash payment operations.

Result: `customer` (12 operations, includes login), `reservation` (12), `veterinarian-services`
(3, read-only), `checkout` (8) contracts plus `common.openapi.json`. Customer serves
`CustomerRead`/`PetRead`, which no longer embed reservations, visits, or history (D-38). Every feature
file maps to at least one operation (`x-features`). Structural tests in
`spec/tests/contract/api-contracts.test.js` pass (131 schema checks in total).

### FE-01 — Frontend project

Status: planned. Decision A-04.

- Plain HTML/JS in `frontend/`, calling services directly through their published APIs
  using CORS (runtime contract).
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

### TEST-01 — Service-level executable tests (all red)

Status: in progress. Phase: spec.

Decisions: test clock `POST /test/clock` (RT-009) instead of restarts, so in-memory data
survives a clock change; "Given" state only through published APIs with stubs for
dependencies (no seed backdoors); one step file per service plus shared steps (clock,
login, "refused as <reason>" → problem `code`); access control generated from every
contract operation's `x-roles` (401 missing/bad-signature/`alg: none`/expired, 403 wrong
role, 404 another customer's record); OBS-023..040 in dedicated observability tests,
OBS-002 via `traceparent` recorded by stubs; stubs assert internal calls carry a
`service`-role token and never the user's token (negative check), and internal
operations reject user tokens with 403. Workflow features and Playwright are TEST-02.

Done so far:
- Part 1: test clock (runtime contract, harness, RT-009). Tag `test-01-clock`.
- Slice 1: shared helpers (`clinic-time.js`, `money.js`, `seed.js`), Cucumber world `api()`
  that validates every response against the service contract, `tokenFor()`/`actAs()`
  (real login against Customer; identical locally signed tokens elsewhere), shared steps,
  and VeterinarianServices steps. Validated against a throwaway spike service (9/9 green),
  then with two deliberate faults (wrong fee: 3 scenarios fail; extra field: 2 fail with
  "Contract violation"). Spike deleted; baseline: 9/9 fail as not implemented.

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
