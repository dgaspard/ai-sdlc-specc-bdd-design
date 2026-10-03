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

### DEMO-02 — Speaking outline for the presentation

Status: in progress (promoted to Now 2026-10-03, A-14). Working draft:
[talk notes](docs/talk-notes.md). Reprioritized ahead of DEMO-01's r3
recording: r1 + r2 are accepted as sufficient rehearsal evidence, so the
presentation outline needs to exist and be rehearsed before further
rehearsal reps would add marginal value.

Explicitly a talking-point outline, not a word-for-word script — three parts:
the problem (statistics and an opening anecdote, still to be picked), the
process used to build the application (pipeline, architecture decisions, the
pivots, protection, folder structure), and findings and recommendations
(what's next, the platform-services argument, repeatable review, the
adoption checklist). Rough timing budget included against the one-hour slot,
accounting for the live rebuild wait as part of the process section, not dead
air.

Done when: outline covers all three parts with the opening anecdote chosen,
and at least one full read-through has been timed against the one-hour
budget. Depends on DEMO-01 and EXP-01 evidence (already sufficient per A-14).
Freeze core scope the week before 2026-11-07; fold in r3 if it's recorded by
then.

### ENG-02 — Independent, calibrated engineering review

Status: planned (2026-09-29). Build in parallel with DEMO-01; run before MVP-02A.
Phase: review tooling (unprotected `tools/review/`), then apply. Supersedes
[ENG-01](docs/history/backlog-completed.md#eng-01--review-implementation-quality-across-the-language-swap)'s
self-review as the demo-readiness and playbook gate, reusing its checklist.

Why: ENG-01 was written by the same agent that built the code, largely as a
narrative checklist, and was never tested. The Python rebuild (r1) has no review.
Passing tests say nothing about behavior the tests don't cover.

**Target architecture (2026-10-03 design decision):** build the reference
implementation in this repo now (there is no Excella platform team yet to own a
shared version), but author it as a liftable, versioned unit from day one, split
by portability — the same split that cut the auth-suite redundancy, applied to
*review* instead of tests:

- **Portable (candidate for a future org-level, centrally curated GitHub Actions
  check, run from every repo's CI, not forked and maintained per repo):**
  duplicate-code detection, security scanning (Semgrep/Bandit/secret scan),
  dependency audit, the import-boundary check's *engine*, the independent-reviewer
  *process* (fresh session, checklist-driven, cite file/line, human sign-off), and
  the calibration *methodology* (plant defects, measure catch rate). A generic
  defect like "non-constant-time secret comparison" is reusable across any
  project's auth check; it doesn't belong reinvented, or worse not invented, per repo.
- **Project-specific (stays in this repo, frozen like everything else):** the
  import-boundary *rules* (which folders map to which service), the observability
  rule audit (petclinic's own OBS registry), service-boundary/payment-safety
  checklist content, the threat-model note, and which defects get planted for
  calibration (though the defect *types* can seed a shared library).

**Long term:** `/harness` (and `tools/review/`) in each repo narrows to (a) the
project's own frozen contract/business checks, (b) a declared "already covered
here" manifest so the central service doesn't re-check what a repo already proves,
and (c) a feed of new recurring findings upward. A platform/security team curates
the central library and promotes a repo-level finding into it once it recurs
across multiple projects and has its own calibration case — the same reification
discipline this project already uses for specs (a gap an agent surfaces doesn't
matter until it's written into a frozen, re-checkable artifact). A shared,
mandatory check also needs its own versioning/rollout discipline (semantic
versions, staged rollout, a pin-and-upgrade path) and clear ownership, since a bad
update now breaks every consuming repo's CI at once — a GUARD-01 for the org.
This long-term piece is a design note for the playbook, not built here.

1. **Automated gates (tool-judged, same for every language):**
   - Duplicate-code detection across services (e.g. jscpd, which reads JS and Python).
   - Import-boundary check: no service imports another service's code or a store;
     shared infrastructure (`services/platform/`) is allowed and listed. Replaces
     `tools/ownership.test.mjs`; the other `tools/*.test.mjs` checks move to `tools/review/`.
   - Security scanning: Semgrep (both languages) plus Bandit for Python; secret scan.
   - Dependency audit: `npm audit` and `pip-audit`.
   - Connected-trace capture (`npm run trace:payment`) against every build,
     including Python.
2. **Observability rule audit:** list every OBS rule without a test and have the
   reviewer check each against the code, recording followed / not followed / N/A.
3. **Independent reviewer agent:** a fresh session that never saw the build,
   driven by a written checklist prompt (`tools/review/review-prompt.md`) covering
   service boundaries, payment safety, inter-service auth (including hand-written
   token signing/verification), privacy in telemetry and errors, and structure.
   Every finding cites file and line. A human signs off security and boundary findings.
4. **Threat-model note:** record known architectural risks, starting with the single
   shared HS256 secret (any compromised service can forge user tokens); disclose
   as a demo limitation.
5. **Calibration:** a set of planted defects applied to a scratch copy (copied
   business logic across services, payment reference leaked into a span, token
   check that skips signature or uses non-constant-time compare, cross-service
   store access, missing OBS attribute on an untested rule). The review passes
   calibration when it catches every planted defect; record the catch rate.

Apply to: the JavaScript baseline (`impl-02`), r1 Python, r2 JavaScript, r3 Python.
Record under `docs/engineering-reviews/` with gate output, findings, sign-off, and
calibration score. Feeds PLAY-01.

### SEC-01 — Security spike: calibrate automated gates against AI-generated code

Status: **spike package prepared (2026-10-03); execution pending.** Time-boxed
spike (target: 2 days), run in parallel with DEMO-01/ENG-02, before MVP-02A
build. Not a shipped feature — a research exploration whose output is a
written recommendation, feeding ENG-02's security gate and PLAY-01's playbook.

Tooling is ready in `tools/security/` (`run-sec01-spike.sh`,
`calibration-defects.md`, `README.md`) and a fill-in template exists at
`docs/engineering-reviews/sec-01-spike.md`. It has not been executed yet:
Semgrep/Bandit/pip-audit/detect-secrets/`npm audit` all need real network
access to install and query vulnerability databases, which the environment
this was prepared in doesn't have (same restriction as the earlier GitHub
push issue). Run it via Claude Code locally or a normal terminal — see
`tools/security/README.md` for the exact command.

Why now: published benchmarks put LLM-generated code's vulnerability rate at
roughly 9.8–42.1%, and AI-introduced issues surviving in public repos passed
100,000 by February 2026 (see chat log 2026-10-03 for sources). Spec-first reduces
*wrong* behavior; it does not by itself reduce *insecure* behavior — the contracts
and BDD scenarios in this project assert business outcomes, not security
properties, so a correct-and-insecure implementation can pass every frozen test.
ENG-02 currently lists "Semgrep + Bandit + secret scan + dependency audit" as one
line item; this spike finds out whether that's actually sufficient, before it's
load-bearing.

Questions this spike answers:
- Run Semgrep/Bandit/secret-scan/`npm audit`/`pip-audit` against the existing
  JavaScript Checkout (`impl-02`) and the Python rebuild (r1). What do they
  actually flag? Any true positives already present (e.g. the known single shared
  HS256 secret)?
- Calibrate: plant 5–8 realistic AI-introduced vulnerabilities in a scratch copy
  (non-constant-time secret comparison, a secret logged at error level, an
  injection-shaped string concatenation, a dependency with a known CVE, overly
  broad CORS, a path that skips the auth hook). What fraction do the chosen tools
  actually catch? This is the same calibration discipline already used for TEST-01
  and planned for ENG-02, applied specifically to the security tier.
- Where tools miss, decide: add a tool, add a targeted scenario-level check
  (business-observable security properties, e.g. "a declined payment's card
  reference never appears in telemetry," already partly covered), or accept and
  disclose the residual gap.
- Recommendation: a short written practice — which scanners, at what gate, with
  what measured catch rate — specific enough to go in the Excella playbook as
  "the minimum automated security floor for AI-generated service code," distinct
  from ENG-02's broader review (which also covers boundaries, payment safety, and
  structure, not just security-tool output). Classify each finding/tool as
  portable (candidate for ENG-02's future central service) or project-specific,
  per ENG-02's target architecture.

Record under `docs/engineering-reviews/sec-01-spike.md`: tools run, versions,
findings against both real builds, the calibration table (planted defect → caught
y/n → by which tool), and the resulting recommendation. Feeds directly into
ENG-02 item 1 (automated gates) and item 4 (threat-model note).

## Next — before 2026-10-14

### SPEC-06 — Close Checkout specification gaps found in rehearsal

Status: planned. Phase: spec (human review and freeze). Sources:
[rehearsal r1](docs/rehearsals/r1.md), [rehearsal r2](docs/rehearsals/r2.md).
Timing: after DEMO-01, reviewed and frozen together with MVP-02A.

The rebuilds passed every test but reported behavior the contracts leave silent or
inconsistent. For each gap: decide the intended behavior, then add or amend the
contract, OBS rule, and scenario so a test pins it down.

| Gap | Question to decide | Likely artifacts |
| --- | --- | --- |
| GAP-08 | Moved to [MVP-02A](#mvp-02a--administrator-role-and-veterinarian-roster) (veterinarian authorization). | — |
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

### MVP-02A — Administrator role and veterinarian roster

Status: planned (re-prioritized 2026-09-29). Starts after DEMO-01. Phase: spec,
then build. Target: verified by 2026-10-13 for PLAY-01. Purpose: prove the method on
*adding* functionality to a tested system, the common enterprise case.

Scope:

- Administrator role distinct from veterinarian (auth contract, users seed, tokens).
- Admin can add and deactivate veterinarians (new API, domain contract changes).
- Admin can view all appointments; veterinarian privileges narrow to their own work.
- Frontend admin screen with accessible labels and a browser check.
- Fold in [SPEC-06](#spec-06--close-checkout-specification-gaps-found-in-rehearsal)
  (GAP-09–15) in the same spec review and freeze cycle.

Veterinarian and administrator test scenarios to add (found in rehearsals):

| Gap | Question to decide | Likely artifacts |
| --- | --- | --- |
| GAP-08 | A veterinarian who did not perform the visit applies a promotion or records cash and gets 403 `not_assigned_veterinarian`, but that outcome is missing from the OBS-030 / OBS-033 closed outcome lists. Found independently by r1 (Python) and r2 (JavaScript); no test covers it. | OBS-030/OBS-033 outcome lists; observability test; Checkout scenarios |
| GAP-08a | After the role split, may an administrator apply a promotion or record cash on any visit, or only the assigned veterinarian? What outcome is recorded when an admin is refused? | auth contract; Checkout scenarios; OBS outcomes |

Sequence: business decisions (human answers) → contracts, features, OBS rules →
protected tests red → human freeze → JavaScript build → `npm test` green → ENG-02.
Record spec effort, agent time, interventions, and gaps found for PLAY-01.
After it lands, rerun one fresh Python Checkout rehearsal before 2026-11-07.

Out of scope (remain in MVP-02): office capacity, reassigning other veterinarians'
appointments, departure policies for future appointments and history, multi-visit
payments.

### PLAY-01 — Excella playbook package for leadership

Status: planned. Due 2026-10-13. Depends on DEMO-01, ENG-02, and MVP-02A evidence.

- Playbook document: roles (product/QA write features, architects program the
  engineering agent, humans freeze), phase gates, guard, review, metrics, and when
  the method fits or doesn't.
- Evidence: rebuild rehearsal numbers, the MVP-02A feature addition (spec effort,
  agent time, interventions, spec gaps surfaced), and the ENG-02 calibration score.
- Short recorded demo: a few-minute cut of the rebuild and the admin feature.

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

DEMO-02 (the speaking outline) moved to [Now](#demo-02--speaking-outline-for-the-presentation)
on 2026-10-03 (A-14); see there for current status.

## Open follow-ups on completed work

- **GUARD-01 remote:** configure and verify the GitHub branch ruleset (PR required,
  guard check required, code-owner review) and confirm the CODEOWNERS username.
- **SPEC-03 coverage:** privacy, exporter failure/lifecycle, eligibility tracing, and
  broader fault/concurrency OBS rules remain untested; ENG-02's rule audit reviews them.

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
