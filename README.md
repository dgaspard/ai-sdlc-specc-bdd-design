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

Tag `test-01` marks completion of service-level executable specification work.
Business decisions D-01–D-38, domain schemas, per-service API contracts, and 166
service scenarios are present. The latest access-control and telemetry rehearsal
passed 310 checks against temporary services and detected 13 deliberate defects;
see the [rehearsal report](docs/test-slices-5-6-rehearsal.md).

The temporary implementations were removed. There is no application code yet:
the frozen TEST-01 checkpoint passes the protected guard, harness, and schema suites.
Reviewed and frozen SPEC-05 adds complete self-registration, partial payments,
clinical corrections, and catalog updates. The guard passes;
application-dependent suites fail because the services do not exist.
The scenarios have step definitions; they are not undefined.

TEST-02 now has nine frozen backend journeys using Playwright HTTP requests without
launching a browser. These retain the existing workflows without extra UI/setup
flows. The next checkpoint is implementation plus the
[Engineering Discipline review](BACKLOG.md#eng-01--review-implementation-quality-across-the-language-swap).
[BACKLOG.md](BACKLOG.md) tracks verification and task status. The earlier
single-app version remains preserved at tag `1.0`.

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
docs/observability.md              Telemetry rules OBS-001..OBS-042 and coverage
PROJECT-PLAN.md                    Milestones, experiment protocol, demo gate
BACKLOG.md                         Task status and open items
docs/development-workflow.md       Working sequence and handoff rules
AGENTS.md                          Guardrails for coding agents
```

## Prerequisites and commands

Node.js 22, 24, or 26+ (matching the package engine declarations).

```bash
npm ci
npm --prefix spec ci
npm test                            # runs every suite and prints an aggregate summary
npm --prefix spec run guard:check    # verifies frozen protected files and skip/focus rules
npm --prefix spec run test:bdd       # service scenarios only
npm --prefix spec run test:workflows # real-service journeys using Playwright HTTP
```

An exit code of 1 from `npm test` is expected at this specification-only checkpoint.
A finished application must pass every required suite; TEST-01 is not that milestone.
