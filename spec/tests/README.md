# Tests and validators

All validators live here, grouped by kind. Each is black-box: it reaches services
only over HTTP (or reads the telemetry collector) and never imports application code.

| Folder | Validates |
| --- | --- |
| `steps/`, `support/` | Cucumber step definitions for service and workflow features |
| `contract/` | Responses and requests against the domain schemas and per-service OpenAPI contracts |
| `observability/` | OBS rules and OpenTelemetry conventions, read from the test collector |
| `performance/` | Minimum latency budget (PERF-01) |
| `guard/` | Protected-file hashes and frozen test inventory (GUARD-01) |

Present now: `contract/domain-examples.test.js` (domain contract self-consistency),
`runtime/runtime-contract.test.js` (RT-001..RT-007), and `support/world.js` (Cucumber
lifecycle). Step definitions arrive in TEST-01. Run everything with `npm test`, which
reports every suite even when one fails.
