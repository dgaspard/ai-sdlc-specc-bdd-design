# AI SDLC PetClinic

A demonstration of **controlling AI development with executable specifications**,
prepared for a November presentation.

The approach is test-driven:

1. Lock business decisions, the domain model, and schemas.
2. Write feature files for each service, then derive API contracts.
3. Write service and schema contract tests an AI agent cannot modify. Every test fails on creation.
4. Write workflow features and tests for journeys that span services.
5. Ask an AI agent to build the entire application until every test passes.
6. Delete a service and have the agent rebuild it from the specifications and tests.

## Current state

Tag `spec-schema-complete` marks completed specifications and schemas. There is no
application code yet and no step definitions, so `npm test` reports every scenario
as undefined. The earlier single-app version is preserved at tag `1.0`.

## Planned services

| Service | Owns |
| --- | --- |
| Customer | Customer and pet profiles, account balance, booking eligibility |
| Reservation | Calendar, reservation lifecycle, clinical visit records |
| VeterinarianServices | Service catalog and fees in USD |
| Checkout | Bills, promotions, booking-fee and visit payments (fake provider), cash |

Each runs as a separate local HTTP process with in-memory storage.

## Where things live

```text
docs/specs/business-decisions.md   SPEC-01 decision record (D-01..)
docs/specs/domain-model.md         SPEC-02 domain model
docs/specs/schema-decisions.md     Schema rules and approvals
contracts/domain.openapi.json      Machine-readable domain schemas and examples
docs/observability.md              Telemetry rules OBS-001..OBS-040 and coverage
features/<service>/                Service behavior (Gherkin)
features/workflows/                Cross-service journeys (next phase)
PROJECT-PLAN.md                    Milestones, experiment protocol, demo gate
BACKLOG.md                         Task status and open items
docs/development-workflow.md       Working sequence and handoff rules
AGENTS.md                          Guardrails for coding agents
```

## Prerequisites and commands

Node.js 22 or newer.

```bash
npm ci
npm test        # runs Cucumber
```
