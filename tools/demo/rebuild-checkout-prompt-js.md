# Rebuild Checkout in JS

Rebuild the Checkout service in JavaScript (Node.js 22 or newer) at
`services/checkout/`. The previous implementation was deleted and is not available.

Build it only from the published expectations: `spec/contracts/` (checkout, auth,
runtime, and observability contracts), `spec/features/`, and the tests under
`spec/tests/`. Follow `AGENTS.md`; protected paths are read-only. Stay inside this
working directory.

Requirements:

- Provide executable `setup` and `start` scripts per the runtime contract.
- You may use the shared JavaScript runtime in `services/platform/`, as the other
  JavaScript services do. Do not import code from other services; use only their
  published APIs.
- Telemetry uses the official OpenTelemetry JavaScript SDK with OTLP/HTTP protobuf
  export. Keep other dependencies minimal and standard.
- Keep storage in memory.

Work in small steps: run the Checkout service scenarios and fix failures, then the
workflow and browser journeys, then `npm test`. Done means `npm test` passes all
suites with no changes to protected files. If a specification looks wrong, stop
and explain instead of working around it.
