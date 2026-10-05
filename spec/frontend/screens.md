# FE-01 screen and interaction contract

Status: draft. UI wording below is part of the proposed contract. Existing API
contracts remain authoritative for validation, permissions, money, and transitions.
No backend API change is proposed. Values in the preview are examples; actual UI
records, service prices, availability, bills, and permissions come from APIs.

MVP-02A amendment, draft 2026-10-04 (D-53–D-56): S1–S5 below are unchanged except
where noted inline. S6 and S7 are new administrator-only screens. This amendment
does not retract S1's "never add an admin role or role toggle" instruction — see
D-53: no UI control ever grants a role the backend didn't issue; what's added here
is rendering different, backend-authorized actions for whichever role(s) a signed-in
account actually holds, with no mode switch.

## Shared behavior

- Role-aware pages; customers see their own records, vets can read records but
  only the assigned veterinarian gets visit/acceptance/finalization actions.
  Direct navigation to another vet's visit-recording form shows the permission
  error rather than an editable form. An account holding the administrator role
  (alone, or alongside veterinarian per D-40/D-44) additionally gets the
  bypass actions in S2/S4 and the S6/S7 screens (D-53); a dual-role account sees
  the union of both roles' UI at once, never a separate toggle (D-53).
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
and identity from the login response; never add an admin role or role toggle —
every nav link and action below is gated on roles the login response actually
returned (D-53), nothing the frontend invents or lets the user pick.
Sign out clears session and returns to `/`.

Sidebar nav gains `Veterinarians` (S6) and `Reports` (S7) links, rendered only
when the signed-in account's roles include `administrator` (D-54). An
administrator-only account (no veterinarian identity, D-52) sees the
`CLINIC ADMINISTRATION` workspace eyebrow instead of `CUSTOMER PORTAL`/
`VETERINARIAN WORKSPACE` on pages that don't otherwise set one.

## S2 — Appointments (`/appointments`, `/appointments/{id}`)

Heading `Appointments`. Customer explanation: `Manage your pet's upcoming care.`
Veterinarian explanation: `Review appointments and record the care you provide.`
Administrator-only explanation (no veterinarian role): `Review and manage any
appointment.` Customer primary action `Request appointment`. Table columns: `Pet`,
`Date & time`, `Veterinarian`, `Status`, `Details`. Use a `View appointment` link
with an accessible name extended by pet/date for each row. Display past and future
data returned by Reservation; render statuses as `Requested`, `Accepted`, `Denied`,
`Canceled`, `Completed · balance due`, or `Completed · paid` (map the last two
API states). An administrator (any account holding that role) sees every
reservation here, not only ones tied to their own veterinarian identity.

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

Administrator, Requested, not the assigned veterinarian (D-41, D-55): the same
`Accept appointment` control renders, labeled `Accept on behalf of {vet name}`;
identical request/response handling. A `Deny appointment` button is also
available here (customer/vet flows have no deny control; only acceptance can be
declined by payment). POST `/reservations/{id}/deny`; success re-renders the
Denied state with `Appointment denied.`

Assigned vet, Accepted: `Record visit` opens S4. Server refuses recording before
start; show `This visit cannot be recorded before its appointment starts.` after
that rejection. Do not add a browser clock bypass. If a visit already exists,
show `View visit`; completed visits link to their bill. Customers have read-only
visit details and `View bill` when a finalized checkout exists. Absence of a bill
is `The bill is not ready yet.`, not a fabricated zero-balance bill.

Administrator, Accepted, not the assigned veterinarian: the same `Record visit`
link renders (D-41, D-55), opening S4 in bypass mode (no clinical-notes field).

Reassign-veterinarian control (D-48, D-51, D-56, revised): Accepted reservation,
no clinical notes recorded yet for its visit: a veterinarian other than the one
currently assigned sees `Reassign to me`; PATCH Reservation
`/reservations/{id}/veterinarian` with `{veterinarianId: self}`. Success:
`Appointment reassigned to you.` and the detail view refreshes with the new
veterinarian. The backend accepts only the caller's own veterinarianId here —
there is no "assign to someone else" capability for any caller. An
administrator-only account (no veterinarian identity) sees no reassignment
control at all; the dual-role owner sees `Reassign to me` only through her own
veterinarian identity, same as any other veterinarian. Once the visit has
clinical notes, this control does not render for anyone (D-51) — omit it
rather than disabling it.

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

Administrator bypass mode (D-41, D-47, D-55): when the signed-in account is
not the assigned veterinarian, the form omits `Clinical notes`, `Diagnoses`,
`Medications`, and `Follow-up notes` entirely — the request they submit must
carry none of that content — replaced by a notice: `This visit will be saved
without clinical notes and flagged for follow-up.` `Performed services` stays.
Submit label and success message are unchanged (`Save visit` /
`Visit recorded.`); the saved read-only view then shows a
`Missing clinical notes` badge next to the visit summary (reads the visit's
`notesMissing` flag, D-46). **Correction:** finalizing the bill is not one of
D-41's bypassable actions — D-41 lists accept/deny, record-visit, promotion,
and cash recording only; checkout's finalize route still calls the strict
`assigned()` check (D-36: the visit's own attributed veterinarian finalizes),
not an administrator bypass. So an admin-bypass-recorded visit shows
`The bill is not ready yet.` to the administrator who recorded it, same as
any other non-assigned viewer; only the visit's actual `veterinarianId` (the
originally assigned veterinarian, unchanged by an accept/record bypass) sees
`Finalize bill`. The assigned veterinarian's own read-only view of a
notes-missing visit shows the same `Missing clinical notes` badge.

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

## S6 — Veterinarian roster (`/veterinarians`), administrator only (D-54)

Direct navigation by a non-administrator shows the standard
`You don't have permission to do that.` alert, as any other role-gated screen.

Heading `Veterinarians`. Explanation: `Add veterinarians and manage who is
currently seeing patients.` Primary action `Add veterinarian` opens an inline
form (not a separate route): `First name`, `Last name`, `Office` (free-text
office id, matching the API's `officeId` string — no office catalog exists to
select from). Submit `Add veterinarian` calls POST Reservation
`/veterinarians`. Success: `Veterinarian added.`, form clears and collapses,
new row appears.

Table columns: `Name`, `Office`, `Status`, `Action`. Status renders `Active` or
`Inactive` as text (not only color, per Shared behavior). Action column: an
active row gets `Deactivate`; an inactive row gets `Reactivate` — both call
PATCH Reservation `/veterinarians/{id}` with `{active: false}` or
`{active: true}`. No confirmation dialog (deactivation has no cascading
effects, D-43); success re-renders the row's new status with
`Veterinarian deactivated.` or `Veterinarian reactivated.` No delete action —
the API has none (D-42's roster only grows or deactivates).

GET Reservation `/veterinarians` for the list (the existing published-catalog
endpoint customers/vets already read from, now also rendering `active` status
here for the administrator).

## S7 — Visits missing notes (`/reports/visits-missing-notes`), administrator only (D-50, D-54)

Direct navigation by a non-administrator shows
`You don't have permission to do that.`, same as S6.

Heading `Visits missing notes`. Explanation: `Completed visits that were closed
without clinical notes.` Read-only table, no actions: `Pet`, `Customer`,
`Veterinarian`, `Date`, `Details` (a `View visit` link into the existing S4
read-only visit view, same accessible-name convention as S2's `View appointment`
links). Empty state: `No visits are missing clinical notes.` (reuses the
existing empty-state pattern, not a new string). GET Reservation
`/reports/visits-missing-notes`; resolve names the same way S2 does
(`referenceData`-equivalent lookups against Customer/Reservation's
veterinarian list), since the report endpoint itself returns only visit
records.

## Acceptance fixtures (not hardcoded UI behavior)

Jordan Rivera / Milo / Dr Avery Taylor / Wellness. Start clinic at
2026-10-12T08:00:00-05:00, request 09:00–10:00, accept, then the fixture advances
all service clocks to 09:05 in the same token lifetime. Record `Routine examination`.
Bill: services $50.00, fee $20.00, total $70.00, payments received $20.00,
balance $50.00. Pay $50.00 → CompletedSettled and zero customer debt.
A customer or single-role veterinarian switches which account they're acting as
by signing out and signing in as a different account — still true, and
unaffected by D-53's dual-role union-of-UI behavior, which applies only to the
one account that actually holds two roles at once (D-40).

MVP-02A administrator fixtures (D-52–D-56): `riley.chen`, administrator only,
no veterinarian identity — exercises S2/S4 bypass actions, S6, and S7 without
also holding assigned-veterinarian actions. `avery.taylor`, the dual-role
owner — exercises the simultaneous union-of-UI case (D-53): her own assigned
appointments show ordinary veterinarian actions, while any other veterinarian's
appointments show her administrator bypass actions on the same signed-in
session, no sign-out required.
