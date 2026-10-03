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

*(Re-verify every number above against current sources before this goes on
stage — they're from an earlier research pass in this project, not
re-checked at final-draft time.)*

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

Each lesson follows the same shape on purpose, so the audience can pattern-
match it after the second one: **the assumption** going in, **why this
specific pivot** happened — the concrete thing that exposed the assumption
as wrong, not a vague "we realized" — **what changed**, and **the
takeaway**. Lead with the most surprising ones.

### Lesson 1 — "More tests means more safety"

**The assumption:** thoroughness is a function of volume; more automated
checks always means a wider safety margin.

**Why this pivot, specifically:** an audit of the authorization test suite
— done because 242 checks felt like a lot for one mechanism, not because
anything was failing — found 241 of them were re-proving the exact same
signing logic in different clothes. One real idea, dressed up as 242 tests.
In the same pass, a cheap, frozen, tamper-proof performance check turned up
sitting inside an "informational, continue-on-error" CI job — meaning it
could silently regress in production and nobody would be notified, while
241 redundant auth checks ran on every single commit. The volume of tests
and the actual safety margin they bought had quietly come apart.

**What changed:** pruned the redundant auth checks down to the ones proving
distinct behavior, and promoted the performance check out of the
informational bucket into its own required, independent gate.

**Takeaway:** testing isn't a pile to grow, it's a set of guardrails to
place deliberately — audit for redundancy the same way you'd audit for gaps.

### Lesson 2 — "The builder can review its own work"

**The assumption:** if the agent that wrote the code also writes the review
of the code, that review has real value as a check.

**Why this pivot, specifically:** the first engineering review read back as
a narrative checklist — plausible, well-organized, and never once tested
against a known defect. Asking "would this review have caught a real bug
planted on purpose?" had no answer, because nobody had tried. That question
is what exposed it as theater, not the content of the review itself.

**What changed:** replaced it with an independent review — a fresh agent
session with no memory of writing the code, working from a checklist, and
calibrated by planting real defects ahead of time and measuring the catch
rate — required *before* calling the rebuild done, not added after as a
formality.

**Takeaway:** never let the thing that built it also certify it. True of
agents for exactly the reason it's true of people, and for the same reason
auditors aren't employees of the company they audit.

### Lesson 3 — "Correct behavior and secure behavior are the same thing"

**The assumption:** a service that passes every behavioral test is a safe
service.

**Why this pivot, specifically:** walking through what the test suite
actually asserts — business outcomes against a spec — made it obvious that
nothing in it asserts anything about *how* those outcomes are produced. A
service could satisfy every frozen scenario while logging a secret at error
level, or comparing a token with a timing-unsafe check, and every test
would still pass. The gap wasn't found by a failure; it was found by asking
what the passing tests were actually proof of.

**What changed:** added an explicit, time-boxed security pass, separate from
the behavioral suite — scan the real implementations, then calibrate the
scanners themselves by planting real vulnerabilities and measuring what's
actually caught, instead of trusting "we ran a scanner" as a finish line.

**Takeaway:** security is a separate axis from correctness, not a side
effect of it. Budget for it on purpose, with its own evidence of whether
it's working.

### Lesson 4 — "A language-neutral spec has no language baked into it"

**The assumption:** writing a contract in a generic format (OpenAPI/JSON
Schema) makes it genuinely language-neutral.

**Why this pivot, specifically:** a currency field's declared maximum value
— meant to be usable by any language implementing the contract — turned out
to be exactly JavaScript's maximum safe integer. Nobody wrote it there on
purpose; it was inherited from whatever authored the first draft and never
challenged, because the file format *looked* neutral. *(Show the money/
currency snippet live — it's a two-second "wait, really?" moment.)*

**What changed:** made checking contracts for accidentally-inherited
language assumptions an explicit review step, not an assumed property of
using a generic file format.

**Takeaway:** "language-neutral" is a claim to verify, not a property you
get for free just because the format is generic.

### Lesson 5 — "Guardrails as instructions are enough"

**The assumption:** telling the agent, in writing, not to touch certain
files is sufficient protection.

**Why this pivot, specifically:** the honest question was "what actually
stops this if the agent has a reason to ignore the instruction" — under
time pressure, a confusing error, or just a bad run — and the answer was
nothing. An instruction is a request, not a constraint, for the same reason
it is for a person in a hurry.

**What changed:** replaced the written instruction with a structural block —
a permission system that refuses the edit outright and tells the agent
*why* — backed by a frozen, hash-verified manifest checked independently in
CI, so it holds even if the local block were somehow bypassed. *(Demo: have
the agent try to edit a feature file live and get blocked, with the reason
shown.)*

**Takeaway:** if a rule actually matters, make it physically impossible to
break quietly. Don't ask nicely.

### Lesson 6 — "Organize the repo for humans; agents don't care"

**The assumption:** repo structure and documentation hygiene are a
developer-experience nicety, not something that affects correctness.

**Why this pivot, specifically:** the same prompt, run against a cleaner
version of the repository after a reorganization, produced visibly better
agent output than it had against the sprawling version before. That's the
tell: an agent reasons over whatever context it's handed, the same way a new
hire does, and a disorganized project handed it worse context to reason
over, regardless of how good the model was.

**What changed:** treated repo and documentation structure as a
correctness-adjacent concern worth deliberate maintenance, not just a
cleanup task to get to eventually.

**Takeaway:** repo hygiene is now a correctness concern for two audiences,
not one.

### Lesson 7 — "Chase perfection before you ship"

**The assumption:** more rehearsal runs are always better evidence than
fewer, so keep running them.

**Why this pivot, specifically:** after two independent, clean rebuilds —
zero interventions, in both language directions — the instinct was to run a
third anyway, "to be safe," with no specific question that third run would
actually answer. Noticing that *no new question was being asked* is what
exposed it as fake rigor rather than real diligence.

**What changed:** declared the existing two runs sufficient evidence for the
claim being made, in writing, and redirected the freed-up time to the next
thing that actually needed it — the presentation itself.

**Takeaway:** define "done" before you start, or you'll keep redefining it
as "more than I currently have," forever.

### A pivot that wasn't about code

When a genuine external pull showed up — a chance to present this work to
leadership sooner than originally planned — the frozen specs and protected
tests were what made it safe to reorder the remaining work without reopening
anything already settled. Worth saying out loud: the same discipline that
protects code quality also buys the freedom to replan without fear.
**Takeaway:** good guardrails aren't just safety, they're optionality.

## The role shift: where the developer's time actually goes now

This is the part that surprised me most, and it's the part worth spending
real time on, because it's the part a room full of developers will feel
personally.

Writing code used to be the bottleneck. Everything the industry has told
developers mattered for decades — solution architecture, product thinking,
test strategy (not just test volume), security, compliance, observability,
maintainability — kept losing the fight for time against the pressure to
ship the next feature, because code was slow to write and somebody had to
write it. Those practices weren't wrong; they were just first in line to get
cut whenever time, cost, or headcount got tight. Everyone nodded at the
retro that "we should have designed this better" and then went right back to
writing code, because writing code was due Friday.

Once an agent can absorb most of the mechanical cost of writing code, that
bottleneck moves. It doesn't disappear — it moves to exactly the activities
that used to get shortchanged, because those are now the only things left
that actually require a human:

- **Solution architecture** — deciding what the services are and how they
  talk to each other, before anything is generated, because an agent will
  happily generate a confident answer to a question nobody should have
  asked yet.
- **Product decisions** — what the behavior should actually be when the
  spec is silent, which an agent cannot answer for you no matter how
  capable it is, because that's a business call, not a technical one.
- **Testing strategy** — not "how many tests," but what's worth protecting,
  what's redundant, and what a test is actually evidence of (Lesson 1).
- **Security and compliance** — the explicit pass that correctness testing
  does not give you for free (Lesson 3).
- **Observability** — deciding up front what you'll need to see in
  production, instead of adding logging after the first incident.
- **Maintainability** — the structural decisions (Lessons 5 and 6) that
  determine whether this is still a safe system to change in a year, with
  different people, than it is today.

None of these are new ideas. They're the oldest ideas in the industry. The
shift isn't that developers become architects instead of engineers — it's
that the excuse for not doing this work properly is gone. The job doesn't
get smaller. It gets more honest about what it was always supposed to
include.

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

## The cost conversation: selling this inside a real organization

Save this for the end — it's the part that turns "interesting talk" into
"let's actually try this," because it's the part that preempts the first
objection every engineering leader in the room is already forming.

**Be honest about the cost up front.** Writing domain contracts, service
features, and observability rules before any code exists is genuinely
time-consuming, and it does not produce the frequent, visible increments
that most organizations are trained to expect — a sprint review with
nothing demoable because the whole sprint went into an API contract is a
hard thing to stand up in front of a VP. This is the single biggest reason
this approach dies in real organizations before it gets a fair trial: it
front-loads cost that is invisible to anyone who isn't reading the specs
themselves, and defers the visible payoff.

**So the sell has to change, not the substance.** A few things that
actually work:

- Sell the artifacts and services in pieces, not a finished product with a
  front end. A passing contract test, a reviewed domain model, an
  observability dashboard showing a trace end-to-end — these are real,
  demonstrable increments of progress, even with no UI behind them yet.
  Show them as the sprint's output on purpose, instead of apologizing for
  not having a clickable feature.
- Reframe the apparent slowness as the point, not a defect: **the missing
  product and architecture decisions this approach forces you to make
  explicit were never actually free.** They were always being made —
  implicitly, late, usually under incident pressure or during a rewrite,
  by whoever happened to be in the room at the time. This approach doesn't
  add that cost. It moves a cost that already existed from "invisible and
  paid later, at the worst possible time" to "visible and paid now, on
  purpose." That's the feature, not the bug.
- Tie the argument to numbers a budget-holder already tracks, not new
  jargon: incident rate, time to onboard a new engineer into an unfamiliar
  service, time to safely change or replace a component, PR review
  turnaround. Those are the metrics this approach is actually trying to
  move, and they're already in the room's vocabulary.

**The long-term trade-off to put in front of leadership, plainly:** fewer
visible features ship per week while contracts and specs get established.
In exchange, you get a system that stays maintainable rather than quietly
calcifying into brittle legacy software — the specific failure mode where
the business logic only ever lived in the heads of the two or three people
who built it, and the system becomes unsafe to touch the day they roll off
the project. Specs, contracts, and frozen tests are how that knowledge
survives staff turnover instead of leaving with it. That, not raw
development speed, is the actual pitch: lower operational cost over the
system's life, and a system that's still safe to hand to someone new five
years from now.

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
7. Expect the center of gravity to shift toward architecture, product
   judgment, security, observability, and maintainability — not because the
   job is being replaced, but because the excuse for shortchanging them is
   gone.
8. Expect to have to sell this internally in pieces, against the instinct
   that "no visible feature this sprint" means no progress — that's a sales
   problem to solve on purpose, not a sign the approach isn't working.

## Production notes

Rough timing against the hour (the ~25–32 minute rebuild wait is lesson-time,
not dead air):

| Segment | Minutes |
| --- | --- |
| Hook, stakes, thesis | 10–12 |
| Visible journey (before) + timed delete | 3–5 |
| Lessons + the role shift, talked through during the rebuild wait | ~25–32 |
| Visible journey (after) + full suite + trace flip | 3–5 |
| Where this is going / bigger argument / cost conversation / close | 10–12 |
| Buffer / questions | remainder |

Artifacts to have ready to show, cued to the lessons above: the money/
currency snippet (Lesson 4), the agent getting blocked live on a
feature-file edit (Lesson 5), `npm test`'s red-then-green output (mentioned
in passing, not walked step by step), the trace tree's
`telemetry.sdk.language` flip, and the project board only if time allows —
it's supporting evidence, not a story beat.
