# Runtime contract (ARCH-02)

Every project that runs as a process (the four services, the frontend, and the fake
payment provider) must follow this contract in any language. It lets the harness start,
check, reset, and stop each project without knowing how it is built. Protected file;
humans change it deliberately. Verified by `spec/tests/runtime/runtime-contract.test.js`.

| Rule | Requirement | Applies to |
| --- | --- | --- |
| RT-001 | Executable `setup` and `start` scripts | All |
| RT-002 | Healthy on its static port | All |
| RT-003 | Listens on `PORT` | All |
| RT-004 | `POST /test/reset` returns 204 when test endpoints are enabled | Services, fake payment |
| RT-005 | `/test/*` returns 404 when test endpoints are disabled | Services, fake payment |
| RT-006 | CORS allowed only from `FRONTEND_ORIGIN` | Services |
| RT-007 | Stops within 5 seconds of SIGTERM | All |
| RT-008 | Exports traces as OTLP/HTTP protobuf with the correct `service.name` (also verifies OBS-001) | Services |

## Scripts

Each project folder contains two executable shell scripts:

| Script | Purpose | Rules |
| --- | --- | --- |
| `setup` | Install dependencies once (for example `npm ci`, `pip install -r requirements.txt`) | Idempotent; may use the network; never run by the harness during a test run |
| `start` | Run the project | Runs in the foreground; logs to stdout/stderr; reads configuration only from the environment variables below; exits cleanly within 5 seconds of SIGTERM; must not need network access |

Run from the project folder: `./setup`, then `./start`.

## Ports

| Project | Folder | Port |
| --- | --- | --- |
| Frontend | `frontend/` | 3000 |
| Customer | `services/customer/` | 4001 |
| Reservation | `services/reservation/` | 4002 |
| VeterinarianServices | `services/veterinarian-services/` | 4003 |
| Checkout | `services/checkout/` | 4004 |
| Fake payment provider | `spec/fakes/payment/` | 4010 |
| OTLP test collector | `spec/harness/collector/` | 4318 |

Projects must listen on `PORT`. If `PORT` is unset they default to their port above.
Before starting or rebuilding a project on its static port, run
`spec/harness/free-port.sh <port>`.

## Environment variables

| Variable | Used by | Meaning |
| --- | --- | --- |
| `PORT` | All | Port to listen on |
| `CLINIC_NOW` | Services | Clinic clock (see below) |
| `CUSTOMER_URL` | Reservation, Checkout, frontend | Base URL of Customer, e.g. `http://localhost:4001` |
| `RESERVATION_URL` | Checkout, frontend | Base URL of Reservation |
| `VETERINARIAN_SERVICES_URL` | Checkout, frontend | Base URL of VeterinarianServices |
| `CHECKOUT_URL` | Reservation, frontend | Base URL of Checkout |
| `PAYMENT_PROVIDER_URL` | Checkout | Base URL of the fake payment provider |
| `AUTH_TOKEN_SECRET` | Services | Shared demo secret for signing and verifying login tokens (A-09). Demo only |
| `SEED_DATA_DIR` | Services | Path to `spec/seed-data`; read-only |
| `FRONTEND_ORIGIN` | Services | Browser origin allowed by CORS; default `http://localhost:3000` |
| `PETCLINIC_TEST_ENDPOINTS` | Services, fake payment | `enabled` turns on test-only endpoints; anything else turns them off |
| `OTEL_SERVICE_NAME` | Services | Standard OpenTelemetry variable; value per OBS-001 (e.g. `petclinic-checkout`) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Services | Standard OpenTelemetry variable; `http://localhost:4318` in tests |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | Services | Always `http/protobuf` (A-10) |
| `OTEL_TRACES_EXPORTER` | Services | `otlp` |
| `OTEL_METRICS_EXPORTER`, `OTEL_LOGS_EXPORTER` | Services | `none` (traces only) |
| `OTEL_BSP_SCHEDULE_DELAY` | Services | Batch export delay in ms; `100` in tests so spans arrive quickly |

A service may read only the dependency URLs its column allows (D-37: no new
cross-service dependencies). Missing required variables fail startup with a clear message.

## Clinic clock

- `CLINIC_NOW` is an ISO 8601 timestamp with offset, e.g. `2026-10-05T09:00:00-05:00`.
- When set, the clock is **frozen** at that instant for the life of the process. Every
  "now" the service uses (validation and recorded timestamps such as `requestedAt`,
  `acceptedAt`, `appliedAt`) equals `CLINIC_NOW`.
- When unset, the service uses real time.
- Calendar rules are evaluated in `America/Chicago`, whatever offset `CLINIC_NOW` uses.
- Scenarios that need a different time restart the affected services with a new value.
- Time rules in scope: no past appointments, hidden past slots, no acceptance after
  start, cancel only before start, visit only at or after start. No other ordering rules.

## CORS

The browser loads the frontend from port 3000 and calls services directly on their
ports. Every service answers CORS requests from `FRONTEND_ORIGIN` only:

- `Access-Control-Allow-Origin` echoes `FRONTEND_ORIGIN` (never `*`).
- Preflight `OPTIONS` returns 204 and allows methods `GET, POST, PUT, PATCH, DELETE`
  and headers `Authorization, Content-Type, Idempotency-Key`.
- Requests from any other origin get no CORS allow headers.

## Telemetry export

Services send traces with the official OpenTelemetry SDK for their language over
OTLP/HTTP **protobuf** to `OTEL_EXPORTER_OTLP_ENDPOINT` (`/v1/traces`). JSON and gRPC
are not used. The test collector rejects any other format with 415 and records it,
which fails RT-008. Every handled HTTP request, including `GET /health`, produces a
server span following OBS-041 (named `GET /health` for the health check). Traces only; metrics and logs are off.

## Health

`GET /health` returns HTTP 200 with `{"status":"ok"}` once the project is ready to
serve requests, and never before. No authentication. The harness waits up to 10
seconds for 200, then fails the run with the project name and its last log lines.

## Test reset

When `PETCLINIC_TEST_ENDPOINTS=enabled`:

- `POST /test/reset` clears all in-memory state (including idempotency records and,
  for the fake payment provider, call counts), reloads seed data, and returns 204.
- No authentication. Returns only after the reset is complete.

When not enabled, `/test/*` paths return 404.

## Seed data

Services read the seed files they need from `SEED_DATA_DIR` at startup and on reset,
and never write to them:

| File | Contents | Read by |
| --- | --- | --- |
| `veterinarians.json` | The two veterinarians with fixed IDs | Customer, Reservation, Checkout |
| `services.json` | The five catalog services with fixed IDs and fees in cents | VeterinarianServices |
| `users.json` (AUTH-01) | Demo users, roles, linked customer/veterinarian IDs | Customer |

Seed IDs are fixed so tests and every service share them.

## Runtime versions

Reference versions for the demo: Node.js 22 or newer (24.21.0 in use) and Python 3.12.
A generated service may use a different version if its `setup` and `start` work on the
presenter's machine.

## Not in this contract

API endpoints, error formats, and authentication details (SPEC-04, AUTH-01).
