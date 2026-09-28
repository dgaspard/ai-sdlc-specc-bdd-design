# VeterinarianServices service

Owns: Service catalog and fees in USD.

- Port: 4003
- Depends on: None
- Behavior: [`spec/features/veterinarian-services/`](../../spec/features/veterinarian-services/)
- API: [`veterinarian-services.openapi.json`](../../spec/contracts/veterinarian-services.openapi.json)
- Domain schemas: [`domain.openapi.json`](../../spec/contracts/domain.openapi.json)
- Runtime contract: [`runtime-contract.md`](../../spec/contracts/runtime-contract.md); executable `setup`/`start` scripts use environment configuration

The JavaScript implementation is in `server.js`. Run `./setup` to install the
locked dependencies, then `./start` with the runtime contract's environment.
The frozen harness supplies configuration when running `npm test` from the
repository root. See [shared infrastructure](../platform/README.md) for setup,
in-memory limitations, and reconstruction boundaries. Current verification and
engineering-review status is tracked in [IMPL-02](../../BACKLOG.md#impl-02--build-the-four-service-checkout-workflow).
