# Product and demonstration backlog

Task status lives here; the plan, decisions, and milestones live in
[PROJECT-PLAN.md](PROJECT-PLAN.md). Follow [the development workflow](docs/development-workflow.md)
for every item. Finished items keep their full history in
[docs/history/backlog-completed.md](docs/history/backlog-completed.md).

## Purpose and agreed direction

Demonstrate that business behavior (BDD), service/API contracts, and observability
contracts can guide an agent to implement, reconstruct, and extend software.
Passing checks establish the specified behavior, not complete enterprise
correctness or identical source code.

- Preserve Git tag `1.0` (commit `897c9e4`) as the original baseline.
- Keep storage in memory. Restart recovery and durable transactions are out of scope.
- Four services (Customer, Reservation, VeterinarianServices, Checkout) in one
  repository, running as separate local processes communicating over HTTP.
- Deterministic fake payment provider; no real charges or payment credentials.
- Specify contracts, observability rules, and BDD features before implementation;
  the human reviews and freezes; then build against the frozen checks.
- No implementation is authorized merely by adding an item here.

## Key dates

| Date | Event |
| --- | --- |
| 2026-10-14 | Excella leadership visit, DC (PLAY-01, MVP-02A) |
| 2026-11-07 | Black Tech NOLA workshop, one hour |
| 2026-11-13 | NOAI talk, one hour |

## Now

### DEMO-01 — Rehearse deletion and reconstruction

Status: **evidence accepted (2026-10-03, A-14)**. Checkpoint tag
`demo-01-baseline`. Tools, prompts, and the visible journey are in
[tools/demo](tools/demo/README.md). Agent: Claude Code in a fresh session;
disposable workspace with no prior Checkout history; prepared prompt (reading
the shared JavaScript runtime is allowed and disclosed).

| Run | Direction | Rebuild time | Result | Interventions | Record |
| --- | --- | ---: | --- | ---: | --- |
| r1 (2026-09-28) | JavaScript → Python | 25m 49s (agent) | 10/10 suites + visible journey; verification 9m28s | 0 | [r1](docs/rehearsals/r1.md) |
| r2 (2026-09-29) | Python → JavaScript | ≤32m23s | 10/10 suites + visible journey; verification 8m13s | 0 | [r2](docs/rehearsals/r2.md) |
| r3 | JavaScript → Python (optional recorded fallback) | — | not started | — | — |

Live gate (A-12), revised by A-14 (2026-10-03): r1 and r2 — zero interventions,
both language directions — are sufficient evidence the reconstruction claim
holds. r3's screen recording is no longer a blocking milestone; it's an
optional fallback recording (expected under an hour), done whenever before the
talks. Watch for r1's unreproduced startup hang if/when r3 runs. On stage use
`finish-rehearsal.sh --journey-only`.

### SPEC-06 — Close Checkout specification gaps found in rehearsal

Status: **JavaScript fixes verified: D-58–D-65 accepted; specifications frozen; all ten `npm test` suites pass.** D-66 was already decided and frozen separately. Phase: build verification. See [SPEC-06 handoff](docs/handoffs/spec-06.md) for gap-to-test coverage, verification and remaining implementation work. Next: independent engineering review and a fresh Python reconstruction against the updated specs. Sources: [rehearsal r1](docs/rehearsals/r1.md),
[rehearsal r2](docs/rehearsals/r2.md). MVP-02A shipped first, so SPEC-06 now
runs its own review-and-freeze cycle. r3 (DEMO-01) should run against the
specs it produces.

The rebuilds passed every test but reported behavior the contracts leave silent or
inconsistent. For each gap: decide the intended behavior, then add or amend the
contract, OBS rule, and scenario so a test pins it down.

| Gap | Question to decide | Likely artifacts |
| --- | --- | --- |
| GAP-08 | (Carried over from MVP-02A.) Promotion and cash return 403 `not_assigned_veterinarian`, but OBS-030/033's closed outcome lists don't include it, so the trace tests can't assert it. Add it? | OBS-030/033 outcome lists; trace tests |
| GAP-09 | What does promotion/cash return when Reservation cannot record completion (502 `dependency_failed`)? | `checkout.openapi.json` responses; scenario |
| GAP-10 | Is there an internal-error problem code, or is 500 `dependency_failed` intended? | common problem codes; runtime/contract note |
| GAP-11 | Confirm the agents' guesses: $0 bill completes as settled; booking fee excluded from `paymentAttempts` but counted in `previouslyPaidAmount` (r1 Python and r2 JavaScript chose this independently); same-key retry after payment returns current state plus original attempt | business decision entry; scenarios |
| GAP-12 | Idempotency key scopes (r2): booking fee keyed per reservation; card and cash keyed per checkout. Is reusing one key across booking and visit payment, or across card and cash, two separate requests or a conflict? | D-12 clarification; scenarios for cross-scope key reuse |
| GAP-13 | Card approved but follow-up fails: the same-key retry returns the same 502 `authorized_completion_failed` without re-charging or retrying the follow-up. Covered only by unprotected engineering checks today; should a frozen scenario pin it? | scenario; possibly OBS rule |
| GAP-14 | Completion and account-change repeats (r2): Checkout skips re-sending an identical completion and treats Reservation `already_completed` / Customer `already_applied` as success. Intended? | contract note; scenarios with downstream "already done" replies |
| GAP-15 | A $0 promotion is stored but sends no discount to Customer (r2). Intended, and should it appear in the bill and trace? | scenario; OBS-030 attribute note |

Done when: decisions recorded, protected changes human-reviewed and frozen, the
JavaScript Checkout updated so `npm test` passes, and one fresh Python rehearsal
passes against the new specs (earlier rehearsal evidence predates them).

## Handled offline by Dustin

Not tracked here (2026-10-05): **DEMO-02** (the speaking outline,
[talk notes](docs/talk-notes.md)) and **PLAY-01** (the Excella playbook package,
due 2026-10-13). Evidence they draw on lives in `docs/engineering-reviews/` and
`docs/rehearsals/`.

## Next — before the talks (2026-11-07)

### EXP-01 — Measure service reconstruction

Status: in progress through DEMO-01 records. Follow the experiment protocol and
run-record template in `PROJECT-PLAN.md`: at least three fresh Checkout
reconstructions with frozen expectations, no access to deleted source/history,
recorded failures, timings, interventions, and specification changes. Apply ENG-02
to each; keep code-review findings separate from behavioral results. Two-service
reconstruction and a prose-versus-executable comparison are stretch experiments.

### DEMO-03 — Language swap demonstration

Status: planned. Decisions A-05, A-12. The on-stage flow:

- Run the FE-002 journey visibly (`npm run demo:journey`) on the all-JavaScript build
  (login → book → vet accepts/records visit → bill → pay; no sign-up screen).
- Timed delete of `services/checkout/`; the agent rebuilds it in Python from the
  unchanged specs and tests while the presenter talks.
- Rerun the visible journey (`finish-rehearsal.sh --journey-only`); show the agent's
  `npm test` summary, the elapsed time, and the connected trace.
- Fallback: the recorded r3 rehearsal. Stretch (recorded): whole backend in Python.

## Open follow-ups on completed work

- **GUARD-01 remote:** configure and verify the GitHub branch ruleset (PR required,
  guard check required, code-owner review) and confirm the CODEOWNERS username.
- **SPEC-03 coverage:** ENG-02's observability rule audit (2026-10-05, see
  `docs/engineering-reviews/eng-02-observability-audit.md`) reviewed privacy,
  exporter failure/lifecycle, eligibility tracing, and the broader
  fault/concurrency OBS rules against the actual code (not just "untested").
  Most are followed by construction; two concrete gaps remain, not yet fixed:
  - **OBS-008 production exporter-crash risk:** a dependency/collector
    failure during span export can surface as an uncaught exception that
    crashes the whole service; the only existing mitigation is scoped to
    `PETCLINIC_TEST_ENDPOINTS=enabled` (test harness only — see
    `services/platform/runtime.js:117-133`). Needs a real fix before this is
    called production-ready telemetry.
  - ~~OBS-046/047/048 had no dedicated test.~~ **Closed 2026-10-05**
    (`d8db757` red, `5e6f51d` green).
- **From ENG-02 calibration (2026-10-05), spec additions (protected, Dustin's call):**
  - AUTH-005 case: forge a `role: "service"` token with a bad signature
    against each internal operation (would have caught CAL-03 at L0).
  - Runtime/auth case: a non-UUID path ID returns 404 with no downstream
    call, so a rebuild can't reintroduce THREAT-04 (PRE-02).
- **From ENG-02 calibration, low-priority code items:** REV-017 (the `roles`
  claim accepts `"service"`) and REV-018 (`dependency()` passes downstream 4xx
  codes through to callers).
- **Post-November candidate:** open the business span before schema
  validation, so every rejected attempt gets one (full OBS-003). Deferred
  2026-10-05 in favour of dropping the unreachable `validation_error` from
  OBS-046/047.
- **Test-run hygiene:** the full auth suite (~10 min) wasn't being run, which
  hid a two-week-old AUTH-006 failure. Run the whole `npm test` before
  declaring any item done.

## Done

Full history: [docs/history/backlog-completed.md](docs/history/backlog-completed.md).

| Item | Result | Checkpoint |
| --- | --- | --- |
| [SPEC-01](docs/history/backlog-completed.md#spec-01--agree-service-boundaries-and-business-decisions) | Service boundaries; decisions D-01–D-38 ([record](docs/specs/business-decisions.md)) | `spec-schema-complete` |
| [SPEC-02](docs/history/backlog-completed.md#spec-02--publish-the-three-specification-layers) | Domain model, schemas, service features | `spec-schema-complete` |
| [SPEC-03](docs/history/backlog-completed.md#spec-03--trace-observability-rules-to-executable-tests) | OBS registry and coverage table (gaps above) | `test-01` |
| [ARCH-01](docs/history/backlog-completed.md#arch-01--repository-layout-with-separate-projects) | Repository layout, separate projects | `arch` |
| [ARCH-02](docs/history/backlog-completed.md#arch-02--language-neutral-runtime-contract) | Language-neutral runtime contract | `arch-02` |
| [ARCH-03](docs/history/backlog-completed.md#arch-03--black-box-test-harness) | Black-box harness, payment fake | `arch-03` |
| [ARCH-04](docs/history/backlog-completed.md#arch-04--cross-process-telemetry-capture) | OTLP test collector, trace helpers | `arch-04` |
| [OTEL-01](docs/history/backlog-completed.md#otel-01--opentelemetry-specification-conformance) | Semantic conventions OBS-041/042 | `otel-01` |
| [AUTH-01](docs/history/backlog-completed.md#auth-01--simple-local-authentication-and-data-access) | Local JWT auth and access rules | `auth-01` |
| [GUARD-01](docs/history/backlog-completed.md#guard-01--protect-specs-and-tests-from-agent-modification) | Local spec/test protection (remote follow-up above) | `guard-01` |
| [SPEC-04](docs/history/backlog-completed.md#spec-04--per-service-api-contracts) | Per-service API contracts | `spec-04` |
| [TEST-01](docs/history/backlog-completed.md#test-01--service-level-executable-tests-all-red) | Service-level executable tests, mutation-rehearsed | `test-01` |
| [SPEC-05](docs/history/backlog-completed.md#spec-05--revise-the-november-mvp-domain-and-contracts) | November MVP revisions (registration, partial payments) | `spec-05-test-02-frozen` |
| [TEST-02](docs/history/backlog-completed.md#test-02--cross-service-workflow-specifications-and-api-tests) | Nine cross-service backend journeys | `spec-05-test-02-frozen` |
| [IMPL-02](docs/history/backlog-completed.md#impl-02--build-the-four-service-checkout-workflow) | Four JavaScript services ([handoff](docs/handoffs/impl-02.md)) | `impl-02` |
| [ENG-01](docs/history/backlog-completed.md#eng-01--review-implementation-quality-across-the-language-swap) | JavaScript self-review ([record](docs/engineering-reviews/impl-02-javascript.md)); superseded by ENG-02 | `impl-02` |
| [FE-01](docs/history/backlog-completed.md#fe-01--frontend-project) | Frontend, five browser checks ([handoff](docs/handoffs/fe-01.md)) | `fe-01` |
| [PERF-01](docs/history/backlog-completed.md#perf-01--minimum-performance-test) | Local performance test ([handoff](docs/handoffs/perf-01.md)) | `perf-01` |
| [SEC-01](docs/history/backlog-completed.md#sec-01--security-spike-calibrate-automated-gates-against-ai-generated-code) | Security spike; rules later hardened ([record](docs/engineering-reviews/sec-01-spike.md)) | `52252a6` |
| [MVP-02A](docs/history/backlog-completed.md#mvp-02a--administrator-role-and-veterinarian-roster) | Administrator role, roster, reassignment, admin UI | `162e29d` |
| [ENG-02](docs/history/backlog-completed.md#eng-02--independent-calibrated-engineering-review) | Independent calibrated review; reviewer 13/13 ([record](docs/engineering-reviews/eng-02-calibration-2026-10-05.md)) | `e6e169f` |
| [IMPL-01](docs/history/backlog-completed.md#impl-01--legacy-visit-cancellation-retired) | Retired by D-24 | `1.0` |

## Deferred

### MVP-02 — Clinic growth and administration

Status: deferred except the MVP-02A slice; possible 2027 workshop. Office capacity,
reassigning other veterinarians' appointments, departure policies for future
appointments and historical records, and payments allocated across multiple visits.

### DEMO-04 — Reconstruct the frontend from retained design assets

Status: planned after DEMO-03. In an isolated workspace, keep the protected design
instructions, CSS, fonts/license, logo, browser tests, and visual baselines plus the
backend; delete only `frontend/` application code via a reviewed manifest; exclude
prior frontend source/history and the static design preview; rebuild in vanilla
JavaScript. Require the frozen appearance tolerance, identical text/interactions,
and ENG-02. Record time, interventions, failures, and retained scaffolding.

### CI-01 — Wire SEC-01's security gates into CI/CD on push to main

Status: deferred until after the November talks (2026-11-07, 2026-11-13).
Confirmed 2026-10-04: no `.github/workflows/` directory exists at all, so
none of SEC-01's scanners (Semgrep, Bandit, `npm audit`, `pip-audit`,
detect-secrets) run automatically today — they only run locally via
`tools/security/run-sec01-spike.sh` / `tools/security/portable/run-*.sh`.
Nothing currently stops an insecure change from reaching `main` through a
normal push or merge. Related open gap: the "GUARD-01 remote" follow-up
(branch ruleset: PR required, guard check required, code-owner review) is
also still unconfigured — this item should close both at once rather than
wiring security scanning into CI without branch protection to enforce it.

Why this order: per the A-13 CI/CD placement framework, these checks belong
in the agent's local loop *and* as a required remote gate, not one or the
other — local catches issues before commit, CI catches anything that
slipped through or came from a push outside the usual agent loop. Placed
after the November MVP (DEMO-01/02/03, MVP-02A, PLAY-01) so it doesn't
compete with talk-prep time, and explicitly before any database/persistence
work ([DATA-01](#data-01--personal-historical-data-and-archival-learning-demo))
so that work lands on a repo that already enforces its security floor,
rather than retrofitting the gate after data-handling code exists.

Scope (sketch, to be specced properly when picked up):

- `.github/workflows/security.yml` (or equivalent) running
  `portable/run-sast.sh`, `portable/run-secret-scan.sh`,
  `portable/run-dependency-audit.sh` on every push/PR to `main`; add Bandit
  for Python once its `.venv`/vendor exclusion (flagged in the SEC-01
  write-up) is fixed, so CI doesn't choke on noise.
- Configure the branch ruleset: PR required, the guard check (`guard:check`)
  required, code-owner review required (closes "GUARD-01 remote").
- Pre-push git hook running `npm run test:verify` (PERF-03): blocks a push
  unless every full-tier suite passed on the exact tree being pushed. Pre-push,
  not pre-commit, so red checkpoint commits stay allowed. Decide how the hook
  is installed (`core.hooksPath` vs a setup script) and whether `--no-verify`
  is acceptable when CI is the backstop.
- Promote the "Full test suite (informational)" job in `guard.yml` to a
  required check running `npm test` (full tier, no cache); upload
  `test-results/runs/` as the run-record artifact.
- Decide fail-vs-warn per check to start (SEC-01's 62.5% catch rate argues
  for treating these as a floor, not a perfect gate, at least initially).
- `.github/` is CODEOWNERS-protected — any workflow file change here needs
  human review and a `guard:freeze` run before merge, same as other
  protected paths.

### DATA-01 — Personal historical-data and archival learning demo

Status: deferred until explicitly requested. Pet removal, historical-data
preservation, governance, archival, retrieval, and reporting as a separate learning
exercise with deeper architecture. Nothing for it belongs in the November demo.

### ARCH-05 — Evaluate Docker Compose isolation

Status: deferred until after the November talks. Evaluate Compose for the services,
collector, and payment fake: startup/shutdown, health checks, isolated networks,
port ownership, reproducibility, and safer human control over AI-driven process
management. No Docker files before an explicit review.

### Optional feature candidates

- Reschedule appointments: preserve ID, reject date conflicts, record success/conflict.
- Filter upcoming visits: define date range boundaries, ordering, and query outcomes.
- Complete visits: define allowed transitions and trace previous/new states.
- Recover payment-success/confirmation-failure cases using an agreed retry or refund policy.

## Definition of done for implementation

Reviewed requirements are implemented without weakening their checks; all BDD,
contract, and observability suites pass; the browser workflow works; trace evidence
is captured; ENG-02 passes; known in-memory limitations are documented.
Documentation of a proposed feature or an intentionally failing baseline does not
mean that feature is complete.
