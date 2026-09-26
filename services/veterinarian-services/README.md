# VeterinarianServices service

Owns: Service catalog and fees in USD.

- Port: 4003
- Depends on: None
- Behavior: [`spec/features/veterinarian-services/`](../../spec/features/veterinarian-services/)
- Schemas: [`spec/contracts/domain.openapi.json`](../../spec/contracts/domain.openapi.json); per-service API contract comes in SPEC-04
- Runtime rules: start with `./start`, configure only through environment variables (ARCH-02)

No code yet. Any language is allowed as long as the runtime contract and all tests pass.
