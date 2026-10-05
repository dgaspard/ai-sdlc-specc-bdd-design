# Authentication contract (AUTH-01) — demo security only

Simple local login with no cloud dependency (PROJECT-PLAN A-09). Plain-text passwords
and a shared secret are deliberate demo shortcuts, never a production pattern. Schemas:
[`auth.openapi.json`](auth.openapi.json). Protected file; humans change it deliberately.

## Users

- Seeded in `spec/seed-data/users.json` and read by the Customer service from `SEED_DATA_DIR`.
- Roles: `veterinarian` (linked `veterinarianId`) and `customer` (linked `customerId`).
- `administrator` (MVP-02A, D-39): a new, separate role, not a flag on `veterinarian`.
  Exactly one seeded account holds it for now — the clinic owner — who holds
  **both** `veterinarian` and `administrator` (D-40). No operation grants or
  revokes `administrator` at runtime; it's seed-only for this MVP.
- Seed customers and their pets are in `spec/seed-data/customers.json`.
- Seeded and self-registered users can log in. `POST /auth/register` atomically creates
  a customer login, a complete profile (including insurance, secondary contact, and
  saved mock payment details), at least one pet, and a preferred seeded veterinarian.
  It always creates the customer role; clients cannot supply account IDs or ownership.
  Pet UUIDs supplied for the initial pets allow insurance references in the same
  request; they must be new and unique. Invalid registration saves nothing.
  The existing veterinarian-assisted profile endpoint remains separate.

## Login

`POST /auth/login` on the Customer service with `{ "username", "password" }`.

| Result | Response |
| --- | --- |
| Valid credentials | 200 `{ token, user }`; `user` never includes the password |
| Unknown username or wrong password | 401 problem details (`unauthenticated`), identical for both |
| Malformed request | 400 problem details (`validation_error`) |

## Tokens

- JWT, header `{ "alg": "HS256", "typ": "JWT" }`, signed with `AUTH_TOKEN_SECRET`.
- Claims: `sub`, `role`, `iat`, `exp`, plus `customerId` or `veterinarianId` for users.
- **Dual-role accounts (MVP-02A, D-44):** an optional `roles` claim — an array of
  two or more roles — is present only for an account holding more than one role.
  `role` stays that account's primary role (today, always `veterinarian`, for
  backward compatibility with every check that only reads `role`); `roles`, when
  present, is the full set (e.g. `["veterinarian", "administrator"]` for the
  owner). A caller is authorized for role X if `role === X` or `roles` includes
  X. This is a single token carrying both privilege levels, not two logins —
  switching between an admin view and a veterinarian view in the frontend is a
  UI-only affordance; it never re-authenticates. **Disclosed limitation:** a
  stolen token for this one account grants both privilege levels at once —
  `THREAT-02` in [`tools/review/project-specific/threat-model.md`](../../tools/review/project-specific/threat-model.md),
  alongside the existing shared-secret risk (`THREAT-01`).
- Times come from the clinic clock (`CLINIC_NOW` when set). User tokens last 8 hours
  (`exp = iat + 28800`).
- Sent as `Authorization: Bearer <token>`.
- Services verify tokens locally. They reject a missing token, a bad signature, any `alg`
  other than `HS256` (including `none`), and an expired token.

## Service-to-service calls

- A service calling another service signs its own token: `role: "service"`, `sub` is its
  project name (`customer`, `reservation`, `veterinarian-services`, `checkout`), and it lasts
  5 minutes (`exp = iat + 300`).
- Internal operations, such as completing a reservation or applying an account change,
  accept only `role: "service"`. Users cannot call them directly. SPEC-04 marks which
  endpoints are internal.

## Access rules

| Caller | May access |
| --- | --- |
| `veterinarian` | Any customer, pet, reservation, visit, bill, or payment. Actions stay limited by the business rules (for example, only the assigned veterinarian accepts a request) |
| `customer` | Only records linked to their own `customerId` |
| `service` | Internal operations and the reads it needs |
| `administrator` (MVP-02A, D-39) | Manages the veterinarian roster (add, deactivate). **Admin-view bypass (D-41):** when acting under the `administrator` role, may also accept/deny, record a visit, apply a promotion, or record cash on any visit regardless of assignment — the normal assigned-veterinarian-only rule (D-16, D-31, D-26, D-19) is bypassed only for this role, never for `veterinarian` alone. |

## Status codes

| Situation | Status |
| --- | --- |
| Missing, invalid, or expired token | 401 |
| Customer requests another customer's record | 404, as if it did not exist |
| Authenticated caller lacks the role for the action (e.g. a customer calling a veterinarian-only or internal operation) | 403 |

## Open endpoints (no token)

`GET /health`, `/test/*` (when enabled), `POST /auth/login`, `POST /auth/register`, and CORS preflight `OPTIONS`.

## Telemetry

Tokens, passwords, and `Authorization` headers are never exported (OBS-005).
