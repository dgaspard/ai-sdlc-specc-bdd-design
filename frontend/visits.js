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
  isAdministrator,
  notice,
} from "./ui.js";

export async function recordVisit(ctx, id) {
  const row = await request("reservation", `/reservations/${id}`);
  const assignedVet =
    ctx.user.role === "veterinarian" &&
    ctx.user.veterinarianId === row.veterinarianId;
  // MVP-02A (D-41, D-47, D-55): an administrator bypass may close/record a
  // visit, but may never supply clinical content.
  const bypass = isAdministrator(ctx.user) && !assignedVet;
  if (!assignedVet && !bypass) throw new ApiError(403);
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
  const notes = bypass
    ? null
    : field("Clinical notes", "notes", { tag: "textarea", required: true });
  const diagnoses = bypass
    ? null
    : field("Diagnoses", "diagnoses", { tag: "textarea" });
  const medications = bypass
    ? null
    : field("Medications", "medications", { tag: "textarea" });
  const followup = bypass
    ? null
    : field("Follow-up notes", "followup", { tag: "textarea" });
  const form = h(
    "form",
    { class: "panel" },
    servicesField("Performed services", data.services, row.requestedServices),
    bypass
      ? notice(
          "This visit will be saved without clinical notes and flagged for follow-up.",
        )
      : [notes.node, diagnoses.node, medications.node, followup.node],
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
      if (!selections(form).length || (!bypass && !notes.input.value.trim())) {
        invalid(
          form,
          !bypass && !notes.input.value.trim()
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
              ...(bypass
                ? {}
                : {
                    clinicalNotes: notes.input.value.trim(),
                    diagnoses: lines(diagnoses.input),
                    medications: lines(medications.input),
                    ...(followup.input.value.trim()
                      ? { followUpNotes: followup.input.value.trim() }
                      : {}),
                  }),
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
    // MVP-02A (D-46, D-50): a visit closed via the administrator bypass has
    // no clinical notes at all; show the flag rather than an empty section.
    record.notesMissing
      ? h("p", { class: "badge pending" }, "Missing clinical notes")
      : [h("h2", {}, "Clinical notes"), h("p", {}, record.clinicalNotes)],
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
    // D-41 bypasses accept/deny/record-visit/promotion/cash, but not
    // finalizing the bill (D-36): only the visit's own assigned veterinarian
    // finalizes, matching checkout's unchanged assigned(), not assignedOrAdmin().
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
