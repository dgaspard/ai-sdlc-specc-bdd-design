# Spec drafts for review — 2026-10-05

These are drafts for protected `spec/` files, written outside `spec/` so
nothing protected changes until you've reviewed them. They come from two
triage decisions in
[eng-02-calibration-2026-10-05.md](engineering-reviews/eng-02-calibration-2026-10-05.md):

- **PRE-01 / REV-014:** the contract wins for OBS-046–048.
- **REV-016:** Checkout follows reassignment.

Paste them in, or tell me to place them. Either way, run them red, then
freeze; I implement after that.

## 1. OBS-046/047/048 business-trace tests

### `spec/tests/support/business-traces.js`

Add to `rules`:

```js
  "OBS-046": ["reservation", "add_veterinarian", "created failed"],
  "OBS-047": ["reservation", "update_veterinarian", "updated not_found failed"],
  "OBS-048": ["reservation", "reassign_veterinarian", "reassigned validation_error invalid_state not_found failed"],
```

Add `"created"` and `"reassigned"` to that file's `success` set.

### `spec/tests/observability/business-traces.test.js`

Add `seed.vet("Morgan Reed").id` as `morgan` next to the other imports, then:

```js
add("OBS-046", "created", async () => ({
  method: "POST", path: "/veterinarians",
  options: { actor: "riley.chen", body: { firstName: "Casey", lastName: "Nguyen", officeId: "office-1" }, expected: 201 },
  attributes: (r) => ({ "veterinarian.id": r.body.id }) }));
for (const outcome of ["updated", "not_found"]) add("OBS-047", outcome, async () => {
  const id = outcome === "updated" ? morgan : unknownId;
  return { method: "PATCH", path: `/veterinarians/${id}`,
    options: { actor: "riley.chen", body: { active: false }, expected: outcome === "updated" ? 200 : 404 },
    attributes: () => (outcome === "updated" ? { "veterinarian.id": id, "veterinarian.active": false } : { "veterinarian.id": id }) };
});
for (const outcome of ["reassigned", "validation_error", "invalid_state", "not_found"]) add("OBS-048", outcome, async (f) => {
  await f.request();
  if (outcome !== "invalid_state") await f.accept();
  const id = outcome === "not_found" ? unknownId : f.reservation.id;
  const target = outcome === "validation_error" ? avery : morgan;
  const status = { reassigned: 200, validation_error: 400, invalid_state: 409, not_found: 404 }[outcome];
  return { method: "PATCH", path: `/reservations/${id}/veterinarian`,
    options: { actor: "morgan.reed", body: { veterinarianId: target }, expected: status },
    attributes: () => ({ "reservation.id": id, "veterinarian.id": morgan }) };
});
```

**Expected red:**

- OBS-046 `created` fails, because the code emits `added`.
- OBS-047 `updated` fails, because `veterinarian.active` is never set.
- OBS-048 should already pass, since the real code sets both attributes.

**Decided 2026-10-05:** `validation_error` dropped from OBS-046/047 (the
`rules` lines above already reflect that). Original question, kept for the
record: OBS-046 and OBS-047 list
`validation_error`, but a schema-invalid body is rejected *before* the
business span opens (the OBS-003 scope note in the observability audit), so
that outcome can never be emitted. I left those two cases out. Options:

- Drop `validation_error` from OBS-046 and OBS-047 in `docs/observability.md`.
- Have the runtime open the business span before schema validation. That
  change reaches every operation.

## 2. REV-016: billing permissions follow reassignment

Cross-service, so it belongs in `spec/features/workflows/clinic-journeys.feature`:

```gherkin
  # D-48 + REV-016: a fill-in veterinarian who claims a closed, unnoted visit
  # takes over its billing actions too; the original veterinarian no longer has them.
  Scenario: A fill-in veterinarian can bill a visit they claimed after it was closed
    Given Jordan has booked and attended a Wellness visit with a finalized bill and no clinical notes
    When Dr Morgan Reed reassigns the visit to themselves
    And Dr Avery Taylor attempts to apply a 1000 cent promotion
    Then the promotion is refused as "not assigned veterinarian"
    When Dr Morgan Reed applies a 1000 cent promotion
    Then the visit and customer account show 4000 cents due and "CompletedOutstanding"
```

This needs new steps in `spec/tests/workflows/clinic.steps.js`:

- a variant of the existing "attended … finalized bill" Given, with the visit
  recorded without `clinicalNotes`;
- a reassign When;
- a parameterized "Dr X (attempts to) apply a N cent promotion".

**Something to check while you're writing it:** the "4000 cents due /
CompletedOutstanding" outcome assumes a $70 total, the $20 booking fee
already paid, and a $10 promotion, so $40 due. That matches the existing
workflow scenarios' numbers ($50 remaining after the booking fee).

**Planned fix** (`services/checkout/server.js`, after red): drop the
`assignedVets` cache. Promotion and cash recording look up the visit's
current `veterinarianId` from Reservation (`GET /visits/{visitId}`, with a
service token) at the time of the action. That adds one downstream call to
each of those two operations.
