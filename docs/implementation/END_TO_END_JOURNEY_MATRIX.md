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
| 01 | Identity, authentication and customer account | Implemented / unverified — email/password identity, recovery, verification, logout, buyer/seller account choice, Google OIDC+PKCE and customer account hub/profile/address pages now exist | `/login`, `/register`, `/terms`, `/privacy`, `/verify-email`, `/forgot-password`, `/reset-password`, `/account`, `/account/profile`, `/account/security`, `/account/sessions`, `/account/addresses`, `/account/orders`, `/account/favorites`, `/account/store`, `/seller` | Partial — registration stores policy v1 consents; seller choice creates a pending Seller record without permissions; Google callback creates/uses OAuthAccount and session; customer profile, addresses and session revocation call authenticated APIs. Account security page links to reset and active-session workflows; 2FA is explicitly unavailable. Exact-head CI and browser/provider-backed journey not yet passed. | Existing User, Seller, OAuthAccount, UserConsent, UserSession, VerificationToken, UserAddress, Favorite and related models cover this scope; no schema change required in this slice | Previous head PostgreSQL integration passed; latest CI was failing only on unescaped apostrophes in policy pages, now fixed. Exact-head CI, Google provider configuration and HTTP/browser journey pending |
| 02 | Product catalog and discovery | Mapped / partially wired — server-rendered catalog, product detail, category/brand/store surfaces exist; not release-verified | `/`, `/products`, `/products/[slug]`, `/categories`, `/categories/[slug]`, `/brands`, `/brands/[slug]`, `/stores`, `/stores/[slug]` | Partial — public reads require active/approved products and active sellers/stores; detail includes safe media, market prices, localized attributes and SEO. Product detail wires cart, favorite, store message, reviews and Q&A; action journeys remain unverified. | Product, ProductCategory, ProductTranslation, ProductMedia, ProductVariant, ProductPrice, ProductAttribute, VariantAttribute, Category/Translation, Brand/Translation, Store, Seller, Market/Currency; no schema change | Focused catalog tests and typecheck pass in the current worktree. No exact-head PostgreSQL/browser verification; product attribute authoring and structured offers remain open. |
| 03 | Search, filtering and sorting | Mapped / partially wired — query, synonym expansion, market/category/brand/store filters, sort and pagination exist; not release-verified | `/search`, `/products`, homepage discovery controls and header search | Partial — GET `/api/products` uses SearchSynonym and public discovery; `/products` and `/search` share URL-backed filters. Autocomplete, relevance ranking and browser/back-forward journey remain. | SearchSynonym, Product/ProductTranslation, ProductCategory, Brand, Category, Store/Seller, ProductVariant/ProductPrice, Market/Currency | Focused catalog tests and typecheck pass in the current worktree. No exact-head PostgreSQL/runtime journey has been run. |
| 04 | Cart and checkout | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 05 | Orders and order tracking | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 06 | Product and store reviews | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 07 | Wishlist, favorites and recommendations | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 08 | Product questions and answers | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 09 | Customer messaging and support | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 10 | Customer notifications | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 11 | Returns and refunds (customer journey) | `/account/returns`, `/seller/returns`, `/admin/returns`, `/admin/refunds` | Customer request → store-scoped seller decision → warehouse quarantine receipt → finance manual refund request/confirmation | ReturnRequest, ReturnItem, Inventory, InventoryMovement, Refund, RefundItem, Payment, AuditLog | PR #46 CI + PostgreSQL passed; manual refund PR exact-head CI pending; browser journey pending | Physical receipt and merchandise-only manual refund ledger implemented; no provider refund API, quarantine release, tax/shipping refund or dispute flow |
| 12 | Seller onboarding, verification and KYC | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 13 | Seller dashboard and analytics | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 14 | Seller product management | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 15 | Seller order management | Partial — seller preparation actions added; shipment lifecycle remains unavailable | `/seller/orders`, `PATCH /api/seller/orders/[vendorOrderId]/status` | `transitionSellerVendorOrder`; session-derived store ownership / exact `orders:manage`; `CONFIRMED → PROCESSING → READY_TO_SHIP` | Existing `VendorOrder`, `VendorOrderStatusHistory`, `Order`, `OrderStatusHistory`, `AuditLog`; no schema change | Exact-head CI and focused PostgreSQL authorization/concurrency verification pending; no shipment label/tracking or delivered transition |

| 16 | Seller inventory and warehouse management | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 17 | Supplier and procurement management | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 18 | Shipping and fulfillment (seller) | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 19 | Seller finance, commissions and payouts | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 20 | Seller marketing and promotions | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 21 | Seller reviews and reputation | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 22 | Seller staff and scoped permissions | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 23 | Store management and settings | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 24 | Platform admin dashboard / command center | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 25 | User administration | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 26 | Seller administration and KYC review | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 27 | Catalog administration | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 28 | Central order operations | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 29 | Payment administration | Provider-neutral buyer payment entry implemented; manual refund ledger added; admin lifecycle remains partial / unverified | Buyer order detail; payment intent/webhook; `/admin/refunds`; `GET/POST /api/admin/refunds`; `PATCH /api/admin/refunds/[refundId]` | Finance permission `payments:refund`; create refund only for received lines; allocate merchandise value and cap against captured payment; external reference required to complete; late success webhook preserves refund status; no provider refund adapter is registered. | `Payment`, `PaymentWebhookEvent`, `Refund`, `RefundItem`, `Order`, `Currency`, `ReturnRequest`, `ReturnItem`, `AuditLog` | Exact-head CI + PostgreSQL pending for manual refund slice; merged as `ffbf76897a9ee8d15ad3d14a18508efe6f0986a9`. No live provider/browser payment verified. |
| 30 | Commission management | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 31 | Accounting and general ledger | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 32 | Payout administration | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 33 | Returns, refunds and disputes administration | `/admin/returns`, `/admin/refunds` | Admin return review; seller warehouse receipt; finance refund queue/create/external completion | ReturnRequest, ReturnItem, Inventory, InventoryMovement, Refund, RefundItem, Payment, AuditLog | PR #46 CI + PostgreSQL passed; manual refund exact-head CI pending | Manual merchandise refund ledger only; no provider API, tax/shipping refund, disputes or evidence deadlines |

| 34 | Shipping administration | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 35 | Tax and regulatory compliance | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 36 | Promotions, coupons, loyalty and gift cards | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 37 | Review moderation | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 38 | Central customer support | Not audited | Not mapped | Not audited | Not audited | Not verified |
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
| Verify email | `/verify-email` submit → `POST /api/auth/verify-email` | same-origin guard → `verifyUserEmail`; consumes one-time token and activates only PENDING user; AuditLog | Shows server message; token removed from visible URL. Needs real email delivery and HTTP/browser proof. |
| Resend verification | `/verify-email` resend → `POST /api/auth/verification/resend` | IP throttle → issue new single-use token digest → Resend adapter | Generic anti-enumeration response; needs configured sender and delivery smoke test. |
| Request reset | `/forgot-password` submit → `POST /api/auth/password-reset/request` | trusted IP + separate reset throttle → eligible account challenge, token digest, AuditLog → Resend adapter | Generic response regardless of account existence; needs delivery smoke test. |
| Complete reset | `/reset-password` submit → `POST /api/auth/password-reset/complete` | consume token once → hash new password → revoke all sessions → AuditLog | User can sign in with new password; service has PostgreSQL coverage on earlier commit; current UI requires exact-head CI/HTTP proof. |
| Register | `/register` displays unavailable state; no submit control | Registration API/service exists but API is server-side gated by `PUBLIC_REGISTRATION_ENABLED=false`; consent stored in UserConsent; legal documents are absent | Deliberately blocked until approved Terms and Privacy Notice are published. No false success. |
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
| Header search | GET `/search?q=...` → shared state → GET `/api/products` → `listDiscoverableProducts` | Product, ProductTranslation, SearchSynonym, ProductVariant, ProductPrice, Store, Seller, Market, Currency | Query and synonyms wired. Verify results, malformed query, browser history and empty/error states. No autocomplete. |
| Homepage category select | Category control → categoryId state → GET `/api/products` | Category, ProductCategory, Product | Filter wired; verify URL restoration and exact results. |
| Category “View all” | Link → `/categories` | Category, CategoryTranslation | Corrected to navigate to directory rather than clearing filter. |
| Homepage brand select | Brand control → brandId state → GET `/api/products` | Brand, BrandTranslation, Product | Filter wired; verify state, URL and result set. |
| Product listing filters | Market/category/brand/sort/page → GET `/api/products` | Market, Currency, StoreMarket, ProductPrice, ProductVariant, ProductCategory | Source wiring exists; verify invalid market/currency and no-results. |
| Product detail open | `/products/[slug]` → `getDiscoverableProduct`; client GET `/api/products/[productId]` where the value is a slug | Product, ProductTranslation, Store, Seller, Brand, ProductMedia, ProductVariant, ProductPrice | Slug lookup exists; API parameter naming is misleading. Verify valid active-market price contexts. |
| Add to cart | Product detail → POST `/api/cart/items` → `addCartItem` | GuestSession, Cart, CartItem, ProductVariant, ProductPrice, Inventory, InventoryReservation | Client handles non-2xx. Verify guest/customer, stale stock/price, duplicate clicks and reload persistence. |
| Favorite | Product detail → POST/DELETE `/api/favorites/[productId]` | Favorite, User, Product | Verify unauthenticated, duplicate add, remove and reload consistency. |
| Contact store | Product detail → POST `/api/messages` → `startStoreConversation` | StoreConversation, StoreMessage, User, Store | Verify authorization, duplicate conversation and message persistence. |
| Category/brand/store browse | Directory and slug services → product grid | Category/Translation, Brand/Translation, Store, Seller, Product | Pages exist but detail lists are fixed to first 48 and directory pagination is absent. Verify 404, empty state, hierarchy and full result coverage. |

**Blocking gaps:** fix category hierarchy pagination; add bounded pagination to category/brand/store result lists and store directory; separate `/products` and `/search` layouts from homepage; run critical HTTP/browser journeys. Keep schema unchanged unless a real missing business entity/relation is demonstrated.


**Taxonomy correction update — 2026-11-04:** Category tree retrieval now pages root categories and fetches descendants level-by-level before tree assembly. Pagination totals are root-category totals. Focused tests cover deep descendants and malformed-cycle termination. This closes the previously recorded parent/child page-split defect at source level; exact-head CI is pending.

## Search journeys — 2026-11-04

| Action | UI → API/service | Data boundary | Verification gate |
|---|---|---|---|
| Public search | Global search → `/search?q=...` → discovery service | Active products/sellers/stores; tokens across localized fields, identifiers, variants, brands, categories and store; active synonyms | Exact-head CI, filter/pagination, empty/error and browser verification |
| Autocomplete | Header combobox → `GET /api/search/suggestions?q=...` | Maximum six products and four active stores; bounded query | Debounce/abort, stale response, keyboard and screen-reader checks |
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
