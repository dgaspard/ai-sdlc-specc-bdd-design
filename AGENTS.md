# Agent Working Agreement

This repository demonstrates how executable specifications guide AI-assisted development.

## Rules

- Consult `PROJECT-PLAN.md` for milestones, reconstruction experiment boundaries, and demo readiness criteria.
- Follow `docs/development-workflow.md` for specification-first sequencing, service/workflow feature organization, and persistent task handoffs.
- Consult `BACKLOG.md` for scope, sequencing, and unresolved business decisions.
- Design and review API contracts, observability contracts, and BDD features before new implementation; proposed backlog items are not approved requirements.
- Follow `docs/observability.md`, preserving its distinction between binding contracts and proposed standards.
- Follow `docs/specs/observability-traceability.md`: retain stable OBS IDs, include asserted IDs in test titles, and update the coverage table with test changes.
- Treat domain objects exposed across service boundaries as contract surfaces. Test their serialized schemas, references, state transitions, and invariants. Do not add tests whose only purpose is to exercise trivial getters, setters, constructors, or private storage.

## Protected paths

Humans edit these; agents may read them. During the build phase agents must not
create, modify, or delete anything under:

- `spec/` (features, contracts, seed data, tests, validators, harness, fakes)
- `docs/specs/` (decisions, domain model, schema decisions)
- `.github/`, `.claude/`, `AGENTS.md`

Enforcement is GUARD-01, not this file alone:

- `.claude/settings.json` deny rules and the `.claude/hooks/protect-paths.mjs` hook block the
  build agent (Claude Code) from editing protected paths or writing to them from the shell.
  The block reason is shown to the user and returned to the agent.
- `npm --prefix spec run guard:check` (first step of `npm test`, and the required GitHub
  check) fails if any protected file changed since the last human freeze, or if a test is
  skipped or focused.
- Only a human runs `npm --prefix spec run guard:freeze`, after reviewing a spec change.
- In the specification phase, an assistant may draft protected files only when the human
  asks for that specific change; the human reviews the diff and freezes it.
- If the specification looks wrong during the build phase, stop and explain the problem to
  the user. Do not work around the guard.

Backlog tasks state which phase they run in.

## Requirements

- Treat files under `spec/features/` as product requirements.
- Do not modify feature files or test steps merely to make a failing build pass.
- Change a feature only when the requested behavior has intentionally changed.
- Prefer accessible labels and roles because the browser tests use them as the user would.
- Do not hardcode values solely to satisfy the current examples.
- Treat `spec/contracts/` and every validator under `spec/tests/` as externally agreed expectations.
- Do not weaken, skip, or delete a failing BDD, contract, or observability test.
- Run `npm test` before declaring work complete. All suites must pass.
- Explain any requirement ambiguity before implementing a guess that changes behavior.
