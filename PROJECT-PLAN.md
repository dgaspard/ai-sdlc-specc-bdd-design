# Five-week project plan: rebuilding a service from executable expectations

> Current business direction: see [SPEC-01 decisions](docs/specs/business-decisions.md).
> The user has specified four services, including VeterinarianServices, and checkout
> after a documented visit. Earlier held/pay-to-confirm targets below are historical
> proposals pending SPEC-02 revision, not approved requirements.

## Objective and scope

Prepare a November presentation demonstrating that reviewed BDD scenarios, API
contracts, and observability contracts can guide an AI agent to recreate a deleted
service that interoperates with existing services.

Primary demonstration: delete and reconstruct Checkout. Stretch experiment: delete
and reconstruct Checkout and Reservation. The evidence supports this bounded example,
not a claim that arbitrary enterprise systems can be reconstructed from tests.

Use five relative weeks starting when this plan is adopted. The exact talk date,
session length, available weekly effort, and live reconstruction time budget remain
to be confirmed. The schedule is a planning target, not a delivery guarantee.

### In scope

- Customer, Reservation, VeterinarianServices, and Checkout as separate local HTTP processes in one repo.
- Independent in-memory stores and a deterministic fake payment boundary.
- A small browser workflow for appointment reservation and checkout.
- Service-owned feature files, separate cross-service workflow feature files,
  published API contracts, and executable telemetry requirements.
- Independent verification, repeatable reconstruction experiments, and demo recovery.
- Preserve tag `1.0`; maintain the existing behavior unless an intentional migration
  is specified and approved. Complete the current cancellation exercise as a small
  first application of the process.

### Outside the initial scope

Persistent databases, durable idempotency, cloud deployment, Kubernetes, message
brokers, real payments, authentication infrastructure, production monitoring, and
automatic refund/reconciliation systems. Their absence must be explicit in the talk.
No new feature beyond the core demonstration is required to prove the hypothesis.

## Current position

The repository contains a single Express application. Patient viewing, scheduling,
and duplicate-date prevention pass their browser scenarios. Cancellation intentionally
fails in BDD, API, and observability checks. The three-service architecture is planned,
not implemented. Workflow documentation, OBS-001–OBS-022, and a coverage table exist;
most telemetry rules remain proposed and untested.

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
| Customer | Identity and booking eligibility | None |
| Reservation | Scheduling, reservation lifecycle, and clinical Visit storage | Customer |
| VeterinarianServices | Veterinary service fees in USD | None |
| Checkout | Visit bills, payment attempts, and payment authorization outcomes | Customer, Reservation, VeterinarianServices, fake payment adapter |

Services communicate through their published interfaces, never shared store access.
Resolve the mapping from existing pets/owners/visits before changing current APIs.
Keep the fake payment implementation outside any deleted service and independently
inspect its requests and invocation counts.

## Five-week schedule and exit criteria

| Week | Focus and backlog links | Deliverables | Exit criteria |
| --- | --- | --- | --- |
| 1 | Business decisions and initial specification set: SPEC-01, SPEC-02, SPEC-03 | Decision record; per-service and workflow features; service/payment API contracts; reviewed telemetry obligations and coverage links; cancellation edge-case decisions | Core workflow semantics are explicit, specification layers agree, and the user has reviewed them; unresolved stretch behavior is labeled |
| 2 | Executable evidence and first complete slice: TEST-01, IMPL-01 | Deterministic service harness and payment fake; real assertions for the core service contracts; distributed trace capture setup; recorded red baseline; cancellation implementation after its checks exist | Cancellation passes all three layers; future capabilities fail for identifiable missing behavior; suite runner reports all suites rather than hiding later results |
| 3 | Service implementation: IMPL-02 | Customer and Reservation, then Checkout; browser integration; success, decline, retries, and rejection paths; completed OBS mappings | All agreed core BDD, API, and observability suites pass against real local services; no weakened assertions; clean startup/reset/teardown |
| 4 | Reconstruction experiments: DEMO-01, EXP-01 | Isolated experiment workspace; exact deletion manifest; fixed prompt; at least three fresh Checkout reconstructions; evidence log; optional two-service attempt | Each run has recorded timing, interventions, failures, and independent evaluation; decide live feasibility against the agreed time budget |
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
Evidence paths:
Outcome and next action:
```

## Live-demo gate and fallback

The presenter sets the live reconstruction time budget before Week 4. Proceed live
only after three consecutive clean Checkout rehearsals meet that budget, pass all
required checks, preserve frozen expectations, and need no unplanned human code
repair. Disclose any prepared scaffolding and rehearsed prompt.

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

## Immediate next action

Start SPEC-01 with a short decision session to settle the core business semantics
and confirm the talk timing. Then draft the bounded core feature files, derive API
contracts, and review their OBS requirements before creating executable checks.
This plan adds no implementation and does not mark any service specification approved.
