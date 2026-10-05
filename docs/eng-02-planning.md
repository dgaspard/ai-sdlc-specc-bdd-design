# ENG-02 planning: independent, calibrated engineering review

Status: **draft brainstorm, decisions captured 2026-10-04, tooling not yet
built.** Mirrors `docs/mvp-02a-planning.md`'s role — a working doc, not a
protected spec. Nothing here is implemented yet; two open questions below
need answers before the first line of tooling gets written.

## Decided this session

**Reviewer governance model.** Two different situations get two different
rules, not one blanket "agent reviews everything" policy:

- **Substantial, not-yet-developed architecture** (the example given: a
  security architecture that doesn't exist yet) needs a human in the loop
  before a subagent builds it. The sequence is: a subagent drafts/proposes
  the design → a human approves it → *then* a fresh subagent builds against
  the approved design.
- **Once a pattern is repeatable** — e.g., another application consuming an
  already-designed security service — a fresh subagent can take over both
  the build and the review, because at that point the job isn't "design
  something new," it's "check that this new instance doesn't violate the
  rules a human already approved." The review's actual question becomes
  narrow and mechanical: did any agent or person go against the approved
  design, yes or no, cited by file and line.

This refines, rather than replaces, what's already in `BACKLOG.md`'s ENG-02
section ("a human signs off security and boundary findings") — the human
checkpoint moves earlier, to approving the design itself, rather than only
appearing at the end as a findings sign-off. Both checkpoints stay: human
approves novel architecture before it's built, and human still signs off
security/boundary findings on every review afterward.

**Scope and order:**

1. Build ENG-02's tooling now, apply it first to the existing JavaScript
   baseline (`impl-02`) — not the Python rebuilds.
2. After MVP-02A is specified and built (in JavaScript — see open question
   below), run the same review again with a fresh agent that has no memory
   of building it.
3. Specifically revisit SEC-01's calibration defect #5 (a route skipping
   the auth hook) once MVP-02A's real admin-only routes exist: was the
   synthetic planted version of this defect actually a good test of the
   real risk, or did the real case behave differently? This is deliberately
   a retrospective check on the spike's own methodology, not just a rerun
   of the same test. Feeds directly into the "second test" segment of
   `docs/talk-notes.md` — this is its payoff moment, not a side note.
4. Python rebuild application (r1, r2, future r3) is **not** in ENG-02's
   near-term scope — see the open question below on exactly what this means
   for the live demo.

**Calibration defect list: six, not five.** The backlog's original five
(copied business logic across services, a payment reference leaked into a
span, a token check skipping signature verification, cross-service store
access, a missing OBS attribute on an untested rule) plus a sixth:
**an admin-only route missing its role check** — directly reusing SEC-01's
defect-#5 methodology, now against a real feature instead of a synthetic
one.

**Testing philosophy for this phase:** deliberately over-produce checks now
— simple, not fully organized — and curate later once there's enough
material to see what's actually redundant, the same way the 241-of-242
redundant auth-test audit happened only after the suite already existed.
Don't self-censor test volume up front; the audit/prune step comes after,
using ENG-02's own duplicate-detection tooling once it exists.

**Cleanup, deferred to after this task:** duplicate packages, libraries, or
stray Markdown files that don't belong get cleaned up once ENG-02's build is
done — see the open question below on scope.

**Physical structure confirmed:** `tools/review/` with the same
`portable/`/`project-specific/` split as `tools/security/` (A-15). CODEOWNERS
protection on `tools/review/portable/` mirrors `tools/security/portable/`.

## Resolved (2026-10-04)

1. **Python demo scope: unaffected.** "Continue to work in JS" applies only
   to ENG-02's review-application order and MVP-02A's build language. The
   live November demo (A-05/A-12 — build in JS, live-delete-and-rebuild
   Checkout in Python on stage) stays exactly as already decided; that's a
   separate, already-proven capability from r1/r2, not something this
   touches.
2. **Cleanup scope: full repo audit, deferred until ENG-02's duplicate-code
   tooling exists.** Not a narrow rehearsal-artifact sweep done by hand now
   — once `jscpd` (or whatever gets chosen) is built and running, use it to
   systematically find duplicate code/packages/stray docs across the whole
   repo, including but not limited to the r1/r2 rehearsal leftovers.

No open questions remain; tooling work can start.
