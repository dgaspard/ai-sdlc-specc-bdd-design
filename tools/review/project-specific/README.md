# Project-specific review checks and configuration

Everything here encodes a decision specific to *this* application — its
service boundaries, its fixtures, its routes, its business rules. Don't try
to generalize anything in this folder; if a piece of it turns out to
generalize, that's a signal to extract an engine into `../portable/` and
leave only the project's parameters here, not a reason to rewrite this
folder to look more abstract.

No CODEOWNERS protection beyond the project's normal review — unlike
`../portable/`, changes here are expected to track this app's own evolving
architecture.

## What's here

- `ownership.test.mjs` — resource-ownership access-control test (a
  different customer's ID can't be substituted to bypass the 404 check).
  Moved here as-is from `tools/ownership.test.mjs`; despite the name, it is
  **not** the import-boundary check — see `../README.md` for why that
  distinction matters.
- `engineering-review.test.mjs` — supplemental engineering evidence for
  existing D-12/ENG-01 obligations (idempotency, slot validation,
  authorized-payment/failed-completion retry safety). Supplements, never
  replaces, the frozen specification suites.
- `frontend-engineering.test.mjs` — supplemental browser-level engineering
  checks (accessible error states, fractional-cent rejection, uncertain-
  payment UI handling, clinical-text XSS safety). Same relationship to the
  frozen browser oracle in `spec/`.
- Service-to-folder mapping for the import-boundary check's parameters
  (planned, not yet added — see `../portable/README.md`).
- `jscpd` exclusion list and target paths (planned, not yet added).

All three moved test files had their relative import paths updated for the
new depth (`tools/review/project-specific/` instead of `tools/`); run
`npm run test:engineering` to confirm after any future move.
