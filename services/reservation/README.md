# Reservation service

Owns: Calendar, reservation lifecycle, clinical visit records.

- Port: 4002
- Depends on: Customer; Checkout (booking fee, D-32)
- Behavior: [`spec/features/reservation/`](../../spec/features/reservation/)
- API: [`reservation.openapi.json`](../../spec/contracts/reservation.openapi.json)
- Domain schemas: [`domain.openapi.json`](../../spec/contracts/domain.openapi.json)
- Runtime contract: [`runtime-contract.md`](../../spec/contracts/runtime-contract.md); the future implementation supplies `setup`/`start` and uses environment configuration

Service specifications and TEST-01 checks are complete; no application code or
launch scripts remain. The initial build will be JavaScript. The runtime contract
also supports the planned Python reconstruction without changing the tests.
