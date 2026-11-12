# Platform Page-to-System Map

**Project:** Mtjr2 — Global multi-vendor marketplace  
**Purpose:** One canonical placement map connecting the 49 business systems to the pages where each audience actually uses and operates them.  
**Companion documents:** [49-system blueprint](COMPLETE_PLATFORM_SYSTEMS_BLUEPRINT.md) · [page inventory](PLATFORM_PAGE_INVENTORY.md) · [journey matrix](../implementation/END_TO_END_JOURNEY_MATRIX.md) · [route registry](../implementation/PAGE_ROUTE_REGISTRY.md) · [Prisma model map](PRISMA_MODEL_USAGE_MAP.md)

> This is the target information architecture, not a claim that all routes or workflows are implemented. Use the route registry and journey matrix for actual source presence and verification status. A system can span several surfaces; it must still have one owning domain/service and one permission policy.

## Detailed page and control specification

This map is the concise system-to-route ownership index. For the complete page-by-page contents, root-admin/domain-admin controls, role boundaries, global-marketplace gaps, sign-in/session/logout flow and release gates, see [`GLOBAL_PLATFORM_PAGE_AND_CONTROL_SPEC.md`](GLOBAL_PLATFORM_PAGE_AND_CONTROL_SPEC.md).

## 1. Product and navigation architecture

### Public storefront (anonymous and signed-in buyers)

The global storefront shell belongs on all public and buyer pages:
- **Header:** brand/home, global search, category/brand discovery, market/currency selector, account/sign-in, favorites, cart, and a responsive menu.
- **Primary navigation:** Shop, Categories, Brands, Stores, Sell on Mtjr2. Keep the number of top-level items small; do not put operational/admin destinations in public navigation.
- **Footer:** Help, Contact, FAQ, approved legal/policy pages, seller entry, accessibility, and status/help links.
- **Contextual controls:** product/store actions stay on their relevant detail pages; filters stay with the listing/search they affect.

### Buyer account

Use a protected account shell with a persistent account sidebar/menu. Do not make buyers navigate through the seller or admin workspace to manage personal orders, addresses, returns, or messages.

### Seller center

Use a separate protected seller shell and store-scoped navigation. Each seller account may own exactly one store (`Store.sellerId` is unique); the server resolves ownership or active staff membership and the exact store scope for every query and mutation. Do not expose seller-only controls on the public store page.

### Platform administration and operations

Use a separate restricted admin shell. Split routine moderation/customer support from finance, security, and global operations permissions. Sensitive finance, provider, risk, audit, and infrastructure controls should live under restricted operations routes (for example `/admin/finance/*` and `/admin/operations/*`) rather than appearing to every administrator.

### Separate property domain

Property listings and booking remain a separate bounded context and separate navigation entry/experience. Share identity, notifications, audit, and other genuinely common platform capabilities; do not mix property listings, booking requests, or their payments into product catalog/cart/order routes.

## 2. The 49 systems and their owning pages

| # | System | Primary user-facing / operational pages | Where its controls belong |
|---:|---|---|---|
| 01 | Identity, authentication and customer account | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/account`, `/account/profile`, `/account/security`, `/account/sessions`, `/account/addresses` | Public auth pages; account profile/security; global account menu. Registration activates immediately without email verification. Platform administration requires MFA and permission checks. |
| 02 | Product catalog and discovery | `/`, `/products`, `/products/[slug]`, `/categories`, `/categories/[slug]`, `/brands`, `/brands/[slug]`, `/stores`, `/stores/[slug]` | Public storefront listings and detail pages; create/edit controls only in seller product workspace; moderation in admin catalog. |
| 03 | Search, filtering and sorting | `/search`, `/products`, category/brand/store listing pages; admin synonym/ranking controls | Global header search opens `/search`; scoped search/filter panels remain on each listing; admin tuning under `/admin/catalog/search`. |
| 04 | Cart and checkout | `/cart`, `/checkout`, checkout confirmation / order detail | Cart icon and product add-to-cart; checkout owns address, shipping, tax, discounts, payment and final confirmation steps. |
| 05 | Orders and order tracking | `/account/orders`, `/orders/[orderId]`, seller `/seller/orders`, `/seller/orders/[orderId]` | Buyer sees parent order and vendor shipment breakdown; each seller sees only its own vendor order; admin sees cross-store order operations. |
| 06 | Product and store reviews | Product detail review panels, `/account/reviews`, `/stores/[slug]`, `/seller/reviews`, `/admin/reviews`, `/admin/store-reviews` | Buyers submit only in eligible contexts; seller replies in seller center; publication/moderation in admin queues. |
| 07 | Wishlist, favorites and recommendations | Product-card/detail favorite control, `/account/wishlist`, recommendation sections on home/product detail | Favorite toggle on product surfaces; saved list in account; recommendations are contextual and must not be presented as personalized until backed by real logic/data. |
| 08 | Product questions and answers | Product detail Q&A, `/account/questions`, `/seller/questions`, `/admin/questions` | Ask on product page; buyer history in account; store-scoped answer inbox in seller center; moderation in admin. |
| 09 | Customer messaging and support | `/account/messages`, `/account/messages/[conversationId]`, `/account/support`, `/account/support/[ticketId]`, seller messages, `/admin/support` | Store conversation starts from product/store page; buyer inbox and platform tickets stay distinct; seller sees only its store conversations; support staff use restricted queue. |
| 10 | Customer notifications | `/account/notifications` (or one consistent `/notifications` route), seller notification center, admin delivery view | Bell/inbox in relevant authenticated shell; preferences under account/seller settings; delivery operations under admin/operations. Avoid duplicate competing inbox routes. |
| 11 | Returns and refunds (customer journey) | `/account/returns`, `/account/returns/[returnId]`, order detail, `/admin/refunds` | Return action appears only for eligible delivered items; buyer tracks request; seller/admin review in their respective queues. Finance creates refunds only after physical receipt and explicitly submits to the original Stripe/PayPal provider; asynchronous provider states are reconciled before Payment status changes. No seller-ledger reversal is implied. |
| 12 | Seller onboarding, verification and KYC | `/sell`, `/seller`; `/admin/sellers`, `/admin/sellers/[sellerId]` | Public seller explainer and the application/status workflow embedded in the protected seller workspace; verification documents and decisions in restricted admin review. |
| 13 | Seller dashboard and analytics | `/seller` | Seller landing page with real sales/order/stock summaries and actionable alerts; no fabricated metrics. |
| 14 | Seller product management | `/seller/products` | Seller center has an integrated draft-creation and edit studio with category-dependent attributes, variants, market prices and product media; product detail page remains buyer-facing; approval queue belongs to admin catalog. |
| 15 | Seller order management | `/seller/orders` | Seller sees authorized vendor-order cards with item breakdown, paid-order delivery details, permitted fulfillment transitions and shipment/tracking controls; never expose other stores' vendor orders. A separate detail route is not required while the full workflow remains inline. |
| 16 | Seller inventory and warehouse management | `/seller/inventory` | One seller inventory workspace includes warehouse creation, stock adjustments, transfers and movement history; mutations require audit, concurrency control and reason capture. |
| 17 | Supplier and procurement management | `/seller/suppliers`, `/seller/purchase-orders`; restricted operations procurement | Seller procurement only if marketplace business model supports seller-managed suppliers; platform procurement belongs in operations, not buyer pages. |
| 18 | Shipping and fulfillment (seller) | `/seller/shipping`, `/seller/orders` | Seller configures supported store/market rates and fulfils vendor orders from the order workspace; carrier integrations/labels are not implied by seller-entered tracking details. |
| 19 | Seller finance, commissions and payouts | `/seller/finance`, `/seller/commissions`, `/seller/payouts`; admin `/admin/seller-payout-methods`; `/admin/finance/ledger` | `/seller/finance` is a read-only per-currency sales/commission/completed-refund overview; `/seller/commissions` exposes immutable commission snapshots and separate refund allocations; `/seller/payouts` manages encrypted, masked IBAN beneficiary records only, with separate manual admin verification. None of these pages represents seller payable/withdrawable balance or executes a transfer. Double-entry journal is currently read-only for platform admins; FIN-01..12 decisions still gate payment/refund posting, seller payable, holds, settlement, reconciliation and withdrawal. |
| 20 | Seller marketing and promotions | `/seller/advertising` | Store-scoped campaign draft, moderation, spend caps and invoices are exposed; live placement, delivery attribution and full promotions/coupon authoring remain separate capabilities and must not be implied. |
| 21 | Seller reviews and reputation | `/seller/reviews`, seller dashboard reputation panel, public `/stores/[slug]` | Seller responses and reputation analytics in seller center; public display only published, policy-compliant reviews. |
| 22 | Seller staff and scoped permissions | `/seller/staff`, invitation/acceptance pages, `/seller/settings` | Store owner manages staff and exact store-scoped permissions; platform roles remain in admin security. |
| 23 | Store management and settings | `/seller` (embedded store setup/status), public `/stores/[slug]` | Seller application, initial store setup, active-store context, warehouse and shipping configuration are embedded in the workspace. A dedicated profile/policy settings surface remains a separate gap; each seller account is limited to one owned store. |
| 24 | Platform admin dashboard / command center | `/admin` | Restricted operational overview with role-filtered queues, alerts and real metrics; not a public landing page. |
| 25 | User administration | `/admin/users`, `/admin/users/[userId]` | Authorized support/security/admin actions with audit trail; never expose credential secrets. |
| 26 | Seller administration and KYC review | `/admin/sellers`, `/admin/sellers/[sellerId]` | Application queue, verification evidence, approval/rejection/suspension and audit history. |
| 27 | Catalog administration | `/admin/categories`, `/admin/brands`, `/admin/products`, `/admin/products/[productId]` | Taxonomy, brand and product moderation; changes must invalidate/reconcile public discovery caches. |
| 28 | Central order operations | `/admin/orders`, `/admin/orders/[orderId]` | Cross-store investigation, exception handling and audited interventions; no silent edits to purchase snapshots. |
| 29 | Payment administration | `/admin/payments`, `/admin/payment-providers`, payment detail | Finance-restricted provider health, intent/webhook state and investigation. Buyer payment method/checkout UI is separate. |
| 30 | Commission management | `/admin/commissions`, commission rules/detail | Finance admin configures effective-dated rules; seller sees resulting statements only. |
| 31 | Accounting and general ledger | `/admin/finance/ledger`, journal/transaction detail, reconciliation | Finance-only double-entry ledger and reconciliation; never editable from buyer/seller order screens. |
| 32 | Payout administration | `/admin/payouts`, payout detail/approvals | Finance operations approve/reconcile payouts; seller payout page is a read-only counterpart. |
| 33 | Returns, refunds and disputes administration | `/admin/returns`, `/admin/refunds`, `/admin/disputes` | Return receipt gates finance refund creation; Stripe/PayPal provider execution uses idempotency and provider status reconciliation. Manual external confirmation is the exception path. Disputes and general-ledger/seller-payable reversal remain separate, unimplemented workflows. |
| 34 | Shipping administration | `/admin/shipping`, carrier/provider configuration | Platform shipping policies, provider configuration and exceptions; seller rates remain under seller shipping. |
| 35 | Tax and regulatory compliance | `/admin/tax-rates`, `/admin/compliance`, tax reports | Restricted tax configuration and evidence; checkout displays calculated tax snapshots; legal/jurisdiction rules require approved data. |
| 36 | Promotions, coupons, loyalty and gift cards | `/admin/promotions`, `/admin/coupons`, `/admin/loyalty`, buyer `/account/loyalty` | Admin defines global programs; sellers may manage allowed store promotions; buyer redeems at cart/checkout and views balance in account. |
| 37 | Review moderation | `/admin/reviews`, `/admin/store-reviews`, `/admin/questions` | Restricted moderation queues with reason, audit, appeals and publication state; seller response remains in seller center. |
| 38 | Central customer support | `/admin/support`, ticket detail/queue; buyer support pages | Staff queue, assignment, priority, internal notes and replies; internal notes must never reach customers/sellers. |
| 39 | CMS and content administration | `/admin/content`, `/admin/banners`, `/admin/pages`; public home/help/content pages | Admin authors approved content; public pages render published content only. Homepage hero/banner controls belong here, not hard-coded admin toggles. |
| 40 | Platform settings and governance | `/admin/settings`, `/admin/roles`, `/admin/permissions`, `/admin/feature-flags`, `/admin/audit-log` | Split by security/configuration permission; high-risk changes require confirmation, audit and safe rollout. |
| 41 | Global markets, currency, FX and localization | Header market/currency selector; `/admin/markets`, `/admin/currencies`, `/admin/locales` | Buyer selects only active supported markets/currencies; admin maintains reference data and effective rates. Never invent launch markets or FX. |
| 42 | Invoicing and credit notes | `/account/invoices`, `/seller/invoices`, `/admin/invoices` | Buyer/seller download issued documents; finance controls numbering, issue/void/credit-note workflow and jurisdictional rules. |
| 43 | Analytics and reporting | `/seller/analytics`, `/admin/reports`, restricted finance/operations reports | Each dashboard declares source, time zone, filters and freshness; financial totals reconcile to ledger/orders, not arbitrary UI aggregates. |
| 44 | External integrations and provider adapters | `/admin/integrations`, `/admin/payment-providers`, `/admin/shipping-providers`, integration detail | Secrets remain server-side; admin sees connection/health metadata, never raw credentials. Provider actions are gated by explicit configuration. |
| 45 | Background jobs, event processing and outbox | `/admin/operations/jobs`, `/admin/operations/events`, dead-letter/retry detail | Operator-only monitoring, replay and retry with idempotency; customer/seller pages show resulting domain status, not job controls. |
| 46 | Security, audit and platform risk controls | `/admin/security`, `/admin/audit-log`, `/admin/risk`, incident controls | Restricted security roles; immutable audit, risk cases, session/security actions and incident workflow. |
| 47 | SEO and public discovery | Public product/category/brand/store pages; `/sitemap.xml`, `/robots.txt` | SEO is generated from canonical published data; admin may edit approved metadata via catalog/CMS but not publish hidden products. |
| 48 | Newsletter and lifecycle email | Public newsletter signup, `/account/notifications` or preferences, `/admin/marketing/email` | Consent/preferences belong to user account; campaign and delivery operations restricted; unsubscribe and consent history mandatory. |
| 49 | Property listings and booking domain | `/properties`, `/properties/[slug]`, `/property/submit`, `/account/property-requests`, `/property-owner/*`, restricted admin property/requests | Separate property owner/agent and booking workflows; never reuse product cart/order semantics without a separately approved domain model. |

## 3. Recommended navigation menus

### Public header
1. Logo → `/`
2. Shop → `/products`
3. Categories → `/categories`
4. Brands → `/brands`
5. Stores → `/stores`
6. Search field → `/search?q=...`
7. Market/currency selector
8. Account → `/account` when signed in, otherwise `/login`
9. Favorites → `/account/wishlist` when signed in
10. Cart → `/cart`
11. Sell → `/sell`

Only show destinations that exist and whose primary workflow is usable. If a page is not ready, hide the link or show a clearly disabled "Coming soon" item outside the primary task flow.

### Buyer account menu
Overview, Profile, Addresses, Orders, Favorites, Reviews, Questions, Messages, Notifications, Returns, Support, Security, Invoices (only when implemented), Loyalty (only when implemented), Sign out.

### Seller center menu
Dashboard, Store, Products, Orders, Inventory, Warehouses, Shipping, Returns, Reviews, Questions, Messages, Staff, Notifications, Analytics, Finance, Promotions, Settings. Hide or disable sections whose service/provider is not available; do not show empty fake dashboards as operational.

### Admin menu
Overview, Users, Seller/KYC, Stores, Catalog, Categories/Brands, Orders, Payments, Returns/Refunds/Disputes, Reviews/Q&A, Support, Markets/Currencies/Locales, Shipping, Tax/Compliance, Promotions, CMS, Finance/Ledger/Commissions/Payouts, Reports, Integrations, Jobs/Events, Security/Risk/Audit, Settings. Menu visibility must follow server-resolved permissions; hiding a link is not a substitute for API authorization.

## 4. Dependency-aware delivery order

The 49 systems are not 49 independent page projects. Deliver vertical slices in this order:

1. **Foundation and identity:** secure session, roles, scope, consent, audit, shell, error/loading patterns.
2. **Marketplace core:** approved market/reference data → seller/store onboarding → taxonomy/brand → product lifecycle/media/variants/pricing → inventory availability → public catalog/store pages → search/filter/sort.
3. **Buying core:** guest/customer cart → checkout quote → address → shipping selection → tax snapshot → payment provider and verified webhook → transactional order/vendor-order creation → confirmation/history.
4. **Fulfillment and post-purchase:** seller order workflow → shipment/tracking → delivery → customer returns → refund/dispute execution → invoices/credit notes.
5. **Trust and engagement:** reviews/Q&A → messaging/support → notifications → favorites/recommendations → promotions/loyalty/newsletter.
6. **Seller and platform operations:** staff scope, procurement, commissions, ledger, reconciliation, payouts, analytics and reporting.
7. **Global governance and scale:** localization/FX, tax/customs, CMS, integrations, outbox/jobs, SEO, security/risk and operational readiness.
8. **Separate property domain:** only after shared platform contracts are stable; separate schema/services/pages.
9. **Release readiness:** exact-head critical journeys, security and operational checks, backups/restore, deployment and runbooks.

A dependency may be developed earlier when needed, but its acceptance is recorded against the complete owning system. Do not mark a whole system complete when only its first slice is ready.

## 5. Cross-page ownership and implementation rules

- Every page has one audience, one route owner and an explicit access policy: public, customer, seller-owner, store-scoped staff, support, finance, security, admin or operations.
- Every page action maps to a method/path, validation schema, session and permission guard, domain service, repository/Prisma models, transaction/idempotency rule, and server-confirmed UI result.
- The UI never writes directly to Prisma. Reuse domain services; do not duplicate business logic in page components.
- Store IDs, user IDs, seller IDs, prices, currency, tax, discounts, shipping and order totals are resolved or validated on the server.
- Use existing Prisma models where they represent the business fact. Add a model/migration only for a demonstrated missing durable state or relation; update the Prisma model map and migration evidence.
- Lists require bounded pagination, stable sorting, filters and empty/error states.
- All menus, cards, filters, buttons, forms and row actions must work or be disabled/hidden with a clear reason.
- No fake live products, order totals, sales, review counts, shipping promises, tax amounts, payment/refund/payout success or launch-market claims.
- Do not expose provider secrets, internal support notes, cross-store orders, private KYC documents or privileged audit/security data.
- Property booking is not product checkout.

## 6. Reconciliation checklist (update on every slice)

For each affected system and page, record:
1. System number and accountable domain/service.
2. Target route and actual source file (or explicitly "not implemented").
3. Navigation entry point and intended audience.
4. API method/path and validation.
5. Authentication, role, resource-scope and ownership checks.
6. Prisma models/migration, or explicit reason no schema change is needed.
7. Primary action and server-persisted outcome.
8. Loading, empty, validation, forbidden, not-found, conflict, network and server-error behavior.
9. One critical end-to-end journey plus focused tests for money, stock, authorization, ownership, idempotency or concurrency boundaries.
10. Exact branch/commit and CI/database/browser evidence; record gaps in the journey matrix and build log.

**Status vocabulary:** Target = planned placement; Present = route/source exists; Wired = route uses the intended API/service; Verified = critical journey and security/persistence evidence passed on the exact commit. Never infer a later status from an earlier one.

## 7. Initial audit notes (2026-11-04)

- The existing page inventory is useful but is a target list; the route registry separately records source presence and known gaps. Keep both and use this document to resolve system-to-page ownership.
- The route registry's audited snapshot reports public storefront, account, seller and admin routes as a mixture of present, missing and implemented/unverified. Re-run the filesystem audit on the active branch before claiming route counts.
- Buyer account notifications currently have inconsistent route naming in project notes (`/notifications` versus `/account/notifications`); standardize on `/account/notifications` and retain a redirect only if the older route is already linked or bookmarked.
- Seller onboarding must distinguish application status from active seller permissions. Pending applicants must not gain seller workspace capabilities.
- Checkout and orders are separate buyer journeys: checkout creates an order only after a valid quote and configured payment success policy; order detail is the post-purchase record. Never claim order completion merely because a quote was created.
- Seller order pages operate on vendor orders, while buyer order pages operate on parent orders. Admin order operations may inspect both under separate permission.
- Return approval is not refund execution. Payment administration, refund execution, disputes, ledger, reconciliation and payouts require provider/finance workflows.
- Some routes in the older registry use `[id]` while canonical public links use `[slug]`; keep stable public slugs and opaque internal IDs in protected management routes.
- The existing main README records a separate property domain and a 49-system blueprint. Preserve that boundary.

**Audit status:** This map is an architecture/documentation update. It does not certify any of the 49 systems or any route as complete. The next implementation pass must reconcile it with the actual active branch and update the journey matrix, route registry and build log with exact evidence.
