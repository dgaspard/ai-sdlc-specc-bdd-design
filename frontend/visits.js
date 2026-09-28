import { request, ApiError } from "./api.js";
import { referenceData, names } from "./appointments.js";
import {
  h,
  date,
  field,
  servicesField,
  selections,
  formAction,
  invalid,
} from "./ui.js";

export async function recordVisit(ctx, id) {
  const row = await request("reservation", `/reservations/${id}`);
  if (
    ctx.user.role !== "veterinarian" ||
    ctx.user.veterinarianId !== row.veterinarianId
  )
    throw new ApiError(403);
  if (row.visitId) {
    await ctx.navigate(`/visits/${row.visitId}`);
    return;
  }
  const data = await referenceData(ctx.user),
    n = names(row, data);
  ctx.title(
    "Record visit",
    `${n.pet} · ${n.customer} · ${n.vet} · ${date(row.scheduledStart)}`,
  );
  const notes = field("Clinical notes", "notes", {
    tag: "textarea",
    required: true,
  });
  const diagnoses = field("Diagnoses", "diagnoses", { tag: "textarea" });
  const medications = field("Medications", "medications", { tag: "textarea" });
  const followup = field("Follow-up notes", "followup", { tag: "textarea" });
  const form = h(
    "form",
    { class: "panel" },
    servicesField("Performed services", data.services, row.requestedServices),
    notes.node,
    diagnoses.node,
    medications.node,
    followup.node,
  );
  const lines = (input) =>
    input.value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  formAction(
    form,
    "Save visit",
    async () => {
      if (!selections(form).length || !notes.input.value.trim()) {
        invalid(
          form,
          !notes.input.value.trim()
            ? notes.input
            : form.querySelector('input[name="services"]'),
          "Clinical notes and at least one service are required.",
        );
        ctx.say("Check the highlighted fields.", true);
        return;
      }
      try {
        const result = await request(
          "reservation",
          `/reservations/${id}/visit`,
          {
            method: "POST",
            body: {
              performedServices: selections(form),
              clinicalNotes: notes.input.value.trim(),
              diagnoses: lines(diagnoses.input),
              medications: lines(medications.input),
              ...(followup.input.value.trim()
                ? { followUpNotes: followup.input.value.trim() }
                : {}),
            },
          },
        );
        await ctx.navigate(`/visits/${result.id}`, "Visit recorded.");
      } catch (error) {
        if (
          error.body?.code === "invalid_state" &&
          row.reservationState === "Accepted"
        )
          ctx.say(
            "This visit cannot be recorded before its appointment starts.",
            true,
          );
        else ctx.report(error);
      }
    },
    ctx.report,
  );
  ctx.content.replaceChildren(form);
}
export async function visit(ctx, id) {
  const [record, data] = await Promise.all([
    request("reservation", `/visits/${id}`),
    referenceData(ctx.user),
  ]);
  const row = await request(
      "reservation",
      `/reservations/${record.reservationId}`,
    ),
    n = names(record, data);
  ctx.title(
    "Visit details",
    `${n.pet} · ${n.customer} · ${n.vet} · ${date(row.scheduledStart)}`,
  );
  const panel = h(
    "section",
    { class: "panel stack" },
    h("h2", {}, "Clinical notes"),
    h("p", {}, record.clinicalNotes),
    h("h3", {}, "Performed services"),
    h(
      "p",
      {},
      data.services
        .filter((item) => record.performedServices.includes(item.id))
        .map((item) => item.name)
        .join(", "),
    ),
    h("h3", {}, "Diagnoses"),
    h("p", {}, record.diagnoses.join("\n") || "None recorded"),
    h("h3", {}, "Medications"),
    h("p", {}, record.medications.join("\n") || "None recorded"),
    record.followUpNotes &&
      h(
        "div",
        {},
        h("h3", {}, "Follow-up notes"),
        h("p", {}, record.followUpNotes),
      ),
  );
  let checkout;
  try {
    checkout = await request("checkout", `/visits/${id}/checkout`);
  } catch (error) {
    if (error.status !== 404) throw error;
  }
  if (checkout)
    panel.append(h("a", { href: `/bills/${checkout.id}` }, "View bill"));
  else if (
    ctx.user.role === "veterinarian" &&
    ctx.user.veterinarianId === record.veterinarianId
  ) {
    const form = h("form");
    formAction(
      form,
      "Finalize bill",
      async () => {
        let result;
        try {
          result = await request("checkout", `/visits/${id}/checkout`, {
            method: "POST",
          });
        } catch (error) {
          if (error.body?.code !== "already_finalized") throw error;
          result = await request("checkout", `/visits/${id}/checkout`);
        }
        await ctx.navigate(`/bills/${result.id}`, "Bill finalized.");
      },
      ctx.report,
    );
    panel.append(form);
  } else panel.append(h("p", {}, "The bill is not ready yet."));
  ctx.content.replaceChildren(panel);
}
