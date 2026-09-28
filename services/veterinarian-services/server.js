import { Runtime, ok, fail, requireValue } from "../platform/runtime.js";
const app = new Runtime("veterinarian-services", 4003);
let services;
app.route("GET", "/services", () => ok([...services.values()]));
app.route("GET", "/services/{serviceId}", ({ params }) =>
  ok(requireValue(services.get(params.serviceId))),
);
app.route(
  "PATCH",
  "/services/{serviceId}",
  ({ params, body, user }) => {
    app.attrs({
      "veterinarian_service.id": params.serviceId,
      "veterinarian.id": user.veterinarianId,
    });
    const s = requireValue(services.get(params.serviceId));
    Object.assign(s, body);
    app.outcome("updated");
    return ok(s);
  },
  "update_service",
);
app.route(
  "GET",
  "/fees",
  ({ query }) => {
    const ids = (query.get("serviceIds") ?? "").split(",").filter(Boolean);
    app.attrs({ "veterinarian_service.count": ids.length });
    const unknown = ids.filter((i) => !services.has(i));
    if (unknown.length)
      fail(422, "unknown_service", { unknownServiceIds: unknown });
    app.outcome("found");
    return ok({ fees: ids.map((i) => services.get(i)) });
  },
  "get_fees",
);
await app.serve(() => {
  services = new Map(app.seed("services").map((s) => [s.id, s]));
});
