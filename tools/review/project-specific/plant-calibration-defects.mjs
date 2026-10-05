#!/usr/bin/env node
// ENG-02 calibration: plant the defects in calibration-manifest.md into a
// SCRATCH COPY of the repo. Never run this against the real working tree.
//
//   node plant-calibration-defects.mjs <scratch-dir> [CAL-01,CAL-02,...]
//
// With no ID list, every defect is planted. Each edit is an exact-string
// replacement that must match exactly once, so a drifted baseline fails loudly
// instead of silently planting nothing.
import fs from "node:fs";
import path from "node:path";

const [target, only] = process.argv.slice(2);
if (!target) {
  console.error("usage: plant-calibration-defects.mjs <scratch-dir> [IDs]");
  process.exit(2);
}
const root = path.resolve(target);
const real = path.resolve(import.meta.dirname, "../../..");
if (root === real || fs.existsSync(path.join(root, ".git"))) {
  console.error(`Refusing: ${root} is the real repo or a git checkout.`);
  process.exit(2);
}

const CHECKOUT = "services/checkout/server.js";
const RESERVATION = "services/reservation/server.js";
const CUSTOMER = "services/customer/server.js";
const RUNTIME = "services/platform/runtime.js";

const DEFECTS = {
  "CAL-01": [
    [
      CHECKOUT,
      `function remaining(c) {`,
      `const chicago = (value) =>
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
function remaining(c) {`,
    ],
    [
      CHECKOUT,
      `      app.outcome("finalized");`,
      `      const local = chicago(app.now());
      app.attrs({
        "checkout.billed_local_date": \`\${local.year}-\${local.month}-\${local.day}\`,
      });
      app.outcome("finalized");`,
    ],
  ],
  "CAL-02": [
    [
      CHECKOUT,
      `    "payment.attempt.id": a?.attemptId,
    "checkout.replayed": replayed,`,
      `    "payment.attempt.id": a?.attemptId,
    "payment.method_reference": a?.mockMethodReference,
    "checkout.replayed": replayed,`,
    ],
  ],
  "CAL-03": [
    [
      RUNTIME,
      `      const expected = createHmac("sha256", this.secret)`,
      `      // Service tokens are minted by sibling services on the private network and
      // only live 300 s, so skip the HMAC on this hot path and just check expiry.
      if (
        claims.role === "service" &&
        claims.sub &&
        Number.isFinite(claims.exp) &&
        claims.exp > Date.parse(this.now()) / 1000
      )
        return claims;
      const expected = createHmac("sha256", this.secret)`,
    ],
  ],
  "CAL-04": [
    [
      RUNTIME,
      `        s.length !== expected.length ||
        !timingSafeEqual(Buffer.from(s), Buffer.from(expected))`,
      `        s !== expected`,
    ],
  ],
  "CAL-05": [
    [
      CHECKOUT,
      `      const fees = await app.dependency(
        \`\${urls.catalog}/fees?serviceIds=\${v.performedServices.join(",")}\`,
      );`,
      `      let fees;
      try {
        fees = await app.dependency(
          \`\${urls.catalog}/fees?serviceIds=\${v.performedServices.join(",")}\`,
        );
      } catch {
        // Catalog briefly unavailable: price from the shared seed catalog so the
        // veterinarian isn't blocked at the end of a visit.
        fees = {
          fees: app
            .seed("services")
            .filter((s) => v.performedServices.includes(s.id)),
        };
      }`,
    ],
  ],
  "CAL-06": [
    [
      RUNTIME,
      `            if (
              user &&
              !route.op["x-roles"].includes(user.role) &&
              !(user.roles ?? []).some((r) => route.op["x-roles"].includes(r))
            )`,
      `            // D-39: the clinic owner is a veterinarian, so veterinarians can manage the
            // roster as well as administrators.
            const roster =
              route.route.startsWith("/veterinarians") &&
              user?.role === "veterinarian";
            if (
              user &&
              !roster &&
              !route.op["x-roles"].includes(user.role) &&
              !(user.roles ?? []).some((r) => route.op["x-roles"].includes(r))
            )`,
    ],
  ],
  "CAL-07": [
    [
      RESERVATION,
      `      app.attrs({
        "reservation.id": params.reservationId,
        "veterinarian.id": user.veterinarianId,
      });
      const r = getReservation(user, params.reservationId);
      // D-48 (revised)`,
      `      app.attrs({
        "veterinarian.id": user.veterinarianId,
      });
      const r = getReservation(user, params.reservationId);
      // D-48 (revised)`,
    ],
  ],
  "CAL-08": [
    [
      RESERVATION,
      `  for (const v of vets.filter(
    (v) =>
      v.active &&
      (!query.has("veterinarianId")`,
      `  for (const v of vets.filter(
    (v) =>
      (!query.has("veterinarianId")`,
    ],
  ],
  "CAL-09": [
    [
      CUSTOMER,
      `app.route("GET", "/customers", () => ok([...customers.values()].map(view)));`,
      `app.route("GET", "/customers", ({ query }) => {
  // Front-desk lookup: optional ?search= matches first or last name.
  const pattern = query.has("search") ? new RegExp(query.get("search"), "i") : null;
  return ok(
    [...customers.values()]
      .filter((c) => !pattern || pattern.test(\`\${c.firstName} \${c.lastName}\`))
      .map(view),
  );
});`,
    ],
  ],
  "CAL-10": [
    [
      RUNTIME,
      `          if (
            req.headers.origin ===
            (process.env.FRONTEND_ORIGIN ?? "http://localhost:3000")
          ) {
            res.setHeader("Access-Control-Allow-Origin", req.headers.origin);`,
      `          if (req.headers.origin) {
            res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
            res.setHeader("Access-Control-Allow-Credentials", "true");`,
    ],
  ],
  "CAL-11": [
    [
      RUNTIME,
      `            const user = route.op["x-roles"].includes("anonymous")
              ? null
              : this.authenticate(req.headers.authorization);`,
      `            // Internal routes are only reachable from sibling services on this host.
            const internal =
              route.route.startsWith("/internal/") &&
              ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
                req.socket.remoteAddress,
              );
            const user = route.op["x-roles"].includes("anonymous")
              ? null
              : internal
                ? { sub: "internal", role: "service" }
                : this.authenticate(req.headers.authorization);`,
    ],
  ],
  "CAL-12": [
    [
      CHECKOUT,
      `      if (incompleteBills.has(params.visitId)) fail(502, "dependency_failed");
`,
      ``,
    ],
  ],
  "CAL-13": [
    [
      RUNTIME,
      `      return claims;
    } catch {
      fail(401, "unauthenticated");`,
      `      return claims;
    } catch {
      console.error(\`[\${this.name}] rejected credentials:\`, header);
      fail(401, "unauthenticated");`,
    ],
  ],
};

const ids = only ? only.split(",") : Object.keys(DEFECTS);
for (const cal of ids) {
  if (!DEFECTS[cal]) throw new Error(`Unknown defect ${cal}`);
  for (const [file, from, to] of DEFECTS[cal]) {
    const p = path.join(root, file);
    const src = fs.readFileSync(p, "utf8");
    const count = src.split(from).length - 1;
    if (count !== 1)
      throw new Error(`${cal}: anchor matched ${count}x in ${file}`);
    fs.writeFileSync(
      p,
      src.replace(from, () => to),
    );
  }
  console.log(`planted ${cal}`);
}
