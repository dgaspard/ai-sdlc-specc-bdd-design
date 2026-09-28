import {
  request,
  ApiError,
  pendingPayment,
  rememberPayment,
  forgetPayment,
} from "./api.js";
import {
  h,
  date,
  time,
  fullName,
  vetName,
  field,
  paymentMethod,
  servicesField,
  selections,
  formAction,
  invalid,
} from "./ui.js";

const states = {
  Requested: "Requested",
  Accepted: "Accepted",
  Denied: "Denied",
  Canceled: "Canceled",
  CompletedOutstanding: "Completed · balance due",
  CompletedSettled: "Completed · paid",
};
export function status(reservation) {
  return h(
    "span",
    {
      class: `badge${reservation.reservationState === "Requested" ? " pending" : ""}`,
    },
    states[reservation.reservationState],
  );
}
export async function referenceData(user) {
  const [customers, vets, services] = await Promise.all([
    user.role === "customer"
      ? request("customer", `/customers/${user.customerId}`).then(
          (customer) => [customer],
        )
      : request("customer", "/customers"),
    request("reservation", "/veterinarians"),
    request("catalog", "/services"),
  ]);
  return { customers, vets, services };
}
export function names(record, data) {
  const customer = data.customers.find((item) => item.id === record.customerId);
  const pet = customer?.pets.find((item) => item.id === record.petId);
  const vet = data.vets.find((item) => item.id === record.veterinarianId);
  return {
    customer: customer ? fullName(customer) : "Customer",
    pet: pet?.name ?? "Pet",
    vet: vet ? vetName(vet) : "Veterinarian",
  };
}
export async function appointments(ctx) {
  const [rows, data] = await Promise.all([
    request("reservation", "/reservations"),
    referenceData(ctx.user),
  ]);
  ctx.title(
    "Appointments",
    ctx.user.role === "customer"
      ? "Manage your pet's upcoming care."
      : "Review appointments and record the care you provide.",
    ctx.user.role === "customer" &&
      h(
        "a",
        { class: "button", href: "/appointments/new" },
        "Request appointment",
      ),
  );
  ctx.content.replaceChildren(
    rows.length
      ? h(
          "section",
          { class: "panel table-panel", "aria-label": "Appointments" },
          h(
            "table",
            {},
            h(
              "thead",
              {},
              h(
                "tr",
                {},
                ["Pet", "Date & time", "Veterinarian", "Status", "Details"].map(
                  (text) => h("th", {}, text),
                ),
              ),
            ),
            h(
              "tbody",
              {},
              rows.map((row) => {
                const n = names(row, data);
                return h(
                  "tr",
                  {},
                  h("td", {}, h("strong", {}, n.pet)),
                  h(
                    "td",
                    {},
                    date(row.scheduledStart),
                    h(
                      "div",
                      { class: "detail" },
                      time(row.scheduledStart, true),
                    ),
                  ),
                  h("td", {}, n.vet),
                  h("td", {}, status(row)),
                  h(
                    "td",
                    {},
                    h(
                      "a",
                      {
                        href: `/appointments/${row.id}`,
                        "aria-label": `View appointment for ${n.pet} on ${date(row.scheduledStart)}`,
                      },
                      "View appointment",
                    ),
                  ),
                );
              }),
            ),
          ),
        )
      : h("p", {}, "No appointments yet."),
  );
}
export async function appointment(ctx, id) {
  const [row, data] = await Promise.all([
    request("reservation", `/reservations/${id}`),
    referenceData(ctx.user),
  ]);
  const n = names(row, data);
  ctx.title(
    "Appointment details",
    `${n.pet} · ${date(row.scheduledStart)} · ${time(row.scheduledStart)}`,
    status(row),
  );
  const panel = h(
    "section",
    { class: "panel stack" },
    h("h2", {}, n.pet),
    h("p", {}, `${n.customer} · ${n.vet}`),
    h(
      "p",
      {},
      data.services
        .filter((service) => row.requestedServices.includes(service.id))
        .map((service) => service.name)
        .join(", "),
    ),
    h("p", {}, "$20.00 booking fee"),
  );
  const assigned =
    ctx.user.role === "veterinarian" &&
    ctx.user.veterinarianId === row.veterinarianId;
  if (assigned && row.reservationState === "Requested") {
    const method = paymentMethod("booking-method", "Booking payment method");
    const form = h("form", {}, method.node);
    // Retain ambiguous booking intents across reloads, just like visit payments.
    const storageId = `booking:${id}`;
    let intent = pendingPayment(storageId);
    if (intent) {
      method.input.value = intent.body.bookingFee.mockMethodReference;
      method.input.disabled = true;
      ctx.say(
        "Booking payment outcome needs attention. Accept appointment retries the same payment.",
        true,
      );
    }
    formAction(
      form,
      "Accept appointment",
      async () => {
        intent ??= {
          key: crypto.randomUUID(),
          body: {
            bookingFee: {
              method: "card",
              mockMethodReference: method.input.value,
            },
          },
        };
        rememberPayment(storageId, intent);
        method.input.disabled = true;
        try {
          const result = await request(
            "reservation",
            `/reservations/${id}/accept`,
            { method: "POST", ...intent },
          );
          intent = null;
          forgetPayment(storageId);
          await appointment(ctx, id);
          ctx.say(
            result.reservationState === "Accepted"
              ? "Appointment accepted. Booking fee paid."
              : (result.denialReason ?? "This appointment was denied."),
            result.reservationState !== "Accepted",
          );
        } catch (error) {
          if (error.body?.code === "booking_payment_declined") {
            intent = null;
            forgetPayment(storageId);
            method.input.disabled = false;
            ctx.say(
              "Booking payment was declined. The appointment is still requested.",
              true,
            );
          } else if (error.body?.code === "past_start") {
            intent = null;
            forgetPayment(storageId);
            method.input.disabled = false;
            ctx.say(
              "This appointment has already started and cannot be accepted.",
              true,
            );
          } else if (error.status === 409) {
            await appointment(ctx, id);
            ctx.report(error);
          } else if (!error.status || error.status >= 500) {
            ctx.say(
              "Booking payment outcome needs attention. Accept appointment retries the same payment.",
              true,
            );
          } else ctx.report(error);
        }
      },
      ctx.report,
    );
    panel.append(form);
  }
  if (row.visitId)
    panel.append(h("a", { href: `/visits/${row.visitId}` }, "View visit"));
  else if (assigned && row.reservationState === "Accepted")
    panel.append(
      h(
        "a",
        { class: "button", href: `/appointments/${id}/visit` },
        "Record visit",
      ),
    );
  if (row.denialReason) panel.append(h("p", {}, row.denialReason));
  ctx.content.replaceChildren(panel);
}
export async function newAppointment(ctx) {
  if (ctx.user.role !== "customer") throw new ApiError(403);
  const [pets, data] = await Promise.all([
    request("customer", `/customers/${ctx.user.customerId}/pets`),
    referenceData(ctx.user),
  ]);
  ctx.title("Request appointment", "Choose the care your pet needs.");
  const pet = field("Pet", "pet", { tag: "select", required: true });
  const vet = field("Veterinarian", "vet", { tag: "select", required: true });
  const day = field("Appointment date", "day", {
    type: "date",
    required: true,
  });
  const slot = field("Available time", "slot", {
    tag: "select",
    required: true,
  });
  pet.input.append(
    ...pets.map((item) => h("option", { value: item.id }, item.name)),
  );
  vet.input.append(
    ...data.vets.map((item) => h("option", { value: item.id }, vetName(item))),
  );
  const slotsMessage = h("p", { class: "small muted" });
  let slots = [],
    revision = 0;
  const loadSlots = async () => {
    const version = ++revision;
    slots = [];
    slot.input.replaceChildren(h("option", { value: "" }, "Choose a time"));
    slotsMessage.textContent = "";
    if (!day.input.value) return;
    try {
      const result = await request(
        "reservation",
        `/availability?date=${encodeURIComponent(day.input.value)}&veterinarianId=${encodeURIComponent(vet.input.value)}`,
      );
      if (version !== revision) return;
      slots = result.slots;
      slot.input.append(
        ...slots.map((item, index) =>
          h(
            "option",
            { value: index },
            `${time(item.start)} – ${time(item.end)}`,
          ),
        ),
      );
      if (!slots.length)
        slotsMessage.textContent =
          "No appointments are available for this date and veterinarian.";
    } catch (error) {
      if (version === revision) ctx.report(error);
    }
  };
  day.input.addEventListener("change", loadSlots);
  vet.input.addEventListener("change", loadSlots);
  const services = servicesField("Requested services", data.services);
  const summary = h("p", {}, "None selected");
  const form = h(
    "form",
    { class: "panel" },
    pet.node,
    vet.node,
    day.node,
    slot.node,
    slotsMessage,
    services,
  );
  services.addEventListener("change", () => {
    summary.textContent =
      data.services
        .filter((item) => selections(form).includes(item.id))
        .map((item) => item.name)
        .join(", ") || "None selected";
  });
  formAction(
    form,
    "Request appointment",
    async () => {
      if (!selections(form).length) {
        invalid(
          form,
          form.querySelector('input[name="services"]'),
          "Choose at least one service.",
        );
        ctx.say("Check the highlighted fields.", true);
        return;
      }
      const selected = slots[Number(slot.input.value)];
      if (!selected) {
        ctx.say("Check the highlighted fields.", true);
        return;
      }
      const row = await request("reservation", "/reservations", {
        method: "POST",
        body: {
          customerId: ctx.user.customerId,
          petId: pet.input.value,
          veterinarianId: vet.input.value,
          scheduledStart: selected.start,
          scheduledEnd: selected.end,
          requestedServices: selections(form),
        },
      });
      await ctx.navigate(
        `/appointments/${row.id}`,
        row.reservationState === "Requested"
          ? "Appointment requested."
          : (row.denialReason ?? "This appointment was denied."),
      );
    },
    ctx.report,
  );
  form.append(
    h(
      "p",
      { class: "rule" },
      h("a", { href: "/appointments" }, "Back to appointments"),
    ),
  );
  ctx.content.replaceChildren(
    h(
      "div",
      { class: "columns" },
      form,
      h(
        "aside",
        { class: "panel" },
        h("h2", {}, "Before you book"),
        h(
          "p",
          {},
          "A $20.00 booking fee is collected when your veterinarian accepts the appointment. It is not refundable if you cancel.",
        ),
        h("h3", { class: "rule" }, "Requested services"),
        summary,
      ),
    ),
  );
}
