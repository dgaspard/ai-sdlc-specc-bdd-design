// MVP-02A (D-50, D-54): administrator-only visits-missing-notes report (S7).
import { request, ApiError } from "./api.js";
import { referenceData, names } from "./appointments.js";
import { h, date, isAdministrator } from "./ui.js";

export async function missingNotesReport(ctx) {
  if (!isAdministrator(ctx.user)) throw new ApiError(403);
  const [rows, data] = await Promise.all([
    request("reservation", "/reports/visits-missing-notes"),
    referenceData(ctx.user),
  ]);
  ctx.title(
    "Visits missing notes",
    "Completed visits that were closed without clinical notes.",
  );
  ctx.content.replaceChildren(
    rows.length
      ? h(
          "section",
          { class: "panel table-panel", "aria-label": "Visits missing notes" },
          h(
            "table",
            {},
            h(
              "thead",
              {},
              h(
                "tr",
                {},
                ["Pet", "Customer", "Veterinarian", "Date", "Details"].map(
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
                  h("td", {}, n.customer),
                  h("td", {}, n.vet),
                  h("td", {}, date(row.startedAt)),
                  h(
                    "td",
                    {},
                    h(
                      "a",
                      {
                        href: `/visits/${row.id}`,
                        "aria-label": `View visit for ${n.pet} on ${date(row.startedAt)}`,
                      },
                      "View visit",
                    ),
                  ),
                );
              }),
            ),
          ),
        )
      : h("p", {}, "No visits are missing clinical notes."),
  );
}
