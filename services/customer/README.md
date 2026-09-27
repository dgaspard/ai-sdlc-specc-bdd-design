# Customer service

Owns: Customer and pet profiles, account entries and balance, booking eligibility, login (A-09).

- Port: 4001
- Depends on: None
- Behavior: [`spec/features/customer/`](../../spec/features/customer/)
- API: [`customer.openapi.json`](../../spec/contracts/customer.openapi.json)
- Domain schemas: [`domain.openapi.json`](../../spec/contracts/domain.openapi.json)
- Runtime contract: [`runtime-contract.md`](../../spec/contracts/runtime-contract.md); the future implementation supplies `setup`/`start` and uses environment configuration

Service specifications and TEST-01 checks are complete; no application code or
launch scripts remain. The initial build will be JavaScript. The runtime contract
also supports the planned Python reconstruction without changing the tests.
