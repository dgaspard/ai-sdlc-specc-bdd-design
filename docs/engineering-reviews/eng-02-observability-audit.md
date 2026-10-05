# ENG-02 — observability rule audit

Date: 2026-10-05. Reviewer: agent session (not yet the fresh/independent
reviewer called for by ENG-02's governance model — this is the first pass,
read against the actual implementation). Supports `BACKLOG.md`'s ENG-02
item 2: "list every OBS rule without a test and have the reviewer check
each against the code, recording followed / not followed / N/A."

Source of the rule list: `docs/observability.md`'s traceability table
(lines 212–259), which already marks which rules have a dedicated
rule-wide test. This audit covers every rule marked "No test" there, plus
one new gap found while auditing (OBS-046–048). Rules with a passing
dedicated test, or already-tracked partial-outcome gaps, are not repeated
here — see `docs/observability.md` directly for those.

## Key structural finding

Every service shares one `Runtime` class
(`services/platform/runtime.js`) that creates the SERVER span, the
business-operation span, and handles outcome→status mapping generically.
This means most instrumentation rules are enforced **once, structurally**,
for all five services at once, rather than per-service. That's good: a
rule proven here holds everywhere. It also means a bug here is a
single point of failure for every service's telemetry — worth knowing
before trusting this layer blindly.

## Audit results

| Rule | Followed? | Evidence |
| --- | --- | --- |
| OBS-003 — one business span per attempt, including rejected/failed | **Followed**, with a scope nuance | `runtime.js:515–522` opens the business span before `route.action()` runs; the `finally` at `553–570` always ends it exactly once, success or thrown `Problem`. Nuance: auth failures (403) and schema-validation failures (400) at `483–510` happen *before* the business span opens, so an unauthenticated or malformed request gets no business span — only the SERVER span. That's a reasonable product decision (not a business "attempt" yet), but it means OBS-003 as worded technically doesn't cover pre-authorization rejections. Not currently documented as a scope limit in `docs/observability.md` — worth adding. |
| OBS-004 — outcome/status mapping | **Followed** | `runtime.js:382–400` (`success` set) and `556–563` map every outcome to OK/ERROR/UNSET consistently; verified by reading, not by a dedicated test (the rule-level test referenced by `OBS-004` in `docs/observability.md` is marked "No test"). |
| OBS-005 — IDs present when known, never invented for failures | **Followed** | `attrs()` (`runtime.js:287–293`) silently drops `undefined`/`null` values, so a caller can't accidentally set an ID it doesn't have. Spot-checked `services/customer/server.js:131` (`customer.id` set from the URL param before the lookup even resolves, so it's present on `not_found` too, correctly, since it came from the request — not invented) and the `attrs()` call sites across `services/checkout/server.js` and `services/reservation/server.js`; all set IDs from resolved request/entity data, never placeholders. |
| OBS-006 — stable span names/attribute keys | **Followed**, structural | Business span names are built as `` `petclinic.${service}.${operation}` `` in one place (`runtime.js:517`) — there is no per-service code path where a name could drift or typo. |
| OBS-008 — exporter lifecycle and failure isolation | **Not followed in production** — real gap | `runtime.js:117–133`: the comment itself documents that an exporter-level failure (e.g., collector unreachable) can surface as an uncaught exception/unhandled rejection that bypasses the `client()`/`sendWithHttp` try/catch and **crashes the whole service**. The mitigation (swallowing those events) is explicitly scoped to `PETCLINIC_TEST_ENDPOINTS=enabled` only — i.e., test harness only. In a real deployment, a flaky OTel collector could take down a service over a dropped span. This is a genuine, previously-undocumented-as-a-gap finding, not a restated known issue. |
| OBS-009 — full sampling in demo/test | **Followed** | `runtime.js:134–148`: `BasicTracerProvider` is constructed with no sampler override, so the OTel SDK default (`ParentBased(AlwaysOn)`) applies — every root span is sampled. |
| OBS-012 — customer eligibility outcomes | **Followed** | `services/customer/server.js:127–142`: `customer.id` attribute set at line 131 before resolution; `app.outcome("eligible"/"ineligible")` at line 134; `not_found`/`failed` fall through the generic catch path. All four documented outcomes are reachable. |
| OBS-020 — dependency failure evidence | **Followed**, structural | `client()`/`dependency()` (`runtime.js:298–378`) mark the CLIENT span ERROR and `fail(502, ...)` on any non-2xx or network error; the outer catch (`537–552`) then marks the business span ERROR too (`ctx.outcome ??= ... "failed"`). A dependency failure can't silently read as a success. |
| OBS-021 — privacy of captured telemetry | **Followed** | Grepped every `attrs()` call site across all four services for clinical/payment-sensitive fields. `clinicalNotes`, `diagnoses`, and `medications` (`services/reservation/server.js`) never reach `attrs()` — only the derived boolean `visit.notes_missing` does (line 323). `mockMethodReference` (the fake payment method reference, `services/checkout/server.js:95,163,339`) is only ever passed into the internal HTTP request body to the fake payment provider, never into a span attribute. |
| OBS-022 — concurrent workflow isolation | **Followed**, structural | Each request runs inside its own `AsyncLocalStorage` context (`runtime.js:102`, `this.context.run(ctx, ...)` at `431`) — concurrent requests get independent context stores by construction, not by convention a developer could forget. |

## New gap found: OBS-046/047/048 still have no dedicated observability test

`docs/observability.md` already lists these as "Not yet written... red
tests pending" from MVP-02A planning. Confirmed still true as of this
audit: `grep -c "OBS-046\|OBS-047\|OBS-048" spec/tests/observability/business-traces.test.js`
returns zero matches. The underlying instrumentation is wired generically
(the operation strings `"added"` and `"reassigned"` are already in
`runtime.js`'s `success` set, lines 398–399) and the features themselves
are proven working through BDD/schema/Playwright coverage, but no test
asserts the actual span name/attributes match the OBS-046/047/048
contract specifically. This was planning language before; it's now a
confirmed, concrete follow-up — not closed by this audit, but no longer
just a TODO note.

## What this audit did not re-check

Rules already marked "Implemented; partial outcomes" in
`docs/observability.md` (OBS-025–030, OBS-033–035, OBS-043–045) have some
dedicated test coverage already, with specific named gaps (e.g.,
unexpected-failure branches). Those are pre-existing, already-tracked
items, not re-litigated here — this pass was scoped to rules with **zero**
dedicated test, per the backlog wording.

## Recommendation

1. OBS-008's production exporter-crash risk should get a BACKLOG item of
   its own — it's a real production reliability gap, not an observability
   nicety. Candidate fix: scope the uncaught-exception/unhandled-rejection
   guard to always apply (not just under `PETCLINIC_TEST_ENDPOINTS`), or
   wrap the OTLP exporter's own async paths so a collector outage can
   never reach `process`-level handlers at all.
2. Write the OBS-046/047/048 dedicated tests in
   `spec/tests/observability/business-traces.test.js`, following the exact
   pattern already used for OBS-027/OBS-048's sibling rules.
3. OBS-003's pre-authorization-rejection scope nuance is worth one line in
   `docs/observability.md` so a future reader doesn't assume 403/400
   responses get business spans.
