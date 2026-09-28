import http from "node:http";
import { readFile } from "node:fs/promises";

const config = Object.fromEntries(
  [
    ["customer", "CUSTOMER_URL", 4001],
    ["reservation", "RESERVATION_URL", 4002],
    ["catalog", "VETERINARIAN_SERVICES_URL", 4003],
    ["checkout", "CHECKOUT_URL", 4004],
  ].map(([name, variable, port]) => [
    name,
    process.env[variable] ?? `http://localhost:${port}`,
  ]),
);
const files = new Map([
  ...[
    "app.js",
    "api.js",
    "ui.js",
    "appointments.js",
    "visits.js",
    "billing.js",
  ].map((name) => [`/${name}`, [name, "text/javascript"]]),
  [
    "/design/styles/clinic.css",
    ["../spec/frontend/styles/clinic.css", "text/css"],
  ],
  [
    "/design/assets/cedar-paw.svg",
    ["../spec/frontend/assets/cedar-paw.svg", "image/svg+xml"],
  ],
  ...[400, 600].map((weight) => [
    `/design/assets/fonts/inter-latin-${weight}-normal.woff2`,
    [
      `../spec/frontend/assets/fonts/inter-latin-${weight}-normal.woff2`,
      "font/woff2",
    ],
  ]),
]);
const pageRoute =
  /^\/(?:appointments(?:\/new|\/[\da-f-]+(?:\/visit)?)?|visits\/[\da-f-]+|bills\/[\da-f-]+)?$/i;

const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("referrer-policy", "no-referrer");
  response.setHeader("cache-control", "no-store");
  response.setHeader(
    "content-security-policy",
    `default-src 'self'; connect-src 'self' ${Object.values(config)
      .map((url) => new URL(url).origin)
      .join(" ")}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`,
  );
  if (request.method !== "GET") {
    response.writeHead(405);
    response.end();
    return;
  }
  if (pathname === "/health" || pathname === "/config.json") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify(pathname === "/health" ? { status: "ok" } : config),
    );
    return;
  }
  const file =
    files.get(pathname) ??
    (pageRoute.test(pathname) ? ["index.html", "text/html"] : null);
  if (file) {
    try {
      const content = await readFile(new URL(file[0], import.meta.url));
      response.writeHead(200, { "content-type": file[1] });
      response.end(content);
    } catch {
      response.writeHead(500);
      response.end("Unable to load this page.");
    }
    return;
  }
  response.writeHead(404, { "content-type": "text/plain" });
  response.end("Not found.");
});

server.listen(Number(process.env.PORT ?? 3000), "0.0.0.0");
function stop() {
  server.close();
  server.closeIdleConnections();
}
process.once("SIGTERM", stop);
process.once("SIGINT", stop);
