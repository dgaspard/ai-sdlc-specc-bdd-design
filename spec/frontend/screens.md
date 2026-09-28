# FE-01 screen and interaction contract

Status: draft. UI wording below is part of the proposed contract. Existing API
contracts remain authoritative for validation, permissions, money, and transitions.
No backend API change is proposed. Values in the preview are examples; actual UI
records, service prices, availability, bills, and permissions come from APIs.

## Shared behavior

- Role-aware pages; customers see their own records, vets can read records but
  only the assigned veterinarian gets visit/acceptance/finalization actions.
  Direct navigation to another vet's visit-recording form shows the permission
  error rather than an editable form.
- Customer session token in tab-scoped sessionStorage; never embed the signing
  secret or service tokens in the frontend. Clear session on sign out or 401.
  A refreshed page restores the session; signed-out protected links return to login.
- Fetch backend URLs from frontend runtime configuration using the four existing
  environment URL variables. No browser calls to internal or test-only routes,
  payment provider, or stores. The test harness alone manages seeds and clinic time.
- Render all API-provided text as text, not HTML. Money is integer cents in API
  payloads and USD with two decimals in the UI. Parse decimal payment input exactly
  to cents; reject excess precision rather than rounding silently.
- Dates/times use en-US and America/Chicago. No live ticking clock or relative
  timestamps. Show actual clinic appointment dates; do not use browser time to
  override server-side acceptance/recording rules.
- Data fetch: `Loading…`; empty appointments: `No appointments yet.`; failed read:
  `We couldn't load this information. Try again.` plus `Try again` button.
- Invalid input: associate field error text and aria-invalid with the field;
  summary `Check the highlighted fields.` Do not erase entered values.
- Disabled submit while a write is pending, with `Saving…` or `Processing…`.
  Do not automatically retry writes or use optimistic booking/payment success.
- 401: return to login, `Your session has expired. Please sign in again.`
  403: `You don't have permission to do that.`; 404: `This record is unavailable.`
  State conflict: refresh authoritative data and show `This appointment or bill
  has changed. Review its current status.` Keep failures visible until dismissed
  or the user takes another action; do not use auto-disappearing toast messages.

## S1 — Sign in (`/`)

Wordmark, tagline, `Your pet's care, in one place.` introduction and `Sign in`
heading. Labels `Username`, `Password`; password control type=password; submit
`Sign in`. Invalid credentials: `Username or password is incorrect.` No sign-up,
forgot-password, or decorative social-login actions. A quiet `Demonstration clinic`
label makes the mock context clear, without exposing implementation details.

POST Customer `/auth/login`. Successful login opens `/appointments`. Read role
and identity from the login response; never add an admin role or role toggle.
Sign out clears session and returns to `/`.

## S2 — Appointments (`/appointments`, `/appointments/{id}`)

Heading `Appointments`. Customer explanation: `Manage your pet's upcoming care.`
Veterinarian explanation: `Review appointments and record the care you provide.`
Customer primary action `Request appointment`. Table columns: `Pet`, `Date & time`,
`Veterinarian`, `Status`, `Details`. Use a `View appointment` link with an accessible
name extended by pet/date for each row. Display past and future data returned by
Reservation; render statuses as `Requested`, `Accepted`, `Denied`, `Canceled`,
`Completed · balance due`, or `Completed · paid` (map the last two API states).

GET Reservation `/reservations`; obtain pet/customer names from the published
Customer endpoints and veterinarian names from GET `/veterinarians`. Do not render
UUIDs as the primary identity. Detail shows customer, pet, vet, date/time, requested
services, status and booking fee. GET catalog `/services` resolves service labels.

Assigned vet, Requested: `Accept appointment`, with `Booking payment method`
select (`Demo card — approve`, `Demo card — decline`) and `$20.00 booking fee`.
POST Reservation `/reservations/{id}/accept` with bookingFee method=card and the
selected fake method reference. Use a UUID per intentional payment attempt.
Success: `Appointment accepted. Booking fee paid.` Decline:
`Booking payment was declined. The appointment is still requested.`
Server slot-conflict denial must show the returned Denied state, never success.

Assigned vet, Accepted: `Record visit` opens S4. Server refuses recording before
start; show `This visit cannot be recorded before its appointment starts.` after
that rejection. Do not add a browser clock bypass. If a visit already exists,
show `View visit`; completed visits link to their bill. Customers have read-only
visit details and `View bill` when a finalized checkout exists. Absence of a bill
is `The bill is not ready yet.`, not a fabricated zero-balance bill.

## S3 — Request appointment (`/appointments/new`)

Heading `Request appointment`. Labels: `Pet`, `Veterinarian`, `Appointment date`,
`Available time`; fieldset legend `Requested services` with multiple checkboxes.
Read pets from GET Customer `/customers/{customerId}/pets`, vets and availability
from Reservation, and services from VeterinarianServices. Customer ID comes from
the signed-in identity. Changing date/vet clears the old time selection and reloads
availability. Use returned slot start/end; do not manufacture unavailable slots.
Time option labels use `9:00 AM – 10:00 AM` formatting in the clinic timezone.
No available slots: `No appointments are available for this date and veterinarian.`

Side panel `Before you book`: `A $20.00 booking fee is collected when your
veterinarian accepts the appointment. It is not refundable if you cancel.`
Show `Requested services` names; do not present catalog estimates as a final bill.
Submit `Request appointment`; secondary `Back to appointments`.
POST Reservation `/reservations` with customerId, petId, veterinarianId,
scheduledStart, scheduledEnd, requestedServices. There is no request-notes field
in this API; do not invent one. On Requested, show `Appointment requested.` and
open detail. HTTP 201 with Denied is a business rejection: show denialReason and
Denied status, without a request-success confirmation.

## S4 — Record/view visit (`/appointments/{id}/visit`, `/visits/{id}`)

Heading `Record visit` before saving; `Visit details` afterward. Summary identifies
customer, pet, assigned vet, date. Fieldset `Performed services`, multiple selections;
required `Clinical notes`; `Diagnoses` and `Medications` textareas, one item per line,
blank means empty array. Optional `Follow-up notes`, omitted when empty. Submit
`Save visit` calls POST Reservation `/reservations/{id}/visit`. Do not silently copy
requested services into performed services without displaying the selection.
After successful creation, show read-only returned data and `Visit recorded.`

Assigned vet `Finalize bill` calls POST Checkout `/visits/{visitId}/checkout`.
Success opens S5 with `Bill finalized.` Existing bill links use GET
Checkout `/visits/{visitId}/checkout`. Duplicate finalization fetches that bill;
it does not repeat account charges. Clinical editing after completion is outside
this frontend slice, although backend support and tests exist.

## S5 — Bill and payment (`/bills/{checkoutId}`)

Heading `Visit bill`. Pet, visit date, veterinarian, read-only service lines with
frozen descriptions/prices from Checkout. A region named `Bill summary` contains
rows `Services`, `Booking fee`, `Total`, `Payments received`, `Promotion`, and
emphasized `Balance due`.
Booking fee is included once in Total. Payments received includes the prepaid fee;
derive the fee component as totalAmount minus the sum of billedLines.priceAmount.
Show zero promotion as `$0.00`; read appliedAmount when present. No edit controls.

Customer with positive balance: required `Payment amount`, default remaining USD;
`Payment method` select (`Demo card — approve`, `Demo card — decline`); button
`Pay now`. Use POST Checkout `/checkouts/{id}/payments`. Do not collect real card
details. A vet can read the bill but has no customer card-payment button here.
Amounts may be positive partial payments up to the remaining balance. Success:
`Payment received.` plus returned remaining balance and reservation state; paid
in full: `Paid in full`, with payment controls removed. Decline:
`Payment was declined. Your balance has not changed.`

Retain one UUID and its exact submitted payload until the result is known, in
tab-scoped sessionStorage keyed by user and checkout so a page reload preserves
an unresolved attempt. Never store passwords or real card details. Sign out clears
the session; durable recovery across browser restarts is outside this demo.
Network/502 ambiguity: `Payment outcome needs attention. Do not start another
payment until it is checked.` Offer `Retry same payment` for the exact same request
and key only. Never create a new key automatically; an explicit new attempt after
a known decline uses a new key. `authorized_completion_failed` displays this
attention state with the returned payment-attempt reference, never `Paid in full`
solely because a local amount became zero. Existing backend manual-recovery limits
apply; do not invent a recovery or refund workflow.

## Acceptance fixtures (not hardcoded UI behavior)

Jordan Rivera / Milo / Dr Avery Taylor / Wellness. Start clinic at
2026-10-12T08:00:00-05:00, request 09:00–10:00, accept, then the fixture advances
all service clocks to 09:05 in the same token lifetime. Record `Routine examination`.
Bill: services $50.00, fee $20.00, total $70.00, payments received $20.00,
balance $50.00. Pay $50.00 → CompletedSettled and zero customer debt.
The user switches roles by signing out and signing in, not by an admin bypass.
