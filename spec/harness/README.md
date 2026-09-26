# Test harness

Protected scaffolding. Black-box only: it uses the runtime contract and never imports
application code.

| File | Purpose |
| --- | --- |
| `config.js` | Project table (folders, ports, dependencies) and environment per the runtime contract |
| `processes.js` | Start (`./start`), wait for `/health`, reset, restart on a new `CLINIC_NOW`, stop; logs to `test-results/logs/<project>.log`; clear "not implemented" errors |
| `stub-server.js` | Programmable stub that impersonates a dependency on its real port; validates every programmed response against that service's contract; records requests |
| `schema.js` | Validates data and HTTP responses against `spec/contracts` (OpenAPI 3.1 / JSON Schema 2020-12) |
| `free-port.sh` | Stops whatever listens on a port |

Service features (`@service:<name>`) run the real service, stubs for the services it
calls (D-28), and the real fake payment provider. The OTLP collector arrives in ARCH-04.
