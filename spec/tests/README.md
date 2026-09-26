# Tests and validators

All validators live here, grouped by kind. Each is black-box: it reaches services
only over HTTP (or reads the telemetry collector) and never imports application code.

| Folder (planned) | Validates |
| --- | --- |
| `steps/`, `support/` | Cucumber step definitions for service and workflow features |
| `contract/` | Responses and requests against the domain schemas and per-service OpenAPI contracts |
| `observability/` | OBS rules and OpenTelemetry conventions, read from the test collector |
| `performance/` | Minimum latency budget (PERF-01) |
| `guard/` | Protected-file hashes and frozen test inventory (GUARD-01) |

No tests yet. Every test must fail when first created.
