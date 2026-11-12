# Platform End-to-End Journey Matrix — 49 Systems

**Canonical system scope:** `docs/architecture/COMPLETE_PLATFORM_SYSTEMS_BLUEPRINT.md`  
**Universal execution contract:** `docs/implementation/END_TO_END_JOURNEY_STANDARD.md`  
**Page/route registry:** `docs/implementation/PAGE_ROUTE_REGISTRY.md`  
**Prisma ownership map:** `docs/architecture/PRISMA_MODEL_USAGE_MAP.md`  
**Baseline:** `feat/returns-workflow`, 2026-11-04.

## Purpose and non-negotiable rule

This matrix applies the end-to-end rule to **all 49 systems**. It is a work ledger, not a claim that the listed journeys already work. Every system remains not audited until its real user journeys and every visible action have been traced and verified. No system is complete merely because its page, API, Prisma model, or unit test exists.

A visible control must either:
- complete a real, authorized workflow and show the server-confirmed result; or
- be clearly marked unavailable/coming later and disabled or removed from the active user journey.

No inert buttons, fake data presented as live, optimistic success without persistence, client-only business writes, placeholder payment/refund/payout success, or navigation to missing pages.

## 49-system audit ledger

| # | System | Journey audit | Entry points mapped | Action-to-API trace | Prisma impact reviewed | Exact-commit evidence |
|---:|---|---|---|---|---|---|
| 01 | Identity, authentication and customer account | Implemented / unverified — immediate-activation password registration, recovery, logout, buyer/seller account choice, Google OIDC+PKCE, TOTP MFA, sessions and customer account pages | `/login`, `/register`, `/terms`, `/privacy`, `/forgot-password`, `/reset-password`, `/account`, `/account/profile`, `/account/security`, `/account/sessions`, `/account/addresses`, `/account/orders`, `/account/favorites`, `/account/store`, `/seller` | Partial — registration stores policy v1 consents, requires Turnstile, and creates an active account/session without email verification; seller choice creates a pending Seller record without permissions. Google callback creates/uses OAuthAccount and session. Platform administrators require TOTP enrollment and fresh verification for permission-protected operations. Saved-address country-code and response-shape contract corrected in PR #77; full customer identity/address browser journey and Google provider configuration remain pending. | User, Seller, OAuthAccount, UserConsent, UserSession, UserTwoFactor, UserTwoFactorRecoveryCode, UserAddress, Favorite and related models; no new schema or migration was needed for the address fix. | Focused saved-address service tests pass. Exact-head CI, disposable PostgreSQL integration and Browser E2E all pass on PR #77 head; these checks do not prove the full identity/address browser journey or live Google provider callback. |
| 02 | Product catalog and discovery | Mapped / partially wired — server-rendered catalog, product detail, category/brand/store surfaces exist; not release-verified | `/`, `/products`, `/products/[slug]`, `/categories`, `/categories/[slug]`, `/brands`, `/brands/[slug]`, `/stores`, `/stores/[slug]` | Partial — public reads require active/approved products and active sellers/stores; detail includes safe media, market prices, localized attributes and SEO. Product detail wires cart, favorite, store message, reviews and Q&A; action journeys remain unverified. | Product, ProductCategory, ProductTranslation, ProductMedia, ProductVariant, ProductPrice, ProductAttribute, VariantAttribute, Category/Translation, Brand/Translation, Store, Seller, Market/Currency; no schema change | Focused catalog tests and typecheck pass in the current worktree. No exact-head PostgreSQL/browser verification; product attribute authoring and structured offers remain open. |
| 03 | Search, filtering and sorting | Implemented at source level / not release-verified | `/search`, `/products`, homepage discovery controls, header autocomplete, `/admin/search-synonyms` | Prisma-backed public discovery supports localized synonyms, typo-tolerant trigram relevance, category/brand/market/store filters, currency-aware price and stock filters, facets, stable bounded pagination, URL state and suggestions. Search endpoints are rate-limited; admin synonym CRUD is permission-protected and audited. | SearchSynonym, Product/ProductTranslation, ProductCategory, Brand, Category, Store/Seller, ProductVariant/ProductPrice, Inventory, Market/Currency | All 182 tests pass with repository environment loaded; ESLint passes for changed search files. Whole-app typecheck/build remain blocked by existing errors in `src/server/wishlist/recommendations.ts`. No PostgreSQL migration/runtime or browser journey has been run. |
| 04 | Cart and checkout | Implemented at source level / not release-verified | `/cart`, `/checkout`, quote/address/shipping/tax/order APIs, coupon admin APIs | Guest/customer carts merge idempotently; cart uses server-validated variants, prices and stock; quotes reserve inventory; address, per-store shipping, configured tax and percentage/fixed coupons are snapshotted; serializable order creation consumes stock, allocates discounts/tax to vendor orders and records coupon redemption. No payment is collected at order placement. | GuestSession, Cart/CartItem, Inventory/InventoryReservation/InventoryMovement, CheckoutQuote/Address/Shipping/Tax, Coupon/CouponRedemption, Order/VendorOrder/OrderItem | 25 focused tests across cart, checkout quotes/coupons, order placement, and tax pass; typecheck passes; changed checkout files pass ESLint with one pre-existing `<img>` warning. Coupon migration is applied to local `mtjr2_demo`; checkout-specific browser journey remains pending. |
| 05 | Orders and order tracking | Implemented at source level / full lifecycle journey verification pending | `/account/orders`, `/orders/[orderId]`, `/seller/orders` | Buyer history/detail include parent and vendor status timelines. Cancel is restricted to pending-payment orders with no payment attempt and atomically restores stock/releases coupon redemption. Reorder validates all prior variants against current market, price and stock and adds all-or-none. Sellers create one manual shipment per vendor order and append forward-only tracking events; order status aggregates all seller shipments. Invoices, carrier integrations and paid-order refunds are deferred. | Order, OrderAddress, OrderItem, OrderStatusHistory, VendorOrder, VendorOrderStatusHistory, Shipment, ShipmentTrackingEvent, InventoryMovement, Cart/CartItem, CouponRedemption | Focused order/checkout tests and TypeScript check pass. Migration applied to local `mtjr2_demo`; PostgreSQL table/enum check and existing integration suite pass. Browser journey and database-backed cancellation/shipment lifecycle tests remain pending. |
| 06 | Product and store reviews | Partial / source implementation present; customer, seller and moderation journeys not verified | Product detail and `/stores/[slug]`; `/account/reviews`; `/seller/reviews`; `/admin/reviews`, `/admin/store-reviews`; review/report/appeal APIs | Verified-order submissions and one-review constraints are retained. Up to five unique HTTPS image references are validated and saved atomically (no file upload). Authenticated one-per-user reports and author-only one-time appeals enter audited admin queues; decisions hide/dismiss or restore/uphold. Active exact-store `reviews:manage` staff can answer published store reviews. | `ProductReview`, `StoreReview`, `ReviewMedia`, `ReviewReport`, `ReviewAppeal`, `AuditLog`; additive migration `20261105014200_review_media_reports_appeals` created, not applied | Ten focused review unit tests pass; Prisma schema validates. Typecheck passes against a generated client in a temporary output directory. Migration replay against disposable PostgreSQL, report/appeal route tests, and browser journeys remain pending. |
| 07 | Wishlist, favorites and recommendations | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 08 | Product questions and answers | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 09 | Customer messaging and support | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 10 | Customer notifications | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 11 | Returns and refunds (customer journey) | Partial / source workflows present; full customer-to-refund journey not release-verified | `/account/returns`, `/seller/returns`, `/admin/returns`, `/admin/refunds`; customer request → store-scoped item decision → physical receipt into quarantine → finance refund request → second-operator manual/provider execution and reconciliation | ReturnRequest, ReturnItem, Order, VendorOrder, OrderItem, Inventory/InventoryMovement, Refund/RefundItem, Payment, AuditLog | Receipt writes quarantine inventory and item-level RECEIVED state atomically. Refund request is limited to physically received items, locks the order, reserves prior committed refund quantities/amounts, and caps refunds at captured payment. Refund merchandise basis now uses the same deterministic vendor coupon allocation as commission snapshots. | Refunds exclude shipping/tax and do not reverse commissions or post ledger entries; those are policy-gated. Exact-HEAD tests, PostgreSQL and browser journey still pending; no live provider action verified in this audit. |
| 12 | Seller onboarding, verification and KYC | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 13 | Seller dashboard and analytics | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 14 | Seller product management | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 15 | Seller order management | Seller preparation and manual tracking implemented at source level | `/seller/orders`, `PATCH /api/seller/orders/[vendorOrderId]/status`, `POST /api/seller/orders/[vendorOrderId]/shipment`, `POST /api/seller/orders/[vendorOrderId]/tracking-events` | Session-derived store ownership / exact `orders:manage`; paid `CONFIRMED → PROCESSING → READY_TO_SHIP → SHIPPED → DELIVERED`; shipment event transitions are forward-only and parent status derives from all vendor orders | VendorOrder and histories, Shipment, ShipmentTrackingEvent, Order histories, AuditLog | Focused tests and typecheck pass; new migration and PostgreSQL/browser verification pending; no carrier integration |

| 16 | Seller inventory and warehouse management | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 17 | Supplier and procurement management | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 18 | Shipping and fulfillment (seller) | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 19 | Seller finance, commissions and payouts | Read-only finance overview, immutable commission statement, and owner-managed payout beneficiary submission/review journey are implemented; no seller payable/withdrawal journey | `/seller/finance`, `/seller/commissions`, `/seller/payouts`; `/admin/seller-payout-methods`; `GET /api/seller/commissions`, store finance/export APIs, payout-method APIs and admin review endpoint | Store owner or exact-store authorized staff for finance statements; payout destination owner-only; admin `platform:manage` + fresh TOTP step-up; masked beneficiary details, self-verification blocked, evidence/reason/audit and submission-version concurrency guard | Seller finance overview and commission statements are informational per-currency source reports, not ledger balances. Beneficiary data encrypted/masked; admin manual verification is attestation, not bank ownership verification. Prior CI/PostgreSQL/Browser evidence is recorded in the relevant merged implementation docs; current HEAD validation not run in this session. | No seller payable, held/available balances, withdrawal request, transfer execution, settlement or reconciliation. FIN-01..FIN-12 approval remains a release gate. |
| 20 | Seller marketing and promotions | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 21 | Seller reviews and reputation | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 22 | Seller staff and scoped permissions | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 23 | Store management and settings | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 24 | Platform admin dashboard / command center | Phase 1 dashboard and shared admin navigation implemented | `/admin/dashboard`, `/admin/control-panel`; `GET /api/admin/dashboard` | `users:manage`; Prisma-backed counts, currency-specific order/payment totals, date/country/currency/seller/store filters | Focused dashboard unit tests, typecheck and lint pass; PostgreSQL/browser workflow not run | Partial: no accounting revenue, payout, refund/dispute or health metrics; top-performer and entity drill-through pages remain missing |
| 25 | User administration | Phase 2 partial: searchable users, account details, roles/sessions/consents/login attempts/audit history, reasoned status change and session revocation | `/admin/users`, `/admin/users/[userId]`; `GET /api/admin/users`, `GET/PATCH /api/admin/users/[userId]` | `users:manage`; protects self and SUPER_ADMIN accounts; suspension/disable revokes active sessions and writes audit event | `tests/admin/users.test.ts` (3 tests); typecheck and targeted ESLint pass. No database/browser journey | Role changes, verification/security controls, and complete admin identity journey remain incomplete |
| 26 | Seller administration and KYC review | Phase 2 partial: seller search/owner context, existing application approval and audited store suspend/reactivate | `/admin/sellers`; `GET /api/admin/sellers`, existing seller approval API, `PATCH /api/admin/stores/[storeId]` | `users:manage`; store transition requires reason, checks current state and seller eligibility, writes AuditLog | `tests/admin/sellers.test.ts` (3 tests); typecheck and targeted ESLint pass. No database/browser journey | KYC, documents, tax registrations, seller detail, risk tooling and end-to-end application journey remain incomplete |
| 27 | Catalog administration | Partial: product moderation, bulk archive, category CRUD/archive and brand CRUD/archive are present in source | `/admin/products`, `/admin/product-management`, `/admin/categories`, `/admin/brands`; category and brand CRUD APIs | Catalog moderation permissions; category/brand mutations require `catalog:manage`, are transactional and audited; brand archive preserves product relations | Existing product/category evidence; brand API/service/UI added on 2026-11-09. No focused brand service test, PostgreSQL or browser verification for the new slice | Product approval is distinct from publishing; product queue is bounded; taxonomy still needs translations, brand/category search and pagination, attribute governance, change history and exact-head journey verification |
| 28 | Central order operations | Phase 2 partial: read-only order search/detail, customer and monetary snapshots, payment attempts, vendor splits and tracking/status history | `/admin/orders`, `/admin/orders/[orderId]`; `GET /api/admin/orders`, `GET /api/admin/orders/[orderId]` | `users:manage`; validated bounded pagination/status filters; does not expose provider references or unsupported financial/fulfillment actions | `tests/admin/orders.test.ts` (3 tests); typecheck and targeted ESLint pass. No PostgreSQL/browser journey | Payment/refund/dispute operations, exception queue, controlled intervention workflows and lifecycle verification remain future work |
| 29 | Payment administration | Phase 3 partial: read-only payment transaction and webhook operations workspace | `/admin/payments`, `/admin/payments/[paymentId]`; `GET /api/admin/payments`, `GET /api/admin/payments/[paymentId]` | `payments:read`; bounded search/status/provider pagination and separate status/currency aggregates; no provider references, checkout URLs or raw payloads returned | `tests/admin/payments.test.ts` (3 tests); typecheck and targeted ESLint pass. No PostgreSQL/browser journey; no payment provider configured. | Refunds, chargebacks, reconciliation, settlement and payouts remain unsupported; inspection-only |
| 30 | Commission management | Super Admin rules and applied snapshots; `/admin/commissions` | `/api/admin/commission-rules`, `/api/admin/commission-rules/[ruleId]`, `/api/admin/commissions`; payment success webhook integration | `platform:manage`; versioned effective periods; seller+category → seller → category → global; net item merchandise after discount excludes shipping/tax; no rule means zero; immutable snapshots per order item | Policy tests (4), management-service tests (3), and payment lifecycle tests (5) pass; schema/migration/typecheck/lint/build pass. No end-to-end payment-success DB journey yet. | Rule configuration and transaction inspection implemented; no seller ledger, payout, refund reversal or reconciliation |
| 31 | Accounting and general ledger | Read-only admin ledger account-inspection journey exists; internal posting primitive and database integrity protections are present; complete financial lifecycle remains partial | `/admin/finance/ledger` → `GET /api/admin/finance/ledger`; `platform:manage` + MFA/step-up; account filters and cursor-paginated selected-account journal activity | `LedgerAccount`, `JournalEntry`, `JournalLine`, `Currency`; immutable single-currency double-entry posting primitive; no chart-of-accounts bootstrap or seller subledger | Historical exact-commit CI/E2E/CodeQL and PostgreSQL evidence is recorded in System 31 docs. Later `20261112130000_journal_append_only_integrity` hardening and current category-scoped policy changes require exact-HEAD validation; do not infer they pass from earlier CI. | No payment/refund journal posting, seller payable, withdrawable balances, reserve/hold release, reconciliation, settlement or payout workflow; gated by explicit FIN-01..FIN-12 owner decisions and approved per-currency account mapping. |
| 32 | Payout administration | Manual seller bank-destination review implemented | `/admin/seller-payout-methods`; `GET /api/admin/seller-payout-methods`; `POST /api/admin/seller-payout-methods/[methodId]/review` | Global `platform:manage` + fresh TOTP step-up; self-verification blocked; masked-only queue; evidence reference + reason; atomic `submissionVersion` and pending-state guard; current-generation `submittedAt`; AuditLog | Exact-head general CI, PostgreSQL integration, Browser E2E (13/13) and CodeQL passed on `401cb342d034dd8ad27576dde053ce3454891b7d` | Manual attestation only. No payable balance, withdrawal request, transfer execution or settlement/reconciliation. |
| 33 | Returns, refunds and disputes administration | `/admin/returns` | Admin return queue/review APIs and UI | ReturnRequest, ReturnItem, AuditLog | CI + PostgreSQL passed on merged implementation; admin browser journey pending | Implemented / unverified; workflow-only, no funds movement |

| 34 | Shipping administration | Phase 3 partial: read-only inspection of persisted shipments and tracking events | `/admin/logistics`, `/admin/logistics/[shipmentId]`; `GET /api/admin/shipments`, `GET /api/admin/shipments/[shipmentId]` | `users:manage`; status-filtered bounded search; suppresses non-HTTPS/credential-bearing tracking URLs; does not create shipment data | `tests/admin/logistics.test.ts` (3 tests); typecheck and targeted ESLint pass. No PostgreSQL/browser journey. | Carrier configuration, labels, automated tracking, exception/delay detection and shipment actions remain unavailable |
| 35 | Tax and regulatory compliance | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 36 | Promotions, coupons, loyalty and gift cards | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 37 | Review moderation | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 38 | Central customer support | Existing support desk supports ticket queue/detail, priority/status changes, self-assignment, public replies and internal notes; Phase 3 reuse, journey still unverified | `/admin/support`; `GET /api/admin/support/tickets`, `GET/PATCH/POST /api/admin/support/tickets/[ticketId]` | `support:manage`; ticket mutations are transactional/audited; public replies notify customers, internal notes remain private | Existing ticket service/API/UI; no additional schema changes in this slice. No authenticated admin/browser support journey run here | Search/filter, SLA timers/escalation, attachments, team assignment and workload reporting remain incomplete |
| 39 | CMS and content administration | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 40 | Platform settings and governance | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 41 | Global markets, currency, FX and localization | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 42 | Invoicing and credit notes | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 43 | Analytics and reporting | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 44 | External integrations and provider adapters | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 45 | Background jobs, event processing and outbox | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 46 | Security, audit and platform risk controls | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 47 | SEO and public discovery | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 48 | Newsletter and lifecycle email | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 49 | Property listings and booking domain (separate bounded context) | Not audited | Not mapped | Not audited | Not audited | Not verified |

**Status vocabulary:** Not audited → Mapped → Wired → Implemented → Verified → Complete. A status can move forward only with linked evidence. If a feature has no required persistence, record “No schema change — reason” rather than inventing a table. “Complete” applies only to the agreed scope and requires provider/policy/operational dependencies to be explicitly resolved or excluded.

## Required action trace record

Create one record for **each** visible button, link, form submission, menu action, bulk action, background-triggering action, and API mutation. Group controls only when they share the same handler, payload, authorization rule, domain operation, and outcome; otherwise trace them separately.

| Field | Required evidence |
|---|---|
| Action identity | System number, page/route, component/file, exact visible label, actor (guest/customer/seller/staff/admin/system), starting state |
| Interaction | Click/submit handler, fields, client validation, loading/disabled state, double-submit prevention, destination/confirmation |
| Preconditions | Session, email verification, role, resource ownership/scope, entity status, market/policy/provider prerequisites |
| API contract | Method/path, request schema, response schema, safe error codes, CSRF/origin/rate-limit protections where applicable |
| Domain execution | Service/use-case and repository; business invariants enforced server-side, not only in UI |
| Authorization | Server-derived actor; ownership and tenant/store scope; forbidden cross-user/cross-store/escalation tests |
| Prisma decision | Existing models checked; exact models/relations/constraints/indexes; or explicit reason no schema change is required |
| Transaction integrity | Atomic writes, concurrency/stale-state behavior, uniqueness, idempotency/retry, audit/outbox/notification effects |
| Final outcome | Persisted state, returned data, refreshed UI, final route, user-visible confirmation, refresh/retry behavior |
| Failure outcomes | Validation, unauthenticated, forbidden, not found, conflict, rate limit, provider unavailable, timeout, server failure |
| Evidence | Focused tests, exact CI/PG run for exact commit, browser/HTTP evidence when configured, reviewer notes |
| Remaining scope | Explicit exclusions, external decisions, operational dependencies, known gaps and owner |

## End-to-end lifecycle that must be covered

For each system, map the full lifecycle relevant to its domain:

1. **Discover and enter:** where the actor finds the action; visible CTA and navigation; guest/unauthorized behavior.
2. **Prepare:** required data, form state, validation, policy disclosure and prerequisites.
3. **Submit/execute:** exact click/submit event, API contract, pending state, retry and duplicate handling.
4. **Authorize:** server-side session, role, ownership, resource scope and business-state checks.
5. **Process:** domain service, database transaction, external provider or job handoff, idempotency and concurrency.
6. **Persist:** canonical Prisma records and relations, audit/event/notification records; migration/backfill if schema changes.
7. **Confirm:** server-confirmed outcome, updated UI, destination, status and receipt/reference where applicable.
8. **Continue:** subsequent user/admin/seller actions, state transitions, cancellation, correction, dispute, return or reversal as applicable.
9. **Recover:** retry, stale state, provider timeout/webhook replay, duplicate delivery, failed job, compensation/reconciliation.
10. **Verify:** relevant happy path and distinct security/data-integrity/failure invariants with exact-commit evidence.

## Completion gates

- **Mapped:** every page and action for the agreed system scope has an owner, actor, API/service, persistence decision and outcome.
- **Wired:** the visible control invokes the intended real route/API and handles pending and error responses.
- **Implemented:** domain rules, authorization, persistence, audit/events and state transitions exist; no fake outcome.
- **Verified:** critical success, failure, ownership/permission, duplicate/retry and concurrency invariants are tested; required CI and disposable PostgreSQL checks pass for the exact commit. Browser/HTTP journey evidence is recorded where a runnable environment exists.
- **Complete:** all agreed user journeys and operational dependencies for the system scope pass; no visible dead end or knowingly nonfunctional control remains in that scope.

A missing browser environment is a verification limitation, not a reason to claim success. A control intentionally not yet implemented must not be exposed as an active feature. Provider-dependent systems cannot be marked complete using mocks alone.

## Cross-cutting audit order

Audit shared dependencies once, then re-check them from each consumer journey: identity/session → permission and resource scope → market/currency → catalog → cart/checkout/order → payment/refund/payout → inventory/fulfillment → returns/disputes → notifications/support → admin/audit/reporting. A shared component passing its own test does not waive verification at each system boundary.

## Change log

- 2026-11-04: Created the all-49 system ledger. All rows start as Not audited; this intentionally avoids converting route/model presence into completion claims.


## System 01 initial action trace — source implementation, not yet verified

| User action | UI → API | Server/domain/persistence | Final outcome and remaining gate |
|---|---|---|---|
| Sign in | `/login` submit → `POST /api/auth/login` | same-origin JSON guard → trusted-proxy IP resolution → `loginWithPassword` → session cookie, LoginAttempt, lastLoginAt, AuditLog | Server sets HttpOnly session cookie; client redirects only to same-origin local return path or `/account/orders`. Needs deployed proxy config and HTTP/browser test. |
| Register | `/register` submit → `POST /api/auth/register` | Same-origin guard, Turnstile verification, trusted-IP/email throttles, consent capture, immediately active account creation without email verification, and audit event; session is created on the user's first sign-in | Registration does not require email verification; redirect is restricted to the safe same-origin return path. Configured challenge/proxy and HTTP journey remain to verify. |
| MFA challenge | Login challenge → `POST /api/account/security/mfa` | TOTP or one-time recovery code is checked and consumed; MFA assurance is bound to the active session | Platform permission-protected operations require enrollment and fresh verification; browser journey remains pending. |
| Request reset | `/forgot-password` submit → `POST /api/auth/password-reset/request` | trusted IP + separate reset throttle → eligible account challenge, token digest, AuditLog → Resend adapter | Generic response regardless of account existence; needs delivery smoke test. |
| Complete reset | `/reset-password` submit → `POST /api/auth/password-reset/complete` | consume token once → hash new password → revoke all sessions → AuditLog | User can sign in with new password; service has PostgreSQL coverage on earlier commit; current UI requires exact-head CI/HTTP proof. |
| Register | `/register` submit | Registration requires terms/privacy consent, Turnstile, rate limits, and `PUBLIC_REGISTRATION_ENABLED`; active user and session are created transactionally | No email-verification or resend step. Registration remains blocked in production until explicitly enabled and legal documents are approved. |
| Logout | `/account/orders` Sign out button → `POST /api/auth/logout` | same-origin guard → cookie-backed `logoutCurrentSession` → revoke current session + AuditLog + clear HttpOnly cookie | UI redirects to `/login` only after successful response; verify `/api/auth/me` returns 401 after logout and repeat/logout error handling in deployed HTTP journey. |


## Shared navigation action trace — initial implementation, not yet verified

| Action | UI → route/API | Server/data boundary | Final outcome and remaining gate |
|---|---|---|---|
| Open home | Global header brand/Home → `/` | Existing storefront discovery page and catalog APIs | Route exists; verify navigation from nested routes and mobile menu/scroll behavior. |
| Search | Header GET form → `/?q=...` | Existing home page restores query from URL and calls `GET /api/products` | Search is wired to the existing discovery contract; verify query encoding, empty results and API errors. |
| Open shop | Header Shop → `/products` | Reuses `StorefrontHomePage` and `GET /api/products` | Route added; dedicated catalog UX and browser test remain outstanding. |
| Browse categories / brands | Header anchors → `/#categories`, `/#brands` | Existing active taxonomy APIs populate home sections | No new persistence; verify section visibility and anchor behavior. |
| Open cart | Header Cart → `/cart` | Existing guest cart cookie and cart API | Existing route; guest/customer journey still requires test. |
| Open account actions | Favorites, Orders, Account → protected account routes | Existing session guard and user-scoped APIs | Links are only shown when server session resolves; verify ownership and redirects. |
| Apply to become a seller | Authenticated user opens `/seller` and completes the guided Akaar-style application | `POST /api/seller/applications`; `POST /api/seller/applications/identity-document`; Seller and AuditLog | Persists legal/display names, contact person/email/phone, business type/address, categories, intended products/sourcing plan, description, coordinates, optional HTTPS social links, and optional private identity file reference; applicant identity comes from session; input validated by Zod; one Seller per owner and audit event in transaction. Private file upload validates session, origin, MIME/signature/size and verifies private ImageKit file ownership before linking. | Source implemented; no runtime verification claimed yet. Needs Prisma validate/generate, migration replay on disposable PostgreSQL, ImageKit-configured upload test, admin review details, and browser journey. |
| Open seller workspace | Header Sell on Mtjr → `/seller` | Seller application/store services; Seller/Store models | Existing route; verify pending and approved states. |
| Open messages / notifications | Authenticated header links → existing routes | Existing participant/user-scoped APIs | Links shown only for resolved sessions; verify server authorization. |


## Navigation directory and search traces — initial implementation, not yet verified

| Action | UI → route/API | Server/data boundary | Final outcome and remaining gate |
|---|---|---|---|
| Submit global search | Header GET form → `/search?q=...` → existing discovery state → `GET /api/products` | Catalog discovery service reads bounded query parameters and active product data | Real product listing response is used; verify URL encoding, no-result, server-error and browser back/forward behavior. |
| Browse categories | Header → `/categories` → `GET /api/categories` | Public taxonomy service reads active Category tree | Loading/error/empty states are rendered; each category opens filtered `/products?categoryId=...`. Verify filter persistence and invalid IDs. |
| Browse brands | Header → `/brands` → `GET /api/brands` | Public taxonomy service reads active Brand records | Loading/error/empty states are rendered; each brand opens filtered `/products?brandId=...`. Verify filter persistence and invalid IDs. |


## System 02–03 source audit — 2026-11-04

| Entry point/action | Frontend → API/service | Canonical persistence | Current finding / next verification |
|---|---|---|---|
| Header search | Debounced combobox → `GET /api/search/suggestions`; submit → `/search` → `GET /api/products` → `listDiscoverableProducts` | Product, ProductTranslation, SearchSynonym, ProductVariant, ProductPrice, Store, Seller, Market, Currency | Implemented at source level with validated bounded queries, rate limits and stale-request cancellation. Verify live database results, browser/accessibility behavior and empty/error states. |
| Homepage category select | Category control → categoryId state → GET `/api/products` | Category, ProductCategory, Product | Filter wired; verify URL restoration and exact results. |
| Category “View all” | Link → `/categories` | Category, CategoryTranslation | Corrected to navigate to directory rather than clearing filter. |
| Homepage brand select | Brand control → brandId state → GET `/api/products` | Brand, BrandTranslation, Product | Filter wired; verify state, URL and result set. |
| Product listing filters | Market/currency/category/brand/price/availability/sort/page → GET `/api/products` | Market, Currency, StoreMarket, ProductPrice, ProductVariant, Inventory, ProductCategory | URL-backed, validated filters/facets and stable pagination are implemented; verify PostgreSQL results, invalid combinations and no-results. |
| Product detail open | `/products/[slug]` → `getDiscoverableProduct`; client GET `/api/products/[productId]` where the value is a slug | Product, ProductTranslation, Store, Seller, Brand, ProductMedia, ProductVariant, ProductPrice | Slug lookup exists; API parameter naming is misleading. Verify valid active-market price contexts. |
| Add to cart | Product detail → POST `/api/cart/items` → `addCartItem` | GuestSession, Cart, CartItem, ProductVariant, ProductPrice, Inventory | Server checks active listing, market/currency price and available stock; guest token is stored hashed. Focused guest/customer and stock tests pass; browser reload behavior pending. |
| Guest cart merge | Sign in → customer cart read/write → `mergeGuestCarts` | GuestSession, Cart, CartItem | Transaction claims the guest session once before merging items and marks source carts MERGED; concurrent retry does not add the same quantities twice. Focused unit test passes; browser sign-in merge journey pending. |
| Checkout quote and coupon | `/cart` coupon field → POST `/api/checkout/quote` → `createCheckoutQuote` | CheckoutQuote/Line, Coupon, InventoryReservation | Server prices items, validates coupon schedule/currency/cap, snapshots discount, and reserves stock atomically; same idempotency key cannot be reused with a different coupon. PostgreSQL migration/runtime pending. |
| Place marketplace order | Checkout review → POST `/api/checkout/quote/[quoteId]/place-order` → `placeOrderFromCheckoutQuote` | CouponRedemption, Order/VendorOrder/OrderItem, InventoryMovement | Serializable transaction snapshots totals/address, applies discount before tax, splits vendor orders, consumes reservations and records one coupon redemption. Retry returns the committed order after recognized unique/serialization conflict; payment remains pending. PostgreSQL/browser journey pending. |
| Favorite | Product detail → POST/DELETE `/api/favorites/[productId]` | Favorite, User, Product | Verify unauthenticated, duplicate add, remove and reload consistency. |
| Contact store | Product detail → POST `/api/messages` → `startStoreConversation` | StoreConversation, StoreMessage, User, Store | Verify authorization, duplicate conversation and message persistence. |
| Category/brand/store browse | Directory and slug services → product grid | Category/Translation, Brand/Translation, Store, Seller, Product | Pages exist but detail lists are fixed to first 48 and directory pagination is absent. Verify 404, empty state, hierarchy and full result coverage. |

**Blocking gaps:** add bounded pagination to the remaining category/brand/store result lists and store directory; run critical HTTP/browser journeys. Keep schema unchanged unless a real missing business entity/relation is demonstrated.


**Taxonomy correction update — 2026-11-04:** Category tree retrieval now pages root categories and fetches descendants level-by-level before tree assembly. Pagination totals are root-category totals. Focused tests cover deep descendants and malformed-cycle termination. This closes the previously recorded parent/child page-split defect at source level; exact-head CI is pending.

## Search journeys — 2026-11-04

| Action | UI → API/service | Data boundary | Verification gate |
|---|---|---|---|
| Public search | Global search → `/search?q=...` → discovery service | Active products/sellers/stores; localized fields, identifiers, variants, brands, categories, stores, active synonyms and trigram ranking | Exact-head PostgreSQL migration/runtime, filters/pagination, empty/error and browser verification |
| Autocomplete | Header combobox → `GET /api/search/suggestions?q=...` | Maximum six products and four active stores; bounded/rate-limited query | Debounce/abort implemented; keyboard and screen-reader verification pending |
| Seller catalog | `/seller/products` → `GET /api/seller/products?storeId=...&q=...` | Authorized store only; name/slug/description/SKU/barcode | Owner/staff authorization and cross-store isolation |
| Seller orders | `/seller/orders` → `GET /api/seller/orders?q=...` | Store IDs derived from authenticated owner/staff permissions; order number, store and item fields | Multi-store isolation and result correctness |
| Seller inventory | `/seller/inventory` → `GET /api/seller/inventory?storeId=...&q=...` | Authorized store only; product/SKU/warehouse fields | Owner/staff authorization and cross-store isolation |

Status: Implemented at source level; not Verified until exact-head CI/PostgreSQL and browser journeys pass.


## Seller return visibility — 2026-11-04

| Journey | UI → API/service | Data and authorization boundary | Verification |
|---|---|---|---|
| Seller return visibility | `/seller/returns` → `GET /api/seller/returns` → `listSellerReturnRequests` | Verified session; active owned stores, exact-store `orders:manage` grants, or platform admin. Items are grouped by `VendorOrder.storeId`; client cannot supply store scope. | Exact-head General CI and disposable PostgreSQL integration passed on `797f8dd61ee5ec3591f8cc0d2abb46b85235a364`; merged as PR #19. Deployed browser journey remains pending. |

**Boundary:** seller view is read-only. Parent ReturnRequest has one global status across vendors; seller decisions, receipt, shipping and refunds remain disabled until a per-vendor lifecycle is implemented.


## System 15 — seller order preparation action trace (initial slice)

| Actor action | UI → API | Authorization and domain | Persistence / final outcome | Boundary |
|---|---|---|---|---|
| Start processing | `/seller/orders` → `PATCH /api/seller/orders/[vendorOrderId]/status` with `PROCESSING` | HttpOnly session; server resolves vendor order and store; active store/seller; owner, active staff with exact store `orders:manage`, or global `orders:manage`; current vendor status must be `CONFIRMED` and parent order confirmed/processing | Compare-and-set in serializable transaction; vendor status history, parent order status/history (when first seller starts), and audit log commit atomically; UI updates only after server response | Unpaid `PENDING_PAYMENT` orders cannot advance; cross-store and stale requests are denied |
| Mark ready to ship | `/seller/orders` → same PATCH endpoint with `READY_TO_SHIP` | Same server-derived store and permission checks; current vendor status must be `PROCESSING` | Vendor status and audit/history commit atomically; repeated target request is idempotent | Shipment, label, tracking, dispatch, delivered, cancellation and refund actions remain unavailable |

This is an initial System 15 slice, not completion of seller order management or System 18 shipping/fulfillment. Browser verification is still pending.

## System 12 — seller store creation retry trace

| Actor action | UI → API | Authorization and domain | Persistence / final outcome | Boundary |
|---|---|---|---|---|
| Create draft store | `/seller` → `POST /api/seller/stores` | Verified session and `store:manage`; service resolves the active seller from the session. Requested markets must be active and have their default currencies enabled. | Creates `Store` and enabled `StoreMarket` rows plus one `store.created` audit in a transaction. The database enforces one store per seller with `Store.sellerId @unique` / `@@unique([sellerId])`; the service serializes creation with a seller-scoped PostgreSQL advisory transaction lock. Exact owner/name/enabled-market replay returns the persisted store with HTTP 200 and does not write another audit. | A second distinct store for the same seller is rejected even with a different slug; slug collision with another seller or differing setup is also rejected. |
| Retry after concurrent create | Same request after a uniqueness race | Same authorization and request checks; only the slug unique constraint is eligible for recovery. | After the failed transaction, re-reads the slug; returns the existing store only when owner/name/markets match exactly. | Other Prisma uniqueness errors propagate; no false success is returned. |

Focused evidence: `npx vitest run tests/marketplace/seller-application.test.ts tests/marketplace/seller-store-route.test.ts` (12 tests) and the consolidated Phase 4–7 run (88 tests) pass. This does not replace disposable PostgreSQL or browser verification; the seller journey remains unverified end to end.

## Super Admin audit history

| User journey | Frontend | API/service | Persistence | Critical checks | Status |
|---|---|---|---|---|---|
| Super Admin opens audit history | `/admin/control-panel/audit-log` | Server route calls `requirePlatformManagement` before rendering | None | No session → login; no platform permission → not found | Implemented; CI pending |
| Super Admin filters and pages audit events | Action/resource filters and Load older control | `GET /api/admin/control-panel/audit-log` → `getPlatformAuditEvents` | Read-only `AuditLog` query | Server permission gate; bounded page size; validated date range; no-store; stable descending cursor | Implemented; CI pending |

## Super Admin role and permission inventory

| User journey | Frontend | API/service | Persistence | Critical checks | Status |
|---|---|---|---|---|---|
| Super Admin reviews role grants | `/admin/control-panel/access-catalog` | `GET /api/admin/control-panel/access-catalog` → `getPlatformAccessCatalog` | Read-only Role, Permission, RolePermission and UserRoleAssignment aggregates | Global platform permission at page and service; no mutation surface; private/no-store | Implemented; CI pending |

## Super Admin privilege request and independent review

| User journey | Frontend | API/service | Persistence | Critical checks | Status |
|---|---|---|---|---|---|
| Existing Super Admin requests access for another user | `/admin/control-panel/privilege-requests` form | `POST /api/admin/control-panel/privilege-requests` → `createPlatformPrivilegeRequest` | PlatformPrivilegeRequest + AuditLog | ACTIVE target, verified email, minimum justification, no current platform grant, one pending request per target under advisory lock | Implemented; migration/CI pending |
| A different Super Admin approves or rejects | Pending request card | `PATCH /api/admin/control-panel/privilege-requests/[requestId]` → `decidePlatformPrivilegeRequest` | Request status, UserRoleAssignment on approval, AuditLog | Actor separation, pending-only transition, canonical role permission check, transaction + target lock | Implemented; migration/CI pending |

## Manual seller dispatch — pending exact-head verification

| Action | Journey | Authorization and invariant | Persistence/result | Failure behavior |
|---|---|---|---|---|
| Record dispatch | `/seller/orders` → POST `/api/seller/orders/[vendorOrderId]/shipment` | HttpOnly session; vendor order resolves store server-side; active store/seller; owner or active staff with exact STORE `orders:manage` or global permission; status must be READY_TO_SHIP; tracking URL HTTPS | Shipment + vendor status SHIPPED + parent aggregate status + both histories + AuditLog in one serializable transaction | Anonymous 401; forbidden 403; missing order 404; stale state 409; invalid payload 400; identical replay returns existing shipment |
| View shipment | `/orders/[orderId]` reload | Existing order ownership check | Shipment serialized per vendor order | Missing shipment renders no tracking block; tracking link opens HTTPS URL in new tab |
 
Manual seller-entered tracking is not a carrier integration. Carrier webhooks, live tracking, label purchase and delivery confirmation remain out of scope for this slice.


## Multi-vendor shipment aggregation correction — 2026-11-05

- On seller dispatch, parent order aggregation now considers only non-cancelled vendor orders. A cancelled seller leg does not block FULFILLED once all remaining live vendor orders are SHIPPED or DELIVERED.
- If at least one live vendor order remains undispatched after another has shipped, parent state remains PARTIALLY_FULFILLED.
- Regression tests cover both states. No Prisma migration is needed; the existing CANCELLED status is sufficient.
- Exact-head CI/PostgreSQL verification for this correction is pending.


2026-11-05: Seller return decisions now operate on `ReturnItem` rows scoped to the authorized store. A multi-store request remains pending until every store has decided; customer UI shows each line's status. Platform review synchronizes line status. No physical receipt, inventory restock or payment refund is performed.


## 2026-11-07 — canonical-main evidence reconciliation

The original 2026-11-04 baseline above is historical. Do not use its old per-system statements as the current status where later merged evidence below supersedes them. This reconciliation deliberately does not mark all 49 systems complete.

| Scope | Current evidence on merged main | Remaining boundary |
|---|---|---|
| Identity and Super Admin governance (01, 25, 26, 40, 46) | PR #64 merged as `84ae9ecec4ecd2796533dd3551d346ee43fb5849`; exact PR head General CI, disposable PostgreSQL (3 files / 9 tests), and Browser E2E passed. E2E covers customer denial, independent privilege review, audit persistence, and mandatory MFA after elevation. | Full role/ownership/store-scope verification across all protected operations is not implied by this governance journey. |
| Anonymous API boundary (cross-cutting) | PR #68 merged as `16b185f765d4e7dbf68ee25907c41d17efbbea45`; 165 route/method anonymous-boundary cases, General CI and Browser E2E passed on exact PR head `2207295893cde027e123518ea9b29a169dcc0cc0`. | Anonymous denial does not prove authenticated role, resource ownership, staff scope, or cross-tenant isolation. |
| Advertising (20, 24, 43) | Sponsored placements are wired into product discovery, search, category discovery and product detail. Campaign targeting, signed event tokens, impression/click deduplication, budget enforcement, spend ledger, invoice generation, seller invoice listing and admin settlement/analytics exist on main. Campaign event writes use a campaign advisory lock and READ COMMITTED transaction isolation. | Live provider billing is not connected; invoice settlement is a manual external-payment confirmation. Browser evidence for ad placement/click replay is in the merged buyer E2E journey, but a live billing provider is not verified. |
| Buying / checkout (04, 05) | Merged browser journey covers product → cart → checkout review → address → shipping → tax → order confirmation; the order is explicitly pending payment. Disposable PostgreSQL and General CI evidence are recorded for the exact merged Super Admin E2E head. | Payment collection/provider onboarding, paid-order lifecycle, and full cancel/refund/reconciliation recovery are not thereby complete. |
| Financial lifecycle (05, 11, 15, 18, 29, 33, 34, 42) | Corrected PostgreSQL workflow ran on main `0d0fab6f47fdf49396022331f77f5612616a8d44`: all committed migrations deployed; 3 integration files / 9 tests passed; repeatable demo seed passed twice. General CI passed on `f05480a83fe3126f0183e51f990e47216fb14098`. | No live payment/refund provider or carrier was exercised. Manual refund/invoice operations must not be described as provider settlement. |
| Security and mutation feedback (cross-cutting) | Exact PR #64 inventory: 105/105 state-changing API handlers with request/system-boundary evidence; 54/54 mutation-bearing UI files with success/error feedback. PR #68 separately covers anonymous route/method denial. | Static inventories and anonymous tests do not replace actor/tenant/ownership tests for every domain action. |

### Current release-gate snapshot

- Canonical default branch: `main`; no open pull requests were returned by the repository search on 2026-11-07.
- Latest observed main commit: `1d458f0b43db43012913c5351c9754daeb153062` (documentation-only financial lifecycle verification update).
- General CI passed on preceding main documentation/registry commit `f05480a83fe3126f0183e51f990e47216fb14098` (run [42404307099](https://github.com/waelkamira/mtjr2/actions/runs/42404307099)); PostgreSQL passed on `0d0fab6f47fdf49396022331f77f5612616a8d44` (run [42404238983](https://github.com/waelkamira/mtjr2/actions/runs/42404238983)). These are not exact-head results for `1d458f0`.
- Vercel check on latest observed main commit `1d458f0` is FAILURE with the provider URL indicating the build/deployment rate limit. This is an external deployment gate, not evidence of an application build defect.
- The current evidence does not establish production database migration, production secrets, live payment/refund/carrier integration, or successful deployment. None was changed or exercised in this audit.

Next audit work must start by updating the individual 49 ledger rows against these merged facts, then finish actor/ownership/store-scope checks and route-level browser coverage. Do not turn the 165 anonymous cases, 105 API inventory, or 54 UI inventory into a blanket authorization-complete claim.



## 2026-11-08 — Buyer purchase journey verification update

- Current main's Playwright journey covers product detail → cart → checkout review → delivery address → shipping option → tax snapshot → place order → order confirmation/detail.
- The verified expected terminal state is `PENDING_PAYMENT`; the UI explicitly communicates that payment is pending. This journey is not evidence of a captured payment or seller fulfillment eligibility.
- The exact PR #78 source head passed Browser E2E [42489548167](https://github.com/waelkamira/mtjr2/actions/runs/42489548167), alongside disposable PostgreSQL [42489548337](https://github.com/waelkamira/mtjr2/actions/runs/42489548337) and General CI [42489542922](https://github.com/waelkamira/mtjr2/actions/runs/42489542922), with the follow-up test correction also passing in [42489548427](https://github.com/waelkamira/mtjr2/actions/runs/42489548427).
- Payment provider onboarding, actual charge/webhook, external refund execution, settlement reconciliation, and carrier integrations remain conditional on owner-approved market/currency/provider/merchant decisions.


## Customer saved-address lifecycle — implementation update 2026-11-08

| Actor action | UI → API | Authorization and domain | Persistence / final outcome | Failure behavior |
|---|---|---|---|---|
| List saved addresses | `/account/addresses` → `GET /api/account/addresses` | Current authenticated session; server derives owner | Only the session user's UserAddress rows are returned with flattened active country data | Anonymous 401; private response is no-store |
| Create address | Address form → `POST /api/account/addresses` | Same-origin JSON guard; server derives owner; selected country must be active | Serializable transaction + per-user advisory lock; first address becomes default; explicitly selected default replaces previous default | Invalid payload/country rejected; no partial default change |
| Edit address | Edit form → `PATCH /api/account/addresses/[addressId]` | Same-origin JSON guard; query is scoped by address ID and session user ID | Serializable transaction; country, address fields and optional default change commit together | Foreign/missing address returns 404; invalid payload 400 |
| Change default | Address card → same PATCH endpoint with current address snapshot and `isDefault: true` | Same owner check; no client-supplied user ID | Per-user advisory lock clears the previous default and sets the selected address atomically | Missing address 404; failed/concurrent update returns conflict |
| Delete address | Address card → `DELETE /api/account/addresses/[addressId]` | Same-origin JSON guard; server derives owner | Deletes only the owned row; checkout quote snapshots retain their copied address and nullable source relation; newest remaining address becomes default when needed | Missing/foreign address 404; transaction rolls back if promotion fails |

The address book does not expose another user's records. No Prisma migration was required: the existing `UserAddress` and `CheckoutQuoteAddress` relation already preserves immutable checkout snapshots and sets the optional source-address reference to null on deletion. Verification remains tied to PR #79 exact-head General CI, PostgreSQL and Browser E2E; do not claim browser coverage of these new controls unless a dedicated browser journey is added.

| Review seller identity document | Authorized administrator opens the identity-document link on a seller application | `GET /api/admin/sellers/[sellerId]/identity-document`; Seller and ImageKit file metadata | Requires `users:manage`; verifies file is private and tagged to the seller owner; redirects to a five-minute ImageKit signed URL. The raw file ID is not returned in the seller list API. | Source implemented; provider/runtime test pending. |
| Correct and resubmit rejected application | Seller revisits `/seller`, reads the saved reviewer feedback, corrects fields and submits again | `GET /api/seller/stores` workspace response and `POST /api/seller/applications`; Seller and AuditLog | Workspace service reads only the authenticated seller's latest rejection audit event and returns its reason/review timestamp; UI displays it before the form. Resubmission updates the same rejected Seller record using a conditional status update, returns it to PENDING, and records `seller.application.resubmitted`; active/suspended sellers cannot use this path. | Source updated on main; execution and browser journey pending. |

## Seller portal shell and product studio — 2026-11-09

| Area | Source-level implementation | Backend/data boundary | Verification status |
|---|---|---|---|
| Shared seller shell | `src/app/seller/layout.tsx` wraps seller pages with `src/features/seller/seller-navigation.tsx` and `src/features/seller/seller-topbar.tsx`; the grouped dark-navy icon sidebar and compact mobile navigation cover overview, catalog, orders, inventory, shipping, returns, reviews, questions, messages, team, advertising and notification destinations. | The shell is presentation/navigation only. Seller APIs remain responsible for session, owner/staff membership, exact-store scope and permissions. | Implemented in source; responsive desktop/mobile browser checks not run on this exact head. |
| Seller dashboard visual system | `src/features/seller/workspace-page.tsx` retains the seller application, store setup, live sales/order/inventory metrics, charts and recent orders while using the supplied cool blue-grey clay surfaces with pale cyan/teal accents. | Reads existing seller workspace, analytics, orders, inventory and shipping-rate APIs; no fake metrics or new models. | Implemented in source; data and responsive screenshot checks pending. |
| Product studio and image preview | `src/features/seller/products-page.tsx` supports category-dependent attributes, variant-level attributes, SKU/barcode, market/currency prices, property fields, media upload/retry/replace/remove/reorder and a full-size preview overlay for create/edit galleries. | Existing product and media APIs; image uploads remain temporary until attached to ProductMedia; API validates store access and file signature. | Implemented in source; upload-provider and create/edit browser journey on exact head pending. |
| Shipping editor | `/seller/shipping` supports listing, create and update of store shipping services. | `GET/POST /api/seller/shipping-rates` and `PATCH /api/seller/shipping-rates/[id]`; StoreShippingRate, active StoreMarket and currency checks. | Implemented in source; persisted reload and checkout quote behavior require browser/PostgreSQL verification. |

No seller portal slice is marked complete solely because these components exist. Run the existing focused seller E2E/API and disposable PostgreSQL workflows against the exact current `main` head before closing the portal.
## Seller delivery address visibility — 2026-11-09

| Actor action | UI → API | Authorization and privacy | Persistence / outcome | Verification |
|---|---|---|---|---|
| Seller views delivery instructions | `/seller/orders` → `GET /api/seller/orders` → `listSellerVendorOrders` | Server resolves active owned stores or active staff membership plus exact-store `orders:manage` permission. Only the seller's VendorOrder rows are queried. | Includes the immutable `OrderAddress` snapshot only when parent Order status is `CONFIRMED`, `PROCESSING`, `PARTIALLY_FULFILLED`, `FULFILLED` or `COMPLETED`. `PENDING_PAYMENT` and `CANCELLED` orders return `address: null`. | Source inspected; exact-head API/browser privacy test pending. |
| Seller opens carrier tracking | Same seller order card | Tracking URL is the seller-supplied HTTPS URL validated by shipment service; opened with `noopener noreferrer`. | Tracking number, carrier and tracking events remain on the store-scoped Shipment record. | Source inspected; browser check pending. |

**Privacy boundary:** do not expose recipient name, phone or street address for unpaid orders; do not add parent-order address access to seller routes without the same per-vendor store authorization.
## Seller store profile update — 2026-11-09

| Actor action | UI → API | Authorization and validation | Persistence / outcome | Verification |
|---|---|---|---|---|
| Owner edits store identity, branding, dispatch details or customer policies | `/seller` → `PATCH /api/seller/stores/[storeId]` → `updateSellerStoreSettings` | Current session; active seller/store; owner or exact-store `store:manage`; strict name/slug/HTTPS media/policy/dispatch validation; store row lock; duplicate slug conflict handling. | Store identity, logo/banner URLs, public shipping/returns/privacy/terms text and private dispatch origin update atomically with `store.settings_updated` AuditLog. Policy values are bounded to 8,000 characters and public policy fields are exposed only by the public store detail serializer; private dispatch fields remain private. URL changes are allowed only while the store is DRAFT. | Source implemented; migration replay, API/page browser journey and policy content/legal review pending. |
| Seller manages reusable store media | `/seller` → `POST /api/seller/products/media`; workspace `GET /api/seller/stores`; `DELETE /api/seller/stores/[storeId]/media` | Current session; owner or exact-store `catalog:manage`; signed temporary-delete token for staged cleanup; store row lock; reject deletion while referenced by store branding or ProductMedia. | Upload persists StoreMediaAsset with provider key and dimensions; latest 100 assets appear in the seller library and can be reused as logo/banner. Provider deletion must succeed before the library row is removed; audit event records deletion. | Source implemented; provider credentials, migration replay and browser journey pending. |

Policy localization/versioning, market/currency controls, seller-specific notification rules and deletion of detached provider assets without deletion credentials remain follow-up capabilities.
## Seller team invitation privilege boundary — 2026-11-09

- The current invitation flow defaults the UI to `STORE_CATALOG_MANAGER`; owners may choose catalog, inventory, order, customer-care, marketing or explicitly full `STORE_MANAGER`. New role assignments are store-scoped and only granted after the invited user accepts.
- Invitations expire after seven days. Owners can renew an expired invitation by re-inviting the same email; the existing SellerStaff membership is reused. Acceptance checks the invitee identity, active seller and expiry boundary.
- Owners may change an invited or active member's role. Active role changes remove the previous store-scoped assignment and upsert the new one in a single transaction with audit. Owners alone may invite/change/revoke; staff cannot delegate access.
- Role definitions are seeded by `prisma/seed.cjs`; run the identity seed before using the new role keys. Session invalidation on revocation and a readable access-history screen remain open.
- Verification: service and test source updated; Vitest and browser tests not run.
## Seller commission statements — 2026-11-09

| Actor action | UI → API | Authorization and data boundary | Persistence / outcome | Verification |
|---|---|---|---|---|
| Seller reviews recorded platform fees | `/seller/commissions` → `GET /api/seller/commissions?storeId=...` → `getSellerCommissionHistory` | Current session; store owner or exact-store `orders:read`; query is constrained by both `storeId` and the store's `sellerId`. | Reads the latest 100 immutable CommissionTransaction snapshots with order item, order status, currency, base amount and recorded commission. Totals are grouped by currency. No net seller balance, payout, withdrawal or refund-adjustment amount is inferred. | Service test added; API/page browser and database checks pending. |

**Financial boundary:** commission snapshots explain the fee applied to an order item; they are not an accounting ledger or payable balance. Do not add payout actions until the platform ledger, refunds/adjustments and payout reconciliation are implemented.

## Seller portal verification — 2026-11-09

| Journey | UI → backend → persistence | Result |
|---|---|---|
| Owner saves dispatch origin | /seller#store-management → PATCH /api/seller/stores/[storeId] → updateSellerStoreSettings → Store shipping* fields → fresh GET /api/seller/stores | Browser E2E verifies the updated contact, phone, address, city and ISO country code. Audit records changed field names only. |
| Seller creates and edits a product | /seller/products → seller product/media APIs → Product, ProductVariant, ProductPrice and ProductMedia | Browser E2E verifies draft creation and edit persistence; image-provider response is isolated at the external storage boundary. |
| Seller edits shipping services | /seller/shipping → shipping-rate APIs → StoreShippingRate and active StoreMarket/currency checks | Browser E2E and focused shipping service tests pass. |
| Seller changes store context | Workspace, product, inventory, order, return, shipping, advertising, message and commission loaders | Store-scoped state is cleared or refreshed and late responses are guarded where the page has a store selector. Owner accounts remain limited to one store by unique constraints and serialized creation. |
| Owner invites or renews a team member | `/seller/staff` → `POST /api/stores/[storeId]/staff` → SellerStaff upsert | Owner-only; selected seeded role key; seven-day expiry; duplicate membership key `(storeId,userId)`; invitation audit. Expired invite can be renewed using the same membership. | Invitee inbox hides expired invites; acceptance requires matching user, active seller and unexpired INVITED state, then grants the selected role within exact STORE scope. |
| Owner changes a staff role | `/seller/staff` → `PATCH /api/stores/staff-memberships/[membershipId]` → `changeStoreStaffRole` | Owner-only; exact membership/store derived server-side; role key allowlisted; previous scoped grant removed and new grant assigned in one transaction; audit records previous/next role. | UI refreshes the member row only after the server confirms the role change. |
| Owner revokes a team member | `/seller/staff` → `POST /api/stores/staff-memberships/[membershipId]/revoke` | Owner-only; membership transitions to REVOKED and its membership-owned scoped role grant is removed transactionally with audit. | Revoked member cannot use the store role; session invalidation is not yet implemented, so authorization must continue to re-check current role assignments per request. |

**Verification evidence on exact main head a5bb22e212973be2f14c7c2fc8d7383ba7948a16:** CI passed with Prisma validation/migration/generation, typecheck, lint, 109 test files / 540 tests, production build and all three route/authorization/mutation inventories. PostgreSQL integration passed. Browser E2E passed 9/9, including seller workspace, product draft create/edit, shipping-rate editing and dispatch-address persistence.

**Boundaries:** this closes the current seller portal surface, not all Phase 5 work. Procurement and the admin command center remain open. Seller commission statements do not create a payable balance or payout; those belong to Phase 6. Live carrier integrations remain conditional. No Vercel deployment was performed.


| Seller application pending review | Seller workspace /seller → authenticated owner profile | GET /api/seller/stores → getSellerWorkspace → Seller | The workspace now returns the authenticated owner's complete submitted application profile (business/contact details, selling plan, social links, map coordinates and submitted timestamp). A dedicated pending-review state displays the submitted record and status instead of dropping the seller into the operational dashboard. | Implemented on main; runtime/browser verification intentionally deferred. |


## Seller finance and payout-method journeys — 2026-11-10

| Journey | UI → API → persistence | Authorization and safety boundary | Current result |
|---|---|---|---|
| Owner exports store workbook | `/seller/finance` → `GET /api/seller/stores/[storeId]/export` → Store/Product/ProductVariant/ProductPrice/Inventory/Warehouse | Current session; server checks `Store.seller.ownerId`; bounded DB queries; inventory is constrained by both warehouse and product store; private/no-store; audit counts/truncation; buyer PII excluded | Merged to main in PR #87; Browser E2E and CodeQL passed |
| Owner saves IBAN beneficiary | `/seller/payouts` → `POST /api/seller/payout-methods` → SellerPayoutMethod | Current session + seller-owner check; country-specific IBAN length, MOD-97 checksum and country-prefix validation; AES-256-GCM encryption; fingerprint dedupe; no plaintext bank identifier in DB/audit/API | Merged to main in PR #88; PostgreSQL integration, CodeQL and Browser E2E passed |
| Owner lists, changes default or disables beneficiary | `/seller/payouts` → `GET/PATCH/DELETE /api/seller/payout-methods/[methodId]` → SellerPayoutMethod + AuditLog | Every operation is seller-owner scoped; list exposes masked identifier only; default is per currency; disabled record clears encrypted details; MFA errors are explicit | Implemented; separate manual admin ownership review now exists; no payout transfer |
| Seller receives funds / withdraws | Not yet implemented | Must require approved finance policy, source-event journal posting, available/held balance, verified beneficiary, atomic reservation, approval, provider/bank confirmation and reconciliation | BLOCKED; no withdrawable balance or withdrawal control may be shown |

**Important:** A saved default IBAN is not verified until an administrator completes the separate manual review. `PENDING_VERIFICATION` is the only creation state; local bank-account formats remain disabled. Admin review records an out-of-band human attestation only. Existing commission snapshots and refund allocations are informational and are not a seller payable ledger.


## Admin seller payout destination review — 2026-11-12

| Actor action | UI → API → persistence | Authorization, privacy and concurrency | Verified outcome / boundary |
|---|---|---|---|
| Admin opens payout review queue | `/admin/seller-payout-methods` → `GET /api/admin/seller-payout-methods?status=...&page=...` → SellerPayoutMethod + Seller + User | Current session; global `platform:manage` and fresh TOTP step-up; bounded status/page; response contains only masked bank destination fields and the submission generation | Pending/verified/rejected queues are paginated; no encrypted bank identifier is returned |
| Admin verifies or rejects a destination | Evidence/reason fields → `POST /api/admin/seller-payout-methods/[methodId]/review` → `reviewSellerPayoutMethod` → SellerPayoutMethod + AuditLog | Same-origin JSON mutation; platform permission + step-up; seller owner cannot verify their own destination; evidence reference and reason required; database atomically checks `PENDING_VERIFICATION` plus the exact `submissionVersion` inspected | Decision and audit event commit together. Stale or concurrent submissions return 409; no audit decision is written when the atomic guard fails |
| Seller disables and later re-registers a destination | `/seller/payouts` → payout-method API → SellerPayoutMethod | Seller-owner scope; encrypted identifier is cleared on disable; re-registration increments `submissionVersion` even if the same row ID/fingerprint is reused | A review opened against an older submission cannot approve the re-registered destination |
| Bank transfer / seller withdrawal | Not implemented | Requires approved ledger policy, payable balance, verified beneficiary, reservation, approval, provider/bank confirmation and reconciliation | BLOCKED; admin review is not a transfer or payout execution |

**Exact-head evidence:** `401cb342d034dd8ad27576dde053ce3454891b7d` — CI, PostgreSQL integration, Browser E2E (13/13) and CodeQL passed. Vercel rate limiting is excluded from the application merge gate.


## Payout review queue correctness refinements — 2026-11-12

| Concern | Implementation | Persistence / verification |
|---|---|---|
| Deep pagination | The queue accepts every page whose 50-row offset is a safe integer; page 1001 is covered by a route test using 50,001 total records | `GET /api/admin/seller-payout-methods`; route test asserts `skip: 50000` and `pageCount: 1001` |
| Evidence draft isolation | Drafts use `methodId:submissionVersion` for reads, edits, clears and session recovery | A newer submission generation cannot reuse an older evidence reference or reason |
| Filter changes during review | Successful POST reloads using status/page refs synchronously updated by the filter and pagination controls, instead of invoking a stale callback | Request sequencing still guards superseded GET responses |
| Submission date accuracy | `submittedAt` updates for every re-registration; admin list sorts/displays it; `createdAt` remains the original row creation timestamp | Migration `20261112093000_seller_payout_submission_timestamp`; domain and route tests cover timestamp update and queue ordering |

**Verification boundary:** These latest queue refinements are committed but their exact-head CI, PostgreSQL, Browser E2E and CodeQL checks are pending. Previous passing checks apply to the earlier reviewed head only.


## Accounting journal integrity checkpoint — 2026-11-12

- Strengthened idempotent retry matching: the same key must now match source, currency,
  description, occurrence timestamp, reversal reference and canonical journal lines.
- Added `createdTransactionId` and migration `20261112130000_journal_append_only_integrity`.
  Journal lines may only be inserted in the transaction that creates their journal entry;
  later append attempts are rejected by PostgreSQL, even if a caller bypasses the service.
- The deferred database integrity trigger now also rejects inactive accounts as well as
  currency mismatches and unbalanced entries.
- Added `tests/finance/ledger.test.ts` and
  `tests/integration/ledger-postgres.integration.test.ts`.
- Verification is pending: Prisma validate/generate, typecheck, focused Vitest, migration
  replay, and the PostgreSQL integration suite have not been run on this commit.
