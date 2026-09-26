# AI SDLC PetClinic

A deliberately small, clean-room demonstration of **executable specifications in an AI-assisted software development lifecycle**.

The project is intentionally not a testing platform or evidence framework. It is a tiny PetClinic application with:

- business behavior written in Cucumber/Gherkin;
- real browser interaction driven by Playwright;
- an OpenAPI contract exercised against the running application;
- an OpenTelemetry trace contract for an operationally important workflow;
- the same test command locally and in GitHub Actions;
- a compact application that can be safely changed or partially removed during a live demonstration.

## Prerequisites

- Node.js 22 or newer
- npm

## Install

```bash
npm ci
npx playwright install chromium
```

## Run the application

```bash
npm start
```

Open <http://localhost:3000>.

## Run the executable specifications

```bash
npm test
```

For a visible browser:

```bash
npm run test:bdd:headed
```

The HTML Cucumber report and failure screenshots are written to `test-results/`.

Individual suites can be run with:

```bash
npm run test:bdd
npm run test:contract
npm run test:observability
```

## Intentional red baseline

The **cancel scheduled visit** workflow is specified but not implemented. Its three independent suites are expected to fail:

- BDD expects a user to cancel a visit through the browser.
- The API contract expects `DELETE /api/pets/{petId}/visits/{visitId}`.
- The observability contract expects a completed `petclinic.visit.cancel` span with pet, visit, and outcome attributes.

This is deliberate. The next coding-agent exercise is to implement the workflow without modifying or weakening its executable expectations.

## Repository layout

```text
contracts/                   Published API expectations
features/                    Human-readable behavior
tests/steps/                 Gherkin-to-browser step definitions
tests/support/               Browser and test-server lifecycle
tests/contracts/             API contract verification
tests/observability/         OpenTelemetry expectations
src/                         Server and domain behavior
public/                      Browser UI
.github/workflows/test.yml   Pull-request verification
AGENTS.md                    Guardrails for coding agents
```

## Suggested live-demo workflow

1. Show `features/visit-scheduling.feature` before showing implementation code.
2. Run `npm test` to show the three purposeful cancellation failures.
3. Ask an agent to implement visit cancellation without modifying specifications.
4. Review the implementation diff and rerun the suite.
5. Push the branch and show all three checks turn green in GitHub Actions.

The critical agent instruction is:

> Implement the requested behavior. Do not modify the feature files or tests. Run `npm test` and report any ambiguity instead of weakening the specifications.

## Scope

The initial application supports only:

- viewing patients;
- scheduling a visit;
- preventing duplicate visits for the same pet and date.

Cancellation is the intentionally unimplemented workflow used for the AI-development demonstration.

Keeping the domain this small makes the testing story visible and the live demonstration recoverable.
