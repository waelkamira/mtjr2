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
| 01 | Identity, authentication and customer account | Implemented / unverified — email/password registration, login, verification, recovery and logout; explicit CUSTOMER/SELLER choice; protected buyer account pages; seller application; and Google OIDC+PKCE source are present, but no live browser/provider journey is claimed | `/login`, `/register`, `/terms`, `/privacy`, `/verify-email`, `/forgot-password`, `/reset-password`, `/account`, `/account/profile`, `/account/security`, `/account/sessions`, `/account/addresses`, `/account/orders`, `/account/favorites`, `/account/wishlist`, `/account/store`, `/seller` | Partial — registration stores v1 Terms/Privacy consent; CUSTOMER persists the seeded CUSTOMER role; SELLER creates a PENDING Seller without a SELLER role; seller approval is the only reviewed path that grants SELLER; Google callback uses state/PKCE and validates issuer, audience, verified email and expiry, blocks new OAuth accounts when public registration is disabled, and refuses silent same-email linking; profile/address/favorites/orders APIs derive ownership from the current session; `/account` descendants are guarded by the server layout; logout revokes the cookie-backed session. 2FA remains unavailable. | Existing User, UserRoleAssignment, Seller, OAuthAccount, UserConsent, UserSession, VerificationToken, UserAddress, Favorite and Order models cover this scope; no schema change required | Original head `1aee590a98f3bd2e8f682be1e721cec7acf989c1`: General CI [41762316070](https://github.com/waelkamira/mtjr2/actions/runs/41762316070) and PostgreSQL [41762316053](https://github.com/waelkamira/mtjr2/actions/runs/41762316053) passed. Follow-up account/OAuth/role fixes need fresh exact-head CI/PostgreSQL; Google credentials, email/proxy configuration and browser journey remain external/unverified |
| 02 | Product catalog and discovery | Mapped / partially wired — public discovery, product detail, category/brand/store surfaces exist; not verified | `/`, `/products`, `/products/[slug]`, `/categories`, `/categories/[slug]`, `/brands`, `/brands/[slug]`, `/stores`, `/stores/[slug]` | Partial — discovery/taxonomy/store reads exist; product detail wires cart, favorite, store message, reviews and Q&A. Actions still need full authorization/persistence/refresh journey evidence. | Product, ProductCategory, ProductTranslation, ProductMedia, ProductVariant, ProductPrice, Category/Translation, Brand/Translation, Store, Seller, Market/Currency; no schema change justified | Source audit at `d205a6a`: active product/store/seller and market/currency filters present. CI + PostgreSQL passed. Pagination, category-tree defect, dedicated page composition and browser journey remain open. |
| 03 | Search, filtering and sorting | Mapped / partially wired — query, synonym expansion, market/category/brand filters, sort and pagination exist; not verified | `/search`, `/products`, homepage discovery controls and header search | Partial — GET `/api/products` uses SearchSynonym; URL state is shareable. Autocomplete, relevance ranking, dedicated composition and browser/back-forward journey remain. | SearchSynonym, Product/ProductTranslation, ProductCategory, Brand, Category, Store/Seller, ProductVariant/ProductPrice, Market/Currency | Source audit at `d205a6a`: Zod query bounds, active seller/store/product filters and JSON-safe BigInt prices; focused tests exist. CI + PostgreSQL passed. Runtime journey not run. |
| 04 | Cart and checkout | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 05 | Orders and order tracking | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 06 | Product and store reviews | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 07 | Wishlist, favorites and recommendations | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 08 | Product questions and answers | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 09 | Customer messaging and support | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 10 | Customer notifications | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 11 | Returns and refunds (customer journey) | `/account/returns`, `/orders/[orderId]` | Customer return APIs/services and screens | ReturnRequest, ReturnItem, Order, OrderItem, VendorOrder | CI + PostgreSQL passed on merged implementation; deployed browser journey pending | Implemented / unverified; no refund execution |
| 12 | Seller onboarding, verification and KYC | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 13 | Seller dashboard and analytics | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 14 | Seller product management | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 15 | Seller order management | Not audited | Not mapped | Not audited | Not audited | Not verified |
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
| 29 | Payment administration | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 30 | Commission management | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 31 | Accounting and general ledger | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 32 | Payout administration | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 33 | Returns, refunds and disputes administration | `/admin/returns` | Admin return queue/review APIs and UI | ReturnRequest, ReturnItem, AuditLog | CI + PostgreSQL passed on merged implementation; admin browser journey pending | Implemented / unverified; workflow-only, no funds movement |
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
| Register | `/register` Customer/Buyer or Seller choice + separate Terms and Privacy checkboxes → `POST /api/auth/register` | server-side registration policy → Zod validation → pending User + one-time VerificationToken digest + UserConsent v1; CUSTOMER gets the seeded CUSTOMER role, SELLER gets a PENDING Seller only | Development/test flow is wired. Production registration is hard-blocked; v1 policy pages are development drafts, not final approved legal documents. Real email delivery needs Resend configuration. |
| Google sign-in | `/register` Continue with Google → `GET /api/auth/google/start` → Google authorization → `GET /api/auth/google/callback` | state and PKCE verifier are HttpOnly cookies; callback exchanges code, checks Google tokeninfo issuer/audience/email_verified/exp, persists OAuthAccount/consents/session, and only creates a new account when public registration is enabled | Existing linked accounts may sign in; same-email accounts are not silently linked. Requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and the exact registered callback URI. No real Google provider run is claimed. |
| Buyer account pages | `/account`, `/account/profile`, `/account/addresses`, `/account/favorites`, `/account/orders` | account layout resolves the HttpOnly session; profile/address/favorite/order queries use session.userId; address country contract uses `iso2` ↔ `countryCode` and `countryName` | A PostgreSQL integration test has been added for profile read/update, address create/list, favorites list/remove and orders list using a mocked current session backed by disposable DB rows; its latest-head result is pending. No live browser journey or end-user data test was run. |
| Seller onboarding | Register with SELLER → email verification → `/seller` → `POST /api/seller/applications` | Seller row is PENDING; no SELLER role is assigned; store creation requires `store:manage` and ACTIVE seller; admin approval assigns SELLER | Unit/PostgreSQL tests cover pending state and no selling permission before approval. Full browser and admin-approval journey remains unverified. |
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


## Identity/account follow-up audit — 2026-11-04

- Confirmed the saved-address page previously sent `countryId` and expected a nested `country` object, while the actual public country API returns `iso2` and the account API returns `countryCode`/`countryName`. The UI now follows the existing service contract; focused unit tests cover the owner scope and response shape.
- Confirmed and closed the production Google-registration bypass: the callback now blocks creation of a new OAuth-backed account when public registration is disabled, without blocking sign-in for an already-linked Google identity.
- Persisted the explicit CUSTOMER choice through the existing global CUSTOMER role. SELLER registration creates a PENDING Seller and no seller role; the PostgreSQL integration test asserts `store:manage` is denied before approval.
- Original PR #15 was already merged before this audit. Follow-up code and documentation are on the same feature branch after a fast-forward to the current main base. Fresh exact-head CI/PostgreSQL and browser/provider evidence remain required before System 01 can be marked Verified or Complete.

## Identity exact-head recheck — 2026-11-04

For audited pre-update head `5a24e38c4ae448108384438772f6c5d47a701c11`, GitHub Actions returned no workflow runs and the commit Checks API returned no check-runs. The previous CI/PostgreSQL successes on `0574d94ed9330667edee1ad2843e97ee2169807c` do not verify this head. Therefore the new buyer-account PostgreSQL test, the identity path-filter change, and the overall identity exit gate remain **pending**, not passed. The Vercel build-rate-limit status is deployment-only and does not substitute for CI. No browser runtime was available; real email, trusted-edge and Google provider flows remain unverified. Recheck both workflows on the resulting documentation commit's exact SHA before closure.


## Google OIDC verifier hardening — 2026-11-05

| Journey | UI → API/service | Security and persistence | Verification |
|---|---|---|---|
| Google sign-in / registration | /register → GET /api/auth/google/start → Google authorization-code callback | State cookie, PKCE S256 verifier and one-time nonce; callback verifies RS256 signature against Google's published JWKS, issuer, audience/authorized party, expiry, issued-at, verified email and nonce. OAuthAccount links by stable Google sub; matching local email is not silently linked. | Source and focused unit cases added. Repository CI/PostgreSQL on the resulting head and a real Google project/browser journey remain unverified. |

The previous production tokeninfo validation call was removed because Google documents that endpoint for debugging, not production validation. This correction does not prove a live provider sign-in. System 01 remains Implemented / unverified.


## Identity buyer/seller journey evidence review — 2026-11-06

| Journey step | UI / API / service | Persistence and authorization | Evidence status |
|---|---|---|---|
| Buyer registration | /register → POST /api/auth/register → registerUser | Explicit CUSTOMER role; required Terms/Privacy v1 consent; PENDING User; one-time VerificationToken digest | Source reviewed; existing PostgreSQL integration asserts pending state, two consents, digest-only token and CUSTOMER assignment. Exact resulting-head Actions pending. |
| Verify email | POST /api/auth/verify-email → verifyUserEmail | Atomic single-use challenge consumption; only PENDING user becomes ACTIVE and receives emailVerifiedAt | Source reviewed; PostgreSQL integration checks concurrent verification consumes the token once. |
| Login/session | POST /api/auth/login → loginWithPassword | Requires ACTIVE + verified email; persistent throttling; HttpOnly cookie; only session digest stored | Source and PostgreSQL integration reviewed; integration authenticates a verified buyer and resolves/revokes the real session. |
| Profile | GET/PATCH /api/account/profile | User ID comes from current session, never request body | PostgreSQL integration exercises read/update and asserts the session user ID is queried. |
| Addresses | GET/POST /api/account/addresses | UserAddress.userId is the current session user; active Country lookup | PostgreSQL integration creates/lists an address and checks ownership. |
| Favorites | GET /api/favorites, GET/POST/DELETE /api/favorites/[productId] | Favorite query/mutation includes current session user ID | PostgreSQL integration checks list/remove scope; live browser add/reload remains unverified. |
| Orders | GET /api/orders and owned order detail | Customer order list filters by current session user ID; detail uses authenticated owner or guest token | PostgreSQL integration checks order-list ownership; no live checkout-to-history browser run is claimed. |
| Logout | POST /api/auth/logout → logoutCurrentSession | Same-origin JSON mutation; current cookie session is revoked, audited and cleared | Unit tests cover logout service. A new PostgreSQL integration case now exercises the HTTP handler and real session revocation; exact-head Actions pending. |
| Seller registration | /register with SELLER → registerUser | Creates Seller=PENDING; does not assign SELLER role or store:manage | PostgreSQL integration asserts pending status, zero role assignments and denied store:manage. |
| Seller approval | Admin review → reviewSellerApplication | PENDING→ACTIVE and SELLER role assignment occur atomically; store creation separately checks ACTIVE + store:manage | Source reviewed; live reviewer/browser journey remains unverified. |
| Google OAuth | GET /api/auth/google/start → Google → GET /api/auth/google/callback | State + PKCE S256 + nonce; JWKS RS256 signature and OIDC claims; provider-subject mapping; no silent email linking | Unit tests use synthetic signed test keys only. Real Google credentials/callback and browser consent flow remain external and unverified. |

The latest reviewed starting SHA d5208538c46003d35f8374bc04bcd64678dc5303 had no GitHub Actions workflow runs. The workflow push filters were corrected in the follow-up commit so General CI and disposable PostgreSQL can execute after the PR has already merged. No browser runtime was available; source and database integration evidence must not be described as a live browser pass.


## Exact-head identity test failure diagnosis — 2026-11-06

- On SHA e743a8afc30c1bad67c6bf164a50f5572874e3b2, General CI passed npm install, Prisma validate and Prisma generate, then failed TypeScript in the Google callback state parameter and the JWK type passed to Node crypto. Both are identity-specific type errors and have been corrected in the follow-up commit.
- The disposable PostgreSQL job successfully started PostgreSQL 16, validated/generated Prisma, applied all 23 committed migrations and seeded six system roles, 23 permissions and 67 role-permission links. The integration suite then failed during module loading because Vitest did not resolve Next.js's server-only marker; zero test cases ran. An integration-only alias/stub was added, without changing production code.
- The exact-head run did not prove buyer/seller integration success. Re-run General CI and PostgreSQL on the new SHA before accepting any of these journeys as Verified.
- The PostgreSQL push filter now includes identity tests, account, favorites, orders and seller-application paths, in addition to the workflow's existing schema and server paths.


## PostgreSQL test harness correction — 2026-11-06

On SHA 7872ea280e34ac6933cc6abcfea16f835c636c69, General CI passed completely. PostgreSQL migrations and seed passed, and the integration suite ran 7 cases: 3 passed, 4 failed. The failure traces all followed Prisma delegate spies in the buyer account test; the profile call returned 404 under the spy, and restoring the spies removed prisma.user.findUnique for subsequent tests. These were test-harness failures, not proven application authorization failures. The spies were removed and replaced with persisted-state assertions for profile update, favorites and orders. Re-run both workflows on the resulting SHA before claiming the buyer journey verified.


## Identity automated acceptance result — 2026-11-06

- Exact code/test SHA 8ecd8f6eddd42d2404e5b523e492743e442ed182: General CI run 42212333808 passed Prisma validate/generate, typecheck, lint, unit tests and production build.
- Same exact SHA: PostgreSQL run 42212333827 passed all 23 disposable migrations, seed and 7/7 integration tests. The suite includes buyer registration/verification, CUSTOMER assignment, session lifecycle, account profile/address/favorites/orders, pending seller/no selling permission, throttling, password reset and the HTTP logout endpoint.
- Seller permission remains absent while Seller.status=PENDING; the approval service is the only path that assigns the SELLER role, and store creation separately requires ACTIVE + store:manage.
- Google RS256/JWKS, state, PKCE and nonce verifier unit tests passed as part of General CI. They use generated test keys; no real Google account or provider credential was exercised.
- No live browser runtime was available. Real Google sign-in, verification-email delivery and trusted-proxy edge behavior remain external runtime acceptance items. Do not represent them as browser/provider tested.


## Identity exact-head acceptance — 2026-11-07

| Area | Exact-head evidence on `3eddb74d92f4aa369a4e2e3917de2a2066381514` | Remaining boundary |
|---|---|---|
| General CI | [Run 42212894665](https://github.com/waelkamira/mtjr2/actions/runs/42212894665): quality job passed Prisma validate/generate, typecheck, lint, unit tests and production build. | No live browser runtime was available. |
| PostgreSQL | [Run 42212894876](https://github.com/waelkamira/mtjr2/actions/runs/42212894876): PostgreSQL 16, all 23 disposable migrations, baseline seed (6 roles / 23 permissions / 67 links), and 7/7 integration tests passed. | Database is disposable CI only; no owner or production database was used. |
| Buyer registration and verification | PostgreSQL asserts CUSTOMER assignment, PENDING user, both v1 consents, hashed verification token, and exactly one successful concurrent token consumer. | Real email delivery requires operator-provided Resend configuration. Production public registration is intentionally disabled by the current environment policy. |
| Login, account and logout | Verified-user login/session lifecycle, throttling, profile read/update, address create/list, favorites/order scoped service calls, and HTTP logout/revocation/audit/cookie clearing are covered by the passing integration suite. | The favorites/orders test does not yet seed populated cross-user fixtures; no live browser persistence/redirect test was run. Login HTTP needs a trusted edge header configuration. |
| Seller | PostgreSQL verifies SELLER registration creates a PENDING Seller with no role assignments and no `store:manage`. Seller approval and ACTIVE-only store creation have focused unit coverage. | No live admin-review/browser journey was run. |
| Google OAuth | Generated-key tests exercise RS256/JWKS validation, audience, expiry, nonce, signature and malformed-token rejection; source review confirms state and PKCE S256 flow. | Real provider sign-in requires Google client credentials and the exact callback registration; no live Google account was used. |

Automated source/CI/PostgreSQL acceptance is verified at the stated SHA. Browser, email-provider, trusted-proxy and real Google provider behavior remain untested external runtime gates; do not represent them as live-tested.
