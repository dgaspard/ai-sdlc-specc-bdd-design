# Agent Working Agreement

This repository demonstrates how executable specifications guide AI-assisted development.

## Rules

- Treat files under `features/` as product requirements.
- Do not modify feature files or test steps merely to make a failing build pass.
- Change a feature only when the requested behavior has intentionally changed.
- Prefer accessible labels and roles because the browser tests use them as the user would.
- Do not hardcode values solely to satisfy the current examples.
- Treat `contracts/` and the assertions under `tests/observability/` as externally agreed expectations.
- Do not weaken, skip, or delete a failing BDD, contract, or observability test.
- Run `npm test` before declaring work complete. All three suites must pass.
- Explain any requirement ambiguity before implementing a guess that changes behavior.
