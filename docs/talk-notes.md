# Talk notes (November presentation)

Running list of talking points for the "how we built this" review. Not a specification.

## Workflow slides

1. **Business decisions** — D-01..D-38 in `docs/specs/business-decisions.md`; the human answers, the agent asks.
2. **Domain and schema** — `docs/specs/domain-model.md`, `spec/contracts/domain.openapi.json`; the harness caught two real schema defects before any code existed.
3. **Service features** — one folder per service; each asserts only its own state plus the calls it makes (D-28), so a service can be deleted and rebuilt alone.
4. **PM tasks** — `PROJECT-PLAN.md` and `BACKLOG.md`; each task has a phase (spec or build) and a tag per milestone.
5. **Architecture** — language-neutral runtime contract, black-box tests, stubs validated against contracts.
6. **Security** — demo login, service-role tokens for internal operations, 401/403/404 rules.
7. **OpenTelemetry** — protobuf-only export, semantic conventions, a collector that rejects the wrong format.
8. **Schema and API contracts** — OpenAPI per service, problem details, contract structure tests.
9. **Observability contract** — OBS rules with IDs in test titles and a coverage table.
10. **Guard** — instructions guide the agent; permissions enforce. Deny rules + hook (the agent sees why it was blocked), fingerprints frozen by a human, required GitHub check.
11. **Red baseline** — every test fails with a message naming what to build next.

## Be explicit where things differ

Anything that varies by language, locale, or library is pinned in the specs so a rebuild
in another language cannot silently diverge:

| Concern | Decision | Where |
| --- | --- | --- |
| Currency | USD, integer cents in every API | Domain model, schemas |
| Money display | `$1,234.50` (thousands comma, two decimals) | D-27 |
| Time zone | America/Chicago with daylight saving, not a fixed offset | D-03, runtime contract |
| Timestamps | ISO 8601 with offset; frozen clinic clock `CLINIC_NOW` | Runtime contract |
| IDs | UUIDs; fixed seed IDs shared by tests and services | Seed data |
| Errors | RFC 9457 problem details with stable codes | `common.openapi.json` |
| Tokens | JWT HS256; clinic-clock expiry | Auth contract |
| Telemetry | OTLP/HTTP protobuf; semantic conventions v1.44.0 | A-10, OBS-041 |
| Runtimes | Node 22+, Python 3.12; `setup`/`start` scripts | Runtime contract |
| Ports and config | Static ports; environment variables only | Runtime contract |

## Testing the tests

- Every API response a step receives is validated against the service's contract, so
  behavior scenarios also enforce the API contract ("Contract violation: ... unevaluated properties").
- Each slice of step definitions is proven against a throwaway spike service, then
  broken on purpose (wrong fee, extra field) to confirm the tests fail, then the spike is
  deleted so the committed baseline stays red.

## Vertical (service-level) testing, then end-to-end

- Each service is tested alone, top to bottom: HTTP in, its own state, the calls it makes.
- Services with no dependencies (Customer, VeterinarianServices) are driven directly; the
  test plays the callers' role with service-role tokens and made-up visit/payment IDs.
- Services with dependencies (Reservation, Checkout) get contract-validated stubs, and the
  tests assert what the service sent to them.
- Both sides are held to the same contract, which narrows the integration gap; the real
  end-to-end proof is the workflow suite (TEST-02) with all services running.
- This is what makes "delete one service and rebuild it in Python" testable in isolation.

## Moments worth showing live

- The agent tries to edit a feature file and gets the GUARD-01 message.
- `npm test` red baseline: "Checkout not implemented: services/checkout/start not found".
- Trace tree showing `telemetry.sdk.language` change from `nodejs` to `python` after the rebuild.
