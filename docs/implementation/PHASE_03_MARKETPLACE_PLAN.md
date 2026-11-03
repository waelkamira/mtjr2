# Phase 3 — Marketplace Core execution plan

**Status:** In implementation, approaching exit review. Canonical schema, seller/catalog services, inventory foundation, buyer storefront, and seller/admin workspaces are committed. General CI and disposable PostgreSQL integration passed on `3a9369bf`; latest General CI passed on `dd725732`. No production database has been accessed.

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
- [x] General CI passed for the consolidated marketplace changes (`3a9369bf`).

## 3.5 Discovery and search

- [x] Public active-product listing and slug detail APIs.
- [x] Category, brand, market, currency, and text filters; bounded pagination and stable sorting.
- [x] Localized active search-synonym expansion.
- [x] General CI passed for the consolidated discovery changes (`3a9369bf`).
- [ ] Add full-text/typo-tolerant ranking only after measuring baseline query behavior and catalog volume.
- [x] Initial buyer storefront homepage and product detail route consume the public market/category/product APIs; search, category filtering, market selection, and localized currency display are connected.
- [x] Buyer discovery pagination, brand/category/market/currency/search filters, and sorting are connected.
- [x] Product detail has an accessible selectable media gallery with primary-image default.
- [x] Add server-rendered product SEO metadata (title, description, canonical, Open Graph, Twitter, and missing-product noindex) using the catalog domain service.
- [ ] Add product structured data only after verifying all required fields and price/availability semantics in the canonical product DTO.

## 3.6 Inventory and warehouse foundation

- [x] Add Warehouse, Inventory, InventoryMovement, InventoryReservation, StockTransfer, and StockTransferItem schema.
- [x] Add database constraints for non-negative on-hand/reserved stock, reservation/transfer quantity, and distinct transfer warehouses.
- [x] Add seller warehouse creation and inventory listing APIs.
- [x] Add idempotent stock adjustments; negative adjustments cannot consume reserved stock.
- [x] Add draft transfer creation, ship, and receive operations with transactional stock movements and audit events.
- [x] Require store ownership or exact STORE-scoped `inventory:manage` permission; reject cross-store transfers.
- [x] Make stock-transfer creation idempotent with a required unique idempotency key and payload consistency check.
- [x] General CI and disposable PostgreSQL migration replay passed for inventory, market, seller catalog, and moderation queries.
- [ ] Add reservation create/consume/release/expiry lifecycle when the cart/checkout system defines ownership and idempotency contracts.
- [ ] Add reconciliation/stock-count workflow after movement ledger behavior is verified.


## 3.7 Frontend/backend integration

- [x] Establish the shared storefront shell using the approved visual tokens.
- [x] Connect the homepage to active market, category, and product read APIs.
- [x] Connect buyer discovery filters for brand, category, market/currency, query, sorting, and pagination to the catalog APIs.
- [x] Connect product detail routes to the canonical public product API.
- [x] Serialize Prisma BigInt price amounts as JSON-safe minor-unit strings and include each currency's minor-unit precision.
- [x] Add the seller application screen connected to `POST /api/seller/applications`.
- [x] Add the authenticated seller workspace connected to `GET/POST /api/seller/stores`, active-market lookup, warehouse creation, and inventory listing APIs.
- [x] Add seller product draft creation/editing and approved-product publishing UI against the existing catalog APIs; price entry covers every enabled store market.
- [x] Add seller team screen with store staff listing/invitation/revocation and the current user's invitation inbox/acceptance, connected to scoped backend APIs.
- [x] Add inventory UI for warehouse creation, stock adjustment, transfer creation, shipment, receipt, and transfer history against the existing inventory APIs.
- [x] Add protected pending seller/product review queues and platform-admin moderation UI for approve/reject decisions with mandatory rejection reasons.
- [x] Buyer product SEO metadata is server-generated from the canonical catalog service; General CI passed on commit `dd725732`.
- [ ] Add cart/checkout UI only alongside the Buying Core APIs; never ship inert purchase controls.

## Minimal verification gates

1. General CI: Prisma validate/generate, TypeScript, lint, focused unit tests, production build.
2. Existing PostgreSQL integration workflow: deploy all migrations to its disposable PostgreSQL service and run the integration suite.
3. One deployed HTTP E2E journey after release configuration is approved.
4. Additional tests only for a concrete security issue, regression, or distinct business invariant.

## Out of scope for Phase 3

Cart, checkout, orders, payments, refunds, shipments, seller payouts, accounting, tax, loyalty, reviews, messaging, and storefront visual implementation. They remain in later blueprint phases.

## Definition of done

Marketplace Core is complete when authorized sellers can manage stores and warehouses, create and publish approved products with variants/media/prices, maintain stock safely, and customers can discover active products through canonical category/product/search journeys with market-aware prices. All sensitive writes must be validated, authorized, auditable, transactional, and pass the minimal CI/PostgreSQL gates.


## Phase 3 latest verification and exit review — 2026-11-03

- General CI passed on `dd725732dab3e7a7a6466254828a9e13467c0ef2` (run [41698547547](https://github.com/waelkamira/mtjr2/actions/runs/41698547547)); Prisma validate/generate, typecheck, lint, unit tests, and production build all succeeded.
- Product SEO metadata is complete for the current product page; it reuses `getDiscoverableProduct` and existing persisted fields. No schema change or migration is justified.
- The earlier disposable PostgreSQL integration result remains tied to `3a9369bf`; it is not evidence for later UI-only commits. Re-run the existing disposable PostgreSQL workflow once at the Phase 3 integration checkpoint, not for each presentation-only change.
- Remaining Phase 3 dependencies: owner-approved launch markets/currencies and initial taxonomy seed; optional structured data after DTO verification; one consolidated disposable PostgreSQL integration run; final responsive/browser journey review.
- No live database, production migration, or Vercel environment was accessed.

**Next implementation boundary:** do not add cart/checkout buttons or client-only cart persistence. Start Buying Core only with the server-owned cart, price revalidation, inventory reservation contract, idempotency, and order lifecycle APIs, then connect the buyer UI to those APIs.
