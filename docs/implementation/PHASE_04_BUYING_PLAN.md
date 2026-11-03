# Phase 4 — Buying Core Implementation Plan

**Project:** Mtjr2 — Global Multi-Vendor Marketplace  
**Blueprint:** `docs/architecture/COMPLETE_PLATFORM_SYSTEMS_BLUEPRINT.md`  
**Canonical data contract:** `prisma/schema.prisma`  
**Status:** In progress — cart, quote/reservation, and delivery-address capture are implemented and verified. Shipping, tax, order, and payment workflows remain.

## Objective

Implement the buyer journey as server-owned domain workflows. The browser never determines authoritative prices, stock, totals, reservations, or order state. Each slice connects Prisma persistence, domain service, protected API, buyer UI, focused tests, and recorded evidence.

## 4.1 — Persistent cart foundation

**Implemented and verified.** General CI: [41702592022](https://github.com/waelkamira/mtjr2/actions/runs/41702592022). Disposable PostgreSQL: [41702592323](https://github.com/waelkamira/mtjr2/actions/runs/41702592323).

- Added `GuestSession`, `Cart`, and `CartItem` with ownership, market/currency partitioning, quantity constraints, and migration.
- Guest identity uses an opaque HttpOnly cookie; only its SHA-256 hash is persisted.
- Guest-to-customer cart merge is transactional.
- Added cart read/add/update/remove APIs with server-side market, currency, product, variant, price, and stock validation.
- Connected product detail Add to cart and buyer `/cart` UI to the APIs.

## 4.2 — Checkout quote and inventory reservation

**Implemented and verified.** General CI: [41704221580](https://github.com/waelkamira/mtjr2/actions/runs/41704221580). Disposable PostgreSQL: [41704221517](https://github.com/waelkamira/mtjr2/actions/runs/41704221517).

- Added `CheckoutQuote` and `CheckoutQuoteLine` immutable price/line snapshots.
- Server creates ten-minute quotes and reserves stock atomically across active warehouses belonging to each store.
- Enforced ownership, idempotency, conditional stock updates, and reservation release/expiry.
- Connected cart checkout action and `/checkout` review UI to quote APIs.
- Bounded expiry service exists; scheduled invocation remains an operational follow-up.

## 4.2a — Delivery address capture

**Implemented and verified on PR #3 branch `feat/checkout-address-capture`.** General CI: [41706908024](https://github.com/waelkamira/mtjr2/actions/runs/41706908024). Disposable PostgreSQL: [41706907994](https://github.com/waelkamira/mtjr2/actions/runs/41706907994).

- Added `UserAddress` and quote-owned `CheckoutQuoteAddress` snapshot models with migration `20261103210000_checkout_address_capture`.
- Added authenticated customer address-book APIs and quote-scoped address read/write APIs.
- Guest buyers can provide a one-time address; authenticated buyers can select or save addresses.
- Server derives the destination country from the quote's market and rejects cross-country saved addresses/client overrides.
- Connected checkout delivery-address UI to the APIs.
- Fixed quote reads and idempotent replays to include the saved delivery-address snapshot; without this, a page reload could lose the address in the quote response.
- Address data does not alter item subtotal. Shipping and tax are not guessed or calculated yet.

## 4.3 — Store shipping configuration and checkout options

**Implemented on `feat/store-shipping-options`; verification pending.**

- Added `StoreShippingRate` scoped to store, active market, currency, optional destination region, effective dates, delivery window, and integer minor-unit amount.
- Added `CheckoutShippingSelection` as a quote-owned per-store immutable snapshot. Added `storeId` to `CheckoutQuoteLine` and backfilled it from the variant's product store so multi-vendor shipping cannot cross seller boundaries.
- Added migration `20261103223000_store_shipping_options`; the migration adds constraints for non-negative amounts, delivery-day ranges, effective date ranges, and foreign keys.
- Added seller shipping-rate create/list APIs and connected configuration UI in the seller workspace.
- Added buyer shipping-options read/select APIs and connected the checkout UI. Options are filtered by quote market, currency, destination region, store-market activation, and effective dates.
- No carrier integration, country list, tax, final order total, or default shipping amount is assumed. Unconfigured stores return no shipping options.

**Verification gate:** General CI (Prisma validate/generate, typecheck, lint, unit tests, production build) plus the disposable PostgreSQL migration/integration workflow. This slice is not complete until both pass.

## 4.4 — Tax, discounts, and final checkout validation

- Model jurisdiction-scoped tax rules with country/region, product/category applicability where required, inclusive/exclusive treatment, effective dates, and currency-safe calculation.
- Add coupons only after eligibility, usage limits, stacking, and seller/platform funding rules are specified.
- Recalculate all lines, shipping, taxes, and discounts on the server when checkout is confirmed. Never trust browser totals.

## 4.5 — Order creation and payment boundary

- Add customer `Order`, per-store `VendorOrder`, `OrderItem`, and immutable address/price/shipping/tax snapshots.
- Create order and consume reservations transactionally with idempotency and valid state transitions.
- Keep payment pending until a real provider integration and verified webhook lifecycle are implemented; never simulate successful payment.
- Connect checkout confirmation, order confirmation, and order history pages to real APIs.

## Invariants and test policy

1. `prisma/schema.prisma` is the canonical source of truth; migrations are forward-only.
2. UI → API → auth/validation → domain service → Prisma. No Prisma in React components.
3. Server resolves current price, market, stock, and eligibility.
4. Money uses integer minor units; serialize BigInt as strings.
5. Money/order/inventory writes use transactions and idempotency.
6. Do not access the owner's database, run production migrations, or change Vercel environment variables.
7. Keep verification focused: General CI plus one disposable PostgreSQL migration/integration workflow per schema slice. Add tests only for demonstrated critical regressions.

## Current handoff

- PR #1 cart and PR #2 quote/reservations are stacked predecessors.
- PR #3 delivery address is implemented and its General CI/PostgreSQL workflows pass; it remains a draft stacked on PR #2 pending review/merge.
- Next implementation slice is configurable store shipping rules and quote shipping selection, including seller/admin configuration and buyer checkout UI.
