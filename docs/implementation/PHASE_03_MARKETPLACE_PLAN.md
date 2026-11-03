# Phase 3 — Marketplace Core execution plan

**Status:** In implementation. Market, Seller/Store, Category/Brand, Product/Variant/Media/Price, structured attributes, and localized search synonym schema foundations plus additive migrations are committed; Prisma and the latest General CI/PostgreSQL migration verification passed for the committed schema baseline. No production database has been accessed. Production identity checks from Phase 2 remain deferred and are not marked passed. Marketplace development proceeds against disposable PostgreSQL in CI and local development only. Do not connect to or migrate the owner's production database without explicit approval.

## Goal

Build the first usable, multi-vendor marketplace foundation on the canonical `prisma/schema.prisma`. Keep the existing identity foundation and enforce the architecture:

`UI → route/controller → auth + validation → domain service → repository → Prisma`.

Do not copy legacy application code or add models without a defined workflow.

## Delivery order

### 3.1 Market reference data
- [x] Define canonical Country, Currency, Market, and market-currency availability models (commit `a84c4da`).
- [x] Add the initial additive migration (commit `d120587`); CI migration verification is pending.
- [x] Define ISO country/currency codes, enabled states, default currency relation, and explicit currency minor-unit precision constraint.
- [ ] Add deterministic reference-data seed that is safe to run repeatedly.
- [ ] Add repository/service read paths and a minimal admin-protected management API only where required.

### 3.2 Seller and store foundation
- [x] Define Seller, Store, seller/store lifecycle enums, owner relation, and store-scoped staff membership schema.
- [x] Connect seller ownership and staff membership to existing User identity; no duplicate User/Role/Permission models.
- [x] Add authenticated, email-verified seller application submission with atomic audit and idempotent pending retry.
- [x] Add permission-protected approve/reject transitions; approval grants the seeded SELLER role atomically, and rejection requires a reason.
- [x] Add approved-seller draft-store creation with active-market validation and an atomic audit event.
- [ ] Add store-scoped staff invitation, acceptance, revocation, and authorization workflows.
- [ ] Add store-scoped staff invitation, acceptance, revocation, and authorization workflows. Keep KYC documents and payout activation for their later dedicated systems.

### 3.3 Catalog taxonomy
- [x] Define hierarchical Category, CategoryTranslation, Brand, and BrandTranslation schema with draft/active/archive lifecycle.
- [ ] Add deterministic seed data, bounded cycle-safe category-tree queries, and repository/service layer.
- [ ] Enforce active/visible status and bounded pagination.

### 3.4 Product catalog
- [x] Define Product, ProductVariant, ProductMedia, ProductTranslation, ProductIdentifier, ProductCategory, ProductPrice, and store ownership schema. 
- [x] Add product approval lifecycle fields (PENDING/APPROVED/REJECTED) and draft/active/archive status; publishability transition rules remain to be implemented in services.
- [x] Store prices as integer minor units (BigInt) with explicit currency and market; add database checks for non-negative amounts and compare-at price consistency.
- [ ] Add create/update/publish workflows with server-side store-scope authorization.

### 3.5 Discovery
- [ ] Add canonical product listing/detail/category/brand read APIs and pages.
- [x] Add localized search-synonym persistence and an active-market read query that rejects markets whose default currency is not enabled.\n- [ ] Add validated search, filtering, stable sorting, and pagination.
- [ ] Add indexes only for demonstrated query patterns; defer external search infrastructure.

## Required first vertical slice

The schema foundations for **Country + Currency + Market**, **Seller + Store**, **Category + Brand**, and **Product + Variant + Media + Price** are committed in additive migrations. Reference-data seed, product write services, authorization, publishability rules, discovery APIs, and post-change CI/PostgreSQL verification remain outstanding.

## Minimal verification gates

- General CI: Prisma validate/generate, typecheck, lint, unit tests, production build.
- One PostgreSQL integration workflow for migration deployment, repeatable seed, uniqueness, and market/currency invariants.
- Add further tests only for a concrete security issue, regression, or distinct business invariant.

Use only disposable/local/CI PostgreSQL for development verification. Production database connectivity and production migrations are a separate, explicitly approved release task.

## Out of scope for this phase

Cart, checkout, orders, payment processing, shipment, refunds, seller payouts, accounting, tax calculation, loyalty, reviews, messaging, and the separate property/booking domain. These remain in their later roadmap phases.

## Definition of done

Marketplace Core is complete only when a seller can be represented by an authorized store, an approved product with variants and media can be published under that store, and customers can discover it through canonical category/product/search journeys with correct market currency and pagination. All writes must be validated, authorized, auditable where sensitive, and covered by the minimal CI/PostgreSQL gates.
