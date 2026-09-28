import {
  Runtime,
  id,
  ok,
  created,
  fail,
  owner,
  assigned,
  Locks,
} from "../platform/runtime.js";
const app = new Runtime("reservation", 4002, ["CUSTOMER_URL", "CHECKOUT_URL"]);
const customerURL = process.env.CUSTOMER_URL,
  checkoutURL = process.env.CHECKOUT_URL;
let reservations, visits, vets, serviceIds, locks;
const ms = (value) => Date.parse(value);
const chicago = (value) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(value))
      .map((p) => [p.type, p.value]),
  );
const hours = [8, 9, 10, 11, 13, 14, 15, 16];
function startFor(date, hour) {
  const midday = new Date(`${date}T12:00:00Z`),
    offset = 12 - Number(chicago(midday).hour);
  return new Date(
    midday.getTime() + (hour + offset - 12) * 3600000,
  ).toISOString();
}
const overlap = (a, b) =>
  ms(a.scheduledStart) < ms(b.scheduledEnd) &&
  ms(b.scheduledStart) < ms(a.scheduledEnd);
const conflicts = (r, field) =>
  [...reservations.values()].some(
    (x) =>
      x.id !== r.id &&
      x.reservationState === "Accepted" &&
      x[field] === r[field] &&
      overlap(x, r),
  );
function validateSlot(r) {
  const d = chicago(r.scheduledStart);
  if (
    ["Sat", "Sun"].includes(d.weekday) ||
    !hours.includes(Number(d.hour)) ||
    d.minute !== "00" ||
    d.second !== "00" ||
    ms(r.scheduledStart) % 1000 !== 0 ||
    ms(r.scheduledEnd) - ms(r.scheduledStart) !== 3600000
  )
    fail(422, "invalid_slot");
  if (ms(r.scheduledStart) < ms(app.now())) fail(422, "past_start");
}
function getReservation(user, rid) {
  return owner(user, reservations.get(rid));
}
function getVisit(user, vid) {
  return owner(user, visits.get(vid));
}
const list = (map, user, query) =>
  [...map.values()].filter(
    (r) =>
      (user.role !== "customer" || r.customerId === user.customerId) &&
      ["customerId", "petId", "veterinarianId"].every(
        (k) => !query.has(k) || query.get(k) === r[k],
      ),
  );
app.route("GET", "/veterinarians", () => ok(vets));
app.route("GET", "/availability", ({ query }) => {
  const date = query.get("date") ?? app.date(),
    slots = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return ok({ date: app.date(), slots });
  for (const v of vets.filter(
    (v) => !query.has("veterinarianId") || query.get("veterinarianId") === v.id,
  ))
    for (const hour of hours) {
      const start = startFor(date, hour),
        end = new Date(ms(start) + 3600000).toISOString();
      if (
        ["Sat", "Sun"].includes(chicago(start).weekday) ||
        ms(start) < ms(app.now())
      )
        continue;
      if (
        !conflicts(
          { veterinarianId: v.id, scheduledStart: start, scheduledEnd: end },
          "veterinarianId",
        )
      )
        slots.push({ veterinarianId: v.id, start, end });
    }
  return ok({ date, slots });
});
app.route(
  "POST",
  "/reservations",
  ({ body, user }) =>
    locks.run("calendar", async () => {
      app.attrs({
        "customer.id": body.customerId,
        "pet.id": body.petId,
        "veterinarian.id": body.veterinarianId,
      });
      owner(user, { customerId: body.customerId });
      if (!vets.some((v) => v.id === body.veterinarianId))
        fail(404, "not_found");
      validateSlot(body);
      const own = await app.dependency(
        `${customerURL}/internal/customers/${body.customerId}/pets/${body.petId}/ownership`,
      );
      if (!own.owned) fail(404, "not_found");
      if (conflicts(body, "petId")) fail(422, "pet_conflict");
      const eligibility = await app.dependency(
        `${customerURL}/customers/${body.customerId}/eligibility`,
      );
      const r = {
        ...body,
        id: id(),
        bookingFeeAmount: 2000,
        bookingFeePaid: false,
        bookingPaymentId: null,
        requestedAt: app.now(),
        acceptedAt: null,
        reservationState: eligibility.eligible ? "Requested" : "Denied",
        visitId: null,
        denialReason: eligibility.eligible
          ? null
          : `Please pay your full balance of $${(eligibility.outstandingBalance / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      };
      reservations.set(r.id, r);
      app.attrs({ "reservation.id": r.id });
      app.outcome(
        eligibility.eligible ? "requested" : "denied_outstanding_balance",
      );
      return created(r);
    }),
  "request",
);
app.route("GET", "/reservations", ({ user, query }) =>
  ok(list(reservations, user, query)),
);
app.route("GET", "/reservations/{reservationId}", ({ user, params }) =>
  ok(getReservation(user, params.reservationId)),
);
app.route(
  "POST",
  "/reservations/{reservationId}/accept",
  ({ user, params, body, key }) =>
    locks.run("calendar", async () => {
      app.attrs({
        "reservation.id": params.reservationId,
        "veterinarian.id": user.veterinarianId,
      });
      const r = getReservation(user, params.reservationId);
      assigned(user, r.veterinarianId);
      if (r.reservationState !== "Requested") fail(409, "invalid_state");
      if (ms(r.scheduledStart) <= ms(app.now())) fail(422, "past_start");
      for (const [field, reason] of [
        ["veterinarianId", "slot_unavailable"],
        ["petId", "pet_conflict"],
      ])
        if (conflicts(r, field)) {
          r.reservationState = "Denied";
          r.denialReason = reason;
          app.outcome(reason);
          return ok(r);
        }
      const fee = await app.dependency(`${checkoutURL}/internal/booking-fees`, {
        method: "POST",
        headers: { "idempotency-key": key },
        body: {
          reservationId: r.id,
          customerId: r.customerId,
          amount: r.bookingFeeAmount,
          currency: "USD",
          ...body.bookingFee,
          ...(body.bookingFee.method === "cash"
            ? { recordedByVeterinarianId: user.veterinarianId }
            : {}),
        },
      });
      app.attrs({ "payment.attempt.id": fee.attempt.attemptId });
      if (!fee.paid) fail(422, "booking_payment_declined");
      r.bookingFeePaid = true;
      r.bookingPaymentId = fee.paymentId;
      r.acceptedAt = app.now();
      r.reservationState = "Accepted";
      app.outcome("accepted");
      return ok(r);
    }),
  "accept",
);
app.route(
  "POST",
  "/reservations/{reservationId}/deny",
  ({ user, params }) =>
    locks.run("calendar", () => {
      app.attrs({
        "reservation.id": params.reservationId,
        "veterinarian.id": user.veterinarianId,
      });
      const r = getReservation(user, params.reservationId);
      assigned(user, r.veterinarianId);
      if (r.reservationState !== "Requested") fail(409, "invalid_state");
      r.reservationState = "Denied";
      r.denialReason = "Denied by veterinarian";
      app.outcome("denied");
      return ok(r);
    }),
  "deny",
);
app.route(
  "POST",
  "/reservations/{reservationId}/cancel",
  ({ user, params }) =>
    locks.run("calendar", () => {
      app.attrs({
        "reservation.id": params.reservationId,
        ...(user.role === "veterinarian"
          ? { "veterinarian.id": user.veterinarianId }
          : {}),
      });
      const r = getReservation(user, params.reservationId);
      app.attrs({ "customer.id": r.customerId });
      if (user.role === "veterinarian") assigned(user, r.veterinarianId);
      if (r.reservationState !== "Accepted") fail(409, "invalid_state");
      if (ms(r.scheduledStart) <= ms(app.now())) fail(422, "already_started");
      r.reservationState = "Canceled";
      app.outcome("canceled");
      return ok(r);
    }),
  "cancel",
);
app.route(
  "POST",
  "/reservations/{reservationId}/visit",
  ({ user, params, body }) => {
    app.attrs({
      "reservation.id": params.reservationId,
      "veterinarian.id": user.veterinarianId,
    });
    const r = getReservation(user, params.reservationId);
    assigned(user, r.veterinarianId);
    if (
      r.reservationState !== "Accepted" ||
      ms(app.now()) < ms(r.scheduledStart)
    )
      fail(409, "invalid_state");
    if (r.visitId) fail(409, "already_recorded");
    if (body.performedServices.some((s) => !serviceIds.has(s)))
      fail(422, "unknown_service");
    const v = {
      ...body,
      id: id(),
      reservationId: r.id,
      customerId: r.customerId,
      petId: r.petId,
      veterinarianId: r.veterinarianId,
      startedAt: app.now(),
    };
    visits.set(v.id, v);
    r.visitId = v.id;
    app.attrs({ "visit.id": v.id });
    app.outcome("recorded");
    return created(v);
  },
  "record_visit",
);
app.route("GET", "/visits", ({ user, query }) => ok(list(visits, user, query)));
app.route("GET", "/visits/{visitId}", ({ user, params }) =>
  ok(getVisit(user, params.visitId)),
);
app.route(
  "PATCH",
  "/visits/{visitId}",
  ({ user, params, body }) => {
    app.attrs({
      "visit.id": params.visitId,
      "veterinarian.id": user.veterinarianId,
    });
    const v = getVisit(user, params.visitId);
    assigned(user, v.veterinarianId);
    if (
      !["CompletedSettled", "CompletedOutstanding"].includes(
        reservations.get(v.reservationId).reservationState,
      )
    )
      fail(409, "invalid_state");
    Object.assign(v, body);
    app.outcome("corrected");
    return ok(v);
  },
  "correct_visit",
);
app.route(
  "POST",
  "/internal/reservations/{reservationId}/complete",
  ({ user, params, body }) => {
    app.attrs({ "reservation.id": params.reservationId });
    const r = getReservation(user, params.reservationId);
    app.attrs({ "visit.id": r.visitId });
    const target =
      body.financialOutcome === "settled"
        ? "CompletedSettled"
        : "CompletedOutstanding";
    if (r.reservationState === target) fail(409, "already_completed");
    if (
      !r.visitId ||
      !["Accepted", "CompletedOutstanding"].includes(r.reservationState)
    )
      fail(409, "invalid_state");
    r.reservationState = target;
    app.outcome(
      body.financialOutcome === "settled"
        ? "completed_settled"
        : "completed_outstanding",
    );
    return ok(r);
  },
  "complete",
);
await app.serve(() => {
  reservations = new Map();
  visits = new Map();
  locks = new Locks();
  vets = app.seed("veterinarians");
  serviceIds = new Set(app.seed("services").map((s) => s.id));
});
