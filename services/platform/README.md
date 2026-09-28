# Shared JavaScript infrastructure

`runtime.js` provides HTTP routing, published request-schema validation, demo JWT
authentication, OpenTelemetry export/context propagation, and keyed asynchronous
locks. It holds no customer, reservation, service-catalog, or payment state.
Business decisions and stores remain in each service's `server.js`.

Each service's executable `setup` installs this package from its lockfile; `start`
runs that service in its own foreground process. Run setup sequentially because
the JavaScript services share this dependency installation. Configure processes
using the [runtime contract](../../spec/contracts/runtime-contract.md).

The runtime reads the published OpenAPI files as schemas. It does not import test
steps, validators, fixtures, or fake payment code. Checkout communicates with other
services through HTTP and never reads their stores or customer seed data.

For reconstruction, retain this directory for the surviving JavaScript services.
The Python Checkout implementation must supply its own runtime/SDK and obey the
same HTTP, authentication, schema, and telemetry contracts. Shared infrastructure
is disclosed scaffolding, not part of the Checkout business implementation to
reconstruct.

All service state, payment attempt responses, and locks are process-local. Restart
or test reset loses them. This is a local demo, with a shared HS256 secret, seeded
plaintext demo passwords, and a fake payment provider. It supplies neither durable
idempotency nor distributed transactions. An uncertain downstream write requires
manual recovery; the implementation must not claim a successful completion or
silently repeat an authorization.
