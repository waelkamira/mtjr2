# Phase 4 — Buying Core Implementation Plan

**Project:** Mtjr2 — Global Multi-Vendor Marketplace  
**Blueprint:** `docs/architecture/COMPLETE_PLATFORM_SYSTEMS_BLUEPRINT.md`  
**Canonical data contract:** `prisma/schema.prisma`  
**Status:** In progress — Cart foundation implemented; verification pending.

## Objective

Implement the buyer purchase journey as server-owned domain workflows. The browser must never determine authoritative prices, stock, totals, reservations, or order state. Each slice must connect its persisted models, service, protected API, buyer UI, focused tests, and implementation log.

## 4.1 — Persistent cart foundation

**Implemented on `feat/buying-cart-core`; pending CI and disposable PostgreSQL verification.**

- Add `GuestSession`, `Cart`, and `CartItem` to the canonical Prisma schema and a forward-only migration.
- Guest identity uses an opaque random HttpOnly cookie; PostgreSQL stores only its SHA-256 hash. Guest sessions expire after 30 days.
- A cart belongs to exactly one owner: authenticated user or guest session. It is partitioned by market and currency.
- Merge guest carts into the authenticated customer's matching market/currency carts after sign-in; merged carts are marked and the operation is transactional.
- Add server APIs: `GET /api/cart`, `POST /api/cart/items`, `PATCH /api/cart/items/[itemId]`, and `DELETE /api/cart/items/[itemId]`.
- Validate active market/currency, published product, active variant, current market price, and available inventory on the server.
- Enforce quantity 1–99 in validation and PostgreSQL.
- Connect product detail's Add to cart action and the buyer `/cart` page to these APIs. No browser-local authoritative cart state.
- Focused tests cover hashed guest identity, valid add, invalid quantity, and insufficient stock.

## 4.2 — Checkout quote and inventory reservation

Not started. Before creating orders:
- Define a quote contract with immutable server-calculated line prices, currency precision, item availability, and quote expiry.
- Implement reservation create/extend/release/expire/consume using existing `InventoryReservation` and atomic inventory updates.
- Reservations must have bounded TTL, idempotency keys, race-safe stock checks, and a cleanup/reconciliation path.
- Add shipping/tax/coupon calculations only after their canonical models and jurisdiction rules are specified.
- Connect a checkout review UI to the quote API; never trust totals sent by the browser.

## 4.3 — Checkout and order creation

Not started. Build only after 4.2 is verified:
- Add canonical `UserAddress`, `Order`, `VendorOrder`, `OrderItem`, and immutable order-address/price snapshots where required by the blueprint.
- Split marketplace purchases by seller/store without losing the customer-level order.
- Require an idempotency key and create the order, vendor orders, snapshots, payment intent record, and reservation consumption in a single well-defined transactional workflow.
- Payment-provider integration and webhooks must be verified independently; do not simulate successful payment.
- Connect checkout confirmation and order confirmation/history UI to the real APIs.

## Invariants and boundaries

1. `prisma/schema.prisma` remains the source of truth; add models only for demonstrated persisted business state.
2. UI → API → validation/authentication → domain service → Prisma. No Prisma calls from React components.
3. Server resolves current prices and stock on every cart mutation and checkout quote.
4. Cart contents do not reserve stock. Reservation starts only during the defined checkout hold.
5. Money uses integer minor units; serialize BigInt values as strings.
6. Do not connect to the owner's database, run production migrations, or change Vercel environment variables during this implementation.
7. Use only focused tests: General CI (Prisma validate/generate, typecheck, lint, unit tests, production build) and one disposable PostgreSQL migration/integration run for the schema change. Add more tests only for concrete critical regressions.

## Current handoff

- 4.1 schema, migration, service, APIs, product CTA, cart page, and focused unit tests are committed to `feat/buying-cart-core`.
- Required next actions: complete General CI, replay migrations on disposable PostgreSQL, fix only demonstrated failures, update this document and BUILD_LOG with actual run evidence, then merge after review.
- 4.2 and 4.3 remain pending; checkout is intentionally not exposed yet.
