# Phase 4 — Buying Core Implementation Plan

**Project:** Mtjr2 — Global Multi-Vendor Marketplace  
**Blueprint:** `docs/architecture/COMPLETE_PLATFORM_SYSTEMS_BLUEPRINT.md`  
**Canonical data contract:** `prisma/schema.prisma`  
**Status:** In progress — Cart and quote/reservation slices verified; delivery-address capture is implemented and awaiting CI and disposable PostgreSQL verification.

## Objective

Implement the buyer purchase journey as server-owned domain workflows. The browser must never determine authoritative prices, stock, totals, reservations, or order state. Each slice must connect its persisted models, service, protected API, buyer UI, focused tests, and implementation log.

## 4.1 — Persistent cart foundation

**Implemented and verified on `feat/buying-cart-core`. General CI run 41702592022 and disposable PostgreSQL integration run 41702592323 both passed.**

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

**Implemented and verified on `feat/checkout-quote-reservations`. General CI run 41704221580 and disposable PostgreSQL integration run 41704221517 both passed.**

- Add `CheckoutQuote` and `CheckoutQuoteLine` snapshots with market/currency ownership, immutable product/variant labels and integer-minor-unit prices.
- Create server-priced quotes with a ten-minute expiry; atomically reserve inventory across active warehouses belonging to the owning store.
- Enforce quote ownership, idempotency, conditional stock updates, and release/expiry reconciliation using `InventoryReservation`.
- Add create/read/release quote APIs and connect `/cart` to `/checkout` review UI.
- Expose a bounded `expireDueCheckoutQuotes` cleanup service and expire due quotes during quote creation/read; an actual scheduled invocation remains an operational follow-up.

## 4.2a — Delivery address capture

**Implemented on `feat/checkout-address-capture` (PR #3); General CI and disposable PostgreSQL verification pending.**

- Add `UserAddress` for authenticated customer address books and `CheckoutQuoteAddress` as a delivery snapshot attached to the quote.
- Add authenticated `GET/POST /api/account/addresses` and quote-scoped `GET/POST /api/checkout/quote/[quoteId]/address`.
- Guest checkout can enter an address without saving it; authenticated customers may select saved addresses or save a new address.
- Delivery country is derived from the selected market on the server; the browser cannot override it. Saved addresses from another country are rejected for this market.
- Connect checkout review UI to the address APIs. The delivery address is not added to the price total.
- No shipping rate or tax amount is calculated yet; those require explicit market/carrier and tax-jurisdiction rules.

## 4.3 — Checkout and order creation

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
4. Cart contents do not reserve stock. A checkout quote reserves stock for ten minutes and releases it on cancellation or expiry.
5. Money uses integer minor units; serialize BigInt values as strings.
6. Do not connect to the owner's database, run production migrations, or change Vercel environment variables during this implementation.
7. Use only focused tests: General CI (Prisma validate/generate, typecheck, lint, unit tests, production build) and one disposable PostgreSQL migration/integration run for the schema change. Add more tests only for concrete critical regressions.

## Current handoff

- 4.1 schema, migration, service, APIs, product CTA, cart page, and focused unit tests are committed to `feat/buying-cart-core`.
- Cart foundation is verified by General CI run 41702592022 and disposable PostgreSQL integration run 41702592323. Quote/reservation is verified by General CI run 41704221580 and disposable PostgreSQL integration run 41704221517. PR #1 and PR #2 remain separate reviewable changes; PR #2 depends on PR #1.
- Current next action: verify address capture migration/service/UI on General CI and disposable PostgreSQL, fix only demonstrated failures, then record exact evidence before merge. PR #3 is stacked on PR #2.
- 4.2 and 4.3 remain pending; checkout is intentionally not exposed yet.
