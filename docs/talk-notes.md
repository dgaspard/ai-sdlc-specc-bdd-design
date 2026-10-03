# Talk notes (November presentation)

Story-driven speaking outline for both talks: Black Tech NOLA workshop
(2026-11-07) and NOAI (2026-11-13), one hour each. Talking points to speak
from naturally, not a script. The boring logistics of how this project was
run are deliberately left out — nobody at a conference needs to know about a
leadership review on the calendar. What's kept in is the real pivots: places
a starting assumption about the technology or the approach turned out to be
wrong, and what that forced a change to.

> **Status:** working draft for [DEMO-02](../BACKLOG.md). Demo readiness:
> A-14 (2026-10-03) — r1 + r2 are accepted as sufficient evidence the
> reconstruction claim holds; r3 is an optional bonus recording, not a gate.
> Opening anecdote is chosen (the 900-line PR below). Remaining: one full
> timed read-through, and fold in r3 if it gets recorded before the talks.

## The hook

Introduce myself. Then:

The inspiration for this talk: a coworker submitted a 900-line PR. Another
coworker approved it. Looking at that, the thought wasn't "bad reviewer" —
it was *this problem isn't going away.* Software development has been
disrupted, and most people haven't adjusted. AI doesn't just accelerate
development — it accelerates whatever habits, good or bad, were already
there.

Everyone's using AI differently. There's no "the way" yet. That's the real
tension to sit the audience in:

- Do code reviews still matter if the next agent run just blows away what
  you reviewed anyway?
- Does a professional developer's job change? How? Which of yesterday's best
  practices survive, and which don't?
- What should actually get handed to the agent, and why?
- Is there a "right way" to build *enterprise* software with AI — not a toy,
  not a hackathon demo, something with real failure modes?

This talk is the journey to an answer: the guardrails and best practices
that came out of actually building something this way, so the people in the
room leave able to build not just *more* software, but safer, cheaper, more
valuable, more capable software — and so their organizations can build
things they genuinely couldn't before.

## The stakes (say it fast, then move)

- AI-generated PRs wait roughly 4.6x longer for review (LinearB, 8.1M PRs,
  DORA 2026) — teams aren't bottlenecked on writing code anymore, they're
  bottlenecked on trusting it.
- LLM-generated code shows 9.8–42.1% vulnerability rates depending on study
  and language; AI-created PRs show roughly 75% more logic/correctness
  errors than human-authored ones. "Looks right" isn't "is right" — call
  this *silent wrongness*: code that runs, looks plausible, and is wrong in
  a way nobody catches until production.
- It isn't hypothetical: a ~6-hour Amazon.com outage in March 2026 (120K
  lost orders, 1.6M errors) traced back to exactly this pattern, and more
  than 100,000 AI-introduced issues were still sitting in public GitHub repos
  as of February 2026.
- 88% of enterprise AI-agent pilots never reach production; Gartner projects
  40%+ of agentic AI projects cancelled by 2027. The gap isn't model
  capability — it's the absence of a way to tell good output from
  plausible-looking output before it ships.

**Not** claiming here: that testing alone solves security, that code review
is dead, or that any of this removes the organizational change AI forces.
Those stay open problems and come back at the end.

## The thesis (tell them the ending now)

What building this surfaced: AI isn't really a *transformational* technology
so much as an *accelerating* one. It doesn't hand you new judgment — it
multiplies whatever judgment (or lack of it) was already in the process. The
guardrails that actually work here are not new. They're the same practices
the industry has been saying for decades — specs before code, contracts
before implementation, independent review, tests that prove behavior — just
applied with sharper teeth, because the thing being reviewed now writes
thousands of lines in minutes instead of hours. Embracing AI well looks less
like a new methodology and more like finally taking the old discipline
seriously, because now the cost of skipping it shows up fast.

## The experiment (keep this short)

Built a small, real, multi-service app — the kind of thing an enterprise
actually runs — specifically so a service could be deleted and an agent
could rebuild it from nothing but the specification, in a *different*
language, and prove the result still behaves correctly. Not the point of the
talk. The point is everything that had to be true *before* deletion for that
to be a meaningful test instead of a trick: specs written and frozen before
code, contracts an agent can read but not edit, tests that only ever talk to
the system from the outside. That's where the real lessons are.

**Live demo flow:** run the before-journey and show the JS implementation
briefly, kick off the delete-and-rebuild in the background, then talk
through the lessons below while it runs. Save the rerun — Python journey,
full suite, and the trace-tree language flip (`nodejs` → `python`) — for the
very end, with roughly 20 minutes of slack built in for a slow run.

## Lessons from building it (the core of the talk)

Each one: what was assumed going in, what broke that assumption, what it
forced, and the one-line takeaway. Lead with the most surprising ones.

### "More tests means more safety" — wrong

Assumed thoroughness meant volume. An audit of the authorization test suite
found 241 of 242 checks were re-proving the *same* signing mechanism over
and over — one real idea, dressed up as 242 tests. Around the same time, a
cheap, frozen, tamper-proof performance check sat buried in an
"informational, continue-on-error" CI bucket — meaning it could silently
regress and nobody would notice. Two different symptoms, one root cause:
nobody had asked *who needs this signal, and when* for either one. The fix
in both cases was the same question, not a bigger test suite: prune
redundant tests that prove nothing new, and promote the few that are cheap,
tamper-evident, and load-bearing into an actual required gate. **Takeaway:**
testing isn't a pile to grow, it's a set of guardrails to place deliberately.

### "The builder can review its own work" — wrong

First engineering review of the rebuilt service was written by the same
agent that built the code. It read like a checklist and nobody had tested
whether it caught anything. That's not a review, that's the builder grading
its own homework. Replaced it with an independent review — fresh session,
no memory of having written the code, checklist-driven, calibrated by
planting real defects and measuring the catch rate — *before* calling
anything done. **Takeaway:** never let the thing that built it also certify
it; that's true of agents for exactly the reason it's true of people.

### "Correct behavior and secure behavior are the same thing" — wrong

Every test in this project proves the system does the *right* thing per
spec. None of them prove it does the *safe* thing. A deliberately
correct-but-insecure implementation — says the followup threat-model spike —
can pass every frozen test in the suite. Spec-first reduces wrong behavior;
it does nothing by itself about insecure behavior. That gap gets its own
explicit, time-boxed security pass: scan the real implementations, then
calibrate the scanners by planting real vulnerabilities and measuring what's
actually caught, rather than trusting that "we have a scanner" means
anything. **Takeaway:** security is a separate axis from correctness, not a
side effect of it — budget for it on purpose.

### "A language-neutral spec has no language baked into it" — wrong

Small, concrete one: a currency field's declared maximum value, written to
be usable by any language implementing the contract, turned out to be
exactly JavaScript's maximum safe integer. Nobody put it there on purpose —
it leaked in. *(Show the money/currency snippet live — it's a two-second
"wait, really?" moment.)* **Takeaway:** "language-neutral" is a claim to
verify, not a property you get for free just because the file format is
generic.

### "Guardrails as instructions are enough" — wrong

Early on, protection for the specs and tests was just a note telling the
agent not to touch them. Agents, like people, don't reliably follow
instructions they have an incentive to route around. The fix was structural,
not polite: a permission system that blocks the edit outright and tells the
agent *why*, backed by a frozen, hash-verified manifest in CI that doesn't
care whether the local block was bypassed somehow. *(Demo: have the agent
try to edit a feature file live and get blocked, with the reason shown.)*
**Takeaway:** if a rule matters, make it physically impossible to break
quietly — don't ask nicely.

### "Organize the repo for humans; agents don't care" — wrong

A messy, sprawling set of docs and folders doesn't just slow a human down —
an agent reasons over whatever context it's given, and a disorganized
project produces visibly worse output from the exact same prompt. Folder
boundaries that separate services, protected specs, and docs aren't
aesthetic — they're what makes "delete this one piece cleanly" possible at
all, for an agent the same way it would be for a new hire. **Takeaway:**
repo hygiene is now a correctness concern for two audiences, not one.

### "Chase perfection before you ship" — wrong

Two independent, clean rebuild rehearsals — zero interventions, both
directions between languages — were already strong evidence the claim held.
The instinct was to chase a third run anyway, "to be safe." That's exactly
the kind of fake rigor worth naming on stage: decide in advance what counts
as enough evidence, write the decision down, and stop when you hit it.
Everything after that point is just time not spent on the next real problem.
**Takeaway:** define "done" before you start, or you'll redefine it as "more
than I have," forever.

### "A real pivot can be about process, not just code"

When a genuine external pull showed up — a chance to present this to
leadership sooner than planned — the frozen specs and protected tests were
*what made it safe to reorder work* without reopening anything already
settled. That's worth saying out loud: the same discipline that protects
code quality also buys the freedom to replan without fear. **Takeaway:**
good guardrails aren't just safety, they're optionality.

## Where this is going (keep it tight)

Still active before November, stated as proof this isn't a one-off stunt:

- Proving the pipeline handles *adding* a feature (an admin role and a
  veterinarian roster), not just rebuilding one that already existed — the
  harder, more common case. Target: before November.
- The independent, calibrated review becoming a standing gate, not a
  one-time exercise. Target: before November.
- The security spike's recommendation — which scanners, at what gate, with
  what measured catch rate — specific enough to go straight into a written
  playbook.
- A reusable three-question test for *where* a check belongs — the agent's
  local loop, or an independently-verifying CI gate — so this stops being a
  one-off judgment call per check.

## The bigger argument: this doesn't stay inside one team

Not something this project tested directly — a recommendation, earned by
watching the project's own small version of it happen.

Reinventing cross-cutting concerns per team predates AI. What changes is the
economics: when writing code was the slow, expensive part, a little
duplicated auth or logging glue per team was annoying but survivable. When
an agent can generate an entire service in under 30 minutes, code stops
being the scarce resource — and every team independently, unevenly
re-deriving SSO integration, audit logging, secret scanning on agent PRs, PR
policy gates, license governance, sandboxing, and incident response becomes
the bigger risk, not the smaller one. That expertise usually sits with
security and infrastructure teams, not application teams. Without deliberate
centralization, "AI makes every team ship faster" quietly becomes "every
team ships its own ungoverned security posture faster."

This project's own shared platform runtime is a miniature version of exactly
that move: one piece of shared transport/auth/telemetry code, reused by
every service built in the same language — and the one service rebuilt in a
*different* language had to re-derive all of it from scratch, which is
itself the evidence. Scale that from "shared code in one repo" to "a shared
platform across an organization's many AI-assisted teams" and the argument
holds.

A related operational shift: reviewers shouldn't spend their time
re-catching the same class of bug forever, limited to whatever they
personally remember to check. A versioned, calibrated library of review
checks — buildable today — scales the way a human re-reading the same
checklist never can. The job moves from "catch this bug again" to "find the
next thing worth writing a check for."

## Close

None of this matters if it can't be explained to someone else — generating
an AI-assisted SDLC application in private gets zero attention and helps
nobody. That's the point of this talk existing at all, and it loops back to
the opening: that 900-line PR isn't an anomaly, and it isn't going away.
What changes is whether the next one gets waved through, or gets a real
answer to "was this actually reviewed, or just blessed?"

**Adoption checklist**, offered as starting points, not fixed numbers —
different orgs need different staffing and sequencing:

1. Write business decisions down somewhere an agent can read but never edit
   — before any code exists.
2. Pick the one or two decisions that make your system *rebuildable*, not
   just tested — that's where the value compounds.
3. Protect what's frozen with something stronger than a comment — a hook, a
   manifest, a required CI check.
4. Decide on purpose where each check belongs — agent's local loop or an
   independent CI gate — instead of running everything everywhere.
5. Budget security as its own pass, not an assumed side effect of testing.
6. Decide, in writing, when evidence is enough — and actually stop there.
7. Expect the center of gravity to shift toward architecture and product
   judgment that has to happen faster than old review cycles allowed, and
   toward people who know their languages and libraries deeply — that's
   exactly where specs go silent and someone has to resolve the ambiguity
   correctly. Don't commit to a fixed staffing ratio; the scarce thing is
   the kind of judgment, not a headcount formula.

## Production notes

Rough timing against the hour (the ~25–32 minute rebuild wait is lesson-time,
not dead air):

| Segment | Minutes |
| --- | --- |
| Hook, stakes, thesis | 10–12 |
| Visible journey (before) + timed delete | 3–5 |
| Lessons, talked through during the rebuild wait | ~25–32 |
| Visible journey (after) + full suite + trace flip | 3–5 |
| Where this is going / bigger argument / close | 8–10 |
| Buffer / questions | remainder |

Artifacts to have ready to show, cued to the lessons above: the money/
currency snippet (language-leak lesson), the agent getting blocked live on a
feature-file edit (guardrails lesson), `npm test`'s red-then-green output
(mentioned in passing, not walked step by step), the trace tree's
`telemetry.sdk.language` flip, and the project board only if time allows —
it's supporting evidence, not a story beat.
