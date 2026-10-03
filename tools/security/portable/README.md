# Portable security checks

Nothing in this folder may reference petclinic's routes, domain, or business
logic. If a check needs that kind of project knowledge to run, it belongs in
`../project-specific/` instead, not here.

**The test to apply when adding anything here:** if you ran this exact
mechanism against a different project, would it need new *parameters*, or
would it need rewritten *logic*? New parameters only → it's portable, put it
here and have it read its parameters from `../project-specific/`. Rewritten
logic → it's project-specific, it doesn't belong here no matter how it's
abstracted.

This is the same engine/parameters split ENG-02 already uses for the
import-boundary check, applied to security checks. It's also, eventually,
the folder that gets lifted out of this repo entirely once these checks have
proven themselves on a second real project (ENG-02's graduation criterion) —
either copied as a starting security baseline for a brand-new repo, or
referenced as a shared, centrally-maintained GitHub Actions workflow instead
of copied files at all.

## What's here

- `run-sast.sh <path> <output.json>` — Semgrep, using the default registry
  plus the custom rules in `semgrep-rules/` (patterns the default registry
  doesn't already cover for this project's calibration defects).
- `run-dependency-audit.sh <path> <output.json>` — `npm audit` or
  `pip-audit`, picked automatically by what manifest is present.
- `run-secret-scan.sh <path> <output.json>` — `detect-secrets`.
- `semgrep-rules/` — custom portable rules (see its own README for which
  defect classes these catch and why they weren't already covered).

## Protection

`.github/CODEOWNERS` requires review on this folder — the same model as
GUARD-01's protection of `spec/`, but lighter: these checks are *meant* to
evolve as new defect classes get discovered, so the mechanism is mandatory
review, not an immutable hash freeze.
