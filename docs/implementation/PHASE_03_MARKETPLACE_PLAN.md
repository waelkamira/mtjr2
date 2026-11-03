# Phase 3 — Marketplace Core execution plan

**Status:** In implementation. The Country/Currency/Market Prisma models and first migration have been committed; Prisma/CI verification is pending. Production identity checks from Phase 2 remain deferred and are not marked passed. Marketplace development proceeds against disposable PostgreSQL in CI and local development only. Do not connect to or migrate the owner's production database without explicit approval.

## Goal

Build the first usable, multi-vendor marketplace foundation on the canonical `prisma/schema.prisma`. Keep the existing identity foundation and enforce the architecture:

`UI → route/controller → auth + validation → domain service → repository → Prisma`.

Do not copy legacy application code or add models without a defined workflow.

## Delivery order

### 3.1 Market reference data
- [x] Define canonical Country, Currency, Market, and market-currency availability models (commit `a84c4da`).
- [x] Add the initial additive migration (commit `d120587`); CI migration verification is pending.
- [ ] Define ISO codes, enabled/disabled states, default currency, and explicit decimal precision rules.
- [ ] Add deterministic reference-data seed that is safe to run repeatedly.
- [ ] Add repository/service read paths and a minimal admin-protected management API only where required.

### 3.2 Seller and store foundation
- [ ] Define Seller, Store, seller/store status, ownership, and scoped staff membership.
- [ ] Connect ownership to the existing User identity without duplicating user or role models.
- [ ] Define seller onboarding state transitions and server-side authorization.
- [ ] Keep KYC documents and payout activation out of the first slice unless required to complete the onboarding workflow.

### 3.3 Catalog taxonomy
- [ ] Define hierarchical Category, translations, Brand, and localized display fields.
- [ ] Add deterministic seed data and safe category-tree queries.
- [ ] Enforce active/visible status and bounded pagination.

### 3.4 Product catalog
- [ ] Define Product, ProductVariant, ProductMedia, product attributes, identifiers, and store ownership.
- [ ] Define product moderation/approval and publishability rules.
- [ ] Store money as integer minor units with an explicit currency; never use floating-point values for prices.
- [ ] Add create/update/publish workflows with server-side store-scope authorization.

### 3.5 Discovery
- [ ] Add canonical product listing/detail/category/brand read APIs and pages.
- [ ] Add validated search, filtering, stable sorting, and pagination.
- [ ] Add indexes only for demonstrated query patterns; defer external search infrastructure.

## Required first vertical slice

The first implementation increment is **Country + Currency + Market**. Complete its schema, migration, repeatable seed, repository/service, and minimal tests before proceeding to Seller/Store.

## Minimal verification gates

- General CI: Prisma validate/generate, typecheck, lint, unit tests, production build.
- One PostgreSQL integration workflow for migration deployment, repeatable seed, uniqueness, and market/currency invariants.
- Add further tests only for a concrete security issue, regression, or distinct business invariant.

Use only disposable/local/CI PostgreSQL for development verification. Production database connectivity and production migrations are a separate, explicitly approved release task.

## Out of scope for this phase

Cart, checkout, orders, payment processing, shipment, refunds, seller payouts, accounting, tax calculation, loyalty, reviews, messaging, and the separate property/booking domain. These remain in their later roadmap phases.

## Definition of done

Marketplace Core is complete only when a seller can be represented by an authorized store, an approved product with variants and media can be published under that store, and customers can discover it through canonical category/product/search journeys with correct market currency and pagination. All writes must be validated, authorized, auditable where sensitive, and covered by the minimal CI/PostgreSQL gates.
