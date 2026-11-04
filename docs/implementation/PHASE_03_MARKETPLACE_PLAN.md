# Phase 3 — Marketplace Core execution plan

**Status:** Historical execution plan for Phase 3. Marketplace Core implementation is present on the stacked feature branches, but Phase 3 is not marked release-complete: seller onboarding and catalog/inventory journeys still require exact-commit evidence, owner-approved launch reference data, and the consolidated verification gate. Phase 4 (Buying Core) is the active implementation phase. No production database has been accessed.

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

## End-to-end acceptance gate — seller onboarding and Marketplace Core

Before calling the seller foundation complete, walk the actual experience as a new seller from the homepage seller CTA through identity gating, application form, submission, status refresh, admin review, approval/rejection, draft-store creation, and the first store setup action. Trace each visible control to its request, server validation/authorization, domain service, canonical Prisma records, persisted status, and returned UI state.

The seller/store implementation has application submission, platform review, draft-store creation, and store staff flows described above; those implementation notes are not proof that the whole browser journey has passed. Current verification must remain **Implemented / unverified** until the exact branch/commit has evidence for:
- guest and verified/unverified authenticated entry;
- valid submission, duplicate/retry and already-existing application states;
- server-derived applicant identity and cross-user/store denial;
- admin permission enforcement, rejection reason, stale/double review prevention and audit;
- approval-to-store creation, idempotent replay and persisted draft state;
- loading, validation, forbidden, unavailable-market and recoverable-error UI;
- required focused CI and disposable PostgreSQL replay if schema/transaction code changed.

**Current source-review findings (static inspection on `feat/returns-workflow`):** The seller form is embedded in `/seller`; `POST /api/seller/applications` requires a current session and verified email, derives the applicant from the session, and transactionally creates a PENDING Seller plus AuditLog. Existing PENDING applications replay idempotently. Admin review requires `users:manage`, a rejection reason, a conditional PENDING transition, seller-role assignment on approval, and an audit record. However, the reviewed `createSellerStore` service creates a new store on each successful call and has no demonstrated idempotency key or seller-level duplicate-store guard. Route/API error handlers also map several business failures to generic 400 responses. These are code observations, not proof of a browser journey.

Do not add a new Prisma table just because a status page or form is missing. First compare current Seller/application models and relations against the required durable lifecycle. Any genuine schema gap needs an additive migration and a recorded reason; do not apply it to the owner's database. Keep KYC document uploads, tax registration, store profile editing, and payout activation as separate incomplete scopes unless implemented end-to-end.

For all other Phase 3 buttons and forms, use the same standard: a real verified action, an explicitly conditional/disabled control with explanation, or remove the control until its backend exists. Tests stay focused on distinct security and business invariants; do not create hundreds of per-control tests. Follow [END_TO_END_JOURNEY_STANDARD.md](END_TO_END_JOURNEY_STANDARD.md) and update [PAGE_ROUTE_REGISTRY.md](PAGE_ROUTE_REGISTRY.md).

## Minimal verification gates

1. General CI: Prisma validate/generate, TypeScript, lint, focused unit tests, production build.
2. Existing PostgreSQL integration workflow: deploy all migrations to its disposable PostgreSQL service and run the integration suite.
3. One deployed HTTP E2E journey after release configuration is approved.
4. Additional tests only for a concrete security issue, regression, or distinct business invariant.

## Out of scope for Phase 3

Cart, checkout, orders, payments, refunds, shipments, seller payouts, accounting, tax, loyalty, reviews, messaging, and storefront visual implementation. They remain in later blueprint phases.

## Definition of done

Marketplace Core is complete when authorized sellers can manage stores and warehouses, create and publish approved products with variants/media/prices, maintain stock safely, and customers can discover active products through canonical category/product/search journeys with market-aware prices. The critical seller onboarding and catalog/inventory journeys must be traced from visible action to persisted outcome, including relevant denied/error/retry states. All sensitive writes must be validated, authorized, auditable, transactional, and pass the minimal CI/PostgreSQL gates. A page or API existing is not an end-to-end pass.


## Phase 3 latest verification and exit review — 2026-11-03

- General CI passed on `dd725732dab3e7a7a6466254828a9e13467c0ef2` (run [41698547547](https://github.com/waelkamira/mtjr2/actions/runs/41698547547)); Prisma validate/generate, typecheck, lint, unit tests, and production build all succeeded.
- Product SEO metadata is complete for the current product page; it reuses `getDiscoverableProduct` and existing persisted fields. No schema change or migration is justified.
- The earlier disposable PostgreSQL integration result remains tied to `3a9369bf`; it is not evidence for later UI-only commits. Re-run the existing disposable PostgreSQL workflow once at the Phase 3 integration checkpoint, not for each presentation-only change.
- Remaining Phase 3 dependencies: owner-approved launch markets/currencies and initial taxonomy seed; optional structured data after DTO verification; one consolidated disposable PostgreSQL integration run; final responsive/browser journey review.
- No live database, production migration, or Vercel environment was accessed.

**Phase handoff:** Buying Core is already tracked in `PHASE_04_BUYING_PLAN.md`; do not restart or duplicate the cart/quote work from this historical plan. Finish its exact-head verification and documented payment-provider decision gates there. Return to Phase 3 only for the explicitly outstanding seller/catalog acceptance evidence and launch reference-data decisions.


## Buying Core handoff — 2026-11-03

Marketplace Core's buyer catalog now has a connected product detail journey. The next implementation slice is tracked separately in `docs/implementation/PHASE_04_BUYING_PLAN.md`. Cart/checkout must remain server-owned and connected end-to-end; launch market/taxonomy seed decisions remain owner-controlled. Do not describe Phase 3 as fully production-ready until the pending disposable PostgreSQL checkpoint and launch reference-data decisions are resolved.


## 3.5a — Shareable storefront discovery state

- [x] Restore search query, market, category, brand, sort and page from the URL before requesting products.
- [x] Synchronize active discovery state to the URL for reloads and shareable links.
- [x] Restore discovery controls on browser back/forward navigation.
- [x] Reuse the canonical `/api/products` query contract; no duplicate search endpoint or Prisma model was added.
- [ ] Typo-tolerant ranking, autocomplete and richer facets remain deferred.
- Verification policy: focused code review only for this UI state slice; no database, Prisma migration, or broad routine test run.

<<<<<<< HEAD
## 3.5b — Vendor-aware catalog integration — 2026-11-04

- Global product search now filters by active store/vendor as well as category and brand. Search terms also match the seller's public display name.
- Category, brand, and store product pages expose database-backed name sorting while preserving search terms and sort order across pagination.
- Public store cards and detail pages show the seller's public display name; legal seller data is not exposed.
- The homepage, global search, store/category/brand pages, and product detail were exercised against the local PostgreSQL demo catalog. Store-filtered search returned all eight published demo products, and the browser completed a store-filter → product-detail journey with the correct EUR price.
- Full unit suite passed (131 tests), as did typecheck, repository lint (existing warnings only), and Prisma schema validation.
- This verifies local catalog integration only. It does not complete the payment-backed purchase journey or replace the disposable PostgreSQL integration checkpoint. Payment and launch-market gates remain in `PHASE_04_BUYING_PLAN.md`.
=======
## 3.8 — Isolated demo catalog data

- [x] Implement a repeatable, opt-in demo seed using the canonical category, product, store, market, price, media, variant, warehouse, and inventory models.
- [x] Seed 8 bilingual demo categories and 10 active products per category (80 products), with 4 demo seller/store accounts and a dedicated DEMO-US/USD market.
- [x] Require a separate `DEMO_DATABASE_URL`, explicit opt-in flags, a demo/test/dev database-name marker, and a non-production runtime; never fall back to production `DATABASE_URL`.
- [x] Use stable identifiers/upserts; do not reset existing stock on reruns or fabricate reviews/orders/payments.
- [x] Execute against disposable PostgreSQL and rerun to prove seed idempotency: migration replay and integration suite passed; both seed runs reported 80 products / 8 categories / 4 stores / 80 inventory rows.
- No Prisma migration is required by this data-only slice.


**Verification evidence:** General CI [41837000589](https://github.com/waelkamira/mtjr2/actions/runs/41837000589) and disposable PostgreSQL [41836993780](https://github.com/waelkamira/mtjr2/actions/runs/41836993780) passed on exact head `d9686531b6638e28bb8f2b57cab8e82c1d505abe`; merged as `0ec09ed37492e6c71b27e545abac72893ce73749`. Public browser/API verification remains a separate follow-up.
>>>>>>> 442aae41dfb67a4b1bc8871948cab095bcdb9ade
