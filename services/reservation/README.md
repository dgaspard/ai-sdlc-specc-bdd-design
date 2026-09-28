# Reservation service

Owns: Calendar, reservation lifecycle, clinical visit records.

- Port: 4002
- Depends on: Customer; Checkout (booking fee, D-32)
- Behavior: [`spec/features/reservation/`](../../spec/features/reservation/)
- API: [`reservation.openapi.json`](../../spec/contracts/reservation.openapi.json)
- Domain schemas: [`domain.openapi.json`](../../spec/contracts/domain.openapi.json)
- Runtime contract: [`runtime-contract.md`](../../spec/contracts/runtime-contract.md); executable `setup`/`start` scripts use environment configuration

The JavaScript implementation is in `server.js`. Run `./setup` to install the
locked dependencies, then `./start` with the runtime contract's environment.
The frozen harness supplies configuration when running `npm test` from the
repository root. See [shared infrastructure](../platform/README.md) for setup,
in-memory limitations, and reconstruction boundaries. Current verification and
engineering-review status is tracked in [IMPL-02](../../BACKLOG.md#impl-02--build-the-four-service-checkout-workflow).
