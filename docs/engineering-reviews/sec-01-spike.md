# SEC-01 — Security spike: calibrating automated gates against AI-generated code

Status: **template — not yet run.** `tools/security/run-sec01-spike.sh`
needs real network access (PyPI, npm registry) that the Cowork sandbox this
template was drafted in doesn't have. Run it via Claude Code locally or your
own terminal, then fill in every section below from
`tools/security/.spike-output/`. See `tools/security/README.md`.

## Tool versions

<!-- paste from tools/security/.spike-output/versions.txt -->

| Tool | Version |
| --- | --- |
| Semgrep | |
| Bandit | |
| pip-audit | |
| detect-secrets | |
| npm | |
| node | |
| python3 | |

## Real-build findings: JavaScript Checkout (impl-02)

Source: `js-semgrep.json`, `js-secrets.json`, `js-platform-audit.json`.

<!-- List every true positive found, including whether it's the already-known
shared-HS256-secret-across-services limitation (A-09) showing up as
expected, versus something new. -->

## Real-build findings: Python Checkout rebuild (r1)

Source: `py-bandit.json`, `py-semgrep.json`, `py-secrets.json`, `py-audit.json`.

<!-- Same as above, for the Python rebuild. Note anywhere the two
implementations disagree — same spec, different real findings — since
that's informative on its own. -->

## Calibration table

Eight planted instances across six defect classes; see
`tools/security/calibration-defects.md` for what each one is and why it was
chosen.

| # | Defect | Language | Caught? | By which tool(s) | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Non-constant-time secret comparison | JS | | | |
| 1 | Non-constant-time secret comparison | Python | | | |
| 2 | Secret logged at error level | JS | | | |
| 3 | Injection-shaped string concatenation | JS | | | |
| 3 | Injection-shaped string concatenation | Python | | | |
| 4 | Overly broad CORS | JS | | | |
| 5 | Route skipping the auth hook | JS | | | |
| 6 | Dependency with a known CVE | JS | | | |

**Catch rate: n of 8.**

## Where tools missed

<!-- For each miss: add a tool, add a targeted scenario-level check
(business-observable security property), or accept and disclose the
residual gap. Say which, and why, per miss — not a blanket answer. -->

## Recommendation

<!-- Specific enough to go in the Excella playbook as "the minimum automated
security floor for AI-generated service code": which scanners, at what
gate (agent's local loop vs. CI, per the A-13 framework), with what
measured catch rate. Distinct from ENG-02's broader review, which also
covers boundaries, payment safety, and structure. -->

## Portable vs. project-specific classification

Per ENG-02's target architecture — classify each tool and each finding
class, not just the spike as a whole:

| Tool / finding | Portable (future central check) | Project-specific (stays here) |
| --- | --- | --- |
| | | |

## Feeds into

- ENG-02 item 1 (automated gates) — the recommendation above becomes its
  baseline.
- ENG-02 item 4 (threat-model note) — the misses section becomes its input.
- PLAY-01 — the recommendation section is written to be lifted directly
  into the playbook.
