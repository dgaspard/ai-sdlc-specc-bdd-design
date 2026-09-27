# Product and demonstration backlog

> Current business direction: see [SPEC-01 decisions](docs/specs/business-decisions.md).
> Four services are specified, including VeterinarianServices. Acceptance collects
> the booking fee; checkout follows a documented visit. Held/pay-to-confirm
> proposals from early planning are superseded by the published contracts.

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
There is no application code. TEST-01 is complete: protected service steps,
schema, access-control, and telemetry checks exist, and their temporary-service
rehearsals are recorded below. The frozen TEST-01 baseline contains 166 service
scenarios. SPEC-05/TEST-02 are now reviewed and frozen: 219 service scenarios and
nine Playwright HTTP journeys resolve their steps and remain red because the
application is absent. The guard, harness, and schema checks pass. The checkpoint
is tagged `spec-05-test-02-frozen`; see the handoff below.

## Ordered work

The [five-week project plan](PROJECT-PLAN.md) sequences these tasks and defines
milestone exit criteria. Task status remains recorded here.

Follow [the development workflow](docs/development-workflow.md) for every item.
As an item becomes active, record its stage, specification links, accepted
decisions, verification results, and next action using the handoff fields there.

### SPEC-01 — Agree service boundaries and business decisions

Status: core business decisions recorded and carried into the frozen service
specifications. Decisions D-01–D-38 are in
[SPEC-01](docs/specs/business-decisions.md); later contract clarifications GAP-01–07
are recorded in the [TEST-01 review](docs/test-slices-5-6.md).

| Service | Owns | Calls |
| --- | --- | --- |
| Customer | Customer/pet profiles, account entries, booking eligibility | None |
| Reservation | Calendar, reservation lifecycle, clinical Visit storage | Customer; Checkout for booking payment |
| VeterinarianServices | Service catalog and USD fees | None |
| Checkout | Bills, promotions, booking and visit payments, cash | Customer, Reservation, VeterinarianServices, fake payment provider |

Settled rules include owner = customer, independent in-memory stores, requested
and accepted reservations without expiry, a non-refundable $20 fee at acceptance,
post-visit completion as CompletedSettled or CompletedOutstanding, and sequential
and concurrent payment replay. Failed booking payment leaves the request open;
failed post-visit payment leaves an outstanding balance. Published contracts
specify unknown entities, conflicts, and failures after successful authorization.
Automatic payment recovery, timeout handling, refunds, and durable idempotency
remain outside the demo scope. Do not reopen historical follow-up lists as new
requirements; consult the current domain model and API contracts first.

### SPEC-02 — Publish the three specification layers

Status: service features, domain schemas, and API contracts complete; cross-service
workflow features and browser tests remain under TEST-02.

The [domain model](docs/specs/domain-model.md),
[schema decisions](docs/specs/schema-decisions.md), and
[contract index](spec/contracts/README.md) define the reviewed service surfaces.
Schema questions Q-01–Q-05 are approved. Customer and Pet expose profiles/account
data; Reservation owns and serves clinical records (D-38). Integer USD cents,
price snapshots, payment limits (revised for partial payments by SPEC-05), promotion limits, and state transitions
are expressed in the published contracts and service features.

SPEC-04 delivered the per-service and fake-payment contracts. TEST-01 supplied
executable service steps, schema assertions, access checks, and business trace
checks; all 166 service scenarios resolve their steps. The current OBS registry
runs through OBS-042, with retired IDs and uncovered rules explicitly identified.
Completion of these service artifacts does not imply that workflow features,
the frontend, or the application exist.

### SPEC-03 — Trace observability rules to executable tests

Status: stable-ID registry and coverage mapping established; scoped business-trace
checks validated in TEST-01. Broader rule coverage remains incomplete.

Follow the [traceability specification](docs/specs/observability-traceability.md)
and maintain the rule → test → implementation table in
[observability.md](docs/observability.md). Existing checks cover service identity,
HTTP/resource conventions, W3C propagation, business outcomes OBS-023–035, and
cross-process evidence OBS-036–040. The latest rehearsal passed 92 business
telemetry/workflow checks; temporary implementations were then removed.

Privacy, exporter failure/lifecycle, eligibility tracing, and broader fault and
concurrency coverage remain explicit gaps. Conditional logs and metrics remain
deferred. Supporting assertions under other IDs are not complete coverage of a
broader rule. OBS-011 is retired; the legacy cancellation example stays at tag
`1.0` and the current cancellation contract is OBS-026.

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

Status: local protection done; remote branch ruleset and code-owner configuration
remain to be verified/configured. Decision A-07. Phase: spec.

Protected paths (`spec/guard/protected-paths.json`): `spec/`, `docs/specs/`, `.claude/`,
`.github/`, `AGENTS.md`. Humans edit them; agents read them.

- Build agent: `.claude/settings.json` deny rules plus `.claude/hooks/protect-paths.mjs`
  (edit tools and shell commands; blocks `guard:freeze`). The reason is shown to the user.
- Fingerprints: `spec/protected.sha256`, checked by `npm --prefix spec run guard:check`
  (first suite in `npm test`), refrozen only by a human with `guard:freeze`.
- Skip scan: rejects `.skip`/`.only`/`.todo` and `@skip`/`@wip`/`@ignore`/`@only` tags.
- GitHub: `.github/CODEOWNERS` and `.github/workflows/guard.yml` (guard job required; full
  suite informational). The GitHub remote now exists. Verify/configure its branch
  ruleset requiring PR, the guard check, and code-owner review; confirm the
  CODEOWNERS username. This documentation update does not claim remote enforcement.
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
- Pass [ENG-01](#eng-01--review-implementation-quality-across-the-language-swap)
  for the JavaScript baseline and each Python reconstruction.
- Stretch (recorded): rebuild the whole backend in Python.

### TEST-01 — Service-level executable tests (all red)

Status: done (2026-09-27). Phase: spec. Stage: tests red.
Checkpoint tag: `test-01`.

Completion means the service-level executable specifications and their
green/mutation rehearsals are complete. It does not mean the application passes:
temporary implementations have been removed and missing-service failures are
intentional. Workflow features/browser tests and broader observability coverage
gaps remain outside this task.

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
- Slice 2: Customer steps for profile, pets, account, eligibility, login, and access
  scenarios (45 scenarios). Internal operations are called with service-role tokens.
  Validated against a throwaway spike (45/45 green; AUTH-001..004 10/10 green), then with
  three deliberate faults: clamping an over-credit (1 fails), customers reading others'
  profiles (1 fails), login leaking the password (fails widely via the `User` schema).
  Spike deleted; baseline: 45/45 fail as not implemented.
- Slice 3: Reservation steps (73 scenarios incl. outlines) with Customer and Checkout stubs:
  default stub answers per scenario, assertions on what Reservation sent (amounts, method,
  Idempotency-Key, service-role token signed with the shared secret and never the user's
  token). States are reached only through the API; `BeforeStep` records Given/When/Then so
  `the reservation is "<state>"` sets up in a Given and asserts in a Then. Validated against
  a throwaway spike (73/73 green), then five faults: no slot lock during acceptance (race),
  forwarding the vet's token to Checkout, denial amount without the thousands comma, weekend
  slots, past slots offered; each caught by the scenario owning that rule. Spike deleted;
  baseline: 73/73 fail as not implemented.
- Slice 4: Checkout steps (34 scenarios) with Customer, Reservation, and VeterinarianServices
  stubs plus the real fake payment provider, whose call log proves whether a card was charged.
  Assertions cover amounts, billed-line snapshots, account changes, completion requests, and
  service-role tokens (`sub: checkout`). The spike found one step bug (a regex group count),
  fixed before review. Validated against a throwaway spike (34/34 green), then five faults:
  no idempotency (5 fail), concurrent duplicates racing (1), booking fee collected twice (7),
  promotion driving the balance negative (1), reporting settled when completion fails (1).
  Spike deleted; baseline: 161/161 service scenarios fail as not implemented.
- Slices 5–6 completed: contract-generated access assertions for all 34 protected
  operations; business trace assertions for OBS-023–040 and stub-header propagation
  for OBS-002. Real-service trace tests cover cross-process evidence, replay,
  booking acceptance/decline, and promotion to zero. Application services remain absent.
  See [review, outcome coverage, and contract gaps](docs/test-slices-5-6.md).
  Harness fixture/mutation checks pass; full runtime validation remains red.
  Stage: tests red; supplied protected manifest passes guard:check and includes
  these slices and the prior Checkout slice. Checkpoint tag: `test-01-s5-s6`.
  Contract gaps resolved in GAP-01–07 of the linked review: documented 403s,
  missing telemetry outcomes, invalid visit/bill inputs, cash replay and rejection
  precedence, authorized-completion failure status, and veterinarian identity.
  Added BDD cases and trace assertions; the freeze is included in `test-01`.
  Historical verification before that freeze: npm test passes 45 harness and 131 schema checks; application
  assertions remain red because service implementations are absent. BDD dry run
  resolved all 166 scenarios; the guard then reported the unfrozen revisions.
  Those revisions are now frozen and the guard passes.
  Latest verification (2026-09-27): supplied working-tree manifest passes the
  guard and was preserved unchanged. The [green/mutation rehearsal](docs/test-slices-5-6-rehearsal.md)
  passed all 310 slice-5/6 checks (218 access, 92 telemetry/workflow), detected
  13 deliberate implementation defects, and passed all 10 distinct mutation
  targets after restoration. Temporary implementations were removed; final
  `npm test` again passes guard, 45 harness and 131 schema checks, with application
  suites intentionally red because services are absent. No protected files changed.
  Next: define TEST-02 workflow features and browser tests.
  The TEST-01 specification handoff and first green/mutation rehearsal are complete;
  broader privacy/exporter/fault coverage gaps remain outside these slices.

### SPEC-05 — Revise the November MVP domain and contracts

Status: reviewed and frozen (2026-09-27). Phase: spec. Stage: tests red.

User-directed changes after `test-01-docs`: keep exactly two seeded veterinarians,
their independent offices, assigned-veterinarian acceptance/denial/cancellation,
customers canceling only their own appointments before the start, multiple services
per visit, and the non-refundable $20 booking fee paid before acceptance.

Add customer self-registration with a preferred veterinarian and at least one pet;
allow correction of completed clinical records and veterinarian updates to service
types. Revise the domain, API/auth contracts, features, access fixtures, schema
checks, and affected telemetry expectations before building application code.
Add service-level failing tests and cross-service journeys under TEST-02. This is
the same specification-first process used for the original requirements; a prior
freeze remains a historical checkpoint, not a prohibition on reviewed evolution.

Approved correction scope: assigned-veterinarian changes to clinical notes,
diagnoses, medications, and follow-up notes only; preserve services and finalized
bills. Draft service features and PATCH contracts now cover this scope and
catalog name/fee updates. Cross-service assertions must additionally prove that
clinical corrections and catalog updates leave finalized bills and debt unchanged.

Accepted scope clarification (2026-09-27): require all customer information at
registration, including insurance, saved mock payment details, and secondary
contact, plus a veterinarian and at least one pet. Keep one registration flow;
do not introduce additional setup flows for collecting those details later.
Allow multiple smaller payments against one visit, mixing card payments and
veterinarian-recorded cash. Failed payments leave debt unchanged; any outstanding
customer balance continues to block new appointment requests. Each payment targets
one visit. Pet removal and archival are excluded from this demo.

Workflow scope confirmed: retain the existing backend journeys and TEST-02 tests;
avoid additional UI/setup flows for visits, bill payment, or appointment times.
The draft includes coordinated registration/payment schemas, features, fixtures,
and telemetry revisions. Self-registration requires complete information; the
existing veterinarian-assisted profile endpoint retains its frozen input shape.
The full-balance-only payment rule is superseded by the approved partial payments.

Only the human runs `guard:freeze` after reviewing the revised protected files.
Keep the original `test-01` and `test-01-docs` tags intact.

Handoff (2026-09-27): registration, partial payment, catalog update, and completed
clinical correction contracts/features/steps are frozen, with nine backend
journeys and OBS-043–045. Pet removal is excluded. No business questions remain.
The human reviewed the specification changes and ran `guard:freeze`. `npm test`
passes the guard, harness, and schema suites; runtime, authentication,
observability, service BDD (219 scenarios), and workflow BDD (nine scenarios) are
red because the application services are absent. Cucumber resolves all 219
service scenarios/1685 steps and nine workflow scenarios/58 steps, with no
undefined or ambiguous steps. The new checks have not had a working-implementation
or mutation rehearsal; do not claim implementation verification.
Checkpoint: tag `spec-05-test-02-frozen`. Next: proceed to IMPL-02, coordinating
the application build with FE-01 and PERF-01. Broader
telemetry failure/privacy branches remain explicit gaps in the coverage table.

### TEST-02 — Cross-service workflow specifications and API tests

Status: reviewed and frozen (2026-09-27). Phase: spec. Stage: tests red. Depends on TEST-01 and SPEC-05.

Scope: specify a small set of user journeys spanning the four services, then
write protected workflow steps using Playwright's HTTP request API without
launching a browser. The fast backend suite does not depend on a frontend design.
Add a small headless browser suite with FE-01 once user interactions are specified.
The existing HTTP telemetry workflows prove selected integration assertions;
they do not replace workflow feature files or browser acceptance tests.

Draft journey selection for review:

- Request and accept an appointment, collect the booking fee, record the visit,
  finalize the bill, and settle the remaining balance.
- Mix partial card payment, decline, and veterinarian-recorded cash; block another
  pet's booking until customer debt is cleared.
- Replay a partial payment after settlement without duplicate authorization or credit.
- Apply a promotion after partial payment without overcrediting or another authorization.
- Preserve finalized bills and debt through clinical corrections and catalog changes.
- Reject one of two competing payments before overcollection.
- Retain the booking fee on customer cancellation and reuse released capacity.
- Accept simultaneous bookings for different pets with the two veterinarians.
- Register a customer with complete information and request their first appointment.

Acceptance criteria: reviewed features live under `spec/features/workflows/`;
steps exercise actual local services with only the payment provider faked;
state, money, payment invocation counts, and the existing trace suites agree.
Keep detailed edge cases in the service suites. Register the HTTP journey suite in the aggregate
runner, record a meaningful red baseline, and have the human review/freeze the
protected changes. Tests must stay unchanged for the JavaScript-to-Python demo.
Browser interaction tests remain with FE-01 once its existing UI is designed;
do not add extra UI/setup flows for this task.

References: D-28/D-35, service features, `spec/contracts/`, OBS-036–040,
A-04/A-05, and `docs/development-workflow.md`.
Next action: carry the frozen expectations into IMPL-02. Run with
`npm --prefix spec run test:workflows`; the aggregate `npm test` includes it.
Processes are reused between scenarios, with deterministic resets and one worker;
there are no browser launches, screenshots, or retries hiding failures. This does not authorize
application implementation or introduce new business behavior.

### MVP-02 — Clinic growth and administration after the November demo

Status: deferred; possible 2027 workshop. Phase: spec before implementation.

Business case: the clinic is growing and hires additional veterinarians. Introduce
an administrator role, veterinarian onboarding/removal and office capacity,
administration of other veterinarians' appointments, and policies for future
appointments and historical records when a veterinarian leaves. This is a separate
exercise in evolving a tested product with AI, not required for the November demo.
Payments allocated across multiple visits are also deferred; each MVP payment
targets one visit. Pet removal and archival are excluded from the November demo
and tracked separately below.

### DATA-01 — Personal historical-data and archival learning demo

Status: deferred until explicitly requested. Phase: research/spec before implementation.

Explore pet removal, preservation of historical data, data governance, archival,
retrieval, reporting, and enterprise data-archiving practices in a separate personal
learning exercise. The user intentionally welcomes greater architectural depth in
that later exercise to learn data engineering. Define retention, access, archival,
and retrieval requirements then; no archival implementation, pet-removal endpoint,
or related failing acceptance tests belong in the November TDD demo.

### IMPL-01 — Legacy visit cancellation (retired)

Status: retired by D-24. The legacy app was removed; its cancellation exercise is
preserved at tag `1.0`. Reservation cancellation is specified in
`spec/features/reservation/cancel-reservation.feature` and is built under IMPL-02.

### IMPL-02 — Build the four-service checkout workflow

Status: ready to start; TEST-02 expectations and tests are reviewed and frozen.
Service specifications and TEST-01 are complete; coordinate the JavaScript build
with FE-01 and the agreed PERF-01 checks.

Before declaring this checkpoint ready, pass
[ENG-01](#eng-01--review-implementation-quality-across-the-language-swap) and retain
the JavaScript engineering review record alongside the test results.

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
- Complete [ENG-01](#eng-01--review-implementation-quality-across-the-language-swap)
  for every reconstruction before calling the run demo-ready.
- Rehearse timings, pin a supported runtime, preinstall browsers, and retain a
  recovery checkpoint and recorded fallback. No destructive deletion during planning.

## Experiment and presentation work

### ENG-01 — Review implementation quality across the language swap

Status: planned; applies to the all-JavaScript implementation and each Python
Checkout reconstruction. Phase: implementation and demo review. Depends on a
runnable implementation. Fourth pillar: **Engineering Discipline**.

Purpose: passing BDD, API, observability, and browser checks establishes the
behavior they cover. Review the implementation separately to determine whether
its boundaries, payment handling, and structure are sound enough to maintain.
Apply the same review criteria to both languages. An agent must perform this
review after generating code and fixing test failures, before declaring the
implementation or reconstruction checkpoint ready.

Review tasks:

- **Inspect the complete implementation diff.** Identify Checkout behavior,
  dependencies, startup configuration, and telemetry. Confirm the rebuilt service
  has not changed protected specifications, tests, or surviving services to pass.
- **Check service ownership.** Checkout uses published APIs, owns its state, and
  neither reads another service's store nor copies its business logic. Keep the
  payment fake outside Checkout.
- **Trace one payment from request to outcome.** Locate the idempotency check,
  provider call, recorded result, and Reservation/Customer updates. Verify
  sequential and concurrent retries cause no duplicate provider calls or credits.
- **Review money and state transitions.** Use integer cents; require the $20
  booking fee before acceptance. A booking decline leaves the request Requested.
  Partial and full visit payments produce the specified CompletedOutstanding or
  CompletedSettled state without overcollection or cross-visit allocation.
- **Inspect partial failures.** Provider success followed by downstream failure
  must be reported accurately in the response and trace. A retry must not silently
  charge again. Record limitations outside the agreed in-memory demo scope.
- **Review access and telemetry.** Inspect service-token use, ownership checks,
  trace propagation, and sensitive customer/payment information in spans or errors.
- **Review code structure.** Look for hardcoded scenario values, duplicate payment
  paths, unnecessary coupling, and control flow that obscures payment outcomes.
- **Run language-appropriate code checks.** Add and run formatting, lint, and
  useful static checks. Record exact commands, versions, and results for JavaScript
  and Python; equivalent criteria do not require identical tools.
- **Verify and record the result.** Run frozen suites, backend journeys, and the
  same browser journey once available; inspect the diff and a connected trace.
  Record findings, fixes, remaining limitations, and the final commit/workspace.

Acceptance criteria: frozen behavioral suites and configured code checks pass;
the review record separates test results from code-review findings. Resolve
payment-safety and service-boundary concerns before demo readiness. Record each
other finding's disposition and remaining limitations. Judge JavaScript and Python
by the same criteria; green tests alone do not establish production readiness.

Record each review under `docs/engineering-reviews/` with checkpoint/language,
reviewed diff and files, test/check commands and results, payment/trace evidence,
findings with fixes and dispositions, limitations, and a pass/blocked decision.
Add targeted regression checks for concrete uncovered behavior through the normal
specification-first process; proposed checks under protected paths need explicit
specification authorization and human review/freeze before implementation.
Do not modify frozen tests merely to pass this gate.

Next action: use this gate at IMPL-02 and every DEMO-01/DEMO-03/EXP-01 checkpoint;
refine the checklist against the first working Checkout implementation. No review
or language-tool result is claimed before that implementation exists.

### EXP-01 — Measure service reconstruction

Status: planned; depends on a verified IMPL-02 checkpoint.

Follow the experiment protocol and run-record template in `PROJECT-PLAN.md`.
Perform at least three fresh Checkout reconstructions with frozen expectations,
no access to deleted source/history, and independent evaluation of published
requirements. Record failures, timings, interventions, and specification changes.
Apply [ENG-01](#eng-01--review-implementation-quality-across-the-language-swap)
to each reconstruction; record code-check results and review findings separately
from behavioral test outcomes using the same criteria as the JavaScript baseline.
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
