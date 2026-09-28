# FE-01 browser acceptance plan

Status: draft executable checks in `journeys.spec.js`, run with
`npm --prefix spec run test:browser`. Design and baseline review remain pending.
Existing Playwright HTTP journeys remain
unchanged and do not establish UI correctness.

Red baseline on 2026-09-28: all five tests launched successfully and failed at the
missing `Sign in` heading against the frontend runtime shell. Proposed PNGs stayed
unchanged. Later assertions await a working implementation; see
`docs/fe-01-handoff.md` at the repository root for full validation evidence.

Use the pinned `@playwright/test` already in spec. One headless Chromium worker;
reuse the browser and service processes across tests, reset service state and use
fresh contexts per test. Run serially because service resets share fixed ports.
No retries hiding failures, fixed sleeps, video, browser matrix, or full backend
scenario duplication. Action-based waiting and bounded assertions only. Keep
screenshots/trace attachments on failure; approved comparison screenshots are
still taken on successful visual checks.

Draft independently meaningful tests:

| ID | Browser assertions | Independent backend assertions |
| --- | --- | --- |
| FE-001 | Sign in fails clearly for bad credentials, succeeds for a real customer; protected-route reload and sign out | Existing auth contract remains authoritative |
| FE-002 | Customer requests → assigned vet accepts, records visit and finalizes → customer pays; success copy and amounts; reload retains backend outcome | Requested/Accepted/CompletedSettled, visit relations, customer debt zero, exactly two provider authorizations (booking + visit) |
| FE-003 | Decline keeps balance unchanged; explicit new payment can succeed; rapid double submission cannot collect twice | Provider requests and account credits prove no duplicate payment |
| FE-004 | Another customer cannot read a bill by direct URL; wrong vet cannot use assigned-vet actions | No visit or payment created by denied UI actions; do not retest the full auth matrix |
| FE-005 | Lost response, page reload, and retry keep the same UUID and payload; attention message never reports ambiguous payment as settled | Observe real network request keys and provider count; inject one browser transport interruption after a real response, not a fake success |

FE-001 and FE-002 take three screenshot comparisons total: login, Requested
customer appointments, and unpaid customer bill. No separate browser startup for
each image. Assertions for text, labels, amounts, and statuses remain exact even
when screenshot comparison allows minor raster differences.

Feature descriptions are under `spec/features/frontend/`; their FE IDs map to the
five Playwright tests. The browser command is included in the aggregate runner.
Before implementation, verify missing-frontend failures and review/freeze the
complete set, including approved PNG references. The frontend feature path remains
outside the service Cucumber profile. Tests call pages
and published HTTP APIs only; never import frontend application code. Test harness
may seed through APIs and control test clocks; core FE-002 actions use the UI.

Do not set snapshot-update mode during ordinary tests. Missing baselines must fail
without creating files under protected paths. Baseline authoring is an explicit
review activity; compare source hashes before/after ordinary test execution.

Measure elapsed browser-suite time once runnable. Proposed target: under 30 seconds
warm on the reference machine, including suite startup/teardown, excluding package
installation. This is an optimization target, not an agreed PERF-01 threshold.
Record actual duration; optimize fixtures before cutting coverage or assertions.
