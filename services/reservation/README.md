# Reservation service

Owns: Calendar, reservation lifecycle, clinical visit records.

- Port: 4002
- Depends on: Customer; Checkout (booking fee, D-32)
- Behavior: [`spec/features/reservation/`](../../spec/features/reservation/)
- Schemas: [`spec/contracts/domain.openapi.json`](../../spec/contracts/domain.openapi.json); per-service API contract comes in SPEC-04
- Runtime rules: start with `./start`, configure only through environment variables (ARCH-02)

No code yet. Any language is allowed as long as the runtime contract and all tests pass.
