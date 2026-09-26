# Checkout service

Owns: Bills, promotions, booking-fee and visit payments, cash recording.

- Port: 4004
- Depends on: Customer, Reservation, VeterinarianServices, fake payment provider (4010)
- Behavior: [`spec/features/checkout/`](../../spec/features/checkout/)
- Schemas: [`spec/contracts/domain.openapi.json`](../../spec/contracts/domain.openapi.json); per-service API contract comes in SPEC-04
- Runtime rules: start with `./start`, configure only through environment variables (ARCH-02)

No code yet. Any language is allowed as long as the runtime contract and all tests pass.
