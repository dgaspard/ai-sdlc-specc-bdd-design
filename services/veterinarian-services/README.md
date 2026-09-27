# VeterinarianServices service

Owns: Service catalog and fees in USD.

- Port: 4003
- Depends on: None
- Behavior: [`spec/features/veterinarian-services/`](../../spec/features/veterinarian-services/)
- API: [`veterinarian-services.openapi.json`](../../spec/contracts/veterinarian-services.openapi.json)
- Domain schemas: [`domain.openapi.json`](../../spec/contracts/domain.openapi.json)
- Runtime contract: [`runtime-contract.md`](../../spec/contracts/runtime-contract.md); the future implementation supplies `setup`/`start` and uses environment configuration

Service specifications and TEST-01 checks are complete; no application code or
launch scripts remain. The initial build will be JavaScript. The runtime contract
also supports the planned Python reconstruction without changing the tests.
