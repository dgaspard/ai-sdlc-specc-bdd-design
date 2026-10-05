// MVP-02A (D-54): administrator-only roster management screen (S6).
import { request, ApiError } from "./api.js";
import { h, field, fullName, formAction, isAdministrator } from "./ui.js";

export async function veterinarians(ctx) {
  if (!isAdministrator(ctx.user)) throw new ApiError(403);
  const rows = await request("reservation", "/veterinarians");
  ctx.title(
    "Veterinarians",
    "Add veterinarians and manage who is currently seeing patients.",
  );
  const table = h(
    "table",
    {},
    h(
      "thead",
      {},
      h(
        "tr",
        {},
        ["Name", "Office", "Status", "Action"].map((text) => h("th", {}, text)),
      ),
    ),
    h("tbody", {}),
  );
  const tbody = table.querySelector("tbody");
  function row(v) {
    const status = h("td", {}, v.active ? "Active" : "Inactive");
    const actionButton = h(
      "button",
      { type: "button" },
      v.active ? "Deactivate" : "Reactivate",
    );
    actionButton.addEventListener("click", async () => {
      actionButton.disabled = true;
      try {
        const updated = await request(
          "reservation",
          `/veterinarians/${v.id}`,
          { method: "PATCH", body: { active: !v.active } },
        );
        v.active = updated.active;
        status.textContent = v.active ? "Active" : "Inactive";
        actionButton.textContent = v.active ? "Deactivate" : "Reactivate";
        ctx.say(
          v.active ? "Veterinarian reactivated." : "Veterinarian deactivated.",
        );
      } catch (error) {
        ctx.report(error);
      } finally {
        actionButton.disabled = false;
      }
    });
    return h(
      "tr",
      {},
      h("td", {}, h("strong", {}, fullName(v))),
      h("td", {}, v.officeId),
      status,
      h("td", {}, actionButton),
    );
  }
  tbody.append(...rows.map(row));

  const firstName = field("First name", "vet-first-name", { required: true });
  const lastName = field("Last name", "vet-last-name", { required: true });
  const office = field("Office", "vet-office", { required: true });
  const form = h("form", { class: "panel" }, firstName.node, lastName.node, office.node);
  const formWrap = h("div", {});
  const toggle = h("button", { type: "button" }, "Add veterinarian");
  toggle.addEventListener("click", () => {
    formWrap.replaceChildren(formWrap.contains(form) ? h("div") : form);
  });
  formAction(
    form,
    "Add veterinarian",
    async () => {
      const v = await request("reservation", "/veterinarians", {
        method: "POST",
        body: {
          firstName: firstName.input.value.trim(),
          lastName: lastName.input.value.trim(),
          officeId: office.input.value.trim(),
        },
      });
      tbody.append(row(v));
      firstName.input.value = "";
      lastName.input.value = "";
      office.input.value = "";
      formWrap.replaceChildren();
      ctx.say("Veterinarian added.");
    },
    ctx.report,
  );
  ctx.content.replaceChildren(
    h(
      "section",
      { class: "panel table-panel", "aria-label": "Veterinarians" },
      table,
    ),
    h("div", { class: "rule" }, toggle, formWrap),
  );
}
