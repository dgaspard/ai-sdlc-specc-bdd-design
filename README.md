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
services/<name>/                   One project per service (any language); README only for now
frontend/                          Plain HTML/JS frontend; README only for now
spec/                              Protected: features, contracts, seed data, tests, harness, fakes
docs/specs/                        Protected: decisions, domain model, schema decisions
docs/observability.md              Telemetry rules OBS-001..OBS-040 and coverage
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
