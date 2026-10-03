# Project-specific security checks and configuration

Everything here encodes a decision specific to *this* application's
architecture — its route dispatch model, its CORS policy, its auth wiring.
Don't try to generalize anything in this folder; if a piece of it turns out
to generalize, that's a signal to extract an engine into
`../portable/` and leave only the project's parameters here, not a reason to
rewrite this folder to look more abstract.

No CODEOWNERS protection beyond the project's normal review — unlike
`../portable/`, changes here are expected to track this app's own evolving
architecture.

## What's here

- `cors-policy.json` — this app's actual CORS configuration, as implemented
  in `services/platform/runtime.js`, for comparison against what a portable
  CORS check (if one gets added) should be checking for.
- `auth-coverage-notes.md` — why SEC-01 defect #5 (a route skipping the auth
  hook) is structurally unusual in this app's current architecture, and why
  there's no automated "auth-coverage-engine" here yet.
