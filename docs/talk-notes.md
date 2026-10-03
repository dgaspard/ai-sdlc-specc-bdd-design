# Talk notes (November presentation)

Outline for both talks: Black Tech NOLA workshop (2026-11-07) and NOAI
(2026-11-13), one hour each. Not a specification — this is the narrative,
reusing the specs, backlog, and rehearsal evidence as source material.

> **Status:** working draft for [DEMO-02](../BACKLOG.md#demo-02--prepare-presentation-and-recovery).
> Remaining before the talks: fold in rehearsal r3 once recorded, confirm the
> demo gate (three consecutive clean rehearsals) is met, and time a full
> read-through against the one-hour budget.

## Beginning — problem statements

What's broken about handing an agent a codebase and a prompt, framed before
any repo detail:

1. **The verification tax is real and growing.** AI-generated PRs wait
   roughly 4.6x longer for review (LinearB, 8.1M PRs, DORA 2026). Teams
   aren't bottlenecked on writing code anymore — they're bottlenecked on
   trusting it.
2. **"Looks right" isn't the same as "is right."** LLM-generated code shows
   9.8–42.1% vulnerability rates depending on study and language; AI-created
   PRs show roughly 75% more logic/correctness errors (194 incidents per 100
   PRs) than human-authored ones. This is the "silent wrongness" failure
   mode — code that runs, looks plausible, and is wrong in a way nobody
   catches until production.
3. **This isn't hypothetical.** The March 2026 ~6-hour Amazon.com outage
   (120K lost orders, 1.6M errors) traced back to exactly this pattern. More
   than 100,000 AI-introduced issues were still sitting in public GitHub
   repos as of February 2026.
4. **Most agentic AI pilots don't survive contact with production.** 88% of
   enterprise AI-agent pilots never reach production; Gartner projects 40%+
   of agentic AI projects will be cancelled by 2027. The gap isn't model
   capability — it's the absence of a way to tell good output from
   plausible-looking output before it ships.

**The thesis:** none of this is solved by a better prompt or a smarter model.
It's solved by giving the agent something it cannot talk its way around — a
frozen, independently-checkable definition of correct behavior, written
*before* any code exists, that the agent can read but not edit. Spec-first,
contract-first development isn't a process preference here; it's the
mechanism that makes "an agent wrote this" something you can trust without
reading every line yourself.

**What this talk is not:** not a claim that testing solves security, review
redundancy, or the organizational changes AI-assisted development forces.
Those are explicitly named as open problems and show up again at the end.

## Middle — how it was built

### The pipeline

Business decisions → domain schemas → service features (Gherkin/BDD) → API
contracts (OpenAPI) → observability contracts (OBS rules) → frozen,
protected tests → *then* an agent implements, with nothing upstream of the
tests open for it to renegotiate.

1. **Business decisions** — D-01..D-38 in `docs/specs/business-decisions.md`;
   the human answers, the agent asks when the spec is silent.
2. **Domain and schema** — `docs/specs/domain-model.md`,
   `spec/contracts/domain.openapi.json`; the harness caught two real schema
   defects before any application code existed. (Aside worth showing: the
   `UsdCents` field's declared maximum is literally JavaScript's
   `Number.MAX_SAFE_INTEGER` — proof that even a "language-neutral" contract
   quietly encodes language-specific runtime knowledge, and why that had to
   be caught and decided on purpose rather than inherited by accident.)
3. **Service features** — one folder per service; each scenario asserts only
   its own service's state plus the calls it makes outward (D-28), which is
   the specific design choice that later makes "delete one service, rebuild
   it in a different language" a testable claim instead of a demo trick.
4. **Architecture decisions (A-01..A-13)** — language-neutral runtime
   contract, black-box tests that never import application code, static
   ports and environment-variable-only configuration, OpenTelemetry with
   protobuf-only export, simple local JWT auth, and (newest) a framework for
   deciding what belongs in the agent's local loop versus CI/CD. Don't read
   the table; pick two or three that a software audience will recognize as
   real decisions, not boilerplate — A-03 (black-box harness) and A-10
   (protobuf-only OTLP) land well because they're specific and have a reason
   attached.
5. **Protection (GUARD-01)** — `.claude/settings.json` deny rules plus a
   PreToolUse hook block the agent from editing `spec/**`, `docs/specs/**`,
   `.github/**`, `.claude/**`, `AGENTS.md` — the agent sees *why* it was
   blocked, not just that it was. A human-frozen SHA-256 manifest
   (`spec/protected.sha256`) backs that up in CI, independent of whether the
   local hook was bypassed, and the same required check rejects skipped or
   focused tests (`.skip`, `.only`, `@wip`). This is the one mechanism
   everything else depends on: without it, "frozen spec" is just a filename
   convention the agent can quietly edit around.
6. **Folder structure as enforcement, not just tidiness** — `services/*/`
   each own their dependency file and build/start/delete independently;
   `spec/` holds every protected artifact (features, contracts, harness,
   fakes, collector); `frontend/` only talks to services through published
   APIs. The separation isn't aesthetic — it's what makes deleting
   `services/checkout/` a clean, bounded operation instead of a
   cross-cutting mess.
7. **Red baseline, then green** — every test fails on creation with a message
   naming exactly what's missing ("Checkout not implemented:
   services/checkout/start not found"). Each slice of step definitions is
   proven against a throwaway spike service, then deliberately broken (wrong
   fee, extra field) to confirm it actually fails, before the spike is
   deleted — so the committed baseline is known-red, not accidentally-green.

### The pivots (say these out loud — they're the credible part)

- **Schedule re-prioritization (2026-09-29):** pulled the admin/veterinarian
  roster feature (MVP-02A) and an "Excella playbook" package (PLAY-01)
  ahead of the original five-week plan to hit a 2026-10-14 leadership
  review, while still completing rehearsals and a proper engineering review
  first. The point: specs and protection made it safe to reorder work
  without reopening what was already frozen.
- **ENG-01 → ENG-02:** the first engineering review was self-reviewed by the
  same agent that built the code — recognized as insufficient, replaced with
  an independent review (ENG-02) *before* declaring the Python rebuild done,
  not after.
- **Repository cleanup mid-project:** `BACKLOG.md` grew to 837 lines and had
  to be restructured into Now/Next/Done/Deferred with full history preserved
  separately; `docs/` reorganized into `handoffs/`, `history/`, `design/`.
  Worth naming plainly: a spec-first process generates a lot of durable
  paper trail, and that paper trail needs its own maintenance discipline or
  it becomes unreadable — this is a real cost of the approach, not a solved
  problem.
- **Screenshot baseline split:** the visible, slowed-down demo browser
  renders text-edge anti-aliasing differently from the headless suite used
  by `npm test` (824 differing pixels, zero actual content/layout
  difference). Rather than loosen a frozen tolerance, a second,
  presenter-reviewed baseline set was added for the demo specifically —
  keeping the frozen spec's tolerance meaningful instead of widening it to
  paper over a rendering artifact.

### Moments to actually show live

- The agent tries to edit a feature file and gets the GUARD-01 message.
- `npm test` red baseline naming the missing service.
- Delete `services/checkout/`, prompt a fresh agent session with only the
  frozen contracts/features/tests as input, watch it rebuild in Python while
  talking through the pivots above.
- Trace tree showing `telemetry.sdk.language` flip from `nodejs` to `python`
  after the rebuild — visual proof the new implementation is really new.
- Rehearsal evidence: [r1](rehearsals/r1.md) (JS→Python),
  [r2](rehearsals/r2.md) (Python→JS), r3 (JS→Python) — times, whatever
  interventions were or weren't needed, and the specification gaps the agent
  itself surfaced (GAP-08 through GAP-15), which is better evidence of spec
  quality than anything written in advance.

## End — what's next, and how to adopt this

### What's next for this project

- MVP-02A (administrator role, veterinarian roster) as the live proof that
  the pipeline works for *adding* a feature, not just rebuilding an existing
  one — the harder and more common case.
- ENG-02 as the engineering-discipline pillar: automated gates plus an
  independent reviewer, calibrated against planted defects rather than
  assumed to work.
- SEC-01 (security spike): the explicit counterweight to everything above —
  spec-first and tested reduces *wrong* behavior, it does not by itself
  reduce *insecure* behavior. Planted vulnerabilities, scanned, scored,
  written up honestly either way.
- The CI/CD placement framework (`docs/ci-cd-placement.md`, A-13): a
  reusable three-question test for what belongs in the agent's local loop
  versus what CI/CD must independently verify, applied concretely to
  promoting PERF-01 to a required check.

### The closing argument: platform services aren't optional anymore

Not a finding this repo tested — a recommendation, drawn from the 2026-10-03
analysis session, paired with whatever SEC-01 and ENG-02 end up showing.

Application sprawl reinventing the same cross-cutting concerns per team
predates AI. What changes is the cost-benefit: when writing application code
was the expensive, slow part, duplicating a bit of auth or logging glue in
every repo was annoying but survivable. When an agent can generate an entire
service's application code in under 30 minutes, code stops being the scarce
resource — and every team re-deriving SSO integration, audit logging wired
to SIEM, secret scanning on agent-authored PRs, PR policy gates, license
governance, sandboxed execution, and incident-response runbooks,
independently and unevenly, becomes the larger and more dangerous source of
inconsistency. That knowledge typically sits with security and
infrastructure teams, not application teams — without deliberate
centralization, "AI makes every team ship faster" quietly becomes "every team
ships its own ungoverned security posture faster." (80% of large engineering
orgs already run a platform team, up from 45% four years ago — the direction
isn't new, AI just raises the cost of not doing it.)

This repo's own `services/platform/` is a small, self-referential version of
the same move: shared HTTP transport, auth-token verification, and
OpenTelemetry instrumentation, written once and reused by every JavaScript
service. The Python Checkout rebuild had to supply its own copy of that
logic — which is itself evidence: the Python agent spent real effort
re-deriving auth/telemetry wiring the other three services get for free.
Scale that same principle from "shared code within one repo" to "a shared
platform across an organization's many AI-assisted teams."

### Repeatable review as the adoption pattern

A related, more operational recommendation: architects shouldn't spend their
time re-reviewing the same class of bug repeatedly, only catching the ones
they personally remember to check for. A versioned, calibrated library of
review skills (the ENG-02 target architecture, and literally implementable
today with Claude Skills) scales across projects in a way a human reviewer
re-reading the same checklist cannot. The role shifts from "catch this bug
again" to "find the next thing worth writing a check for."

### How to adopt these patterns (the call to action)

Offered as a starting point, deliberately not as fixed numbers — different
projects and organizations will need different staffing and different
sequencing:

1. Start with the business decisions a human must make explicit before any
   code is written, and write them down somewhere an agent can read but not
   edit.
2. Pick the one or two architecture decisions (black-box tests, frozen
   contracts) that make your system *rebuildable*, not just tested — the
   value compounds specifically because deletion-and-rebuild becomes a
   credible exercise, not a stunt.
3. Protect what you freeze with something stronger than convention — a hook,
   a manifest, a required CI check — or "frozen" quietly becomes "frozen
   until someone's in a hurry."
4. Decide, deliberately, what belongs in the agent's local loop versus CI/CD,
   using a framework like the one in `docs/ci-cd-placement.md` rather than
   defaulting to "run everything everywhere."
5. Treat security as its own counterweight, not an assumed side effect of
   good tests — budget an explicit review for it (SEC-01).
6. Expect the team's center of gravity to move toward architecture and
   product decision-making that has to happen faster than conventional
   review cycles allow, and toward developers who know language and library
   implementation details better than average, because those details (money
   handling in Python vs. JavaScript, auth token semantics, telemetry
   wiring) are exactly where specs stay silent and someone has to resolve
   the ambiguity correctly. Don't commit to a specific staffing ratio in
   advance — the real shift is the kind of work getting more scarce and
   valuable, not a fixed headcount formula.
