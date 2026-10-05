# ENG-02: independent, calibrated engineering review

Not protected by GUARD-01, not part of `npm test` (except `portable/`, which
is *meant* to require review via `.github/CODEOWNERS` — see the note at the
bottom of this file on its current status).

```
tools/review/
  portable/            # generic review engines — see portable/README.md
  project-specific/    # this app's own checks, fixtures, and findings
```

Supports the ENG-02 backlog item: an independent, calibrated engineering
review that supersedes ENG-01's self-review. Full planning and decisions:
[`docs/eng-02-planning.md`](../../docs/eng-02-planning.md). Five components,
per `BACKLOG.md`:

1. Automated gates — duplicate-code detection, the import-boundary check,
   security scanning and dependency audit (reusing `tools/security/portable/`
   directly rather than re-implementing), connected-trace capture.
2. Observability rule audit.
3. An independent reviewer process — fresh session, checklist-driven, cites
   file/line, human signs off security/boundary findings.
4. A threat-model note.
5. Calibration — planted defects, measured catch rate, same discipline
   SEC-01 already proved out for the security tier alone.

## The portable/project-specific split

Same engine/parameters test as `tools/security/` (A-15), which itself
borrowed this split from the import-boundary check this folder now owns:
if running the same mechanism against a different project would need only
new *parameters*, it's portable; if it needs rewritten *logic*, it's
project-specific, however abstractly it's written.

## What moved here, and what didn't

`tools/ownership.test.mjs`, `tools/engineering-review.test.mjs`, and
`tools/frontend-engineering.test.mjs` (the pre-existing "additional
engineering evidence" checks, run via `npm run test:engineering`) moved into
`project-specific/` — they're all specific to this app's fixtures, routes,
and business rules, not generic engines.

**Note on `ownership.test.mjs`:** despite the name, its actual content
(verifying that a different customer's resource ID can't be substituted to
bypass the 404 ownership check) is a resource-ownership access-control test,
not the service-level *import*-boundary check BACKLOG describes ("no service
imports another service's code or a store"). That check — reading each
service's actual imports and flagging a cross-service one that isn't
`services/platform/` — doesn't exist yet. It's still open work under this
folder's automated-gates component, not something this file already covers.
Kept the file under its original name since renaming it is a separate,
deliberate decision, not a side effect of this move.

## CODEOWNERS protection: not yet wired up on `main`

`tools/security/portable/README.md` already states "CODEOWNERS requires
review on this folder" as its intended protection model, and this folder's
`portable/` is meant to work the same way — but as of this scaffolding pass,
`.github/CODEOWNERS` on `main` has no line for either `tools/security/portable/`
or `tools/review/portable/`. This is a known, previously-flagged gap, not a
new one. `.github/` is protected — I can draft the CODEOWNERS addition when
asked, but it needs your review and a `guard:freeze` run before it's real.
