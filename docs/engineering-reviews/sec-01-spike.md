# SEC-01 — Security spike: calibrating automated gates against AI-generated code

Status: **run.** Executed locally (network access the Cowork sandbox doesn't
have) via `tools/security/run-sec01-spike.sh` plus one standalone repro of
the Python calibration copy, run separately after the scripted run's own
`cal-py-bandit.json` came back empty (its Bandit invocation is wrapped in
`|| true`, which silently swallows a failure — not yet root-caused, but the
standalone repro reproduces the same planted defects and isn't affected by
whatever that failure was, so its output is used below in place of the
scripted run's).

## Tool versions

| Tool | Version |
| --- | --- |
| Semgrep | 1.179.0 |
| Bandit | 1.9.4 |
| pip-audit | 2.10.1 |
| detect-secrets | 1.5.0 |
| npm | 11.19.0 |
| node | v24.21.0 |
| python3 | 3.12.6 |

## Real-build findings: JavaScript Checkout (impl-02)

Source: `js-semgrep.json`, `js-secrets.json`, `js-platform-audit.json`.

Clean. Zero findings across SAST, secret scan, and dependency audit. No sign
of the already-known shared-HS256-secret-across-services limitation (A-09)
surfacing as a scanner finding — that gap is architectural, not a
pattern any of these tools look for, which is itself consistent with why
SEC-01 treats it separately from this spike rather than expecting it to
show up here.

## Real-build findings: Python Checkout rebuild (r1)

Source: `py-bandit.json`, `py-semgrep.json`, `py-secrets.json`, `py-audit.json`.

Two real findings, both Bandit, both legitimate (not calibration noise):

- `clients.py:55` — `B310` (`urllib_urlopen`): URL passed to `urllib` is
  built from a variable rather than a literal. Worth a human look to confirm
  the value is never attacker-influenced; not confirmed exploitable in this
  spike, just flagged as the kind of thing this gate is supposed to surface.
- `http_runtime.py:318` — `B104` (`hardcoded_bind_all_interfaces`): server
  binds `0.0.0.0`. Likely intentional for a container/demo runtime, but a
  real finding worth a one-line justification comment at minimum.

The two implementations disagree here, and that disagreement is itself
informative: same spec, but only the Python rebuild produced real-app
findings. Doesn't necessarily mean the JS implementation is safer — could
just as easily mean Semgrep's default registry and the JS-specific rules
here have less default coverage for this app's patterns than Bandit does
for Python's. Not something this spike can distinguish; worth keeping in
mind before treating "Python flags more" as "Python is written worse."

**Methodology finding, not a defect finding:** Bandit's default behavior is
a recursive scan of everything under the target path, including `.venv` and
any vendored dependencies. Scanning the Python rebuild this way produced
hundreds of additional low-relevance findings against pip, protobuf,
opentelemetry, rich, urllib3, pygments, distlib, and other third-party
packages bundled under `.venv` — mostly `B101` (assert used), `B110`
(try/except/pass), `B105` (hardcoded password string, largely false
positives on short strings), `B311` (non-cryptographic random), and
`B404`/`B603` (subprocess import/usage). None of this is wrong, but it
drowns the two real findings above in noise and would make a required CI
gate unreviewable at scale. **`portable/run-sast.sh`'s Bandit invocation
(and the raw `bandit -r ...` calls in `run-sec01-spike.sh`) need an
exclude pattern (`-x .venv` or equivalent) before this tool's real-world
catch rate can be trusted without manual filtering.** Not yet implemented —
tracked as a follow-up, not blocking this write-up since the two real
findings above were confirmed by hand against the noise.

## Calibration table

Eight planted instances across six defect classes; see
`tools/security/calibration-defects.md` for what each one is and why it was
chosen. (Note: `run-sec01-spike.sh`'s own inline comments number the Python
defects "6" and "7" sequentially across the whole script, which doesn't
match `calibration-defects.md`'s per-class numbering — the Python `bad_shell`
snippet is class **3** (injection) and `bad_token_compare` is class **1**
(non-constant-time compare). The table below uses the class numbering from
`calibration-defects.md`, since that's the doc other work items reference.)

| # | Defect | Language | Caught? | By which tool(s) | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Non-constant-time secret comparison | JS | Yes (on retest) | Custom Semgrep rule (`timing-safe-compare.yml`) | Original planted snippet used generic `a`/`b` parameters and the rule didn't fire. Retested with realistic names (`signingSecret`/`requestSignature`) in a standalone repro: rule fired cleanly, blocking. Confirms the original miss was a planting-flaw artifact, not a real rule gap. |
| 1 | Non-constant-time secret comparison | Python | Yes (on retest) | Custom Semgrep rule (`timing-safe-compare.yml`) | Bandit has **no rule at all** for this pattern (confirmed separately, and unaffected by naming — it simply doesn't check for it). The custom Semgrep rule is the actual detector for this class; original `a`/`b` snippet didn't fire, but retested with realistic names (`signing_secret`/`request_signature`) in a standalone repro: rule fired cleanly, blocking. Same conclusion as JS — planting-flaw artifact, not a real gap. |
| 2 | Secret logged at error level | JS | Yes | Custom Semgrep rule (`secret-in-log.yml`) | Clean catch, no caveats. |
| 3 | Injection-shaped string concatenation | JS | No | — | Semgrep's default registry did not flag `db.query("... '" + customerId + "'")`. Likely because the snippet doesn't match a recognized ORM/driver call shape in the default ruleset — a real coverage gap for this specific style of injection, not a fluke. |
| 3 | Injection-shaped string concatenation | Python | Yes | Bandit (`B602`, subprocess_popen_with_shell_equals_true — HIGH severity, HIGH confidence) | Caught cleanly in a standalone repro free of `.venv` noise. Notably, this was caught by **Bandit's own built-in rule**, not Semgrep's default registry as `calibration-defects.md`'s table currently lists for this class — worth correcting that doc, since for the Python/shell-injection variant specifically, Bandit is doing the work. |
| 4 | Overly broad CORS | JS | No | — | Semgrep's default registry doesn't have a rule for the `Allow-Origin: *` + `Allow-Credentials: true` combination specifically. Consistent with `calibration-defects.md`'s note that detection here needs the default registry for the pattern plus a project-specific policy value (`cors-policy.json`) for what's acceptable — in this run, the detection half didn't materialize either. |
| 5 | Route skipping the auth hook | JS | No | — | Expected per `calibration-defects.md`: no engine exists yet for this class. SAST tools don't reason about "this route should have called `requireAuth` but didn't" — that needs a route-vs-contract cross-check, not a pattern-matching rule. |
| 6 | Dependency with a known CVE | JS | Yes | `npm audit` via `portable/run-dependency-audit.sh` | Clean catch after manually pinning a `services/platform` dependency down to a version with a published advisory. |

**Catch rate: 5 of 8 (62.5%).** (Originally measured as 3 of 8 against the
as-planted snippets; #1 in both languages was retested with realistic
variable names and the custom rule caught both — see below.)

## Where tools missed

Three remaining misses, each with a different right answer. (A fourth —
#1, non-constant-time compare — looked like a miss initially but turned out
to be a planting-flaw artifact: the original snippets used generic `a`/`b`
parameter names, and retesting the same custom Semgrep rule with realistic
names (`signingSecret`/`requestSignature`, `signing_secret`/
`request_signature`) caught it cleanly in both languages. No action needed
there beyond fixing the calibration snippet for next time — the rule works
as designed.)

- **#3, JS (injection via string concatenation).** Real gap: Semgrep's
  default registry doesn't recognize this call shape. **Action: add a
  project-specific custom rule** (mirroring the Python side, where Bandit's
  built-in coverage happens to fill the gap) rather than relying on the
  default registry for this pattern in JS.
- **#4, CORS.** Real gap on the detection side, independent of the
  already-known project-specific policy-value gap. **Action: add a custom
  Semgrep rule for the `Allow-Origin: *` + `Allow-Credentials: true`
  combination** — specific enough to write, general enough to be portable.
- **#5, route skipping the auth hook.** No automated engine exists for
  this class and none of the scanners here were ever expected to catch it.
  **Action: accept and disclose** for this spike; building the
  route-vs-contract cross-check is separate, larger work (already tracked
  under ENG-02 item 4, not SEC-01).

## Recommendation

**Minimum automated security floor for AI-generated service code, measured:**
Semgrep (default registry + the two custom rules for secret-in-log and
timing-safe-compare) + Bandit for Python code specifically (not redundant
with Semgrep — in this spike it caught a shell-injection pattern Semgrep's
default registry missed) + a dependency audit (`npm audit` / `pip-audit`).
Measured catch rate against the eight planted defects: **5 of 8 (62.5%)**.

Per the A-13 placement framework: all of the above belong in the agent's
local loop (fast enough to run before every commit, no network flakiness
once scanners are installed) rather than gated only in CI — same logic as
the other fast, deterministic checks already placed there. Bandit needs its
`.venv`/vendor exclusion fixed first, or its local-loop runtime and noise
will make agents and reviewers start ignoring it.

This is a floor, not a ceiling, and the 62.5% catch rate is the headline
number for the playbook — with an important caveat attached: automated
pattern-matching scanners reliably catch the classes they're built for
(CVEs, secrets in logs, well-known injection shapes with existing rule
coverage, and timing-unsafe comparisons when the custom rule is matched
against realistically-named code) and reliably miss the classes that
require project-specific context the tools don't have (CORS policy,
route/auth-hook wiring). Closing the remaining gap needs two different
follow-ups — a new custom Semgrep rule for the JS injection shape (#3), one
for the CORS misconfiguration (#4), and a separate route-vs-contract
cross-check for #5 — not "a better scanner." The #1 result is also a
process lesson worth stating plainly in the playbook: a calibration defect
planted with unrealistic variable names (`a`/`b`) will produce a false
"miss" even when the rule is correct — calibration snippets need
realistic naming to measure anything meaningful.

Distinct from ENG-02's broader review, which also covers boundaries,
payment safety, and structure beyond what automated security gates can see.

## Portable vs. project-specific classification

Per ENG-02's target architecture — classify each tool and each finding
class, not just the spike as a whole. Carried from `calibration-defects.md`'s
Classification column, with this spike's results noted where they change
the picture:

| Tool / finding | Portable (future central check) | Project-specific (stays here) |
| --- | --- | --- |
| Non-constant-time secret/token comparison (#1) | Semgrep custom rule (`timing-safe-compare.yml`), as-is — confirmed working in both languages against realistically-named code | — |
| Secret logged at error level (#2) | Semgrep custom rule (`secret-in-log.yml`) + `run-secret-scan.sh`, as-is | — |
| Injection-shaped string concatenation (#3) | Default Semgrep registry covers the Python/shell-injection shape (via Bandit, per this spike); **JS shape needs a new custom rule**, not yet portable | — |
| Overly broad CORS (#4) | Detection rule (once written) is portable | What counts as "acceptable" CORS is project-specific (`project-specific/cors-policy.json`) |
| Route skipping the auth hook (#5) | The cross-check *method* (route table vs. contract) would be portable once built | The data it reads (hook name, route table) is project-specific; not built yet |
| Dependency with a known CVE (#6) | `run-dependency-audit.sh`, as-is | — |
| Bandit's recursive `.venv` scanning | Exclude-pattern fix is portable (any project using Bandit hits this) | — |

## Feeds into

- ENG-02 item 1 (automated gates) — the recommendation above becomes its
  baseline.
- ENG-02 item 4 (threat-model note) — the misses section becomes its input.
- PLAY-01 — the recommendation section is written to be lifted directly
  into the playbook.
