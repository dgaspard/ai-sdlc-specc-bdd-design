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

Follow the test loop in `AGENTS.md`. Work in small steps: use `npm run test:fast`
(or `npm run test:suite -- <id>` for one failing suite) while building, starting with
the Checkout service scenarios, then the workflow and browser journeys. Then run
`npm run test:gate`. Done means `npm run test:verify` passes, with no changes to
protected files; report the run record paths. If a specification looks wrong, stop
and explain instead of working around it.
