# SPEC-06 — Checkout specification gap closure

Stage: JavaScript fixes verified; all ten frozen test suites pass. Broader SPEC-06 closure still requires independent review and a fresh Python reconstruction.

## Scope and decisions

D-58–D-65 were accepted by Dustin on 2026-10-05 before this draft. His acceptance
edits are preserved. D-66 was already decided and frozen; this task does not redo
its reassignment work. This change drafts protected specifications and tests only;
no application implementation is included. The subsequently updated freeze manifest
is included in the specification checkpoint; the agent did not run guard:freeze.

## Gap-to-evidence map

| Gap | Specification | Executable evidence |
| --- | --- | --- |
| GAP-08 / D-58 | OBS-030/033 closed outcomes include `not_assigned_veterinarian` | `business-traces.test.js`: `[OBS-030] SPEC-06 assignment rejection has no financial side effects`; equivalent OBS-033 test. Assert status, outcome, actor/entity IDs, unchanged bill and no downstream financial work. Existing assignment BDD scenarios retained. |
| GAP-09 / D-59 | Promotion/cash declare 502; accepted-money failure requires `paymentAttemptId` | `promotion.feature` and `visit-payment.feature`: GAP-09 scenarios; schema tests; OBS-030/033 completion-failure tests. Assert retained money state and correct problem code. |
| GAP-10 / D-60 | Shared `internal_error` code, generic InternalServerError response, explicit 500 on all four services' operations; runtime contract note | `spec06.test.js`: `[SPEC-06 GAP-10] unexpected failures have a declared generic 500 problem`. Structural schema coverage only: no language-specific fault injection or new test-only endpoint. This does not claim runtime exception/privacy fault coverage. |
| GAP-11 / D-61 | Zero remaining balance completes settled; booking fee is previously paid but not a visit attempt; replay preserves original response snapshot | `finalize-bill.feature`: zero-balance scenario plus strengthened single-service scenario; `payment-idempotency.feature`: card/cash replay after later settlement, with original snapshot and unchanged stored state. |
| GAP-12 / D-62 | Booking keys scoped per reservation; card/cash share one checkout/key scope | `payment-idempotency.feature`: independent booking/visit requests, card→cash and cash→card conflicts, independent keys across two bills; `booking-fee.feature` covers independent keys across two reservations. |
| GAP-13 / D-63 | Failed follow-up is retained and replayed without recovery | `payment-idempotency.feature`: card/cash × Customer/Reservation failure examples. Assert identical 502, original attempt, and no repeated provider/account/completion calls. OBS-031/033 assert failure replay trace. |
| GAP-14 / D-64 | Reservation `already_completed` accepted; Customer `already_applied` fails | `visit-payment.feature`: two GAP-14 scenarios using contract-validated 409 dependency replies. |
| GAP-15 / D-65 | Promotion amount required, minimum 1 cent in API and domain; supersedes D-26/D-34 zero default | `promotion.feature`: missing/zero rejection, no stored promotion or discount, subsequent 1-cent success. Existing one-promotion test uses a valid positive amount. `spec06.test.js` covers missing/zero/negative/fractional and valid amounts. |

Related artifacts: `spec/contracts/checkout.openapi.json`, `common.openapi.json`,
`domain.openapi.json`, the other three service contracts' shared 500 responses,
`docs/specs/domain-model.md`, `docs/specs/schema-decisions.md`, and
`docs/observability.md` (registry and coverage updated together).

## Verification

Initial sandboxed `npm test` could not bind local ports (`listen EPERM`) and was
stopped. Those failures are infrastructure failures, not product evidence. The
suite was restarted with local-server permissions.

- Schema suite: 173 passed, zero failures.
- Checkout service BDD in a disposable copy on separate ports: 64 scenarios,
  63 passed, one failed. The failing GAP-11 scenario finalizes a bill with zero
  remaining balance; Checkout never sends Reservation a settled completion.
- Five new SPEC-06 trace tests in the disposable copy: three passed, two failed.
  OBS-033 assignment rejection omits `petclinic.veterinarian.id` for the known
  acting veterinarian. Its business outcome is already correct. OBS-030 also omits the saved
  promotion ID when Reservation completion fails after the discount succeeded;
  the strengthened test requires the saved ID and amounts on that failure span.
- Full `npm test`: seven suites passed; guard, observability and service BDD failed
  for the documented reasons. Harness: 45 passed; schema: 172 passed in that run
  (the final schema-only rerun includes one added check and passes all 173);
  runtime: 52 passed; authentication: 274 passed; observability: 123 passed,
  two failed; service BDD: 283 passed, one failed; backend journeys: 11 passed;
  browser journeys: nine passed; performance: four passed. The full run includes
  the final separate-reservation key scenario and strengthened replay assertions.
  No additional product failures were observed.
- `git diff --check`: passed. No application source, guard manifest, skipped-test
  declaration, or focused-test declaration was changed.

Commands: `npm test`, `npm --prefix spec run test:schema`; focused copy checks:
`npm run test:bdd -- --tags @service:checkout` and
`node --test --test-name-pattern SPEC-06 tests/observability/business-traces.test.js`
from the disposable copy's `spec/` directory. Full-run output is retained locally
at `test-results/spec-06/full.log` (ignored generated evidence).

The disposable copy preserves application code and uses alternate local ports so
focused verification cannot interfere with the full suite. Several additions pass
because existing implementation already follows the accepted decisions. Promotion
validation also uses the published request schema at runtime, so the tightened
schema rejects zero/missing amounts without an application-code edit. Passing
checks are recorded as existing behavior; no artificial implementation failure was
introduced to force a red result.

## Next action

The three demonstrated implementation gaps are fixed and `npm test` is green.
Independent fresh-session engineering review and a fresh Python reconstruction
remain for the broader SPEC-06 milestone. The frozen specification checkpoint is
`93f6761`; the implementation follow-up is recorded in the accompanying fix commit. The earlier red verification
above is retained as historical evidence, not the current test result.

## JavaScript implementation follow-up

The requested fixes are confined to `services/checkout/server.js`:

- A finalized bill with zero remaining balance calls Reservation completion after
  account writes and local bill persistence, before reporting finalization success.
  Completion errors still propagate as dependency failures; a repeat finalization
  cannot repeat the account charge because the saved bill already exists.
- Payment trace attributes are recorded before the cash assignment check so a
  rejected action retains the caller's veterinarian ID without accepting payment.
- Saved promotion attributes are recorded after Customer confirms the discount
  and before Reservation completion, preserving their evidence on completion error.

Focused verification: all 65 Checkout BDD scenarios and five SPEC-06 trace checks
pass with the frozen specifications unchanged. Lint passes and Checkout formatting
passes. Repository-wide formatting reports pre-existing issues in six unchanged
files (`services/customer/server.js`, `frontend/appointments.js`, `frontend/ui.js`,
`frontend/veterinarians.js`, `tools/review/portable/check-import-boundaries.mjs`,
`tools/review/project-specific/import-boundaries.test.mjs`).

Full `npm test`: all ten suites pass. Harness 45, schema 173, runtime 52,
authentication 274, observability 125, service BDD 284, backend journeys 11,
browser journeys 9, and performance 4 checks/scenarios pass; guard also passes.
No protected file or test changed. `npm run test:engineering`: all 10 supplemental checks pass. This implementation review
is not the independent fresh-session ENG-02 review. That review and the fresh
Python reconstruction remain follow-ups for closing the broader SPEC-06 item.

Final implementation logs: `test-results/spec-06/implementation-full.log`,
`implementation-engineering.log`, `implementation-focused.log`, and
`implementation-check.log`. `git diff --check` passes.
