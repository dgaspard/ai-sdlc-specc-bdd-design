# Spec project (protected)

Everything that defines and verifies correct behavior. During the build phase, agents
may read this folder but must not create, modify, or delete anything in it
(PROJECT-PLAN A-07, BACKLOG GUARD-01). Humans change it deliberately.

```text
features/<service>/  features/workflows/   Gherkin behavior
contracts/                                 Runtime contract, domain and per-service OpenAPI contracts
seed-data/                                 Veterinarians, service catalog, later users (A-09)
tests/                                     Step definitions and validators
harness/                                   Starts services, resets state, sets the clock
fakes/payment/                             Fake payment provider (port 4010)
```

Run from the repo root with `npm test`, or here with `npm test`.
