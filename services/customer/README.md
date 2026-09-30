# Customer service

Owns: Customer and pet profiles, account entries and balance, booking eligibility, login (A-09).

- Port: 4001
- Depends on: None
- Behavior: [`spec/features/customer/`](../../spec/features/customer/)
- API: [`customer.openapi.json`](../../spec/contracts/customer.openapi.json)
- Domain schemas: [`domain.openapi.json`](../../spec/contracts/domain.openapi.json)
- Runtime contract: [`runtime-contract.md`](../../spec/contracts/runtime-contract.md); executable `setup`/`start` scripts use environment configuration

The JavaScript implementation is in `server.js`. Run `./setup` to install the
locked dependencies, then `./start` with the runtime contract's environment.
The frozen harness supplies configuration when running `npm test` from the
repository root. See [shared infrastructure](../platform/README.md) for setup,
in-memory limitations, and reconstruction boundaries. Current verification and
engineering-review status is tracked in [IMPL-02](../../docs/history/backlog-completed.md#impl-02--build-the-four-service-checkout-workflow).
