# Phase 3 — Marketplace Core execution plan

**Status:** In implementation. Market, Seller/Store, Category/Brand, Product/Variant/Media/Price, structured attributes, and localized search synonym schema foundations plus additive migrations are committed; Prisma and the latest General CI/PostgreSQL migration verification passed for the committed schema baseline. No production database has been accessed. Production identity checks from Phase 2 remain deferred and are not marked passed. Marketplace development proceeds against disposable PostgreSQL in CI and local development only. Do not connect to or migrate the owner's production database without explicit approval.

## Goal

Build the first usable, multi-vendor marketplace foundation on the canonical `prisma/schema.prisma`. Keep the existing identity foundation and enforce the architecture:

`UI → route/controller → auth + validation → domain service → repository → Prisma`.

Do not copy legacy application code or add models without a defined workflow.

## Delivery order

### 3.1 Market reference data
- [x] Define canonical Country, Currency, Market, and market-currency availability models (commit `a84c4da`).
- [x] Add the initial additive migration (commit `d120587`); schema validation and migration rehearsal passed in CI.
- [x] Define ISO country/currency codes, enabled states, default currency relation, and explicit currency minor-unit precision constraint.
- [ ] Add deterministic reference-data seed that is safe to run repeatedly.
- [ ] Add repository/service read paths and a minimal admin-protected management API only where required.

### 3.2 Seller and store foundation
- [x] Define Seller, Store, seller/store lifecycle enums, owner relation, and store-scoped staff membership schema.
- [x] Connect seller ownership and staff membership to existing User identity; no duplicate User/Role/Permission models.
- [x] Add authenticated, email-verified seller application submission with atomic audit and idempotent pending retry.
- [x] Add permission-protected approve/reject transitions; approval grants the seeded SELLER role atomically, and rejection requires a reason.
- [x] Add approved-seller draft-store creation with active-market validation and an atomic audit event.
- [x] Add store-scoped staff invitation and acceptance; grant STORE_MANAGER only in the exact store scope.
- [x] Add owner/scoped-manager authorization for staff invitations and reject cross-user invitation acceptance.
- [x] Expose staff revocation through a mutation-protected API route using the canonical scoped service.
- [x] Add focused store-staff revocation test (CI execution pending); PostgreSQL integration remains pending.
- [ ] Add store profile editing, seller suspension lifecycle, KYC documents, and payout activation in their dedicated systems.

### 3.3 Catalog taxonomy
- [x] Define hierarchical Category, CategoryTranslation, Brand, and BrandTranslation schema with draft/active/archive lifecycle.
- [ ] Add deterministic seed data.
- [x] Add bounded, cycle-safe active category-tree and active-brand read services with locale fallback and stable pagination.
- [x] Enforce active-only visibility and bounded pagination on public category and brand read APIs.

### 3.4 Product catalog
- [x] Define Product, ProductVariant, ProductMedia, ProductTranslation, ProductIdentifier, ProductCategory, ProductPrice, and store ownership schema. 
- [x] Add product approval lifecycle fields (PENDING/APPROVED/REJECTED) and draft/active/archive status; publishability transition rules remain to be implemented in services.
- [x] Store prices as integer minor units (BigInt) with explicit currency and market; add database checks for non-negative amounts and compare-at price consistency.
- [x] Add atomic draft product creation with store-scope authorization, active category/brand checks, enabled store-market/currency checks, variants, media, minor-unit prices, and audit event.
- [x] Add platform-permission product approval and store-scoped publishing with active store/seller, active variant, primary image, and per-market enabled-currency price checks.
- [x] Add draft metadata update with review reset, platform rejection with required reason, and atomic audit; CI/PostgreSQL verification pending.

### 3.5 Discovery
- [x] Add public active-product listing and slug detail APIs with category/brand/market/currency filters, bounded pagination, and stable sorting; storefront pages remain pending.
- [x] Add localized search-synonym persistence and an active-market read query that rejects markets whose default currency is not enabled.\n- [ ] Add validated search, filtering, stable sorting, and pagination.
- [ ] Add indexes only for demonstrated query patterns; defer external search infrastructure.

## Required first vertical slice

The schema foundations for **Country + Currency + Market**, **Seller + Store**, **Category + Brand**, and **Product + Variant + Media + Price** are committed in additive migrations. Reference-data seed, product update/rejection, product discovery/search APIs, and post-change CI/PostgreSQL verification remain outstanding. Draft product creation and taxonomy read APIs are implemented but await CI verification.

## Minimal verification gates

- General CI: Prisma validate/generate, typecheck, lint, unit tests, production build.
- One PostgreSQL integration workflow for migration deployment, repeatable seed, uniqueness, and market/currency invariants.
- Add further tests only for a concrete security issue, regression, or distinct business invariant.

Use only disposable/local/CI PostgreSQL for development verification. Production database connectivity and production migrations are a separate, explicitly approved release task.

## Out of scope for this phase

Cart, checkout, orders, payment processing, shipment, refunds, seller payouts, accounting, tax calculation, loyalty, reviews, messaging, and the separate property/booking domain. These remain in their later roadmap phases.

## Definition of done

Marketplace Core is complete only when a seller can be represented by an authorized store, an approved product with variants and media can be published under that store, and customers can discover it through canonical category/product/search journeys with correct market currency and pagination. All writes must be validated, authorized, auditable where sensitive, and covered by the minimal CI/PostgreSQL gates.


## 2026-11-03 — Taxonomy read APIs and first product write slice

**Implemented**
- Added active category and brand read services with locale fallback, bounded pagination, stable ordering, and active-only visibility.
- Added public GET routes for categories and brands; category tree construction breaks orphan/cyclic parent edges rather than recursing indefinitely.
- Added focused category-tree tests for hierarchy ordering, cycle/orphan handling, and localized labels.
- Added the canonical store-staff revocation POST route; it uses the existing owner/exact-store-scope service and the identity mutation Origin/content-type checks.
- Added atomic draft product creation with validated input, store-scoped `catalog:manage`, active brand/category checks, enabled store-market/currency checks, variant/media/price creation, integer minor-unit conversion, and an audit event.
- Added POST `/api/products` for authenticated draft product creation.
- Added focused product tests for atomic price creation and rejection of a market not enabled for the store.

**Verification**
- An earlier taxonomy CI run failed at lint because of one pre-existing explicit `any` in the seller test fixture; Prisma validation, generation, and typecheck had passed. The fixture was corrected to use Prisma's transaction type, and the unused tree state was removed.
- Follow-up CI runs for the correction and the combined catalog/product changes are pending or were superseded by newer commits. No successful result is claimed yet.
- PostgreSQL integration is still required for migration replay and market/currency invariants. No production database or Vercel environment was accessed or changed.

**Remaining**
- Deterministic ISO country/currency seed and read APIs.
- Store-staff revocation tests and PostgreSQL integration coverage.
- Product update, platform approval, publishability rules, product detail/listing, search/filter/sort/pagination.


### Product lifecycle extension (2026-11-03)
- [x] Approve pending draft products through a permission-protected admin API; approval and audit are atomic.
- [x] Publish only approved drafts through a store-scoped API; validate active seller/store, active variants, primary image, and a valid price for every enabled active store market before the status transition.
- [ ] Add product update and rejection-with-reason workflows, then validate lifecycle against PostgreSQL integration.


### Product lifecycle and discovery follow-up (2026-11-03)
- [x] Add product draft metadata updates. Every edit returns the item to PENDING review and clears prior approval/rejection metadata.
- [x] Add platform rejection for pending drafts with a mandatory reason and atomic audit.
- [x] Persist product rejection reason with additive migration `20261103070000_product_review_reason`.
- [x] Add public product listing/detail APIs; only ACTIVE products belonging to ACTIVE stores and sellers are visible.
- [x] Add category, brand, market, currency, text filters, stable sort options, and bounded pagination.
- [x] Add focused tests for product edit/rejection and staff revocation.
- [ ] Complete General CI and PostgreSQL integration for the combined changes.


**Security follow-up:** Staff-manager authorization now uses exact STORE-scoped grants; global role grants cannot authorize management of arbitrary stores. A focused delegated-manager test was added. CI verification is pending.
