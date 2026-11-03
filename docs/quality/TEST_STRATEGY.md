# Test strategy

## Test layers

- **Unit:** pure domain rules, validation, normalization, pricing and state transitions.
- **Integration:** repositories and services against an isolated PostgreSQL database.
- **End-to-end:** customer, seller and administrator workflows through the application boundary.
- **Security:** authorization bypass, cross-store access, token replay, rate-limit behavior and sensitive-data exposure.
- **Concurrency:** inventory reservation, order idempotency, payment callbacks, refunds and payouts.

## Rules

- Tests must use a dedicated disposable database, never a production database.
- Do not mock the database for tests intended to prove constraints, transactions, or concurrency behavior.
- Every bug fix adds a regression test where practical.
- CI must run Prisma validation and client generation before type checking.
- A passing unit test does not prove an end-to-end system is complete.

## Initial coverage

The initial test suite contains only a unit test for canonical email normalization. Database integration, authentication, authorization, and browser tests are not implemented yet.
