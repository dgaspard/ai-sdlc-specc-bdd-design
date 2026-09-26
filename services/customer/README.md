# Customer service

Owns: Customer and pet profiles, account entries and balance, booking eligibility, login (A-09).

- Port: 4001
- Depends on: None
- Behavior: [`spec/features/customer/`](../../spec/features/customer/)
- Schemas: [`spec/contracts/domain.openapi.json`](../../spec/contracts/domain.openapi.json); per-service API contract comes in SPEC-04
- Runtime rules: start with `./start`, configure only through environment variables (ARCH-02)

No code yet. Any language is allowed as long as the runtime contract and all tests pass.
