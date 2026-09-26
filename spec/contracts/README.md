# API contracts

Protected. Index of the per-service OpenAPI contracts (SPEC-04). Shared errors, security,
and the Idempotency-Key header are in `common.openapi.json`; domain schemas in
`domain.openapi.json`; login schemas in `auth.openapi.json`; process rules in
`runtime-contract.md` and `auth-contract.md`. `x-roles` lists who may call each operation;
`/internal/` operations are service-only.

## Customer service (port 4001) — [`customer.openapi.json`](customer.openapi.json)

Customer and pet profiles, account balance, booking eligibility, and demo login. Calls no other service.

| Method | Path | Roles | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/login` | anonymous | Log in with a seeded demo user |
| POST | `/customers` | veterinarian | Create a customer profile (veterinarians only) |
| GET | `/customers` | veterinarian | List customers |
| GET | `/customers/{customerId}` | veterinarian, customer, service | Get a customer profile |
| PATCH | `/customers/{customerId}` | veterinarian, customer | Update a customer profile (outstanding balance is not editable) |
| POST | `/customers/{customerId}/pets` | veterinarian, customer | Add a pet to a customer |
| GET | `/customers/{customerId}/pets` | veterinarian, customer, service | List a customer's pets |
| GET | `/pets/{petId}` | veterinarian, customer, service | Get a pet |
| GET | `/customers/{customerId}/eligibility` | veterinarian, customer, service | Check booking eligibility (eligible only when nothing is owed) |
| GET | `/customers/{customerId}/account` | veterinarian, customer, service | Get account entries and outstanding balance |
| GET | `/internal/customers/{customerId}/pets/{petId}/ownership` | service | Confirm whether a customer owns a pet |
| POST | `/internal/customers/{customerId}/account-changes` | service | Apply a charge, credit, or discount for one visit |

## Reservation service (port 4002) — [`reservation.openapi.json`](reservation.openapi.json)

Calendar, reservation lifecycle, and clinical visit records. Calls Customer (ownership, eligibility) and Checkout (booking fee).

| Method | Path | Roles | Purpose |
| --- | --- | --- | --- |
| GET | `/veterinarians` | veterinarian, customer, service | List the clinic's veterinarians |
| GET | `/availability` | veterinarian, customer | Open appointment slots for a date |
| POST | `/reservations` | customer, veterinarian | Request an appointment |
| GET | `/reservations` | veterinarian, customer, service | List reservations (customers see only their own) |
| GET | `/reservations/{reservationId}` | veterinarian, customer, service | Get a reservation |
| POST | `/reservations/{reservationId}/accept` | veterinarian | Assigned veterinarian accepts after the booking fee is paid |
| POST | `/reservations/{reservationId}/deny` | veterinarian | Assigned veterinarian denies a request |
| POST | `/reservations/{reservationId}/cancel` | customer, veterinarian | Customer or assigned veterinarian cancels before the start |
| POST | `/reservations/{reservationId}/visit` | veterinarian | Assigned veterinarian records the visit at or after the start |
| GET | `/visits` | veterinarian, customer, service | Visit history by pet or customer (customers see only their own) |
| GET | `/visits/{visitId}` | veterinarian, customer, service | Get a visit |
| POST | `/internal/reservations/{reservationId}/complete` | service | Record how the visit ended financially |

## VeterinarianServices service (port 4003) — [`veterinarian-services.openapi.json`](veterinarian-services.openapi.json)

Read-only service catalog and fees in USD, seeded from services.json. Calls no other service.

| Method | Path | Roles | Purpose |
| --- | --- | --- | --- |
| GET | `/services` | veterinarian, customer, service | List the veterinary service catalog |
| GET | `/services/{serviceId}` | veterinarian, customer, service | Get one service and its fee |
| GET | `/fees` | veterinarian, customer, service | Fees for several services at once |

## Checkout service (port 4004) — [`checkout.openapi.json`](checkout.openapi.json)

Bills, promotions, and all payments. Calls VeterinarianServices (fees), Reservation (visits, completion), Customer (account changes), and the fake payment provider.

| Method | Path | Roles | Purpose |
| --- | --- | --- | --- |
| POST | `/internal/booking-fees` | service | Collect the $20 booking fee for a reservation (card or cash) |
| POST | `/visits/{visitId}/checkout` | veterinarian | Veterinarian who performed the visit finalizes the bill |
| GET | `/visits/{visitId}/checkout` | veterinarian, customer, service | Get the checkout for a visit |
| GET | `/checkouts` | veterinarian, customer, service | List checkouts (customers see only their own) |
| GET | `/checkouts/{checkoutId}` | veterinarian, customer, service | Get a checkout |
| POST | `/checkouts/{checkoutId}/promotion` | veterinarian | Veterinarian who performed the visit applies the visit's one promotion |
| POST | `/checkouts/{checkoutId}/payments` | customer, veterinarian | Pay the full remaining balance by card |
| POST | `/checkouts/{checkoutId}/cash-payments` | veterinarian | Veterinarian who performed the visit records a full cash payment |

## Other contracts

| File | Purpose |
| --- | --- |
| `payment-provider.openapi.json` | Fake payment provider (port 4010) |
| `common.openapi.json` | Problem details, status-code rules, bearer security, Idempotency-Key |
| `domain.openapi.json` | Domain schemas and examples |
| `auth.openapi.json` | Login request/response and token claims |
