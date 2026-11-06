# Database Assertions

**Database:** isolated local PostgreSQL `mtjr2_qa_test`. No production database was accessed.

## Schema and fixture assertions executed

| Assertion | Expected | Actual | Result |
|---|---:|---:|---|
| Current database | `mtjr2_qa_test` | `mtjr2_qa_test` | PASS |
| Successfully applied Prisma migrations | 44 | 44 | PASS |
| Unvalidated foreign-key constraints | 0 | 0 (175 total FKs) | PASS |
| System roles | 6 | 6 | PASS |
| Permissions | 24 | 24 | PASS |
| Role-permission links | 72 | 72 | PASS |
| Seeded demo products (`demo-%`) | 80 | 80 after two demo-seed runs | PASS |
| Active top-level demo categories | 8 | 8 | PASS |
| Active demo stores (`demo-%`) | 4 | 4 | PASS |
| Demo inventory records | 80 | 80 | PASS |
| Inventory rows with negative on-hand or reserved quantities | 0 | 0 | PASS |
| Prisma schema validation | valid | valid | PASS |
| Migration drift/status | up to date | up to date | PASS |

The exact aggregate result from the isolated database was:

```text
database=mtjr2_qa_test;migrations=44;unvalidated_fks=0;roles=6;permissions=24;role_permissions=72;demo_products=80;active_demo_categories=8;active_demo_stores=4;demo_inventories=80;negative_inventory=0
```

## Business-operation database assertions

The seven PostgreSQL integration tests executed actual service workflows and asserted persisted state, including:

- Registration creates one pending identity and verification activates it with consent records.
- Concurrent duplicate registration leaves exactly one account.
- Scoped store-role assignment grants access to the matching store and denies another scope.
- MFA enforcement for Super Admin, TOTP enrollment/verification and one-time recovery code consumption.
- Session token storage uses a digest; session revocation is persisted.
- Concurrent login throttling is persisted.
- Password reset is single-use, updates the password hash and revokes sessions; a reset racing a password login does not leave an active session.

Integration test fixtures are synthetic and cleaned by test teardown. These tests do **not** assert purchase, payment, refund, shipment, or ledger records because those connected operations were not executed.

## Browser-connected guest cart and quote assertions

The QA-backed browser journey used a synthetic seeded product and verified these database transitions:

1. Add product from product detail: one matching `CartItem`, quantity 1.
2. Change quantity in cart UI: one matching `CartItem`, quantity 3.
3. Remove the item through the cart UI: zero matching items.
4. Create checkout quote from cart: one `ACTIVE` quote and one reserved unit; no order created.
5. Cancel quote through checkout UI: quote became `RELEASED`, active quote count returned to zero, reserved stock returned to zero.
6. Final cleanup assertion: matching cart items 0, active quotes 0, released quotes 1, reserved stock 0, orders 0, payments 0, and negative inventory rows 0.

Guest wishlist toggling used browser local storage and intentionally did not create an authenticated customer favorite DB row.

## Isolation guard

- QA migrations and seeds used the explicit `mtjr2_qa_test` database.
- Demo seed was allowed only with an explicit QA `DEMO_DATABASE_URL` and opt-in flags.
- The configured `mtjr2_demo` database was never used for destructive testing.
- No production database, real customer credentials, or real payment/email provider was used.
