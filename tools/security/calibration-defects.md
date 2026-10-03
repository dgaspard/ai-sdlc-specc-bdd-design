# SEC-01 calibration defects

Not protected, not part of `npm test`. The planted defects below exist only
as isolated, clearly-labeled standalone snippets inside a throwaway scratch
copy that `run-sec01-spike.sh` creates and deletes on every run — never
wired into real business logic, never committed, never deployed. This
mirrors how TEST-01 proved step definitions against a deliberately-broken
spike service and then deleted it: the point is to measure whether the
scanners catch a known-bad pattern, not to actually ship one.

Six defect classes, eight planted instances — two reproduced in both
languages specifically to see whether catch rate holds across JavaScript and
Python, not just within one:

| # | Defect class | Language(s) | Why this one | What should catch it | Classification |
| --- | --- | --- | --- | --- | --- |
| 1 | Non-constant-time secret/token comparison | JS + Python | The project already uses a single shared HS256 secret (A-09); a timing side-channel on a comparison involving it is a realistic, specific risk, not a generic textbook one. | `portable/semgrep-rules/timing-safe-compare.yml` | Portable, as-is |
| 2 | Secret logged at error level | JS only | Error-path logging is exactly where secrets leak in real incidents — someone adds `console.error(err, context)` while debugging and the signing secret rides along. | `portable/semgrep-rules/secret-in-log.yml`, `portable/run-secret-scan.sh` | Portable, as-is |
| 3 | Injection-shaped string concatenation | JS + Python | Building a query or shell command via string concatenation with user input is the single most common AI-generated-code vulnerability class in published benchmarks. | `portable/run-sast.sh` (Semgrep's default registry already covers this — no custom rule needed) | Portable, as-is |
| 4 | Overly broad CORS | JS only | `Access-Control-Allow-Origin: *` paired with `Allow-Credentials: true` is a specific, realistic misconfiguration an agent can plausibly generate when asked to "allow the frontend to call this." | `portable/run-sast.sh` (default registry) for detection; `project-specific/cors-policy.json` for what "acceptable" means here | Portable rule, project-specific policy value |
| 5 | A route that skips the auth hook | JS only | The project's whole auth model (A-09) depends on every route going through the same check; one route that's wired up without it is the realistic way this fails, not an attacker defeating the mechanism itself. | No engine yet — see `project-specific/auth-coverage-notes.md`. Worth noting if none of the automated scanners catch this one; that's itself a real result, not a bug in the spike | Portable method (route-vs-contract cross-check), project-specific data (hook name, route table) — not built yet |
| 6 | Dependency with a known CVE | JS only (manual) | Pin one `services/platform` dependency in the scratch copy down to a version with a published advisory, run `portable/run-dependency-audit.sh` again, confirm it's flagged, and record the exact package/version/advisory ID. | `portable/run-dependency-audit.sh` | Portable, as-is |

Recording "none of the scanners catch #5" as a real finding, if that's what
happens, is more valuable to the write-up than making every defect catchable
— that is exactly the kind of gap SEC-01 exists to surface and decide
what to do about (add a tool, add a targeted scenario-level check, or accept
and disclose the residual gap), per the backlog entry.

The Classification column is the answer to a separate, broader question —
which of these checks belong in a shared, org-level library versus staying
local to this project — worked out in full in `portable/README.md` and
`project-specific/README.md`.
