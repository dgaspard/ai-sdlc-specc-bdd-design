# Fake payment provider

Protected test scaffolding (JavaScript, port 4010); never rebuilt by the agent.
Contract: [`spec/contracts/payment-provider.openapi.json`](../../contracts/payment-provider.openapi.json).

- `POST /authorize` — outcome chosen by `mockMethodReference`: `fake-card-approve…` authorizes,
  `fake-card-decline…` declines, `fake-card-error…` returns 500. A repeated `attemptId` returns
  the original result with `replayed: true` and no new authorization (D-12); the same
  `attemptId` with different input returns 409.
- `GET /test/calls` — every request received plus the count of distinct authorizations.
- `POST /test/reset` — clears calls and results.

Follows the runtime contract: `./setup` once, then `./start`.
