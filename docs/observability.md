# Observability standard and workflow contracts

## Status and authority

This document separates cross-service coding standards from workflow span contracts
for the new four-service design ([SPEC-01](specs/business-decisions.md),
[SPEC-02](specs/domain-model.md)). All rules are **proposed** until the specification
review approves them; assigning an ID does not approve semantics. TEST-01 supplies
protected assertions for scoped runtime, access, business-trace, and cross-process
checks. The temporary-service rehearsal passed those checks, but application
implementation status remains red. The legacy app and its OBS-011 contract are
preserved at tag `1.0` and are not part of the new suite (D-24).

## OpenTelemetry conformance

Services follow OpenTelemetry specifications (PROJECT-PLAN A-08, BACKLOG OTEL-01): the
official SDK per language, OTLP/HTTP protobuf export only (A-10), W3C Trace Context, standard resource attributes,
and semantic conventions for HTTP spans and errors. The `petclinic.*` names below are
only for business attributes with no standard equivalent. Reference version: semantic
conventions **v1.44.0**; only the stable HTTP subset (stable since v1.23) is enforced, so SDK
versions may differ by language. Official auto-instrumentation is allowed but not required;
tests check only what reaches the collector (`spec/harness/semconv.js`). Auth tokens and
passwords are forbidden in telemetry.

## Naming conventions

| Element | Convention | Example |
| --- | --- | --- |
| `service.name` | `petclinic-<service>` | `petclinic-veterinarian-services` |
| Span name | `petclinic.<service>.<operation>`, lowercase snake_case, no IDs or input | `petclinic.checkout.apply_promotion` |
| Service segment | `customer`, `reservation`, `veterinarian_services`, `checkout`, `payment` (fake provider boundary) | — |
| Entity ID attribute | `petclinic.<entity>.id`, opaque UUID string, only when known | `petclinic.visit.id` |
| Outcome attribute | `petclinic.operation.outcome`, one value from the rule's enum | `denied_outstanding_balance` |
| Money attribute | `petclinic.<name>.amount_cents`, integer cents | `petclinic.promotion.applied_amount_cents` |

Entity ID attributes used below: `petclinic.customer.id`, `petclinic.pet.id`,
`petclinic.veterinarian.id`, `petclinic.reservation.id`, `petclinic.visit.id`,
`petclinic.checkout.id`, `petclinic.promotion.id`, `petclinic.payment.attempt.id`.

## Cross-service standards

1. **OBS-001** — Use OpenTelemetry tracing. Each process has a stable `service.name`:
   `petclinic-customer`, `petclinic-reservation`, `petclinic-veterinarian-services`,
   or `petclinic-checkout`. The fake payment provider uses `petclinic-payment-fake`.
2. **OBS-002** — Extract incoming W3C trace context and inject it into outgoing HTTP calls.
   Downstream server spans share the initiating trace ID and have the outgoing
   client span as their parent. Concurrent requests must not mix active contexts.
3. **OBS-003** — Create one named business-operation span per attempt, including rejected and
   failed attempts. End every span exactly once, including exception paths. An
   idempotent replay is an observable attempt but must not repeat payment work.
4. **OBS-004** — Successful business operations use status `OK`. Expected business
   rejections (denial, decline, invalid slot, conflict, invalid state) use `UNSET`
   with an explicit outcome. Unexpected internal/dependency failures use `ERROR`,
   outcome `failed`, and a stable `error.type`. The specific exception is a successful
   authorization followed by a failed account or reservation write: status `ERROR`,
   outcome and `error.type` both `authorized_completion_failed`. HTTP instrumentation keeps its own
   status conventions. Payment timeouts are out of scope (D-11).
5. **OBS-005** — Put opaque entity IDs on spans when known; never invent IDs for failures.
   Do not record names, phone numbers, addresses, emergency/secondary contacts,
   insurance details, billing data, mock payment-method tokens, authorization
   references, raw idempotency keys, clinical notes, diagnoses, medications,
   follow-up notes, denial-reason text, authorization headers, or whole
   request/response bodies. Sanitize exception information before export.
6. **OBS-006** — Keep span names and attribute keys exactly as specified by the naming
   conventions and workflow contracts. Outcome enums are closed lists.
7. **OBS-007** — If structured application logs are added, include service, event name, severity,
   outcome, and active trace/span IDs. Apply the same data-exclusion rules to logs.
8. **OBS-008** — Flush and shut down test exporters deterministically. Verify completed spans,
   not console output. Telemetry export failures must not change business results.
9. **OBS-009** — Sample all traces in the deterministic demo/test configuration. Production
   sampling, external monitoring, dashboards, and alerting are later scope.
10. **OBS-010** — If metrics are added, use bounded labels such as service, operation, and outcome.
    Never label metrics with entity IDs, trace IDs, or idempotency keys.
11. **OBS-041** — HTTP spans follow stable semantic conventions. Incoming (SERVER) spans carry
    `http.request.method`, `http.route`, `url.path`, `url.scheme`, `http.response.status_code`
    and are named `{method} {route}` (e.g. `GET /health`). Outgoing (CLIENT) spans carry
    `http.request.method`, `server.address`, `server.port`, `url.full`,
    `http.response.status_code`. 5xx responses add `error.type`. Deprecated names
    (`http.method`, `http.status_code`, `http.url`, `http.target`, `net.peer.name`) are
    forbidden. Every `petclinic.*` business span is a child of its request's SERVER span.
12. **OBS-042** — Every span's resource has `service.name` (per OBS-001), a non-empty
    `service.version`, and `telemetry.sdk.language` (shows `nodejs` or `python` in the demo).

## Workflow span contracts

All spans carry `petclinic.operation.outcome`. Attributes are required when the
entity is known at that point.

| Rule | Span (owning service) | Attributes | Outcome values |
| --- | --- | --- | --- |
| OBS-012 | `petclinic.customer.check_eligibility` (Customer) | customer.id | `eligible`, `ineligible`, `not_found`, `failed` |
| OBS-023 | `petclinic.reservation.request` (Reservation) | customer.id, pet.id, veterinarian.id, reservation.id when stored | `requested`, `denied_outstanding_balance`, `invalid_slot`, `past_start`, `pet_conflict`, `not_found`, `failed` |
| OBS-024 | `petclinic.reservation.accept` (Reservation) | reservation.id, veterinarian.id, payment.attempt.id when attempted | `accepted`, `past_start`, `booking_payment_declined`, `slot_unavailable`, `pet_conflict`, `not_assigned_veterinarian`, `invalid_state`, `not_found`, `failed` |
| OBS-025 | `petclinic.reservation.deny` (Reservation) | reservation.id, veterinarian.id | `denied`, `not_assigned_veterinarian`, `invalid_state`, `not_found`, `failed` |
| OBS-026 | `petclinic.reservation.cancel` (Reservation) | reservation.id, customer.id | `canceled`, `already_started`, `not_assigned_veterinarian`, `invalid_state`, `not_found`, `failed` |
| OBS-027 | `petclinic.reservation.record_visit` (Reservation) | reservation.id, visit.id when created, veterinarian.id | `recorded`, `already_recorded`, `not_assigned_veterinarian`, `invalid_state`, `unknown_service`, `not_found`, `failed` |
| OBS-028 | `petclinic.veterinarian_services.get_fees` (VeterinarianServices) | `petclinic.veterinarian_service.count` (integer) | `found`, `unknown_service`, `failed` |
| OBS-029 | `petclinic.checkout.finalize_bill` (Checkout) | checkout.id when created, visit.id, reservation.id, veterinarian.id, `petclinic.checkout.remaining_amount_cents` | `finalized`, `already_finalized`, `not_assigned_veterinarian`, `unknown_service`, `invalid_state`, `not_found`, `failed` |
| OBS-030 | `petclinic.checkout.apply_promotion` (Checkout) | checkout.id, visit.id, promotion.id when created, veterinarian.id, `petclinic.promotion.amount_cents`, `petclinic.promotion.applied_amount_cents` | `applied`, `already_applied`, `nothing_owed`, `not_found`, `failed` |
| OBS-031 | `petclinic.checkout.pay` (Checkout) | checkout.id, visit.id, reservation.id, payment.attempt.id, `petclinic.checkout.replayed` (boolean) | `settled`, `declined`, `already_settled`, `invalid_amount`, `idempotency_conflict`, `authorized_completion_failed`, `not_found`, `failed` |
| OBS-032 | `petclinic.payment.authorize` (client span in calling service) | payment.attempt.id, `petclinic.payment.purpose` (`booking_fee` or `visit_balance`), `petclinic.payment.provider` = `fake`, `petclinic.payment.amount_cents` | `authorized`, `declined`, `failed` |
| OBS-033 | `petclinic.checkout.record_cash` (Checkout, D-32) | payment.attempt.id, veterinarian.id, reservation.id, visit.id when present, `petclinic.payment.purpose`, `petclinic.checkout.replayed` (boolean) | `recorded`, `already_settled`, `invalid_amount`, `idempotency_conflict`, `not_found`, `failed` |
| OBS-034 | `petclinic.customer.apply_account_change` (Customer) | customer.id, visit.id, `petclinic.account.change_type` (`charge`, `credit`, `discount`) | `applied`, `already_applied`, `invalid_amount`, `not_found`, `failed` |
| OBS-035 | `petclinic.reservation.complete` (Reservation) | reservation.id, visit.id | `completed_settled`, `completed_outstanding`, `already_completed`, `invalid_state`, `not_found`, `failed` |

Notes:

- `denied_outstanding_balance` stores a Denied reservation (D-20); the balance amount
  and denial message are not exported.
- `invalid_slot` covers weekends, lunch, non-slot hours, and wrong duration (D-03, D-22).
  `past_start` covers requests starting in the past (D-18).
- `booking_payment_declined` leaves the reservation Requested with no capacity consumed (D-23).
- `invalid_amount` on OBS-034 means a change that would make the balance negative;
  it is rejected, never clamped (D-26).
- `authorized_completion_failed` means payment succeeded but a later write failed and
  needs manual recovery (D-10). It must not be reported as `settled` or `declined`.
- A replay reports the original outcome with `petclinic.checkout.replayed=true`.
  Cash replays use `recorded` / `OK`, not `already_recorded`. Identical retries
  reuse the original attempt, with no repeated credit or completion. Changed input
  under the same key yields `idempotency_conflict` / `UNSET` before checking balance.
  A new visit-payment key against a zero balance yields `already_settled` / `UNSET`;
  a positive amount different from the balance yields `invalid_amount` / `UNSET`.
  These rejections create no payment attempt, so its ID is omitted when unknown.
  First cash recording has `replayed=false`. An already-paid booking fee retains
  its original result even under a new key, per the existing booking-fee contract.
- For veterinarian actions (accept, deny, record visit, finalize bill, promotion,
  cash recording), `petclinic.veterinarian.id` identifies the acting veterinarian,
  including assignment rejections. On reservation requests it identifies the
  requested veterinarian. It is omitted when neither is known.
- OBS-027 `unknown_service` rejects IDs absent from the seeded catalog with 422
  before saving a visit. No new service dependency is introduced.
- OBS-029 `invalid_state` rejects first finalization unless the linked reservation
  is Accepted and its `visitId` matches the recorded visit. No checkout/account
  mutation occurs. An existing checkout instead yields `already_finalized`.

## Required end-to-end evidence

These combine the individual rules across real service processes.

- **OBS-036 — Checkout success:** a `checkout.pay` trace contains `payment.authorize`
  (`authorized`), `customer.apply_account_change` (`credit`), and
  `reservation.complete` (`completed_settled`) with correct cross-process parents.
- **OBS-037 — Checkout decline:** `payment.authorize` is `declined`; `reservation.complete`
  is `completed_outstanding`; no `credit` account change occurs.
- **OBS-038 — Replay:** identical sequential and concurrent retries report
  `replayed=true` with the original outcome; fake-provider authorization count stays one.
- **OBS-039 — Booking acceptance:** a successful `reservation.accept` trace contains
  `payment.authorize` with purpose `booking_fee`; a declined booking payment yields
  `booking_payment_declined` and no capacity is claimed.
- **OBS-040 — Promotion to zero:** a promotion covering the full remaining balance
  yields `applied`, then `completed_settled`, with no `payment.authorize` span.
- **OBS-020 — Failure:** dependency failures end spans with the agreed outcomes and statuses;
  no successful completion is claimed for an incomplete workflow.
- **OBS-021 — Privacy:** captured attributes and events contain none of the OBS-005 forbidden data.
- **OBS-022 — Isolation:** two concurrent workflows retain distinct contexts and correct entity IDs.

Do not assert exact timings, generated span IDs, or incidental span order. A trace
alone cannot prove business state or payment counts; assert those separately.

## Retired rules

| Rule | Was | Reason | Replaced by |
| --- | --- | --- | --- |
| OBS-011 | `petclinic.visit.cancel` legacy visit deletion | Legacy app replaced (D-24); visits are no longer deleted | OBS-026 |
| OBS-013 | `petclinic.reservation.create` with `held` outcome | Hold/pay-to-confirm flow removed | OBS-023 |
| OBS-014 | `petclinic.checkout.execute` with `confirmed`/`pending_confirmation` | Checkout now follows the visit | OBS-031 |
| OBS-015 | `petclinic.payment.authorize` keyed by checkout, with `unknown` | Now covers booking and visit payments; timeouts out of scope | OBS-032 |
| OBS-016 | `petclinic.reservation.confirm` | No confirm step; replaced by accept and complete | OBS-024, OBS-035 |
| OBS-017 | Checkout success connects payment and confirmation | Flow changed | OBS-036 |
| OBS-018 | Decline prevents confirmation | Decline now yields CompletedOutstanding | OBS-037 |
| OBS-019 | Replay without duplicate payment | Reworded for new spans | OBS-038 |

## Rule-to-test coverage

The ID lifecycle and test naming requirements are defined in
[the traceability specification](specs/observability-traceability.md).
"No test" is a coverage gap, never a passing result. A passing rehearsal against a
temporary implementation validates the assertions; it does not mark the application
implemented. The coverage table distinguishes scoped TEST-01 checks from genuine
uncovered rules.

| Rule | Requirement | Authority | Test reference / planned title | Implementation status |
| --- | --- | --- | --- | --- |
| OBS-001 | Service identity | Proposed | [runtime-contract.test.js](../spec/tests/runtime/runtime-contract.test.js): `[RT-008] [OBS-001] <Service> exports traces as OTLP/HTTP protobuf named <service.name>` | Test present; application not implemented |
| OBS-002 | W3C propagation and context isolation | Proposed | [business-traces.test.js](../spec/tests/observability/business-traces.test.js): `[OBS-002]` request/acceptance/finalization headers and concurrent reservation contexts | Scoped checks rehearsed; application not implemented |
| OBS-003 | One business span per attempt | Proposed | No test; planned `[OBS-003] each attempt finishes exactly one business span` | Not implemented |
| OBS-004 | Outcome/status mapping | Proposed | No test; planned `[OBS-004] outcomes map to agreed statuses` | Not implemented |
| OBS-005 | IDs present, sensitive data excluded | Proposed | No test; planned `[OBS-005] telemetry includes known IDs without sensitive data` | Not implemented |
| OBS-006 | Stable names and attribute keys | Proposed | No test; planned `[OBS-006] span names and attributes follow the contract` | Not implemented |
| OBS-007 | Structured correlated logs | Proposed | No test | Deferred; conditional on adding logs |
| OBS-008 | Exporter lifecycle and failure isolation | Proposed | No test; planned `[OBS-008] exporter failures preserve business results` | Not implemented |
| OBS-009 | Full sampling in demo/tests | Proposed | No test; planned `[OBS-009] demo configuration captures every exercised trace` | Not implemented |
| OBS-010 | Bounded metric labels | Proposed | No test | Deferred; conditional on adding metrics |
| OBS-011 | Legacy visit cancellation | Retired → OBS-026 | Legacy test at tag `1.0` only | Not applicable |
| OBS-012 | Customer eligibility | Proposed | No test; planned `[OBS-012] eligibility emits the agreed outcomes` | Not implemented |
| OBS-013 | Legacy reservation create | Retired → OBS-023 | None | Not applicable |
| OBS-014 | Legacy checkout execute | Retired → OBS-031 | None | Not applicable |
| OBS-015 | Legacy payment authorize | Retired → OBS-032 | None | Not applicable |
| OBS-016 | Legacy reservation confirm | Retired → OBS-024, OBS-035 | None | Not applicable |
| OBS-017 | Legacy success evidence | Retired → OBS-036 | None | Not applicable |
| OBS-018 | Legacy decline evidence | Retired → OBS-037 | None | Not applicable |
| OBS-019 | Legacy replay evidence | Retired → OBS-038 | None | Not applicable |
| OBS-020 | Dependency failure evidence | Proposed | No test; planned `[OBS-020] dependency failures finish spans without claiming success` | Not implemented |
| OBS-021 | Privacy of captured telemetry | Proposed | No test; planned `[OBS-021] captured telemetry excludes sensitive fixture values` | Not implemented |
| OBS-022 | Concurrent workflow isolation | Proposed | No test; planned `[OBS-022] concurrent workflows retain distinct contexts and correct IDs` | Not implemented |
| OBS-023 | Reservation request | Proposed | [business-traces.test.js](../spec/tests/observability/business-traces.test.js): `[OBS-023] request emits <outcome>` | Scoped checks rehearsed; application not implemented |
| OBS-024 | Reservation accept | Proposed | [business-traces.test.js](../spec/tests/observability/business-traces.test.js): `[OBS-024] accept emits <outcome>` | Not implemented; red |
| OBS-025 | Reservation deny | Proposed | [business-traces.test.js](../spec/tests/observability/business-traces.test.js): `[OBS-025] deny emits <outcome>` | Not implemented; red; partial outcomes |
| OBS-026 | Reservation cancel | Proposed | [business-traces.test.js](../spec/tests/observability/business-traces.test.js): `[OBS-026] cancel emits <outcome>` | Not implemented; red; partial outcomes |
| OBS-027 | Visit record | Proposed | [business-traces.test.js](../spec/tests/observability/business-traces.test.js): `[OBS-027] record_visit emits <outcome>` | Not implemented; red; partial outcomes |
| OBS-028 | Fee lookup | Proposed | [business-traces.test.js](../spec/tests/observability/business-traces.test.js): `[OBS-028] get_fees emits <outcome>` | Not implemented; red; partial outcomes |
| OBS-029 | Bill finalization | Proposed | [business-traces.test.js](../spec/tests/observability/business-traces.test.js): `[OBS-029] finalize_bill emits <outcome>` | Not implemented; red; partial outcomes |
| OBS-030 | Promotion | Proposed | [business-traces.test.js](../spec/tests/observability/business-traces.test.js): `[OBS-030] apply_promotion emits <outcome>` | Not implemented; red; partial outcomes |
| OBS-031 | Checkout pay | Proposed | [business-traces.test.js](../spec/tests/observability/business-traces.test.js): `[OBS-031] pay emits <outcome>` | Not implemented; red |
| OBS-032 | Fake payment authorize | Proposed | [business-traces.test.js](../spec/tests/observability/business-traces.test.js): `[OBS-032] payment.authorize emits <outcome>`; both purposes | Not implemented; red |
| OBS-033 | Cash recording | Proposed | [business-traces.test.js](../spec/tests/observability/business-traces.test.js): `[OBS-033] record_cash emits <outcome>`; both purposes | Not implemented; red; partial outcomes |
| OBS-034 | Account change | Proposed | [business-traces.test.js](../spec/tests/observability/business-traces.test.js): `[OBS-034] apply_account_change emits <outcome>`; charge/credit/discount | Not implemented; red; partial outcomes |
| OBS-035 | Reservation completion | Proposed | [business-traces.test.js](../spec/tests/observability/business-traces.test.js): `[OBS-035] complete emits <outcome>` | Not implemented; red; partial outcomes |
| OBS-036 | Checkout success evidence | Proposed | [business-workflows.test.js](../spec/tests/observability/business-workflows.test.js): `[OBS-036] checkout success connects real services` | Not implemented; red |
| OBS-037 | Checkout decline evidence | Proposed | [business-workflows.test.js](../spec/tests/observability/business-workflows.test.js): `[OBS-037] checkout decline connects real services` | Not implemented; red |
| OBS-038 | Replay evidence | Proposed | [business-workflows.test.js](../spec/tests/observability/business-workflows.test.js): `[OBS-038] <concurrent/sequential> <declined/authorized> retries preserve outcome and authorize once` | Not implemented; red |
| OBS-039 | Booking acceptance evidence | Proposed | [business-workflows.test.js](../spec/tests/observability/business-workflows.test.js): `[OBS-039] booking <decline/acceptance>` | Not implemented; red |
| OBS-040 | Promotion-to-zero evidence | Proposed | [business-workflows.test.js](../spec/tests/observability/business-workflows.test.js): `[OBS-040] promotion to zero completes settled across real services without authorization` | Not implemented; red |
| OBS-041 | HTTP semantic conventions | Proposed | [otel-conventions.test.js](../spec/tests/observability/otel-conventions.test.js): `[OBS-041] <Service> incoming request spans use stable HTTP semantic conventions`, `[OBS-041] <Service> spans use no deprecated HTTP attribute names`; client-span, 5xx, and business-parent checks are exercised in TEST-01 | Scoped checks rehearsed; application not implemented |
| OBS-042 | Resource attributes | Proposed | [otel-conventions.test.js](../spec/tests/observability/otel-conventions.test.js): `[OBS-042] <Service> resource identifies service, version, and SDK language` | Test present; application not implemented |

Slice 6 was frozen at checkpoint `test-01-s5-s6`. The supplied working-tree
manifest now passes the guard for the GAP-01–07 revisions and was not changed
by the rehearsal. The [2026-09-27 rehearsal](test-slices-5-6-rehearsal.md) passed
all 92 slice-6 telemetry/workflow checks, alongside 218 access checks, and
detected deliberate defects in propagation, outcomes, status, span uniqueness,
parenting, replay, payment counts, and downstream account work. Temporary
implementations were removed; the table's application implementation status
therefore remains red. See also [the Slice 5–6 review](test-slices-5-6.md). A rule with a test is not a
claim of exhaustive outcome coverage or a passing application. Helpers also check
span uniqueness, completion, status, and SERVER parenting for the exercised cases;
this does not close the broader OBS-003–009 test gaps above.
