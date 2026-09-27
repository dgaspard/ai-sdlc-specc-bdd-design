# Checkout service

Owns: Bills, promotions, booking-fee and visit payments, cash recording.

- Port: 4004
- Depends on: Customer, Reservation, VeterinarianServices, fake payment provider (4010)
- Behavior: [`spec/features/checkout/`](../../spec/features/checkout/)
- API: [`checkout.openapi.json`](../../spec/contracts/checkout.openapi.json)
- Domain schemas: [`domain.openapi.json`](../../spec/contracts/domain.openapi.json)
- Runtime contract: [`runtime-contract.md`](../../spec/contracts/runtime-contract.md); the future implementation supplies `setup`/`start` and uses environment configuration

Service specifications and TEST-01 checks are complete; no application code or
launch scripts remain. The initial build will be JavaScript. The runtime contract
also supports the planned Python reconstruction without changing the tests.
