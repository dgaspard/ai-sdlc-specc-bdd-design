# Rebuild Checkout Service

Rebuild the Checkout service in Python 3.12 at `services/checkout/`. The previous
JavaScript implementation was deleted and is not available.

Build it only from the published expectations: `spec/contracts/` (checkout, auth,
runtime, and observability contracts), `spec/features/`, and the tests under
`spec/tests/`. Follow `AGENTS.md`; protected paths are read-only. Stay inside this
working directory.

Requirements:

- Provide executable `setup` and `start` scripts per the runtime contract. `setup`
  creates a local virtual environment and installs pinned dependencies from
  `requirements.txt`; `start` runs the service from that environment.
- Use the official OpenTelemetry Python SDK with OTLP/HTTP protobuf export.
  Keep other dependencies minimal and standard.
- Do not import or call code from other services; use only their published APIs.
- Keep storage in memory.

Work in small steps: run the Checkout service scenarios and fix failures, then the
workflow and browser journeys, then `npm test`. Done means `npm test` passes all
suites with no changes to protected files. If a specification looks wrong, stop
and explain instead of working around it.
