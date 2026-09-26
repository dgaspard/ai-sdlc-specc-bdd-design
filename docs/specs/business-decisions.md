# SPEC-01 — Business decision record

Status: user decisions captured; explicit follow-up questions remain. This record
supersedes the earlier proposed pay-to-confirm booking flow. It does not change
the current implementation, feature files, or existing published contract.

## Confirmed direction

| Decision | User-specified behavior |
| --- | --- |
| D-01 | A customer is a pet owner with one or multiple pets and an optional secondary contact. Each reservation references one customer and one pet. |
| D-02 | Reservations and visits are separate. A visit documents customer/animal interactions, medicines, diagnoses, and follow-up if necessary. Every visit ends in checkout, including a $0.00 visit. |
| D-03 | Appointments occupy one-hour slots Monday–Friday, 08:00–12:00 or 13:00–17:00 in US Central Time (use America/Chicago, including daylight saving). Lunch 12:00–13:00 is unavailable. Valid start hours are 08, 09, 10, 11, 13, 14, 15, and 16. |
| D-04 | At most two veterinarians, each with one office. A veterinarian can serve only one visit at a time. For competing requests, the first approved reservation wins; the second request for that capacity is denied. |
| D-05 | Reservation states: Requested, Accepted, Denied, Canceled, CompletedSettled, CompletedOutstanding. Explicit transitions: Requested → Accepted or Denied; Accepted → Canceled, CompletedSettled, or CompletedOutstanding. Accepted consumes veterinarian capacity; Requested does not. Moving an appointment means cancelling it and requesting another. Unpaid completion blocks new booking until the account is paid; the customer retries with a different payment method, or the veterinarian marks cash payment as paid. |
| D-06 | Reservations do not expire. They remain in their prescribed states; no hold-expiration mechanism. |
| D-07 | VeterinarianServices owns fees, retrieved by Checkout, in USD. The $20 booking fee is paid when the reservation is accepted and is non-refundable on cancellation. Five service prices are defined below. |
| D-08 | Successful payment means authorization. Subsequent collection/capture of failed payments is outside demo scope; confirm terminology if “claiming failed payments” meant something else. |
| D-09 | Confirmed replacement of the earlier decline rule: post-visit payment decline produces CompletedOutstanding, not Denied. CompletedOutstanding means an actual unpaid balance. A customer owing $0 remains in good standing; Denied describes rejected reservation requests. |
| D-10 | Recovery after successful authorization and failed subsequent confirmation is manual. With checkout after the visit, define exactly which completion write can fail and what is reported. |
| D-11 | Payment timeout handling is outside demo scope. The user manually checks their bank account. No automatic reconciliation or retry policy is implied. |
| D-12 | Approved: repeated identical checkout requests return the same result while authorizing payment only once, including concurrent requests. The user delegated a practical mock key convention; see below. A new attempt after decline uses a different payment method. |
| D-13 | Customer owns outstanding balances. Customer profile includes name, address, phone number, emergency contact, billing information, insurance if applicable; pets include name, type, age, breed. Earlier requested medical history remains part of the domain; veterinarian owns clinical records. Customers with unpaid prior balances cannot reserve until paid. A reservation may be cancelled before its start. |
| D-14 | Approved requirement change: the new cancellation feature cancels the reservation and releases its veterinarian/time slot while preserving clinical records. Cancellation is permitted before the reservation starts; the paid booking fee is retained. Existing visit-deletion expectations need an explicit specification migration, not application to clinical records. |
| D-15 | Primary demo: delete Checkout, show the broken workflow, and have the agent reconstruct it until all tests pass. Audience-proposed feature changes are a possible extension; scope may evolve. |
| D-16 | Veterinarians accept or deny their own reservation requests. There is no automatic acceptance and no staff role. A veterinarian cannot accept or deny a request assigned to another veterinarian. |
| D-17 | A customer chooses a veterinarian when creating their customer profile. That veterinarian is the default for new reservation requests; the customer may request the other veterinarian for a given appointment. |
| D-18 | Reservations whose scheduledStart is in the past are not allowed. |
| D-19 | If an electronic payment fails, the customer may pay in cash. The veterinarian manually records the cash payment, bringing the amount owed for that visit to $0. Cash recording never calls the fake payment provider. |
| D-20 | A customer with a positive outstanding balance has their reservation request denied with the message "Please pay your full balance of $X" (format per D-27). The system stores the reservation immediately in Denied state with that reason, so it appears in history. This is the only automatic denial; all other accept/deny decisions belong to the veterinarian (D-16). |
| D-23 | The $20 booking fee must be paid before acceptance takes effect. If the electronic booking payment fails, the reservation stays Requested and consumes no capacity until the fee is paid with another method or recorded as cash by the veterinarian (D-19). Acceptance and capacity are applied only after payment succeeds. |
| D-25 | A pet cannot have Accepted reservations with both veterinarians at overlapping times. A pet may have at most one Accepted reservation per time slot, checked at request and again at acceptance. |
| D-26 | Promotion: the veterinarian may apply at most one promotion to a visit to reduce its remaining balance. The promotion amount defaults to $0 and the veterinarian enters the discount. If the promotion exceeds the amount owed, the amount owed becomes $0; the excess is discarded. A customer can never owe a negative amount, and no refund or credit results. The prepaid $20 booking fee is never refunded by a promotion. |
| D-27 | Balance denial message is exactly `Please pay your full balance of $X`, where X is the customer's total outstanding balance across all pets, formatted with a thousands comma and two decimals (for example `$1,234.50`, `$50.00`). |
| D-28 | Service feature files assert only the owning service's state plus the requests it sends to other services. Cross-service end results belong in workflow feature files. Each service can therefore be tested, deleted, and rebuilt on its own. |
| D-29 | If a veterinarian tries to accept a request whose slot is already taken by another Accepted reservation, the system automatically sets the request to Denied (consistent with D-04). |
| D-30 | The customer or the assigned veterinarian can cancel an Accepted reservation before it starts. |
| D-31 | Only the assigned veterinarian can record a visit, only for an Accepted reservation, and only at or after its scheduledStart. |
| D-32 | Checkout owns all payments, including the $20 booking fee and cash recording for it. On acceptance, Reservation asks Checkout to collect the booking fee and accepts only if it is paid. |
| D-33 | Requests that break calendar rules (weekend, lunch, non-slot hour, past start) or would double-book the pet are rejected with a validation error and are not saved. Only outstanding-balance denials are saved as Denied (D-20). |
| D-34 | An applied promotion is final: it cannot be changed or removed. A $0 promotion still uses the visit's one promotion. |
| D-35 | Service feature files live in `spec/features/<service>/`; workflow files in `spec/features/workflows/` (moved under `spec/` by ARCH-01). |
| D-36 | The veterinarian who performed the visit finalizes the bill. Completion is automatic: whenever a payment, cash recording, or promotion brings the remaining balance to $0, Checkout completes the reservation as CompletedSettled without further action. |
| D-37 | No new cross-service dependencies. Reservation does not validate requested service IDs against VeterinarianServices; it checks only that the list is nonempty and has no duplicates. Performed services are priced (and unknown IDs rejected) by Checkout at bill finalization. |
| D-24 | The new four-service application replaces the legacy app. Legacy tests and behavior remain preserved at tag `1.0` as history but are not part of the new suite and need no migration. |
| D-21 | Owner and customer are the same entity. Customers own pets. There is no separate Owner entity in the new domain. |
| D-22 | Requests outside the calendar (for example, a Saturday such as 2026-10-10) are valid negative scenarios: the specification expects them to be rejected. |

## Architectural implications

Latest domain decisions are authoritative in [SPEC-02](domain-model.md): stable IDs;
zero-pet customers; no walk-ins; one reservation to zero/one visit; nonempty requested
and performed service collections; estimated birth date replacing age; explicit
appointment and action timestamps; per-visit account entries; payment records; and
historical billed prices. Completion and financial standing must use one combined
canonical reservationState field with CompletedSettled and CompletedOutstanding.
These names supersede Completed with Payment and Completed with no payment.
Earlier single-Service
and age wording in this historical decision record is superseded by that model.

The latest Customer, Pet, and Visit field definitions and their draft scenarios
are captured in [SPEC-02 domain model](domain-model.md). Customer name is split
into firstName and lastName; Customer aggregates reservations and visits across
all their pets; each Visit references one Customer, Pet, Veterinarian, Reservation,
and a nonempty collection of performed services.

There are now four planned services: Customer, Reservation, VeterinarianServices,
and Checkout. The fee service is a small independent dependency, not a real payment
provider. Payment remains fake. All stores remain in memory.

The business sequence is now customer/profile → reservation request → acceptance
with $20 booking payment → documented visit → checkout for the remaining service
fee → completion outcome. A $0.00 checkout leaves the customer in good standing.
Zero due is CompletedSettled and requires no authorization. Booking authorization failure and sequencing
with capacity acceptance still need a defined outcome.

Customer owns outstanding balances; the veterinarian owns clinical records.
Reservation is assigned as the software owner of clinical Visit records, with the
veterinarian as their clinical owner. Customer histories read those shared records.

## Fee catalog

| Service | Booking fee | Service fee | Total |
| --- | --- | --- | --- |
| Wellness | $20 | $50 | $70 |
| Surgery | $20 | $2,000 | $2,020 |
| Sick | $20 | $75 | $95 |
| Vaccination | $20 | $100 | $120 |
| Spay or Neuter | $20 | $250 | $270 |

This is the latest user-specified catalog and supersedes the earlier names/prices.

Use integer cents in API amounts and currency `USD`. The booking fee is one
component of the total, not an additional charge after that total. It is paid at
acceptance and retained if cancelled. Checkout must account for that earlier payment
and must not collect the $20 twice. Wellness totals $70: $20 at acceptance
and $50 remaining at checkout. No live payment system is introduced.

## D-12 — Mock idempotency convention

These are agent-selected design defaults requested by the user, to include in the
specification review. They do not require real payment credentials or infrastructure.

- Client creates a UUID v4 per intentional payment attempt and sends it in the
  `Idempotency-Key` header. Retransmission/double-click reuses the same key.
- Scope is the visit plus key; retain request fingerprint and completed response
  for the lifetime of the in-memory demo session. Restart loses this state.
- The new booking payment needs a separate operation scope (reservation plus key),
  distinct from visit checkout, so its paid fee cannot be replayed as a service payment.
- Sequential or concurrent identical requests share one authorization and return
  the same completed response/status. Replays do not duplicate balance or completion
  updates. The fake provider also deduplicates its authorization by attempt key.
- Reusing a key with different business input returns HTTP 409 without authorizing
  again. Fingerprint visit, selected services and mock payment-method token; exclude
  tracing headers. Snapshot authoritative fees on the initial attempt so a replay
  does not silently reprice it. Exact request schema belongs in SPEC-02.
- A declined result is also replayed. To retry with a different method, create a
  new key. Never overwrite the recorded declined attempt to disguise a new attempt.
- Successful settlement prevents another authorization for that same settled visit
  even if a new key is sent. Implement this with visit settlement checks in addition
  to key deduplication. Manual-recovery outcomes are not automatic new attempts.
- Cash recording uses its own operation/key and must not invoke the fake payment
  authorization. It must also avoid duplicate account credits on repeated submission.
- Retain opaque mock method tokens only; no real card details. Do not export keys,
  billing information, or payment-method tokens in telemetry.

## Follow-up decisions before executable specifications

1. **Completion settled:** Decline uses CompletedOutstanding; full authorized/cash
   payment or zero due uses CompletedSettled. Later full payment updates the combined
   state. Payment for one visit must not erase unrelated balances.
2. **Duplicate checkout:** Core behavior is approved and mock conventions are defined
   above. Review their concrete request/response schemas with SPEC-02.
3. **Schedule:** Settled by D-16, D-17, D-18, D-25.
4. **Ownership settled:** Reservation stores clinical records, Customer owns account
   entries, and Checkout owns bills/payment attempts. Define their API schemas next.
5. **Pricing:** The non-refundable $20 is paid at acceptance. Cash fallback after a
   failed payment is settled by D-19; booking-fee failure by D-23; a $0 remaining
   balance is possible through a promotion (D-26). Requested and performed services are now distinct,
   nonempty collections with unique service IDs and quantity one. Checkout snapshots
   performed-service prices at bill finalization; booking fee is frozen at acceptance.
6. **Profile:** Owner = Customer (D-21). Field shapes are in SPEC-02. Insurance is optional as stated. Use synthetic billing/profile data.
7. **Cancellation/migration:** Reservation cancellation and clinical-record preservation
   are now approved. Specify the replacement endpoint and compatibility behavior;
   A Saturday request is a valid expected-rejection scenario (D-22). Settled by D-24:
   the new application replaces the legacy baseline; no migration.
8. **Failures:** Specify unknown-entity and illegal-transition responses, manual
   recovery visibility, and the effect of completion failure on account balance.
   Do not report a successful completion or declined payment for an unknown result.

## SPEC-02 tasks unlocked by these decisions

- Customer/profile and eligibility features, including outstanding-balance rejection.
- Reservation features for workdays, lunch, hourly boundaries, two-vet capacity,
  approval contention, non-expiry, transitions, and cancellation cutoff.
- Cancellation scenarios must prove slot reuse, clinical-record preservation, and
  retention of the already-paid booking fee. Add booking-payment and checkout
  assertions proving that the $20 is paid once and credited toward the visit total.
- Visit documentation specification and its ownership decision.
- VeterinarianServices fee lookup contract and its own feature file.
- Checkout features for authorized positive amount, zero amount, decline, and
  manual-recovery visibility; sequential and concurrent duplicate submission must
  return the original result with exactly one authorization. Settle remaining key
  policies before defining their specific API assertions.
- Separate cross-service features for accepted reservation → visit → checkout.
- API and telemetry specifications derived from those reviewed business scenarios.

## SPEC-03 implications

Done in [observability.md](../observability.md): OBS-011 and OBS-013–OBS-019 are
retired and replaced by OBS-023–OBS-040 for the new design (request, accept/deny,
cancel, visit, fee lookup, bill, promotion, payment, cash, account, completion).
OBS-001 now includes the fee service; OBS-005 now covers insurance, contacts,
clinical content, and denial text. Legacy OBS-011 stays with tag `1.0` (D-24).

No business tests or implementation are added by this decision record. Specification
review remains open until the relevant follow-ups are answered.
