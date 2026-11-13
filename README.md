# Mtjr2 — Global Multi-Vendor Marketplace

A ground-up implementation of a global, multi-vendor commerce platform.

## Project principles

- Build from a clean repository; do not import legacy application code.
- Treat the 49-system platform blueprint as the functional scope.
- Treat the previous Prisma schema as a domain reference, not as code to copy blindly. Every model must support a defined workflow.
- Keep business logic in domain services, not UI components or route handlers.
- Enforce authorization on the server for every protected operation.
- Use transactions, idempotency, audit trails, and concurrency-safe operations for orders, payments, inventory, refunds, and payouts.
- A capability is not complete until its user journey, persistence, authorization, error handling, and automated tests pass.
- Record decisions, implementation status, blockers, and test evidence in this repository.
- Keep `main` as the only source of truth; follow [repository consolidation and merge gates](docs/implementation/REPOSITORY_SOURCE_OF_TRUTH.md) before integrating any branch.

## Target architecture

- **Web application:** Next.js App Router and TypeScript.
- **Database:** PostgreSQL with Prisma ORM.
- **Application layers:** UI → route/controller → authentication and validation → domain service → repository → Prisma.
- **Domains:** identity/access, marketplace/catalog, buying, seller operations, platform administration, global operations, and the separate property/booking domain.
- **Quality:** unit, integration, and end-to-end tests; linting, type checking, and CI.

Exact dependency versions and deployment choices will be pinned during the foundation setup and verified against the runtime environment.

## Build sequence — canonical phases 1–11

1. **Technical foundation:** repository/runtime conventions, environment validation, PostgreSQL/Prisma baseline, logging, error handling, CI and test harness.
2. **Identity and access:** accounts, credentials, sessions, OAuth, verification/recovery, RBAC, scoped authorization and audit.
3. **Marketplace core:** markets/reference data, seller/store foundation, taxonomy, catalog, variants, media, discovery and inventory primitives.
4. **Buying core:** cart, quote/reservation, address, shipping/tax snapshots, orders/vendor orders, payment lifecycle and customer order journey.
5. **Seller operations and administration:** seller workspace, staff, procurement, seller fulfillment, moderation and platform-admin domain operations.
6. **Financial integrity:** payment lifecycle integration, commissions, double-entry ledger, reconciliation, seller balances, payouts and invoices.
7. **Trust, engagement and communications:** reviews, Q&A, messaging, support, returns, notifications, loyalty/promotions and lifecycle communications.
8. **Separate property and booking domain:** property listings and booking workflows, sharing only explicitly common platform services.
9. **Global market and regulatory readiness:** localization, FX policy, tax determination, customs, KYB, product compliance, privacy and market eligibility.
10. **Release readiness and controlled launch:** security, performance, accessibility, observability, backup/restore, deployment/rollback and one approved-market release gate.
11. **Production operations, reliability and scale:** SLOs, incident response, worker/outbox operations, disaster recovery, capacity, cost governance and controlled market expansion.

The phase roadmap is a delivery sequence; the 49 numbered systems are independently owned capabilities. They are not interchangeable numbering schemes. Phase 10 is not System 10 (notifications). See [the Phase 1–11 roadmap audit](docs/implementation/PLATFORM_PHASE_ROADMAP_01_11.md) for the review/corrections and [Phase 11 execution plan](docs/implementation/PHASE_11_PRODUCTION_OPERATIONS_PLAN.md) for its acceptance gates.

This sequence is dependency-aware. The 49 systems will be mapped to these delivery slices and implemented incrementally; it is not a promise to create all systems in one pass.
## Phase roadmap and implementation status

The phase audit found that the former README listed only nine phases and that detailed execution plans for Phases 5–10 were missing. The corrected canonical sequence is 1–11; the audit document records current gaps and the distinction between phase numbers and the 49-system IDs. Do not treat the roadmap as completion evidence. Exact-commit CI, disposable PostgreSQL integration, route/action journeys and provider/market approval remain mandatory for their respective exit gates.

## Seller catalog and Syrian location foundations

- [Syrian geography, Leaflet map, and category-specific product attributes](docs/catalog/SYRIA_GEOGRAPHY_AND_CATEGORY_ATTRIBUTES.md) — pinned OpenSyria administrative data, Akaar-derived field definitions, source-tracked neighbourhood suggestions, and seller product authoring integration.

## Phase execution plan index

- [Phase 1 — Foundation](docs/implementation/PHASE_01_FOUNDATION_PLAN.md)
- [Phase 2 — Identity](docs/implementation/PHASE_02_IDENTITY_PLAN.md)
- [Phase 3 — Marketplace](docs/implementation/PHASE_03_MARKETPLACE_PLAN.md)
- [Phase 4 — Buying](docs/implementation/PHASE_04_BUYING_PLAN.md)
- [Phase 5 — Seller and administration](docs/implementation/PHASE_05_SELLER_ADMIN_PLAN.md)
- [Phase 6 — Financial integrity](docs/implementation/PHASE_06_FINANCIAL_INTEGRITY_PLAN.md)
- [Phase 7 — Trust and engagement](docs/implementation/PHASE_07_TRUST_ENGAGEMENT_PLAN.md)
- [Phase 8 — Property and booking](docs/implementation/PHASE_08_PROPERTY_BOOKING_PLAN.md)
- [Phase 9 — Global and regulatory readiness](docs/implementation/PHASE_09_GLOBAL_REGULATORY_PLAN.md)
- [Phase 10 — Release readiness](docs/implementation/PHASE_10_RELEASE_READINESS_PLAN.md)
- [Phase 11 — Production operations and scale](docs/implementation/PHASE_11_PRODUCTION_OPERATIONS_PLAN.md)
- [Full roadmap audit and dependency corrections](docs/implementation/PLATFORM_PHASE_ROADMAP_01_11.md)

## Prisma model map

Use [`docs/architecture/PRISMA_MODEL_USAGE_MAP.md`](docs/architecture/PRISMA_MODEL_USAGE_MAP.md) with `prisma/schema.prisma` before every schema change. The map identifies the owning domain/service and known implementation boundaries; it is an impact-analysis aid, not evidence that a model's workflow is complete.

## Required page inventory

The 49-system blueprint defines business capabilities; it does not replace the route-by-route screen checklist. Use [`PAGE_INVENTORY.md`](PAGE_INVENTORY.md) for the audited App Router routes, actual components/access boundaries, missing targets, and per-area implementation status. Use [`docs/architecture/PLATFORM_PAGE_INVENTORY.md`](docs/architecture/PLATFORM_PAGE_INVENTORY.md) as the broader functional checklist for storefront, account, seller, admin, global operations, property/booking, and legal/system pages. The audit found 74 page routes and 143 API route handlers; route presence alone is not completion evidence.

**Page inventory progress (2026-11-06):** Added root/global not-found and error UI plus loading/error boundaries for root, account, seller, and admin segments. `npm run typecheck`, targeted ESLint, `npm run build`, and `git diff --check` passed. A local browser smoke test verified the unknown-route 404 recovery links at 390px without horizontal overflow. Full route-by-route interaction, authorization matrix, responsive and persistence testing remains open; see the inventory for missing routes and exact evidence. No Vercel deployment was performed.

## Global platform completeness specification

## Independent system implementation specifications

The 49 platform systems are split into individual build/verification contracts in [`docs/systems/README.md`](docs/systems/README.md). Use [`docs/systems/SYSTEM_INTEGRATION_MATRIX.md`](docs/systems/SYSTEM_INTEGRATION_MATRIX.md) for explicit upstream/downstream dependencies. Each system must be closed independently with its own UI-to-API-to-Prisma journey and P0/P1 acceptance evidence; see the global specification for cross-platform page and launch boundaries.


Use [`docs/architecture/GLOBAL_PLATFORM_PAGE_AND_CONTROL_SPEC.md`](docs/architecture/GLOBAL_PLATFORM_PAGE_AND_CONTROL_SPEC.md) as the detailed page/dashboard/control specification: public storefront, buyer account, seller center, full admin domains, restricted finance/security/operations, sign-in/role routing/sign-out, global launch gates, and additional capabilities that must be explicitly accounted for beyond the 49-system inventory.

## Canonical page-to-system placement map

Use [`docs/architecture/PLATFORM_PAGE_SYSTEM_MAP.md`](docs/architecture/PLATFORM_PAGE_SYSTEM_MAP.md) to determine which public, buyer, seller, admin, finance/operations, and property pages own each of the 49 systems. This is the cross-system information architecture; `PLATFORM_PAGE_INVENTORY.md` remains the route checklist, `PAGE_ROUTE_REGISTRY.md` records actual source routes, and `END_TO_END_JOURNEY_MATRIX.md` records action-level evidence. Do not treat target routes as implemented or verified.

## Definition of done

A system may be marked **Complete** only when:
- its user and operational workflows are implemented;
- data ownership, schema constraints, and migrations are correct;
- APIs validate inputs and enforce authorization;
- business rules and failure paths are handled;
- relevant unit/integration/end-to-end tests pass;
- type checking and linting pass;
- documentation includes implementation evidence and known limitations.

## Visual design direction

- Approved premium visual direction: forest green, sage, warm ivory, and restrained copper, based on the user's supplied references.
- Shared design specification: [Mtjr2 Visual Design System](docs/design/VISUAL_DESIGN_SYSTEM.md).
- Foundation tokens are implemented in `src/app/theme.css` and shared styles/primitives in `src/app/globals.css`; storefront, seller, and admin UI implementation follows the delivery sequence and does not bypass Phase 2 security gates. The page-wide adoption and responsive audit remains open.

## Deployment

- Production hosting decision: Vercel.
- Vercel setup, environment variables, PostgreSQL migration procedure, trusted-proxy requirements, and the single Phase 2 production verification journey: [Vercel deployment guide](docs/deployment/VERCEL.md).
- Vercel account/project connection and production secrets are not yet configured; do not treat the deployment gates as passed until evidence is recorded in the build log.

## Matjar AI Assistant

The Matjar AI Assistant implementation is present on canonical `main`: global chat UI, public catalog search, session-scoped order summaries, server-only Groq integration, and input validation. The implementation plan and release gates are documented in [`docs/ai/MATJAR_AI_ASSISTANT_PLAN.md`](docs/ai/MATJAR_AI_ASSISTANT_PLAN.md); local configuration and privacy instructions are in [`docs/ai/SETUP.md`](docs/ai/SETUP.md). It is disabled by default and requires server-side `GROQ_API_KEY` plus `AI_ASSISTANT_ENABLED=true` after CI and privacy/security acceptance. No paid provider fallback is configured.
## Documentation

- `docs/architecture/` — architecture decisions, domain boundaries, and system blueprint.
- `docs/implementation/` — phase plans and implementation records.
- `docs/quality/` — test strategy, security, and release evidence.
- `docs/design/` — visual design system, component rules, and accessibility standards.
- `prisma/` — canonical Prisma schema, migrations, and seed data.

## Identity development status — 4 November 2026

- `/terms` and `/privacy` are published in the application as clearly labelled v1 development drafts. They disclose that the operating company has not yet been incorporated and do not invent an operator identity or contact address.
- `/register` asks the visitor to choose Customer/Buyer or Seller. A successful password registration activates and signs in the account immediately; Cloudflare Turnstile and persistent rate limits protect both password and Google registration. Seller registration creates a `PENDING` seller application but does not grant seller permissions before approval. Separate unchecked Terms and Privacy consents are recorded as exact version `v1`.
- Google OpenID Connect authorization-code flow with state and PKCE is implemented at `/api/auth/google/start` and `/api/auth/google/callback`; it requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` plus the registered callback URL. Existing email accounts are never silently linked to Google.
- Added `/account` dashboard, `/account/profile`, `/account/addresses`, `/account/favorites`, and `/account/store` aliases, connecting profile/address reads and writes to authenticated APIs and existing Prisma entities. Existing order, wishlist, return, review, question, messaging, support, notification and seller pages remain available.
- Registration defaults to enabled in development/test and is unconditionally blocked in production, even if the environment flag is true. Set `PUBLIC_REGISTRATION_ENABLED=false` to disable it in development. Configure `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` together to enable the required registration bot check.
- No Prisma schema change or migration was required for this slice. The policy documents remain development drafts. Focused saved-address service tests and exact-head CI, disposable PostgreSQL integration, and Browser E2E passed on PR #77 head. Identity remains incomplete until Google provider-backed and full registration/login/logout/address browser journeys are verified.

## Current status

**Phase 1 foundation: scaffolded. Phase 2 identity/access: core services and UI implemented; development/test registration is enabled by default, production registration is hard-blocked; focused exact-head CI, PostgreSQL integration, and Browser E2E pass for the saved-address correction, while Google provider-backed and full identity browser journeys remain pending; production exit checks are not passed. Phase 3 Marketplace Core: in progress; seller/store, taxonomy, product lifecycle, discovery, inventory foundations, and the connected buyer/seller/admin workspaces are implemented. Buyer product SEO metadata is now server-generated from the catalog service. Market reference data, seller/store workflows, taxonomy, product lifecycle, public discovery APIs, and warehouse/inventory foundations are implemented. The buyer storefront consumes the live market/category/product APIs, including product detail and currency-aware price display. The seller workspace supports seller applications, store/warehouse management, inventory viewing, and API-connected product draft creation/editing/publication. A platform moderation workspace is connected to protected seller/product review queues. Seller team and invitation/acceptance/revocation screens are now connected to scoped staff APIs. Reference-data activation remains pending. Buying Core is now in progress: persistent cart, checkout quote/reservation, and delivery-address capture are implemented and verified by General CI and disposable PostgreSQL workflows (runs 41702592022/41702592323, 41704221580/41704221517, and 41706908024/41706907994). General CI and disposable PostgreSQL migration/integration verification passed on commit `3a9369bf`; the buyer product detail now includes an accessible media gallery. Warehouse, stock adjustment, and stock transfer screens are connected to the existing backend APIs.**

Implemented identity capabilities include Turnstile-protected registration, login/logout services, session resolution and revocation, password reset, persistent abuse throttling, scoped server-side authorization, role assignment/revocation, audit events, same-origin JSON mutation protection, a server-only Resend adapter for password reset, and a fail-closed trusted-proxy IP resolver.

**Verification evidence**
- General CI passed on the latest documentation commit `0716f8f43e60771c3702bb6984715915a0a1a665`: [run 41648760634](https://github.com/waelkamira/mtjr2/actions/runs/41648760634). It includes Prisma validate/generate, typecheck, lint, unit tests, and production build.
- PostgreSQL identity integration passed on `0ffb3b4651b06d90c9eecb10eed960c87bae0348`: [run 41647984160](https://github.com/waelkamira/mtjr2/actions/runs/41647984160).
- The existing focused password-reset PostgreSQL lifecycle and general CI evidence is recorded in [Phase 2 execution plan](docs/implementation/PHASE_02_IDENTITY_PLAN.md) and [build log](docs/implementation/BUILD_LOG.md).

**Deferred Phase 2 production exit work (not passed)**
1. Configure both Turnstile keys for the production hostname and verify the challenge.
2. Configure a verified Resend sender for password reset and perform one real delivery smoke test.
3. Verify the trusted proxy header and block direct origin bypass.
4. Run one deployed HTTP journey: register → immediate sign-in → `/api/auth/me` → logout → confirm anonymous access is denied.
5. Record deployment evidence and the focused security review.

These are production-release gates, not blockers for schema/domain development in Phase 3. Continue using only local/disposable/CI PostgreSQL until the owner explicitly approves production database access. No additional helper-level test suites are planned.

Phase 3 execution plan: [Marketplace Core plan](docs/implementation/PHASE_03_MARKETPLACE_PLAN.md).

**Latest Marketplace Core update (2026-11-03)**
- Buyer storefront filters now connect brand, category, market/currency, search, sorting, and pagination to the existing catalog APIs.
- General CI passed for the implementation commit [3bd744a](https://github.com/waelkamira/mtjr2/commit/3bd744a44f5265ab6e41b08168085b7e1b7cbe82) ([run 41693570451](https://github.com/waelkamira/mtjr2/actions/runs/41693570451)).
- No Prisma migration was needed for these UI-only discovery capabilities; the canonical schema already contains the required brand/product and market-price relations.
- Disposable PostgreSQL migration replay remains the next verification gate; no production database was accessed.


**Latest Marketplace Core update (2026-11-03 — product SEO)**
- Added server-generated product metadata using `getDiscoverableProduct`: title, description, canonical URL, Open Graph image, Twitter card, and `noindex` for missing products.
- Commit: `dd725732dab3e7a7a6466254828a9e13467c0ef2`.
- General CI passed on this exact commit: [run 41698547547](https://github.com/waelkamira/mtjr2/actions/runs/41698547547). All quality steps passed, including Prisma validate/generate, typecheck, lint, unit tests, and production build.
- No Prisma change was required: metadata is derived from existing product, translation, store, and media records. No production database or Vercel environment was accessed.
- Remaining Phase 3 blockers are deliberate reference-data decisions (launch markets and taxonomy seed); do not fabricate countries, currencies, categories, or brands. Continue with structured product data/SEO only if the existing product DTO supports it without duplicating domain logic, then close Phase 3 verification and hand off to Buying Core.


## 2026-11-03 — Buying Core 4.1: persistent cart foundation

**Implemented and verified on `feat/buying-cart-core`**

- Added canonical `GuestSession`, `Cart`, and `CartItem` models plus migration `20261103193000_cart_foundation`.
- Enforced exactly one cart owner (customer or guest), unique active carts per owner/market/currency, and cart-line quantity bounds in PostgreSQL.
- Guest sessions use an opaque HttpOnly cookie; only a SHA-256 token hash is persisted. Guest carts merge transactionally into the signed-in customer's matching market/currency carts.
- Added `GET /api/cart`, `POST /api/cart/items`, `PATCH /api/cart/items/[itemId]`, and `DELETE /api/cart/items/[itemId]`.
- Server validates active market/currency, published product, active variant, current price, and available inventory before adding or changing quantities.
- Connected product detail's Add to cart action, homepage cart navigation, and the `/cart` buyer page to the real APIs.
- Added focused tests for guest-token hashing, valid add, quantity bounds, and insufficient stock.
- Cart additions do not reserve inventory; stock is reserved only when the shopper creates a time-limited checkout quote. Shipping, taxes, discounts, payment and order creation remain pending.

**Prisma decision**
- Schema changes are required because the canonical blueprint calls for persistent guest/customer carts and the existing schema had no GuestSession, Cart, or CartItem models. The migration adds only those required records and their ownership/quantity constraints.

**Verification and safety**
- Latest main General CI before this feature passed: run [41699817283](https://github.com/waelkamira/mtjr2/actions/runs/41699817283), including Prisma validate/generate, typecheck, lint, unit tests, and production build.
- Cart foundation verification passed: General CI run [41702592022](https://github.com/waelkamira/mtjr2/actions/runs/41702592022) and disposable PostgreSQL integration run [41702592323](https://github.com/waelkamira/mtjr2/actions/runs/41702592323).
- No owner database was connected, no production migration was run, and no Vercel environment variable was read or changed.

**Next**
1. Complete General CI for `feat/buying-cart-core` and fix only actual failures.
2. Run one disposable PostgreSQL migration/integration check.
3. Record exact results, review, and merge the cart foundation.
4. Continue with checkout quote and reservation lifecycle per `PHASE_04_BUYING_PLAN.md`.

## Buying Core progress — 2026-11-03

### 4.2 Checkout quote and inventory reservation
- Implemented on `feat/checkout-quote-reservations`; PR #2 depends on PR #1.
- Added Prisma `CheckoutQuote` and `CheckoutQuoteLine` plus migration `20261103200000_checkout_quote_reservations`.
- Server calculates item prices from active market product prices, snapshots line details in minor units, and reserves available stock transactionally for ten minutes.
- Added quote create/read/release APIs, idempotency, expiry/release handling, and a connected `/checkout` review page.
- General CI passed: [run 41704221580](https://github.com/waelkamira/mtjr2/actions/runs/41704221580). Disposable PostgreSQL integration passed: [run 41704221517](https://github.com/waelkamira/mtjr2/actions/runs/41704221517).

### 4.2a Delivery address capture
- Implemented on `feat/checkout-address-capture`; PR #3 is stacked on PR #2.
- Added Prisma `UserAddress` and `CheckoutQuoteAddress` plus migration `20261103210000_checkout_address_capture`.
- Added authenticated account address-book APIs and quote-scoped delivery address APIs for guest and signed-in checkout.
- Delivery country is derived from the selected market on the server; the connected checkout UI supports new and saved addresses.
- General CI and disposable PostgreSQL integration are pending for this slice: [PR #3](https://github.com/waelkamira/mtjr2/pull/3).
- Shipping prices, tax, discounts, payments, and order creation are not implemented in this slice. No totals are fabricated.
- No owner database or Vercel environment has been accessed.

See `docs/implementation/PHASE_04_BUYING_PLAN.md` for the next implementation boundary and `docs/implementation/BUILD_LOG.md` for exact evidence.

**Latest Buying Core verification (2026-11-03)**
- Delivery-address capture on the stacked PR #3 branch passed General CI [41706908024](https://github.com/waelkamira/mtjr2/actions/runs/41706908024) and disposable PostgreSQL integration [41706907994](https://github.com/waelkamira/mtjr2/actions/runs/41706907994).
- The quote read/idempotent replay path was also corrected to return its persisted delivery-address snapshot. This is part of the current PR branch and is being re-verified.
- Next: configurable store/market shipping rules and buyer quote shipping selection. No shipping rates, carrier, tax rates, or launch geography are assumed.
- PR #3 remains a draft stacked on PR #2; no PR was merged and no owner database or Vercel environment was accessed.


### Buying Core — latest implementation slice

- Cart, checkout quote/reservations, and delivery-address capture are implemented; address slice General CI and disposable PostgreSQL runs passed ([41706908024](https://github.com/waelkamira/mtjr2/actions/runs/41706908024), [41706907994](https://github.com/waelkamira/mtjr2/actions/runs/41706907994)).
- Configurable store shipping rates and per-store quote selections are now implemented on the stacked branch `feat/store-shipping-options`; Prisma migration, seller workspace, buyer checkout UI, and APIs are connected. Verification is pending.
- Tax, discounts, final checkout totals, order creation, payment, and shipment execution remain incomplete. No production database or Vercel environment was accessed.
- Follow the detailed status and verification gate in [Phase 4 Buying Plan](docs/implementation/PHASE_04_BUYING_PLAN.md).


## Buying Core — shipping and tax progress (2026-11-03)

- Shipping configuration and per-seller checkout selection are implemented on `feat/store-shipping-options` (PR #4). The latest full CI attempt was cancelled; the earlier disposable PostgreSQL migration/integration run passed. Shipping remains marked pending final CI rather than being called verified.
- Started the next vertical slice on `feat/checkout-tax-calculation` (PR #5): platform-managed market/region tax rules, quote-owned tax snapshots, admin configuration UI/API, and buyer checkout tax/estimated-total UI.
- Tax uses explicitly configured basis-point rates and integer minor-unit arithmetic. It does not invent statutory rates. Missing configuration is reported instead of silently treating tax as zero.
- Schema additions: `MarketTaxRate`, `CheckoutTaxSnapshot`; migration: `20261103230000_market_tax_rules`.
- No discounts, order creation, or payment are claimed complete. No owner database or Vercel environment was accessed.
- See `docs/implementation/PHASE_04_BUYING_PLAN.md` for boundaries and limitations.


## Buying Core — order creation and seller split (2026-11-03)

- Implemented on `feat/order-vendor-order-creation` (draft PR #6, stacked on tax PR #5): canonical Order/OrderAddress/VendorOrder/OrderItem and status history models, with migration `20261103233000_order_vendor_order_creation`.
- Checkout confirmation now calls `POST /api/checkout/quote/[quoteId]/place-order`. The server requires a live owned quote, saved delivery snapshot, one shipping selection per store, and a persisted tax snapshot.
- In one serializable transaction, the platform creates one parent order and one vendor order per store, copies immutable item/address/tax/shipping values, consumes inventory reservations and on-hand stock, records SALE inventory movements, converts the quote, and closes the cart.
- Buyer order confirmation/detail and signed-in order history are connected to APIs. Seller workspace now links to a store-scoped seller orders page and API.
- Orders intentionally remain `PENDING_PAYMENT`; no payment or seller fulfillment is simulated. Payment provider and signed webhook lifecycle are next.
- Verification is pending. Only the normal CI and disposable PostgreSQL migration/integration workflows are used; no expanding test matrix. No owner database or Vercel environment was accessed.
- See `docs/implementation/PHASE_04_BUYING_PLAN.md` for workflow boundaries and payment follow-up.


## In-app order notifications (2026-11-03)

- Added `Notification` to the canonical Prisma schema and migration `20261103234000_order_notifications`.
- Added authenticated, user-scoped `GET /api/notifications` and `POST /api/notifications/[notificationId]/read`.
- Added connected `/notifications` page with unread count, open-resource links, and mark-as-read action.
- Order placement now creates buyer and store-owner notifications in the same transaction as order/vendor-order creation. Unique deduplication keys prevent duplicate events on retries.
- This is the in-app order-event foundation only. Email delivery, preferences, retries/outbox, and other event categories remain incomplete.


## Verified product reviews

- Added canonical `ProductReview`, `StoreReview` and `ReviewStatus` models in `prisma/schema.prisma`, with migration `20261104001000_verified_product_reviews`.
- Customers can submit a review only for a delivered order item they own. A unique customer/product constraint enforces one review per customer and product.
- New reviews enter moderation as `PENDING`; only published reviews appear publicly.
- Connected product and store review display/submission, reviewable delivered purchases, customer review history, seller review center and owner responses, and separate admin product/store moderation queues/APIs.
- Store reviews, seller responses, review media, reports/appeals and extended moderation workflows remain future work.


## Customer wishlist and favorites

- Added canonical `Favorite` model to `prisma/schema.prisma` with migration `20261104002000_customer_favorites`.
- Added authenticated list, status, add and remove APIs. Favorites are unique per customer/product and only active approved products can be newly saved.
- Connected the product-detail save control and the customer `/account/wishlist` page to the APIs.
- Guest wishlist merge, named lists and recommendations remain future work.


## Product questions and answers

- Added `ProductQuestion` and `ProductAnswer` models with separate moderation states in `prisma/schema.prisma`; migration: `20261104003000_product_questions_answers`.
- Authenticated customers can submit product questions. Only published questions and answers are publicly visible.
- Active store owners can answer published questions. Admin moderation is permission-protected, audited and sends in-app notifications when questions/answers are published.
- Connected product detail Q&A, `/account/questions`, `/seller/questions` and `/admin/questions` to the APIs.
- Staff-scoped answers, abuse reporting, attachments and richer answer history controls remain future work.


## System 09 — Customer messaging and support

Implementation branch: `feat/customer-support-tickets` · [Draft PR #11](https://github.com/waelkamira/mtjr2/pull/11), stacked on PR #10.

- Canonical persistence: `SupportTicket`, `SupportMessage`, `StoreConversation`, and `StoreMessage`; migrations `20261104010000_customer_support_tickets` and `20261104020000_store_conversations`.
- Customer support: create/list/detail/reply at `/account/support` and `/account/support/[ticketId]`; admin queue at `/admin/support` with status/priority, self-assignment, internal notes and public replies.
- Store messaging: customer inbox/detail at `/account/messages` and `/account/messages/[conversationId]`; seller inbox at `/seller/messages`; product detail starts a store conversation.
- Server-side ownership and participant checks are enforced. Store owners and active staff with exact store-scoped `messages:manage` can access the inbox. Customer-to-store notifications now route to the owner and only authorized active staff.
- Support uses `support:manage`; internal notes are excluded from customer responses. Ticket actions are audited; first-response timestamps and customer/agent read timestamps are persisted; public replies create deduplicated in-app notifications.
- **Remaining external/operational dependencies:** attachment storage and malware scanning require an approved object-storage provider and upload policy; SLA targets/escalation require an agreed response policy and worker; outbound email requires a verified sender and delivery policy. These are not marked complete.
- Verification: disposable PostgreSQL integration passed on earlier PR #11 commit `24f68dd`. CI on that commit exposed a pre-existing order serializer selection mismatch; the three store projections were corrected in commit `26f1ab4`. A further CI and PostgreSQL run is pending on the latest staff-routing update. No production DB or Vercel environment was accessed; no PR was merged.

## Storefront demo experience — implementation branch

Implementation branch: `feat/storefront-demo-experience`, based on System 09 PR #11. This work is not visible on `main` until the stacked PR chain is reviewed and merged in order.

- `prisma/seed.cjs` supports an opt-in, repeatable demo marketplace fixture in the Syria launch market (SYP default; USD is an additional currency within the same market), with active demo sellers/stores, categories, brands, published products, variants, images, warehouses and stock.
- Demo commerce data is seeded only when both `SEED_DEMO_CATALOG=true` and `ALLOW_DEMO_CATALOG_SEED=true` are supplied; it is explicitly blocked when `NODE_ENV=production`. The normal seed continues to create identity roles/permissions only.
- On a disposable/local development database only, run in PowerShell:
  ```powershell
  $env:ALLOW_DEMO_CATALOG_SEED="true"
  $env:SEED_DEMO_CATALOG="true"
  npm run db:seed
  Remove-Item Env:ALLOW_DEMO_CATALOG_SEED
  Remove-Item Env:SEED_DEMO_CATALOG
  ```
- Storefront homepage now presents a visual category grid with imagery, featured-brand filters, visible sign-in/register, wishlist, order, cart, seller, messages and notification entry points. Existing product discovery search, market/category/brand filtering, sorting and pagination remain connected to the canonical APIs.
- Product detail retains variant/market pricing, wishlist, store messaging and add-to-cart API actions.
- No Prisma schema change was needed: all demo records use existing canonical models and constraints. No seed was run against any database during this implementation.
- The seeded demo catalog uses the Syria launch market; it is **not** a tax/legal or payment-provider configuration. Checkout tax and payment still require explicit market/provider policy.

## Storefront release follow-up

1. Review and merge the stacked PRs in dependency order before expecting the changes on `main` or the deployment.
2. Run the opt-in seed only against a disposable/local development database.
3. Verify the public browse/search/product/cart path against that seeded database.
4. Configure real shipping, tax, payment, and email providers only after the launch market and providers are approved.


## Customer returns (System 11)

- Signed-in customers can open **Returns** from their account/order detail pages at `/account/returns`. The first slice accepts return requests for items in delivered seller orders and tracks review status.
- Platform support/admin users with the seeded `returns:manage` permission can review requests at `/admin/returns`.
- The additive Prisma migration is `20261104040000_returns_workflow`; apply it only through the normal reviewed migration process on the intended environment.
- This is a return-request workflow, **not a refund system**. Approving a request or marking goods received does not move money. Refund calculation, payment-provider execution and ledger postings are deliberately deferred until those systems are integrated.
- Return-window policy is not configured yet. Eligibility currently requires a delivered vendor order; evidence upload and return shipping/label flows are also pending.


## Homepage discovery experience

The storefront homepage includes a responsive editorial discovery feature between the hero and live catalog sections. Its browse actions connect to the existing category and product discovery sections; the seller action opens the seller entry page. The editorial tiles are presentation content, not fake inventory or fabricated product listings. Actual catalog cards still come from the products API.

## End-to-end journey implementation rule

Every button, link, form, page, API and business service must be traced as one user journey from the actual interaction through frontend request handling, authentication/validation, domain rules, repository/Prisma persistence, response, and refreshed UI state. See [End-to-End Journey Standard](docs/implementation/END_TO_END_JOURNEY_STANDARD.md). The seller application is the first explicit cross-page acceptance trace in the [Page Route Registry](docs/implementation/PAGE_ROUTE_REGISTRY.md). A Prisma table is added only for a demonstrated missing business state/relation, not simply to support a new page. Journey statuses stay unverified until evidence is recorded for the exact commit.

## Page and route inventory

The 49-system blueprint is paired with a unified page-by-page target and audit registry: [`docs/implementation/PAGE_ROUTE_REGISTRY.md`](docs/implementation/PAGE_ROUTE_REGISTRY.md). Use it to reconcile required pages against the active App Router tree and record each route's audience, owning system, API/service, Prisma entities, implementation status and verification evidence. The registry's initial statuses are provisional; it does not claim every target route already exists or is complete.


## Current implementation audit (2026-11-04)

The active baseline is `main`. Seller-return lifecycle work is implemented on `main`; PR #22 is closed without merge, and its remaining useful saved-address contract correction was reconstructed and merged in PR #77. The visual design foundation was merged in PR #21. The static App Router audit found 30 page routes and 86 API route handlers at the time of that audit. This confirms substantial frontend/backend surface area, but does not mean all routes or user journeys are complete. The route registry records actual paths and missing dedicated targets; the Phase 3 seller acceptance gate and Phase 4 buying verification remain open. See [Build Log](docs/implementation/BUILD_LOG.md) for exact-head CI evidence and current blockers. Continue from [Phase 4 Buying Core](docs/implementation/PHASE_04_BUYING_PLAN.md), not by restarting cart/quote work.
## End-to-end completion rule for all 49 systems

Every visible control must be followed from click/submit through frontend handler, API, validation, authentication and authorization, domain service, Prisma persistence (or documented no-schema-change decision), transaction/idempotency/audit behavior, and final server-confirmed UI result. No dead buttons, fake success, or unfinished capability presented as working. The all-system audit ledger is [`END_TO_END_JOURNEY_MATRIX.md`](docs/implementation/END_TO_END_JOURNEY_MATRIX.md); the required contract is [`END_TO_END_JOURNEY_STANDARD.md`](docs/implementation/END_TO_END_JOURNEY_STANDARD.md). All 49 systems start as Not audited until exact-commit evidence supports their status.


## Payment lifecycle status (2026-11-04)

A provider-neutral payment foundation is being reconstructed on current `main`: canonical `Payment` / `PaymentWebhookEvent` persistence, idempotent order payment intent creation, a provider adapter contract, verified webhook processing, and a buyer order-detail payment entry point. No provider is registered by default and no live charge is enabled. The exact-head CI and disposable PostgreSQL checks must pass before merge; refunds, disputes, settlement reconciliation, and concrete provider onboarding remain incomplete.


## Seller order preparation — 2026-11-04

System 15 has an initial seller-side preparation slice on `feat/seller-order-processing`: paid vendor orders can move through `CONFIRMED → PROCESSING → READY_TO_SHIP` using a store-scoped API and connected seller UI. Writes use the existing Prisma status/history/audit models in a serializable transaction; no schema migration was needed. Shipping labels, tracking, dispatch, delivery, cancellation and refunds are deliberately not exposed until their own workflows are implemented. Exact-head verification is pending.

## Demo catalog database

A guarded, repeatable demo catalog seed is available for isolated development databases. It creates 8 active storefront categories and 80 bilingual demo products (10 per category), with demo sellers/stores, SYP pricing in the single Syria market, product images, variants, and initial stock. USD remains an additional currency within that same market. It does not create fabricated customer reviews or orders.

Setup and safety requirements: [Demo catalog seed guide](docs/implementation/DEMO_CATALOG_SEED.md). Demo seeding requires `SEED_DEMO_CATALOG=true`, `ALLOW_DEMO_CATALOG_SEED=true`, and a separate `DEMO_DATABASE_URL` whose database name includes `demo`, `test`, `ci`, or `dev`; it is blocked in production. No Prisma schema change is needed. Exact-head General CI and disposable PostgreSQL migration/integration plus two consecutive seed runs passed before PR #27 was merged as `0ec09ed`.


## Local product and storefront testing

- Windows/PowerShell local setup using an isolated PostgreSQL `mtjr2_demo` database and the 80-product demo catalog: [Local development guide](docs/development/LOCAL_WINDOWS_SETUP.md).
- The canonical application URL is server-only `APP_URL`; do not use a `NEXT_PUBLIC_*` prefix for server-side configuration.


## Marketplace operations added (2026-11-07)

- Sponsored advertising delivery is wired into product discovery, search, category discovery, and product detail, with campaign moderation, targeting, click/impression tracking, budget enforcement, and monthly invoice generation.
- Advertising invoice settlement is a manual finance confirmation using an external payment reference; no provider charge is initiated by this workflow.
- Return refunds are recorded through an idempotent, balance-limited manual finance workflow after warehouse receipt; payment-success webhook replays cannot overwrite refund states.
- Account session management includes an audited sign-out-all-devices action.
- See [Advertising, refunds, and identity operations](docs/implementation/ADVERTISING_REFUNDS_AND_IDENTITY_RUNBOOK.md) for the operating rules and deployment prerequisites.

- Google OAuth validates RS256 ID-token signatures against Google's JWKS and binds the callback to a one-time nonce; customer registration receives the seeded CUSTOMER role while seller applications remain pending without seller permissions.

- Super Admin global actions now require a fresh, non-replayed TOTP step-up tied to the active session, expiring after ten minutes. Successful checks are audited. Added the session migration and verification flow; PR #60 merged after CI, PostgreSQL integration, and browser E2E all passed. See [Build Log](docs/implementation/BUILD_LOG.md) for exact commit and run evidence.


## Super Admin governance verification — 2026-11-07

- Super Admin privilege elevation now enforces independent review: neither the requester nor the target can approve/reject; an independent Super Admin reviewer is required.
- Browser and PostgreSQL tests verify denial before approval, independent approval, the persisted global role, audit history, and mandatory MFA enrollment before the newly elevated account can enter platform administration.
- Access catalogue, audit log, and AI assistant settings pages are included in the Super Admin browser journey. The AI settings API does not expose the provider secret.
- Latest exact-head CI inventory: 105/105 state-changing API handlers have request/system-boundary evidence (0 requiring review); 54/54 mutation-bearing UI files have success and error feedback (0 requiring review).
- PR #64 merged as `84ae9ecec4ecd2796533dd3551d346ee43fb5849` after General CI, disposable PostgreSQL integration (9 tests), and browser E2E passed. See [Build Log](docs/implementation/BUILD_LOG.md) for run links.
- This is source/CI verification, not a production release. Production secrets, external provider credentials, Vercel deployment quota, and live provider smoke tests remain separate operational gates.


## 2026-11-07 — API anonymous-boundary hardening

- PR #68 is merged into main as 16b185f765d4e7dbf68ee25907c41d17efbbea45. Coupon/search-synonym admin reads and four cron workers now fail closed with explicit authorization responses. The 165 route/method anonymous boundary sweep, General CI, and Browser E2E passed on exact PR head 2207295893cde027e123518ea9b29a169dcc0cc0 (runs [42403107066](https://github.com/waelkamira/mtjr2/actions/runs/42403107066) and [42403107025](https://github.com/waelkamira/mtjr2/actions/runs/42403107025)). This does not replace role/ownership/store-scope testing. Main post-merge CI is pending; no production deployment or database access was performed.


## 2026-11-07 — Financial lifecycle verification gate

- Fixed Platform PostgreSQL Integration path filters so payment, webhook, refund, seller shipment, order and return code changes trigger disposable PostgreSQL verification. The corrected integration workflow passed migration replay, 3 files / 9 tests and repeatable demo seeding on main commit `0d0fab6f47fdf49396022331f77f5612616a8d44` ([run 42404238983](https://github.com/waelkamira/mtjr2/actions/runs/42404238983)). General CI passed on documentation/route-registry head `f05480a83fe3126f0183e51f990e47216fb14098` ([run 42404307099](https://github.com/waelkamira/mtjr2/actions/runs/42404307099)). Live payment/refund provider onboarding and carrier integration remain blocked on explicit launch-market, currency, merchant-account, payment-method and provider decisions.


## Canonical main reconciliation — 2026-11-07

The earlier sections above are chronological implementation notes; use the following as the current release-gate snapshot. The 49-system journey ledger has been reconciled with merged CI, PostgreSQL and browser evidence in [END_TO_END_JOURNEY_MATRIX.md](docs/implementation/END_TO_END_JOURNEY_MATRIX.md).

- PR #64 merged Super Admin independent privilege review, mandatory MFA-after-elevation gating, and customer/seller/buyer/Super Admin browser journeys. Exact PR-head General CI, disposable PostgreSQL (3 files / 9 tests), and Browser E2E passed.
- PR #68 merged anonymous API boundary hardening. Its 165 route/method cases, General CI and Browser E2E passed on exact PR head. This is not a substitute for role, ownership, staff-scope or cross-tenant authorization verification.
- Advertising is delivered in product discovery, search, category discovery and product detail; event tracking, deduplication, campaign budgets, spend ledger, invoice generation and manual invoice settlement are implemented. No live advertising payment provider is connected.
- Buyer checkout browser coverage reaches order confirmation through cart, address, shipping and tax; the resulting order is pending payment. No live payment provider is connected.
- Financial PostgreSQL integration passed migration replay, 3 integration files / 9 tests and two repeatable demo-seed runs on `0d0fab6f47fdf49396022331f77f5612616a8d44` (run [42404238983](https://github.com/waelkamira/mtjr2/actions/runs/42404238983)). General CI passed on `f05480a83fe3126f0183e51f990e47216fb14098` (run [42404307099](https://github.com/waelkamira/mtjr2/actions/runs/42404307099)). These are preceding commits, not exact-head checks for the latest docs commit.
- Latest observed main commit is `1d458f0b43db43012913c5351c9754daeb153062`. Its Vercel status is blocked by the provider's build/deployment rate limit. Do not interpret this as a successful deployment or an application compilation failure.
- No production database, production secret, live payment/refund/carrier provider, or deployment setting was accessed or changed in this reconciliation.

Remaining release gates: reconcile all 49 system rows individually; complete actor/ownership/store-scope and cross-tenant authorization tests; complete the missing route-level customer/seller/admin browser journeys; resolve Vercel quota; and explicitly decide launch-market/provider credentials before any live payment, refund or carrier integration. Do not mark the marketplace globally complete while these gates remain open.



## Latest verified progress — 2026-11-08

- Password registration and immediate-session policy was merged into the sole canonical source, `main`, as commit `fde3b47b098b1f15ed40a141b6c66b9a6c237946` (PR #78).
- Exact source-head General CI, disposable PostgreSQL, and Browser E2E passed before merge. Fresh workflows triggered by the merge are recorded in `docs/implementation/BUILD_LOG.md`; do not claim their final result until all three complete.
- Buyer checkout browser journey reaches a persisted order in `PENDING_PAYMENT`; payment capture is not simulated. Real payment/refund/carrier provider work remains conditional on explicit launch-market, currency, merchant and provider decisions.
- Identity code is implemented further, but Phase 2 is not closed: real Turnstile/Resend/trusted-proxy configuration and one deployed HTTP identity journey remain release gates.
- No production database, Vercel configuration, production secrets, or deployment was changed.


## Customer account completion — 2026-11-08

Saved address management is now complete at source level on `main`: customers can add, edit, set a default, and delete saved addresses. The service enforces owner scope and atomic default transitions; checkout snapshots remain unchanged. PR #79 and its General CI, PostgreSQL, and Browser E2E workflows passed, and merged-main General CI passed. Phase 2 still has deployment-only identity gates and is not marked complete.
