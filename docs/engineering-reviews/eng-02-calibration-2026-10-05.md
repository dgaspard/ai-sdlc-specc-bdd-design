# ENG-02 calibration — round 1 (2026-10-05)

ENG-02 item 5. Answer key: [`tools/review/project-specific/calibration-manifest.md`](../../tools/review/project-specific/calibration-manifest.md)
(committed in `3a13746`, before any review ran). Plant script:
`plant-calibration-defects.mjs` (same folder). Raw reviewer output:
[eng-02-calibration-review-round1-2026-10-05.md](eng-02-calibration-review-round1-2026-10-05.md).

**Status: L0 and L2 scored; L1 network gates (jscpd, Semgrep, secret scan)
pending a local run** of `bash tools/review/project-specific/run-calibration-gates.sh`.

## Setup

- **Target:** `main` at `f86ac60`, copied without `.git`, the answer key, or
  the plant script. 13 defects planted at once for the reviewer.
- **L0 frozen tests:** schema, harness, runtime, auth, observability, BDD,
  and workflow suites. Browser and performance suites were not run (no
  Chromium in the sandbox; neither suite is designed to catch these defects).
  Run first with all 13 planted. Every failing test was then rerun with
  its suspected defect planted *alone* to confirm attribution. Auth and
  `business-traces` were chunked by test name to fit the sandbox's ~3-minute
  command limit.
- **L1 gates:** the import-boundary check and `tools/review/project-specific/`
  engineering tests ran in the sandbox. jscpd and Semgrep need network.
- **L2 reviewer:** a fresh general-purpose subagent with no conversation
  history. It was handed the unchanged `review-prompt.md` and told to review
  "a JavaScript build," with no mention of calibration or planted defects.
  It was barred from reading the real repo, and the tree it reviewed had no
  git history to diff against. It took 6.5 minutes and made 31 tool calls.

## Results

| ID | Defect | L0 frozen tests | L1 gates | L2 reviewer |
| --- | --- | --- | --- | --- |
| CAL-01 | Chicago-time helper copied into Checkout | — | jscpd: *pending* | **Caught** (REV-015, REV-019). Rated low/note; mis-mapped to REV-006 in its own summary |
| CAL-02 | Payment method reference in span | — (OBS privacy tests pass) | Semgrep: *pending* | **Caught** (REV-008, high) |
| CAL-03 | Service tokens skip HMAC | **— (gap)** | Semgrep: *pending* | **Caught** (REV-001, critical; verified live with a forged `alg:none` token) |
| CAL-04 | `!==` instead of `timingSafeEqual` | — | custom Semgrep rule: *pending* | **Caught** (REV-003, medium) |
| CAL-05 | Checkout falls back to the catalog's seed file | Side effect only: 1 BDD scenario ("Unknown performed service") and 2 OBS-029 traces fail because the fallback swallows `unknown_service` | import-boundary: **missed** (expected: data read, not an import) | **Caught** (REV-006, high) |
| CAL-06 | Any veterinarian passes admin-only roster routes | **Caught**: 2 BDD scenarios, AUTH-006 add/update vet | — | **Caught** (REV-005, high; verified live) |
| CAL-07 | `reservation.id` dropped from OBS-048 span | — (expected: OBS-048 has no test) | — | **Caught** (REV-014, low) |
| CAL-08 | `/availability` ignores `active` | **Caught**: BDD "A deactivated veterinarian offers no availability" | — | **Caught** (REV-011, medium) |
| CAL-09 | `new RegExp(userInput)` | — | Semgrep: *pending* | **Caught** (REV-013, medium; verified live) |
| CAL-10 | Reflected CORS + credentials | **Caught**: RT-006 × 4 services | Semgrep: *pending* | **Caught** (REV-004, high; verified live) |
| CAL-11 | `/internal/*` skips auth from loopback | **Caught**: AUTH-005/006 on all 4 internal operations | — | **Caught** (REV-002, critical; verified live) |
| CAL-12 | `incompleteBills` guard removed | — | **Caught**: `engineering-review.test.mjs` test 4 | **Caught** (REV-007, high) |
| CAL-13 | Rejected bearer token logged | — | secret-in-log rule: *pending* | **Caught** (REV-012, medium; verified live) |

**Catch rates:**

- **L2 reviewer:** 13/13 (100%) on the first round. Under the agreed rule, no
  rerun was needed.
- **L0 frozen tests:** 4/13 caught directly (CAL-06, 08, 10, 11), plus 1
  side effect (CAL-05).
- **L1 sandbox gates:** 1/13 (CAL-12). The jscpd and Semgrep columns stay
  open until the local run.
- **Missed by everything except the reviewer:** CAL-01 (pending jscpd),
  CAL-02, CAL-03, CAL-04, CAL-07, CAL-09, and CAL-13. The last five also
  depend on the pending Semgrep run.

## What the numbers mean (and don't)

1. **The reviewer is the only layer that sees boundary and auth-logic
   defects without a test written for them.** CAL-03 is the clearest
   example: no frozen test forges a *service* token with a bad signature.
   The bad-signature tests reuse user-role claims, so an implementation that
   trusts service tokens passes the whole suite. This is a candidate spec
   change (see follow-ups).
2. **Blindness was partial, by design of the prompt.** `review-prompt.md`
   lists the six original calibration classes. The reviewer used that list:
   its summary maps findings to "the six planted defect types." It still
   found the seven defects outside that list (CAL-04, 08, 09, 10, 11, 12, 13),
   so the score doesn't rest on the list. Still, a cleaner blind run would
   hand the reviewer a copy of the prompt with the "Calibration defects"
   section removed.
3. **Severity calibration is weaker than detection.** CAL-01 (duplicated
   logic) was rated low/note, and CAL-04 (timing-unsafe compare) medium. Both
   are defensible but not what the manifest's framing implies. Severity
   wasn't part of the pass criterion. Worth deciding whether it should be.
4. **One reviewer, one round, one model.** This is n=1. It shows the checklist
   *can* catch all 13. It doesn't show it reliably will. A second blind
   round, on the revised prompt, would test repeatability.
5. **The reviewer found real issues the plants didn't introduce, and missed
   one.** It independently found PRE-01 (the OBS-047 attribute, in REV-014).
   It did not find PRE-02 (path injection into service-token calls), which I
   noticed while planting. The checklist now has an item for that shape.

## Checklist changes made (`review-prompt.md`)

There was no miss to fix, but the reviewer's own suggestions and the PRE-02
gap were worth adding:

- §3: no auth decision based on peer address, loopback, or Host/Origin headers.
- §3: CORS must match RT-006 exactly. Check it together with the item above.
- §3: request-supplied values must not be interpolated into service-token
  URLs, `RegExp`, or shell/query strings (the PRE-02 shape).
- §2: after a partial failure, can a retry *finish the job*? (From REV-009,
  REV-010, and the second half of REV-007, all of which are real on `main`.)
- §2: is every anti-double-charge guard actually read?
- §4: logs count as telemetry: no tokens or secrets in `console.*`.
- Gate command fixed: `npm --prefix spec run guard:check` (the root script
  doesn't exist).

## Real findings on `main` (not planted) — need your triage

Surfaced by the reviewer or by the calibration runs. All were confirmed
against `main` by reading the code; none were fixed here.

| # | Finding | Source | Notes |
| --- | --- | --- | --- |
| 1 | **Guard is red on `main`:** 11 protected files changed since the last freeze | REV-020; reproduced on the real repo | The REV-001–005 fixes (`51d9115`, `3c12725`) and `f86ac60` edited protected specs/tests without a `guard:freeze`. Needs your review + freeze. |
| 2 | **2 observability tests fail on `main`:** `[OBS-043] register emits registered/validation_error` return 502 | Calibration baseline run | Customer's REV-004 fix now calls Reservation `/veterinarians` during registration; the observability fixture apparently doesn't provide that dependency. Fixing it touches protected `spec/`. Please confirm locally. |
| 3 | PRE-01: OBS-047's `veterinarian.active` attribute is never set; OBS-046's outcome is `added`, but the contract says `created` | Manifest + REV-014 | |
| 4 | PRE-02: decoded path params flow into service-token downstream URLs | Manifest (reviewer missed) | Impact not yet assessed |
| 5 | An authorized payment whose credit failed can't be finished by a retry | REV-009 | |
| 6 | Promotion to $0 followed by a failed `complete()` strands the reservation | REV-010 | |
| 7 | A partial finalize failure blocks the bill permanently (the `incompleteBills` guard prevents a double charge, but nothing recovers) | REV-007 second half | |
| 8 | Checkout's `assignedVets` snapshot ignores later reassignment | REV-016 | May be acceptable if attribution freezes at finalize; needs a decision |
| 9 | The `roles` claim accepts `"service"` | REV-017 | Defense in depth (needs the secret, THREAT-01) |
| 10 | `dependency()` passes downstream 4xx codes through to callers | REV-018 | |
| 11 | Booking fee hardcoded in 4 places | REV-019 | |

## Follow-ups

- **Run the local L1 gates** (`run-calibration-gates.sh`), then fill in the
  jscpd/Semgrep column.
- **Spec gap (your call, protected):** add an AUTH-005 case that forges a
  `role: "service"` token with a bad signature against each internal
  operation. This would have caught CAL-03 at L0.
- Optional round 2: a fresh blind reviewer on the revised prompt, with the
  calibration-classes section stripped from its copy, to test repeatability
  and the new PRE-02 item.
