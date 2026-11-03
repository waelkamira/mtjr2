# Phase 3 — Marketplace Core execution plan

**Status:** In implementation. The canonical schema and first seller/catalog services are committed. Product discovery, inventory, and onboarding changes from the latest work are awaiting the consolidated CI and PostgreSQL verification gates. No production database has been accessed.

## Architecture and constraints

`UI → route/controller → authentication + validation → domain service → repository → Prisma`.

- `prisma/schema.prisma` is the canonical data model and this plan follows `docs/architecture/COMPLETE_PLATFORM_SYSTEMS_BLUEPRINT.md`.
- No direct Prisma access from UI components.
- Resolve store ownership from trusted database relations; delegated permissions must match the exact STORE scope. A global SELLER grant is not proof of ownership.
- Money uses integer minor units. Stock, order, payment, and payout writes require transactions, idempotency where retried, audit records for sensitive mutations, and concurrency-safe conditional updates.
- Use only isolated/local/CI PostgreSQL. Do not connect to or migrate the owner's production database without explicit approval.

## 3.1 Market reference data

- [x] Country, Currency, Market, and MarketCurrency schema and additive migration.
- [x] Enforce currency minor-unit precision and default-market currency relations.
- [x] Add public read APIs for active markets, individual market, active market currencies, and countries represented by active markets.
- [ ] Add repeatable reference-data seed.
- [ ] Define supported launch markets with the owner before activating any market or seeding launch availability.
- [ ] Add minimal admin management endpoints only where required.

## 3.2 Seller and store foundation

- [x] Seller, Store, StoreMarket, and SellerStaff schema.
- [x] Verified-email seller application submission, idempotent pending retry, and atomic audit.
- [x] Platform seller approval/rejection and approved-seller draft store creation.
- [x] Store staff invitation, acceptance, revocation, and exact STORE-scoped delegation.
- [ ] Store profile editing, seller suspension lifecycle, KYC documents, and payout activation in their dedicated blueprint systems.

## 3.3 Catalog taxonomy

- [x] Category/Brand and localized translation schema.
- [x] Active category tree and brand read services/APIs with bounded pagination and cycle handling.
- [ ] Deterministic taxonomy seed; no sample categories/brands are activated without an agreed catalog taxonomy.

## 3.4 Product catalog

- [x] Product, variants, media, identifiers, translations, category links, prices, and typed attribute schema.
- [x] Atomic draft product creation with store, market, category, brand, variant, media, and price validation.
- [x] Platform approval and store-scoped publication validation.
- [x] Draft metadata update with review reset and platform rejection with mandatory reason.
- [x] Persist rejection reason through additive migration.
- [ ] Complete General CI for the latest lifecycle changes.

## 3.5 Discovery and search

- [x] Public active-product listing and slug detail APIs.
- [x] Category, brand, market, currency, and text filters; bounded pagination and stable sorting.
- [x] Localized active search-synonym expansion.
- [ ] Complete General CI for the latest discovery changes.
- [ ] Add full-text/typo-tolerant ranking only after measuring baseline query behavior and catalog volume.
- [ ] Storefront listing/detail pages follow the backend contracts.

## 3.6 Inventory and warehouse foundation

- [x] Add Warehouse, Inventory, InventoryMovement, InventoryReservation, StockTransfer, and StockTransferItem schema.
- [x] Add database constraints for non-negative on-hand/reserved stock, reservation/transfer quantity, and distinct transfer warehouses.
- [x] Add seller warehouse creation and inventory listing APIs.
- [x] Add idempotent stock adjustments; negative adjustments cannot consume reserved stock.
- [x] Add draft transfer creation, ship, and receive operations with transactional stock movements and audit events.
- [x] Require store ownership or exact STORE-scoped `inventory:manage` permission; reject cross-store transfers.
- [x] Make stock-transfer creation idempotent with a required unique idempotency key and payload consistency check.
- [ ] Complete General CI and PostgreSQL migration replay for inventory and market queries.
- [ ] Add reservation create/consume/release/expiry lifecycle when the cart/checkout system defines ownership and idempotency contracts.
- [ ] Add reconciliation/stock-count workflow after movement ledger behavior is verified.

## Minimal verification gates

1. General CI: Prisma validate/generate, TypeScript, lint, focused unit tests, production build.
2. Existing PostgreSQL integration workflow: deploy all migrations to its disposable PostgreSQL service and run the integration suite.
3. One deployed HTTP E2E journey after release configuration is approved.
4. Additional tests only for a concrete security issue, regression, or distinct business invariant.

## Out of scope for Phase 3

Cart, checkout, orders, payments, refunds, shipments, seller payouts, accounting, tax, loyalty, reviews, messaging, and storefront visual implementation. They remain in later blueprint phases.

## Definition of done

Marketplace Core is complete when authorized sellers can manage stores and warehouses, create and publish approved products with variants/media/prices, maintain stock safely, and customers can discover active products through canonical category/product/search journeys with market-aware prices. All sensitive writes must be validated, authorized, auditable, transactional, and pass the minimal CI/PostgreSQL gates.
