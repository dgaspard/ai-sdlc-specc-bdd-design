// Project table from spec/contracts/runtime-contract.md. Protected scaffolding.
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, "..", "..");
export const SPEC_ROOT = path.resolve(here, "..");
export const LOG_DIR = path.join(REPO_ROOT, "test-results", "logs");
export const SEED_DATA_DIR = path.join(SPEC_ROOT, "seed-data");
export const CONTRACTS_DIR = path.join(SPEC_ROOT, "contracts");

export const DEFAULT_CLINIC_NOW = "2026-10-05T09:00:00-05:00";
export const FRONTEND_ORIGIN = "http://localhost:3000";
export const DEMO_AUTH_TOKEN_SECRET = "demo-only-not-a-secret";
export const OTLP_ENDPOINT = "http://localhost:4318";
export const HEALTH_TIMEOUT_MS = 10_000;

const url = (port) => `http://localhost:${port}`;

// kind: "service" | "frontend" | "fake"
// dependsOn: dependency URL variables the project may read (D-37).
export const PROJECTS = {
  customer: {
    title: "Customer", kind: "service", folder: "services/customer", port: 4001,
    otelName: "petclinic-customer", dependsOn: [], contract: "customer.openapi.json",
  },
  reservation: {
    title: "Reservation", kind: "service", folder: "services/reservation", port: 4002,
    otelName: "petclinic-reservation", dependsOn: ["customer", "checkout"], contract: "reservation.openapi.json",
  },
  "veterinarian-services": {
    title: "VeterinarianServices", kind: "service", folder: "services/veterinarian-services", port: 4003,
    otelName: "petclinic-veterinarian-services", dependsOn: [], contract: "veterinarian-services.openapi.json",
  },
  checkout: {
    title: "Checkout", kind: "service", folder: "services/checkout", port: 4004,
    otelName: "petclinic-checkout", dependsOn: ["customer", "reservation", "veterinarian-services", "payment"],
    contract: "checkout.openapi.json",
  },
  frontend: {
    title: "Frontend", kind: "frontend", folder: "frontend", port: 3000,
    dependsOn: ["customer", "reservation", "veterinarian-services", "checkout"],
  },
  payment: {
    title: "Fake payment provider", kind: "fake", folder: "spec/fakes/payment", port: 4010,
    otelName: "petclinic-payment-fake", dependsOn: [], contract: "payment-provider.openapi.json",
  },
  collector: {
    title: "OTLP test collector", kind: "fake", folder: "spec/harness/collector", port: 4318,
    dependsOn: [],
  },
};

const URL_VARS = {
  customer: "CUSTOMER_URL",
  reservation: "RESERVATION_URL",
  "veterinarian-services": "VETERINARIAN_SERVICES_URL",
  checkout: "CHECKOUT_URL",
  payment: "PAYMENT_PROVIDER_URL",
};

export function projectUrl(name) {
  return url(PROJECTS[name].port);
}

/** Environment for a project, per the runtime contract. */
export function projectEnv(name, { clinicNow = DEFAULT_CLINIC_NOW, testEndpoints = true, port } = {}) {
  const p = PROJECTS[name];
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    PORT: String(port ?? p.port),
    FRONTEND_ORIGIN,
    PETCLINIC_TEST_ENDPOINTS: testEndpoints ? "enabled" : "disabled",
  };
  for (const dep of p.dependsOn) env[URL_VARS[dep]] = projectUrl(dep);
  if (p.kind === "service") {
    Object.assign(env, {
      CLINIC_NOW: clinicNow,
      AUTH_TOKEN_SECRET: DEMO_AUTH_TOKEN_SECRET,
      SEED_DATA_DIR,
      OTEL_SERVICE_NAME: p.otelName,
      OTEL_EXPORTER_OTLP_ENDPOINT: OTLP_ENDPOINT,
      OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf",
      OTEL_TRACES_EXPORTER: "otlp",
      OTEL_METRICS_EXPORTER: "none",
      OTEL_LOGS_EXPORTER: "none",
      OTEL_BSP_SCHEDULE_DELAY: "100",
    });
  }
  return env;
}
