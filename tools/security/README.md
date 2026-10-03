# Security checks and the SEC-01 spike

Not protected, not part of `npm test` (except `portable/`, which
`.github/CODEOWNERS` requires review on — see `portable/README.md`).

```
tools/security/
  portable/            # generic checks — see portable/README.md for the
                        # portable-vs-project-specific test to apply
  project-specific/    # this app's own config/findings
  calibration-defects.md
  run-sec01-spike.sh
```

Supports the SEC-01 backlog item: calibrate automated security gates against
AI-generated code, before ENG-02 relies on them. The spike script is a thin
orchestrator around `portable/run-*.sh` — the same scripts a real CI job
would call — so the spike measures exactly what a future required check
would measure, not a parallel implementation of it.

## Why this needs to run outside a network-restricted sandbox

`run-sec01-spike.sh` installs and runs Semgrep, Bandit, pip-audit, and
detect-secrets, and calls `npm audit`. All of that needs real access to PyPI
and the npm registry. Run it on a machine with normal internet access —
your own terminal, or Claude Code running locally against this repo — not
inside an agent sandbox whose outbound network is restricted (that's
exactly the `403 from proxy` behavior this project has already hit when
pushing to GitHub from inside one).

## Running it

```
bash tools/security/run-sec01-spike.sh
```

By default it scans the Python Checkout rebuild at
`~/petclinic-demo-runs/r1/services/checkout`. Point it at a different
rehearsal workspace with:

```
SEC01_PY_CHECKOUT=/path/to/workspace/services/checkout bash tools/security/run-sec01-spike.sh
```

It will:

1. Install the scanners (`pip install ... --break-system-packages`).
2. Scan the real JavaScript Checkout (`services/checkout`) and the real
   dependencies it shares via `services/platform`.
3. Scan the real Python Checkout rebuild.
4. Make a throwaway scratch copy of both, plant the calibration defects
   documented in `calibration-defects.md`, rescan, and leave the raw JSON
   under `tools/security/.spike-output/` (gitignored — it can contain file
   paths and scanner noise not worth committing).
5. Delete the scratch copy. Nothing with a planted vulnerability is ever
   committed or kept around.

## After it runs

Fill in `docs/engineering-reviews/sec-01-spike.md` (a starting template
already exists) from the JSON in `tools/security/.spike-output/`: tool
versions, real true positives found in each build, the calibration table
(defect → caught y/n → by which tool), and the resulting recommendation.
If you're running this via Claude Code locally, it can read that output
directory directly and draft the write-up for you.

Record every finding's classification — portable (candidate for a future
org-level, centrally curated check, per ENG-02's target architecture) or
project-specific (stays local to this repo) — per defect and per tool, not
just overall.
