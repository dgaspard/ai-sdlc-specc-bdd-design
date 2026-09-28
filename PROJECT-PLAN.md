# Five-week project plan: rebuilding a service from executable expectations

> Current business direction: see [SPEC-01 decisions](docs/specs/business-decisions.md).
> The user has specified four services, including VeterinarianServices, and checkout
> after a documented visit. Earlier held/pay-to-confirm targets below are historical
> proposals superseded by the published contracts.

## Objective and scope

Prepare a November presentation demonstrating that reviewed BDD scenarios, API
contracts, and observability contracts can guide an AI agent to recreate a deleted
service that interoperates with existing services.

The fourth pillar is **Engineering Discipline**: passing behavioral specifications,
API contracts, and observability checks is followed by an implementation review of
service boundaries, payment safety, and maintainability. The required gate is
[ENG-01](BACKLOG.md#eng-01--review-implementation-quality-across-the-language-swap).
Apply it after code generation at the all-JavaScript implementation checkpoint
and every Python Checkout reconstruction. Record test results separately from
review findings; both the automated checks and engineering review must pass.

Primary demonstration: build all services in JavaScript, show the Playwright workflow
passing, delete Checkout, have the agent rebuild it **in Python** from the unchanged
tests, then rerun the same Playwright workflow and performance check (A-05). Stretch:
a recorded rebuild of the whole backend in Python. The evidence supports this bounded example,
not a claim that arbitrary enterprise systems can be reconstructed from tests.

Use five relative weeks starting when this plan is adopted. The exact talk date,
session length, available weekly effort, and live reconstruction time budget remain
to be confirmed. The schedule is a planning target, not a delivery guarantee.

### In scope

- Customer, Reservation, VeterinarianServices, and Checkout as separate local HTTP processes,
  each its own project in one repo (A-01), able to use different languages.
- A separate plain HTML/JS frontend project (A-04) and a minimum performance test (A-06).
- Independent in-memory stores and a deterministic fake payment boundary.
- A small browser workflow for appointment reservation and checkout.
- Service-owned feature files, separate cross-service workflow feature files,
  published API contracts, and executable telemetry requirements.
- Independent verification, repeatable reconstruction experiments, and demo recovery.
- Preserve tag `1.0` as history. The new four-service application replaces the legacy
  app; no migration is required (D-24).

### Outside the initial scope

Persistent databases, durable idempotency, cloud deployment, Docker/containers
(decided against: added complexity, little value for an unshared project), Kubernetes, message
brokers, real payments, authentication infrastructure, production monitoring, and
automatic refund/reconciliation systems. Their absence must be explicit in the talk.
No new feature beyond the core demonstration is required to prove the hypothesis.

## Current position

The specification phase through TEST-01 is complete at tag `test-01` (commit
`9d7b08e`): decisions D-01–D-38, the domain model, per-service and payment
contracts, OBS-001–OBS-042, protected service steps, schema assertions,
access-control checks, and business-trace checks are present. The 166 service
scenarios resolve their steps. The latest temporary-service rehearsal passed 310
access and telemetry/workflow checks and caught 13 deliberate defects; its
temporary implementations were removed afterward. The legacy application remains
at tag `1.0`. The four JavaScript services and the FE-01 vanilla JavaScript frontend
now exist. IMPL-02 validation and the JavaScript ENG-01 review pass; see the
[JavaScript review record](docs/engineering-reviews/impl-02-javascript.md) for
results, findings, and resolved service-BDD harness correction.

SPEC-05 and TEST-02 are reviewed and frozen: complete self-registration information,
partial per-visit payments, clinical-text corrections, catalog updates, and fast
backend journeys using Playwright HTTP requests without a browser. No extra UI/setup
flows are added. Pet removal and archival are deferred to the separate DATA-01
learning exercise. See BACKLOG for current verification and review status.
IMPL-02's full validation and
[ENG-01](BACKLOG.md#eng-01--review-implementation-quality-across-the-language-swap)
are complete for the JavaScript backend workspace. FE-01's UI, five browser checks,
three visual comparisons, and frontend ENG-01 review also pass at checkpoint `fe-01`.
PERF-01 remains before demo readiness. The original intentional red
baseline is historical. The verified implementation checkpoint is tag `impl-02`.

## Working agreements and ownership

Follow [the development workflow](docs/development-workflow.md) for each capability:
features → API contracts → standards/telemetry → specification review → executable
failing checks → implementation → independent verification.

The presenter owns business decisions, acceptance of specifications, and the final
presentation scope. The agent drafts artifacts, identifies gaps, builds authorized
checks and implementation, and records evidence. Review expectations independently
of generated code; a separate human review is useful where available, not assumed.

The plan owns milestones and experiment criteria. [BACKLOG.md](BACKLOG.md) owns task
status and unresolved decisions. [Observability documentation](docs/observability.md)
owns telemetry definitions and coverage. Do not turn this plan into a second copy of
the requirements. Review and test each bounded slice before moving to the next.

## Target service boundaries

| Service | Owns | Dependencies |
| --- | --- | --- |
| Customer | Profiles, pets, account balance, booking eligibility | None |
| Reservation | Calendar, reservation lifecycle, clinical Visit storage | Customer; Checkout (booking fee, D-32) |
| VeterinarianServices | Service catalog and fees in USD | None |
| Checkout | Bills, promotions, all payments, cash | Customer, Reservation, VeterinarianServices, fake payment provider |

Services communicate through their published interfaces, never shared store access.
Resolve the mapping from existing pets/owners/visits before changing current APIs.
Keep the fake payment implementation outside any deleted service and independently
inspect its requests and invocation counts.

## Architecture decisions for a language-neutral demo

| ID | Decision |
| --- | --- |
| A-01 | One repository with separate projects: `services/customer/`, `services/reservation/`, `services/veterinarian-services/`, `services/checkout/`, `frontend/`, and `spec/` (features, contracts, tests, harness, payment fake, telemetry collector). Each service has its own dependency file and builds, starts, and is deleted independently. |
| A-02 | Language-neutral runtime contract: every service starts with `services/<name>/start`, reads configuration only from environment variables (port, dependency URLs, `CLINIC_NOW`, telemetry endpoint), and exposes a health endpoint and a test-only reset endpoint. Static ports: frontend 3000, Customer 4001, Reservation 4002, VeterinarianServices 4003, Checkout 4004, payment fake 4010, OTLP collector 4318. A port-freeing script clears a port before a service starts or is rebuilt. Full contract: `spec/contracts/runtime-contract.md`. |
| A-03 | Tests are black-box: they reach services only over HTTP, validate responses against the published schemas, and never import application code. Telemetry is exported over OTLP to a test collector so OBS rules work in any language. |
| A-04 | The frontend is its own plain HTML/JS project. It calls services only through their published APIs and uses accessible labels for Playwright. |
| A-11 | FE-01 uses vanilla JavaScript, a fixed desktop viewport, and a small headless Chromium suite. Preserve branding, layout, wording, and interactions across reconstruction with a small reviewed visual tolerance. Retain approved CSS, local fonts/images, design instructions, tests, and visual baselines under `spec/frontend/` and `spec/tests/browser/`; regenerate frontend application code. The separate frontend experiment follows the Checkout experiment (DEMO-04). |
| A-05 | Final demo: all services built in JavaScript; Checkout rebuilt live in Python against unchanged tests; Playwright and performance rerun. A whole-backend Python rebuild is a recorded stretch. |
| A-06 | Minimum performance test: key endpoints stay under a p95 latency budget (proposed 200 ms) at a small concurrent load (proposed 10 users for 30 s) with zero errors. Same thresholds for every language. |
| A-07 | Protection of `spec/**`, `docs/specs/**`, `.github/**`, `.claude/**`, `AGENTS.md` (humans edit, agents read; build-phase tasks never touch them): `.claude/settings.json` deny rules plus a PreToolUse hook (edit tools and shell), `CODEOWNERS`, and a required `guard` workflow that checks the human-frozen `spec/protected.sha256` manifest and rejects skipped or focused tests. |
| A-08 | Observability follows OpenTelemetry specifications. Each service uses the official OpenTelemetry SDK for its language (allowed dependency), exports over OTLP, propagates W3C Trace Context, sets standard resource attributes (`service.name`, `service.version`), and uses OpenTelemetry semantic conventions (reference v1.44.0, stable HTTP subset enforced; OBS-041, OBS-042) for HTTP spans and errors. Only business-specific attributes use the `petclinic.*` namespace. |
| A-09 | Simple local authentication, no cloud dependency. Users are defined in `spec/seed-data/users.json` with plain-text demo passwords (clearly non-production). The Customer service exposes login and returns a JWT signed with HS256 (shared demo secret in an environment variable), lasting 8 hours of clinic time. Every service verifies tokens locally, so no service calls another to authenticate. Roles: `veterinarian` sees all data; `customer` sees only their own records (others return 404); `service` tokens, signed by the calling service, are the only way to call internal operations. Full rules: `spec/contracts/auth-contract.md`. |

| A-10 | Traces are exported only as OTLP/HTTP **protobuf** (`OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf`), in every language. It is the one format both the Node and Python SDKs support, so a single standard applies to any rebuild. The test collector (`spec/harness/collector`, port 4318) accepts only protobuf and rejects anything else with 415; RT-008 fails a service that exports the wrong format. JSON and gRPC are not used; traces only (no metrics or logs). Tests shorten batching with `OTEL_BSP_SCHEDULE_DELAY=100` and wait up to 5 seconds for spans. A terminal trace-tree printer (`npm --prefix spec run trace`) shows traces in the demo. |

These architecture tasks (ARCH-01..04, OTEL-01, AUTH-01, GUARD-01) take priority over designing the
per-service API contracts (SPEC-04), because the contracts and tests must follow them.

## Five-week schedule and exit criteria

| Week | Focus and backlog links | Deliverables | Exit criteria |
| --- | --- | --- | --- |
| 1 | Business decisions and initial specification set: SPEC-01, SPEC-02, SPEC-03 | Decision record; per-service and workflow features; service/payment API contracts; reviewed telemetry obligations and coverage links; cancellation edge-case decisions | Core workflow semantics are explicit, specification layers agree, and the user has reviewed them; unresolved stretch behavior is labeled |
| 2 | Architecture, protection, and protected tests: ARCH-01..04, GUARD-01, SPEC-04, TEST-01 | Repository layout and runtime contract; black-box harness and OTLP collector; test protection; per-service API contracts; service harness and payment fake; service and schema contract tests; access-control and telemetry checks; recorded red baseline and green/mutation rehearsal | Service tests fail on creation for identifiable missing behavior; tests are frozen/hashed so the agent cannot modify them; 310 TEST-01 slice checks pass against temporary services and deliberate defects are caught |
| 3 | Service implementation: IMPL-02, FE-01, PERF-01 | All four services in JavaScript; plain HTML/JS frontend; minimum performance test; success, decline, retries, and rejection paths; completed OBS mappings | All agreed core BDD, API, and observability suites pass against real local services; no weakened assertions; clean startup/reset/teardown |
| 4 | Reconstruction experiments: DEMO-01, DEMO-03, EXP-01 | Isolated experiment workspace; exact deletion manifest; fixed prompt; at least three fresh Checkout reconstructions in Python; evidence log; optional two-service attempt | Each run has recorded timing, interventions, failures, and independent evaluation; decide live feasibility against the agreed time budget |
| 5 | Presentation and reliability: DEMO-02 | Final walkthrough and narrative; known-good checkpoint; bounded reset procedure; representative recording; final rehearsal results | Core scope frozen; three consecutive Checkout rehearsals meet the demo gate below, or presentation switches to a disclosed recorded reconstruction |

These are focus periods, not a large handoff between specification and development
teams. Week 1 establishes the small core set; discoveries later require explicit
specification updates before dependent implementation. Do not defer ambiguous
payment semantics to the coding agent.

## Minimum acceptance portfolio

The following are scenario targets, not yet approved response schemas or business
policies. SPEC-01 resolves semantics and SPEC-02 makes them executable requirements.

| Capability | Required behavior to specify and verify | Independent evidence |
| --- | --- | --- |
| Customer eligibility | Eligible, ineligible, and unknown customer | State/outcome assertions, API response, OBS-012 |
| Reservation | Eligible customer can hold an available appointment; conflicts do not overwrite another reservation | Service feature, API/state assertions, OBS-013 |
| Checkout success | Agreed payment operation succeeds and the held reservation is confirmed | Browser workflow, payment request/count, reservation state, OBS-014–OBS-017 |
| Payment decline | Visible rejection and no confirmation; hold disposition explicitly defined | Workflow and state assertions, payment outcome, OBS-018 |
| Checkout replay | Same valid request/key returns the agreed outcome without another payment or confirmation | Sequential and concurrent tests, fake invocation counts, OBS-019 |
| Unknown reservation | Agreed error and no payment attempt | API/business assertions plus reviewed failure telemetry |
| Conflicting key reuse | Same key with different input yields the agreed rejection and no extra payment | API/state assertions and reviewed rejection telemetry |
| Trace propagation | Correct trace/parent relationships and isolation across real service processes | Shared trace capture, OBS-002, OBS-017, OBS-022 |
| Privacy and failure handling | No forbidden data; spans end with honest outcomes; export failure does not change business results | Captured attributes/events and fault injection, OBS-003–OBS-008, OBS-020–OBS-021 as reviewed |

Do not implement every proposed OBS outcome merely because it appears in a draft
table. Review the required subset and mark deferred obligations explicitly. Logs
and metrics remain conditional. A trace alone cannot prove business state or
exactly-once payment behavior; assert the state and payment calls separately.

## Decisions required before implementation

SPEC-01 must settle ownership of price/currency and payment authorization versus
charge, reservation lifecycle/expiry, decline behavior, and idempotency scope,
retention, replay, and concurrency. Also settle unknown reservation and conflicting
key responses, timeout behavior, and preservation of the original visit workflow.

Payment-success/confirmation-failure must have an honest observable outcome even
if automated recovery is excluded. Never imply confirmed booking or declined
payment when the actual outcome is incomplete or unknown. Advanced retries/refunds
are stretch scope after the core milestone.

## Reconstruction experiment protocol

1. Establish a known-good checkpoint: all required suites green, browser workflow
   demonstrated, and OBS coverage accurately recorded. Keep recovery files outside
   the experiment workspace. Do not alter the original `1.0` tag.
2. Prepare a reviewed manifest of Checkout application files, including adapters
   or generated copies that contain its logic. Retain only explicit service launch
   conventions; do not conceal Checkout behavior in shared helpers or fixtures.
3. Create a fresh workspace and fresh agent context with the service implementation
   removed. Exclude Git history containing the solution, compiled artifacts, old
   source copies, and conversations containing that implementation. Record exactly
   what specifications, scaffolding, dependencies, and surviving services are provided.
4. Freeze and hash the retained tests/specifications and fixed reconstruction prompt.
   Use independently authored evaluation cases exercising published requirements;
   do not introduce undisclosed business rules as surprise acceptance criteria.
5. Show the missing service and failing checks, then ask the agent to rebuild it.
   Capture wall-clock time, commands, test iterations, model/settings as reported
   by the tool or operator, and every human intervention. Never invent unavailable data.
6. Run all three verification layers and the independent cases. Check retained
   artifact hashes and service diffs, inspect the browser, and capture a trace.
   Report regressions or infrastructure failures separately from missing behavior.
7. Repeat from clean state at least three times, including unsuccessful runs in
   the result record. A successful repair in an implementation-aware conversation
   is useful development evidence but is not a fresh reconstruction experiment.

No deletion is performed as part of adopting this plan. Future deletion applies
only to the agreed disposable experiment workspace and explicit manifest.

### What the experiment can establish

Track time to green, completed versus attempted runs, specification corrections,
human interventions, forbidden test/spec changes, independent-check failures, and
review findings. Preserve run commands and artifacts, not just a success percentage.

This can demonstrate feasibility and repeatability for the example. It cannot by
itself prove that BDD causes better AI results. If time permits, compare fresh runs
using prose requirements with runs using the full executable specification set,
holding service scope, environment, evaluation suite, model/settings, and time
budget constant. Report the small sample and differing inputs; do not claim a
controlled industry-wide result or that such a comparison isolates BDD alone.

### Run record template

```text
Run ID / date:
Deleted service(s) and manifest:
Starting checkpoint / retained artifact hashes:
Provided context and prompt:
Agent model/settings (if known):
Environment and dependency versions:
Time budget / elapsed time:
Test iterations and suite results:
Human interventions / specification corrections:
Independent evaluation and diff review:
ENG-01 review record, code-check commands/results, findings and dispositions:
Evidence paths:
Outcome and next action:
```

## Live-demo gate and fallback

The presenter sets the live reconstruction time budget before Week 4. Proceed live
only after three consecutive clean Checkout rehearsals meet that budget, pass all
required checks, preserve frozen expectations, and need no unplanned human code
repair. Disclose any prepared scaffolding and rehearsed prompt.

Each rehearsal must also pass
[ENG-01](BACKLOG.md#eng-01--review-implementation-quality-across-the-language-swap):
inspect the complete diff and connected trace, run the language-appropriate code
checks, and resolve payment-safety and service-boundary findings. Retain a review
record for the JavaScript baseline and each Python reconstruction. This is a
demo-readiness gate, not a production-readiness claim.

Suggested sequence: explain one business scenario, show its API and OBS obligations,
show the working workflow, remove Checkout in the disposable workspace, show red
checks, reconstruct, then show green checks, browser outcome, and connected trace.

If time expires, preserve the result as an incomplete run and switch to a clearly
labeled recording or separate known-good workspace. Do not present restored code
as an agent-generated success. Reinstalling dependencies and debugging the venue's
network should not consume the demonstration: preinstall runtime/browser assets
and have an offline recording available; live agent access may still require network.

Only attempt two-service reconstruction after the one-service gate is met. Preserve
Customer, the payment fake, independent tests, and published interfaces. Evaluate
Reservation and Checkout separately as well as together, so matching errors cannot
pass solely through mutual agreement. Prefer a recorded result if timing is unstable.

## Risks and scope decisions

| Risk | Response |
| --- | --- |
| Specifications omit important behavior | Review concrete counterexamples and use independent evaluation cases |
| Agent changes tests or recalls deleted code | Frozen hashes, diff review, clean context, isolated source snapshot |
| Slow/flaky browser tests obscure business logic | Small browser workflow set; detailed checks at service/API level |
| Two services share the same wrong assumption | Provider/consumer contract assertions and independently verified state |
| Telemetry looks correct while behavior is wrong | Pair trace checks with API, state, and payment call-count checks |
| In-memory state is mistaken for production resilience | Explain restart data/idempotency loss; exclude durability claims |
| Five-week scope grows | Drop two-service and recovery stretch work first; retain core correctness |
| Reconstruction is too slow live | Use rehearsal gate and a disclosed recording; report actual timings |
| Language swap exposes hidden JavaScript assumptions in tests | Black-box HTTP tests only (A-03); exact specs for money format, time zone, IDs; rehearse the Python rebuild early |
| Python environment fails at the venue | Preinstall runtime and dependencies; pin versions; keep a recording |
| Performance results vary by machine | Modest thresholds; same machine for both runs; report actual numbers |

## Immediate next action

TEST-01 is complete at tag `test-01`; SPEC-05 and TEST-02 are reviewed and frozen.
IMPL-02 and the JavaScript
[ENG-01](BACKLOG.md#eng-01--review-implementation-quality-across-the-language-swap)
review pass at checkpoint `impl-02`. FE-01 is verified at checkpoint `fe-01`;
approved design assets and browser/visual expectations remain frozen. Define and
approve PERF-01 thresholds and executable performance checks next, then proceed
to reconstruction rehearsals. Repeat ENG-01 for every reconstruction.
Still needed from the presenter are the talk date, session length, and
live rebuild time budget; those choices become relevant before DEMO-01.
