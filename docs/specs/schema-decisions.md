# SPEC-02 — Schema decision log

Scope: domain data shapes, requiredness, validation, references, and ownership.
Endpoints, service-call ordering, retries, and cross-service workflows are separate
design work. Source: [the accepted domain model](domain-model.md).

Domain objects exposed across service boundaries are contract surfaces. Their
serialized schemas, references, state transitions, and invariants are testable
expectations. Trivial getter/setter, constructor, and private-storage tests are not
required; internal representation remains replaceable while the published contract
is preserved.

Status meanings: **Settled** preserves a user-approved domain rule; **Recommended**
is a concrete schema default for review; **Question** needs a choice that affects
which records are valid. Q-01–Q-05 are now approved by the user. Other schema defaults
remain identified as recommendations until the complete schema set is reviewed.
No runtime implementation is implied by approval of a decision.

## Settled rules

| ID | Decision | Schema consequence |
| --- | --- | --- |
| SCH-001 | Stable entity IDs | Customer, Pet, Veterinarian, Reservation, Visit, VeterinarianService, Checkout have immutable IDs; UUID strings are the current design convention |
| SCH-002 | Customer can own zero pets | Customer pet collection allows an empty array |
| SCH-003 | No walk-ins; reservation has zero/one visit | Visit.reservationId required; unique across persisted visits |
| SCH-004 | One assigned veterinarian | Reservation.veterinarianId required from request creation |
| SCH-005 | Requested/performed services are separate | Both arrays nonempty, unique service IDs, quantity one; performed need not be a subset of requested |
| SCH-006 | Shared record views | Customer.visits, Customer.reservations, Pet.history are read-only projections |
| SCH-007 | Explicit time fields | Reservation: scheduledStart, scheduledEnd, requestedAt, nullable acceptedAt; Visit: startedAt, optional endedAt |
| SCH-008 | One combined state | Exact enum: Requested, Accepted, Denied, Canceled, CompletedSettled, CompletedOutstanding |
| SCH-009 | Historical billing | Preserve serviceId, description, priceAmount on each billed line; freeze prices at bill finalization and booking fee at acceptance |
| SCH-010 | Account arithmetic | amountOwed includes booking fee; amountCredited includes booking payment; balance is owed minus credited; customer balance sums visit balances |
| SCH-011 | Payment limits | Full remaining-balance payments; no partial payments, overpayments, or refunds |
| SCH-012 | Checkout cardinality | One Checkout per Visit, with multiple attempt records; no Checkout required before one is created |
| SCH-013 | Clinical fields | clinicalNotes, diagnoses[], medications[], optional followUpNotes; Reservation stores records with veterinarian attribution |
| SCH-014 | Insurance scope | Optional policies with provider, policyNumber, coveredPetIds; no claims processing |
| SCH-015 | Historical ownership | Preserve original customer references; transfers are out of scope |

## Recommended shared conventions

| ID | Recommendation | Reason |
| --- | --- | --- |
| SCH-016 | Create schemas exclude generated IDs, event timestamps, balances, paid flags, state, and read projections; read schemas include them | Avoid accepting authoritative results as editable profile input; later operation-specific schemas may carry relevant commands |
| SCH-017 | Use customerId, petId, ownerId, veterinarianId, reservationId, serviceId references; requestedServices/performedServices are arrays of UUID strings | Avoid cyclic nested objects; uniqueItems can enforce duplicate IDs |
| SCH-018 | Empty collections are []; absent optional objects/text are omitted; acceptedAt and bookingPaymentId explicitly allow null | Make absence predictable; do not accept null and omission interchangeably everywhere |
| SCH-019 | Use nonnegative integer cents with currency fixed to USD; maximum is JavaScript's safe integer, including aggregate totals | Avoid floating-point money and overflow without inventing a business credit limit |
| SCH-020 | Dates are valid YYYY-MM-DD; timestamps are RFC 3339 with explicit offset, returned in UTC | Store unambiguous instants; apply scheduling rules in America/Chicago |
| SCH-021 | Reject unknown properties in write schemas; define read schemas explicitly | Catch misspelled input; reconsider version compatibility when publishing APIs |
| SCH-022 | Trim ordinary names/contact labels and reject blank required values; preserve clinical text except rejecting whitespace-only when required | Predictable validation without rewriting meaningful notes |
| SCH-023 | Field limits: names 100 characters, address lines 200, city 100, phone 32, identifiers/policy references 100, clinical notes 10000, diagnosis/medication/follow-up text 2000 | Bounded demo input; proposed limits, not previously agreed requirements |
| SCH-024 | UUID v4 for generated entity/attempt/account-entry IDs; existing fixed UUID veterinarian seeds remain valid; officeId is a local opaque string | Keep identity conventions coherent without creating an Office service |

## Proposed field requiredness

All persisted entities include their immutable ID where applicable. References
must resolve, but existence and cross-record consistency are domain assertions,
not checks a standalone JSON Schema can perform.

| Record | Required data | Optional / nullable / read-only |
| --- | --- | --- |
| Customer profile | firstName, lastName, phoneNumber, address, emergencyContact | secondaryContact and billing optional; insurance[] optional on input, [] on read; accountEntries and relationship views read-only |
| Address | street, city, state, postalCode | US-only; two-letter state and ZIP/ZIP+4; secondLine omitted when absent |
| Contact | name, phone, relationship | No additional fields required |
| Billing | billingAddress when Billing is present | mockMethodReference optional; require a method for electronic payment attempts; billingAddress may be copied from customer address |
| InsurancePolicy | provider, policyNumber, nonempty unique coveredPetIds[] | Policy identifier is provider + policyNumber for this demo; multiple policies may cover a pet |
| Pet | name, type, breed, estimatedBirthDate, ownerId | breed may be Unknown; estimatedBirthDate required and not in future; type is nonblank text; history read-only |
| Veterinarian | firstName, lastName, officeId | Seeded two records; IDs and office assignments stable |
| Reservation | customerId, petId, veterinarianId, scheduledStart, scheduledEnd, requestedAt, requestedServices[], bookingFeeAmount, bookingFeePaid, reservationState | acceptedAt and bookingPaymentId nullable; these are persisted/read fields, not all customer-create inputs |
| Visit | reservationId, customerId, petId, veterinarianId, performedServices[], nonblank clinicalNotes, diagnoses[], medications[], startedAt | endedAt and followUpNotes optional; diagnoses and medications may be empty |
| VeterinarianService | name, feeAmount, currency | Stable ID; no quantity field, quantity is one |
| AccountEntry | customerId, visitId, amountOwed, amountCredited, currency, paymentIds[] | Derived remaining balance; unique visitId within account entries |
| BilledLine | serviceId, description, priceAmount | Quantity implicitly one; immutable finalized snapshot |
| Checkout | customerId, reservationId, visitId, currency, nonempty finalized billedLines[], totalAmount, previouslyPaidAmount, remainingBalance, paymentAttempts[] | No pre-finalization Checkout record; attempts may initially be empty; no independently stored Checkout.outcome |

### Calendar configuration

Recommended shape: timezone = America/Chicago; workingWeekdays = [1,2,3,4,5]
(ISO Monday=1); openingTime = 08:00; closingTime = 17:00; lunchStart = 12:00;
lunchEnd = 13:00; slotDurationMinutes = 60. Configuration is fixed for the demo,
not duplicated within every Reservation. A reservation refers to the clinic schedule
through its assigned veterinarian and times; a singleton calendar key can be exposed
if a read model needs it. No persisted slot list or separate calendar database.

## Payment record recommendations

**SCH-025 — Payment shape:** required attemptId, customerId, reservationId, purpose,
amount, currency, outcome, timestamp. Use purpose enum `booking_fee`, `visit_balance`.
visitId is required for visit_balance and omitted for booking_fee. Attempt identity
is distinct from the client idempotency key. bookingPaymentId/paymentIds reference
attemptId; there is no second, ambiguous payment ID.

| Outcome | mockMethodReference | authorizationReference | recordedByVeterinarianId |
| --- | --- | --- | --- |
| authorized | Required opaque fake token | Required opaque fake authorization reference | Omitted |
| declined | Required opaque fake token | Null | Omitted |
| cash_recorded | Null | Null | Required veterinarian ID |

Zero due produces no payment attempt. These are completed attempt records; an
in-flight attempt is internal execution state unless we intentionally expose it.
The original successful attempt survives a later account/completion update failure.
No bank or card data is added by this schema.

**SCH-026 — Checkout outcome:** retain payment outcomes on attempts and keep
reservationState as the sole combined completion field. The model follows the
recommendation to remove independently stored Checkout.outcome. Manual-recovery
metadata is a later operation-contract concern, not a second financial truth.

## Domain consistency assertions beyond JSON Schema

- Reservation pet belongs to its customer; Visit references the reservation's
  customer, pet, and veterinarian. Historical IDs stay unchanged.
- Visit.reservationId and Checkout.visitId are unique in their owning stores.
- referenced veterinarian, services, covered pets, and payment attempts exist and
  belong to the referenced customer/reservation/visit as appropriate.
- scheduledEnd is one hour after scheduledStart; calendar and veterinarian
  capacity rules still apply. endedAt, when present, is not before startedAt;
  acceptedAt, when present, is not before requestedAt. Actual care times need not
  exactly match the scheduled slot.
- Requested/performed IDs are unique, but requested and performed lists may differ.
- Account credit cannot exceed debt; each successful payment reference is credited
  once. Declines create no credit. Payment amount matches the remaining balance.
- Finalized billed-line descriptions/prices cannot change with the live catalog.
- CompletedSettled has zero remaining visit debt; CompletedOutstanding has positive
  visit debt. Neither implies that unrelated customer debt is cleared.

## Approved question decisions

The user approved the following recommendations. They have been incorporated into
the domain model; these rows retain the question IDs for traceability.

| ID | Original question | Approved decision |
| --- | --- | --- |
| Q-01 | Must every customer store a mock electronic payment method, even if paying cash? | Allow billing/mockMethodReference to be absent; require a method on an electronic payment attempt |
| Q-02 | Are addresses US-only, and may billingAddress default to the customer address? | US-only; two-letter state and ZIP/ZIP+4; copy the address into billing when applicable rather than maintaining an implicit changing alias |
| Q-03 | Can a pet have an unknown breed or estimated birth date? | Require an estimated date (not in the future), allow breed = Unknown, keep type as nonblank text rather than a cat/dog-only enum |
| Q-04 | Can a persisted Visit have blank clinicalNotes, or must it contain a note? | Require nonblank clinicalNotes; allow empty diagnoses[]/medications[] and absent followUpNotes |
| Q-05 | Can a Checkout exist before its bill is finalized? | Persist Checkout only with a finalized nonempty billedLines snapshot; later attempts reuse that same record |

## Completion checklist

- Done: record approval of Q-01–Q-05 and reconcile the domain field table.
- Review remaining recommended shared conventions with the complete schema set.
- Done: produce JSON Schema/OpenAPI components with distinct create/update/read shapes in `contracts/domain.openapi.json`.
- Done: include valid and invalid examples for requiredness, nullability, money, IDs, and dates.
- Validate structural schemas and add separate assertions for cross-record rules.
- Keep legacy baseline contracts separate until intentional migration is designed.

No workflow implementation, runtime schemas, or test coverage is created by this log.
