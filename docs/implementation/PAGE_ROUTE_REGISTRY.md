# Application Page & Route Registry

**Project:** Mtjr2 global multi-vendor marketplace  
**Status:** Initial required-page inventory; not yet a verified inventory of every route in the codebase  
**Canonical plan:** `docs/architecture/COMPLETE_PLATFORM_SYSTEMS_BLUEPRINT.md`  
**Required journey standard:** `docs/implementation/END_TO_END_JOURNEY_STANDARD.md`  
**Rule:** A listed target route is not proof that the route exists or works. Actual filesystem route, API/service, schema usage, authorization, and evidence must be filled in during route-by-route audit.

## Status vocabulary

- **Not audited** — existence and behavior have not been verified against the current branch.
- **Missing** — required route does not exist.
- **Partial** — route exists but journey, API connection, authorization, states, or verification is incomplete.
- **Implemented / unverified** — route and apparent wiring exist, but evidence is insufficient for completion.
- **Verified** — journey and relevant security/data behavior have been checked; evidence is recorded.
- **Conditional** — only enabled after a provider, policy, or product decision is approved.

## Required registry fields

For each route record: **Route | Audience/role | Owning system(s) (1–49) | Page/component | API/domain service | Prisma entities | Status | Verification evidence / gaps**. For each interactive action on that route, also trace the exact entry button/link, handler/request, input and response contracts, authorization, domain rules, persistence/state transition, relevant failure states, and test evidence per END_TO_END_JOURNEY_STANDARD.md.

## A. Public storefront and discovery

| Required route | Audience | Owning system(s) | API/service and data to confirm | Initial status | Evidence / gap |
|---|---|---|---|---|---|
| `/` | Everyone | 02, 03, shared market/catalog | markets, categories, brands, product discovery APIs | Partial / unverified | Confirm visible navigation, live API data, loading/error/empty states, market/currency and responsive layout |
| `/products` | Everyone | 02, 03 | `src/app/products/page.tsx` → `src/features/storefront/catalog-discovery-page.tsx` → `listDiscoverableProducts`; `GET /api/products`; Product, ProductPrice, ProductVariant, Category, Brand, Store, Seller, Market, Currency | Implemented / unverified | Server-rendered, paginated catalog with keyword/category/brand/store/market/currency filters and sorting. Category and brand directory links retain their filters; focused tests and typecheck pass, but exact-head PostgreSQL/browser journey remains open. |

| `/products/[slug]` (public API accepts slug or ID) | Everyone | 02, 06–08 | `src/app/products/[slug]/page.tsx`; `GET /api/products/[productId]`; `getDiscoverableProduct`; Product, ProductTranslation, ProductMedia, ProductVariant, ProductPrice, ProductAttribute, VariantAttribute, Store | Implemented / unverified | Active/approved visibility, enabled store-market prices, safe HTTPS media, localized attributes and SEO metadata are wired. Structured product offers remain deferred until stock/price semantics are verified; browser/cart journey remains open. |
| `/search` | Everyone | 03 | `src/app/search/page.tsx` → `src/features/storefront/catalog-discovery-page.tsx`; `GET /api/search`, `GET /api/products`, `GET /api/search/suggestions` | Implemented / unverified | URL-backed keyword/category/brand/store/market/currency/price/availability filters, relevance/name/newest sorting, facets and bounded pagination share Prisma discovery. Trigram migration, runtime, browser and accessibility verification remain open. |
| `/categories` | Everyone | 02, 03 | `src/app/categories/page.tsx` → `src/features/storefront/category-directory-page.tsx`; `GET /api/categories`; Category | Implemented / unverified | Active, bounded category tree links to `/categories/[slug]`; image URLs are HTTPS-filtered. Verify API error/empty states and browser journey. |
| `/categories/[slug]` | Everyone | 02, 03 | `src/app/categories/[slug]/page.tsx`; `getActiveCategoryBySlug`; `listDiscoverableProducts({ categoryId })`; Category, CategoryTranslation, ProductCategory, Product | Implemented / unverified | Active category resolves to localized details/SEO and approved active products; inactive/missing slug returns 404. Product pagination and child-category semantics remain to audit. |
| `/brands` | Everyone | 02, 03 | `src/app/brands/page.tsx` → `src/features/storefront/brand-directory-page.tsx`; `GET /api/brands`; Brand | Implemented / unverified | Active brand directory links to `/brands/[slug]`; verify API error/empty states and browser journey. |
| `/brands/[slug]` | Everyone | 02, 03 | `src/app/brands/[slug]/page.tsx`; `getActiveBrandBySlug`; `listDiscoverableProducts({ brandId })`; Brand, BrandTranslation, Product | Implemented / unverified | Active brand resolves to localized details/SEO and approved active products; inactive/missing slug returns 404. Product pagination remains to audit. |
| `/stores` | Everyone | 02, 12, 23 | `src/app/stores/page.tsx`; `listDiscoverableStores`; Store, Seller, Product | Implemented / unverified | Lists active stores/sellers with active, approved products. First 48 only; search/pagination remain. |
| `/stores/[slug]` | Everyone | 02, 06, 12, 23 | `src/app/stores/[slug]/page.tsx`; `getDiscoverableStoreBySlug`; `listDiscoverableProducts({ storeId })`; `StoreReviews`; Store, StoreReview, StoreReview media, Seller, Product | Implemented / unverified | Hides inactive stores/sellers, scopes approved products to the store, and loads published review aggregates/list from the store review API. Profile completeness and journey verification remain. |
| `/terms`, `/privacy` | Everyone | 01 / shared platform | Static versioned pages `src/app/terms/page.tsx` and `src/app/privacy/page.tsx` | Development draft / unverified | Version v1 drafts disclose that the operator company is not yet incorporated; not final legal policies. `/help`, `/contact`, `/cookies` remain unaudited. |

## B. Identity and customer account

| Required route | Audience | Owning system(s) | API/service and data to confirm | Initial status | Evidence / gap |
|---|---|---|---|---|---|
| `/login` | Guest | 01 | `src/app/login/page.tsx` → `src/features/identity/auth-page.tsx`; `POST /api/auth/login`; login/session services; User, UserSession, LoginAttempt, AuditLog | Implemented / unverified | Form calls the real login API, handles server errors/loading, and validates same-origin return paths; verify unverified-account guidance, cookie behavior, HTTP/browser journey and logout continuation. |
| `/register` | Guest | 01, 12 | `src/features/identity/register-form.tsx`; `POST /api/auth/register`; registration service; User, Seller, VerificationToken, UserConsent | Implemented / unverified | Requires explicit Customer/Buyer or Seller selection. Seller registration creates a PENDING Seller record without granting SELLER permissions. Separate unchecked policy consents stored as v1. Google OAuth start/callback added; requires GOOGLE_CLIENT_ID/SECRET. Production registration remains hard-blocked. Exact-head CI and provider-backed journey pending. |
| `/verify-email` | Guest/customer | 01 | `src/app/verify-email/page.tsx` → shared auth page; `POST /api/auth/verify-email`, `POST /api/auth/verification/resend`; verification service; User, VerificationToken, AuditLog | Implemented / unverified | Token submission and resend are wired; token is removed from visible URL after capture. Verify email delivery, expiry/replay, rate limits and deployed HTTP journey. |
| `/forgot-password` | Guest | 01 | `src/app/forgot-password/page.tsx` → shared auth page; `POST /api/auth/password-reset/request`; password-reset service; PasswordResetToken, LoginRateLimitBucket, AuditLog | Implemented / unverified | Generic anti-enumeration response is rendered; verify email delivery, rate limiting and deployed HTTP journey. |
| `/reset-password` | Guest | 01 | `src/app/reset-password/page.tsx` → shared auth page; `POST /api/auth/password-reset/complete`; password-reset service; PasswordResetToken, UserSession, AuditLog | Implemented / unverified | Password update API is wired; token removed from visible URL, sessions revoked by service. Verify expiry/replay and deployed HTTP journey. |
| `/api/auth/google/start`, `/api/auth/google/callback` | Guest | 01 | Google OIDC authorization-code + PKCE; OAuthAccount, User, Seller, UserConsent, UserSession, AuditLog | Implemented / conditional | State + PKCE cookies, verified Google identity/audience/email, no automatic email-based account linking, session creation. Requires Google OAuth credentials and redirect URI registration; provider journey not yet run. |
| `/account` | Customer | 01, 05, 07, 09, 10 | `src/app/account/page.tsx`; navigation to profile, security, sessions, orders, favorites, addresses, returns, reviews, questions, messages, support, notifications, seller workspace | Implemented / unverified | Account dashboard links to existing customer/seller routes; each destination remains independently subject to journey verification. |
| `/account/profile` | Customer | 01 | `src/app/account/profile/page.tsx`; `GET/PATCH /api/account/profile`; User | Implemented / unverified | Reads authenticated user's own profile and updates display name with server session ownership and validation. HTTP/browser verification pending. |
| `/account/security` | Customer | 01 | `src/app/account/security/page.tsx`; links to password reset and session management | Implemented / unverified | 2FA is explicitly marked unavailable; no fake enrollment control. |
| `/account/sessions` | Customer | 01 | `src/app/account/sessions/page.tsx`; `GET/DELETE /api/account/sessions`; UserSession, AuditLog | Implemented / unverified | Lists only own active sessions and revokes an owned session; current-session revocation clears cookie. Verify with browser and concurrent requests. |
| `/account/addresses` | Customer | 01, 04 | `src/app/account/addresses/page.tsx`; `GET/POST /api/account/addresses`; UserAddress, Country | Implemented / unverified | List and create address are connected; edit/delete are not exposed yet. Verify country selection and validation. |
| `/account/orders` | Customer | 05 | `GET /api/orders`; Order, VendorOrder | Implemented / journey verification pending | Lists the signed-in customer's own orders and links each order to its detail/timeline. |
| `/orders/[orderId]` | Customer | 05, 11 | order detail, payment, cancel and reorder APIs; ShipmentTrackingEvent | Implemented / journey verification pending | Owner-scoped status timelines, shipment tracking, pre-payment cancellation, safe reorder and return entry; invoice generation and paid cancellation/refunds are deferred. |
| `/cart` | Guest/customer | 04 | cart APIs; Cart, CartItem; coupon applied when creating a quote | Implemented / unverified | Guest/customer merge, variant/stock checks and checkout quote are wired; verify exact-head HTTP/browser behavior |
| `/checkout` and its steps | Guest/customer | 04, 05, 07 | quote, address, shipping, coupon, tax, order and payment services | Implemented / unverified | Requires an active tax rule and seller shipping rates; order remains PENDING_PAYMENT and no charge is implied. Coupon migration is applied to local `mtjr2_demo`; checkout-specific PostgreSQL/browser journey remains pending. |
| Order confirmation route | Customer | 05, 07 | order detail/payment status API | Partial / unverified | Must reflect server-side order/payment status |
| `/account/wishlist`, `/account/favorites` | Customer | 07 | wishlist page; favorites APIs; Favorite | Implemented / unverified | Both route names resolve to the same persisted wishlist experience. |\n| `/account/store` | Seller/applicant | 12, 23 | alias to `src/features/seller/workspace-page.tsx`; seller/store APIs; Seller, Store | Implemented / unverified | Reuses the same seller workspace and server-side permissions as `/seller`. |
| `/account/reviews` | Customer | 06 | `GET /api/account/reviews`, `POST /api/account/reviews/[reviewId]/appeal`; ProductReview, StoreReview, ReviewMedia, ReviewAppeal | Implemented / unverified | Lists the customer's submitted reviews and appeal status; author-only appeal is allowed once for rejected/hidden reviews. Verify delivered-purchase, appeal, and refresh journeys. |
| `/account/questions` | Customer | 08 | customer Q&A API; ProductQuestion | Implemented / unverified | Verify ownership and moderation states |
| `/account/returns` | Customer | 11 | returns API; ReturnRequest, ReturnItem | Implemented / unverified | No refund/payment movement in current return slice |
| `/account/messages`, `/account/messages/[conversationId]` | Customer | 09 | messaging APIs; StoreConversation, StoreMessage | Implemented / unverified | Participant isolation and read states |
| `/account/support`, `/account/support/[ticketId]` | Customer | 09 | support APIs; SupportTicket, SupportMessage | Implemented / unverified | Internal notes must never be exposed |
| `/notifications` | Customer/seller | 10 | notification APIs; Notification, NotificationPreference | Implemented / unverified | User scoping and preference enforcement |

## C. Seller workspace

| Required route | Audience | Owning system(s) | API/service and data to confirm | Initial status | Evidence / gap |
|---|---|---|---|---|---|
| `/seller` | Authenticated user/seller | seller onboarding and store operations | `src/app/seller/page.tsx` → `src/features/seller/workspace-page.tsx`; `GET /api/seller/stores`, `POST /api/seller/applications`, `POST /api/seller/stores`; Seller, Store, StoreMarket, AuditLog | Implemented / unverified | Inspected on `feat/returns-workflow`: the application form is embedded in the workspace when no Seller record is returned; there is no separate `/seller/apply` or `/seller/application` route in the audited tree. Workspace fetches markets and seller stores; verify guest/expired-session behavior, pending/rejected/approved status refresh, API error contract and end-to-end browser journey. Store creation idempotency is not demonstrated by the current service. |
| `/seller/dashboard` | Approved seller | seller/store operations | seller summary services | Not audited | Show real metrics only; useful empty/configuration states |
| `/seller/onboarding` or documented equivalent | Applicant | seller onboarding | Current equivalent is embedded in `/seller`; `src/server/marketplace/seller-application.ts`; `Seller`, `AuditLog` | Partial / unverified | Dedicated onboarding/status route not found in the audited route tree. Persisted status is returned by `GET /api/seller/stores`; verify all status states and make route naming explicit rather than treating a target path as existing. |
| `/seller/store` or documented settings route | Store owner | seller/store | store APIs; Store, StoreMarket | Not audited | Store profile, localization and active markets |
| `/seller/products` | Store owner/authorized staff | 02 | seller catalog APIs; Product, ProductVariant, ProductPrice | Not audited | List/status filters and store isolation |
| `/seller/products/new`, `/seller/products/[productId]/edit` | Store owner/authorized staff | 02 | product create/update/media services | Not audited | Create/edit journey, validation and ownership |
| `/seller/inventory` | Store owner/authorized staff | inventory | inventory APIs; Warehouse, Inventory, InventoryMovement | Implemented / unverified | Verify adjustments, transfers and scope checks |
| `/seller/orders` | Store owner/authorized staff | 05, 07 | seller order/status/shipment/tracking APIs; VendorOrder, OrderItem, Shipment, ShipmentTrackingEvent | Implemented / journey verification pending | Payment-confirmed preparation; one seller-entered shipment and forward-only manual tracking updates per vendor order. |
| `/seller/shipping` or documented equivalent | Store owner | 04 | seller shipping-rate APIs; StoreShippingRate | Implemented / unverified | Confirm route and quote invalidation behavior |
| `/seller/staff` | Store owner/authorized staff | seller access control | staff APIs; SellerStaff/invitation models | Implemented / unverified | Exact store-scoped permissions and invitation lifecycle |
| `/seller/reviews` | Store owner or active staff with exact-store `reviews:manage` | 06 | `GET /api/seller/reviews`, `POST /api/seller/reviews/[reviewId]/response`; StoreReview, ReviewMedia, AuditLog | Implemented / unverified | Lists reviews only for stores owned or explicitly authorized; response mutations require published review and owner or active exact-store staff grant. Verify scope and response refresh journeys. |
| `/seller/questions` | Store owner | 08 | seller Q&A API | Implemented / unverified | Verify product/store ownership and moderation |
| `/seller/messages` | Store owner/authorized staff | 09 | seller messaging APIs | Implemented / unverified | Requires exact `messages:manage` scope |
| `/seller/returns` | Active store owner / staff with exact-store `orders:manage` / platform admin | 11 | `src/app/seller/returns/page.tsx` → `src/features/seller/returns-page.tsx`; `GET /api/seller/returns` → `listSellerReturnRequests`; ReturnRequest, ReturnItem, OrderItem, VendorOrder, Store | Implemented / unverified | Read-only; grouped by authorized store. No seller state mutation, shipping, receipt or refund action. Exact-head CI/PostgreSQL passed; browser verification pending. |

| `/seller/analytics`, `/seller/payouts`, `/seller/finance`, `/seller/settings` | Store owner | relevant finance/platform systems | analytics/ledger/payout/settings services | Not audited / conditional | Do not show fabricated values; expose only implemented workflows |

## C1. Mandatory vertical journey: apply to become a seller

This is a cross-page acceptance trace, not a claim that every step has already been verified. Reconcile each row against the actual files and update the status/evidence only after inspection and verification.

| Step | User-visible entry/action | Required route/UI behavior | Backend and persistence contract | Required failure/security coverage | Initial status |
|---|---|---|---|---|---|
| 1. Discover | Homepage/header/footer seller CTA | Navigate to the real seller entry/application route; never a dead link | No write; route must explain prerequisites | CTA target exists; unavailable onboarding is not advertised as working | Partial / unverified |
| 2. Identity gate | Continue/apply while signed out | Sign in/register, then safely return to the application; verified-email requirement is explained | Session/auth service and verified identity | No open redirect; expired session and unverified email handled | Partial / unverified |
| 3. Form | Enter business/applicant details | Required fields, labels, client validation, loading/disabled submit and accessible errors | Server schema validates same contract; only policy-approved fields collected | Missing/malformed fields, excessive payload, duplicate click, sensitive-document handling | Partial / unverified |
| 4. Submit | Submit application | Calls the real API; no client-side fake success | POST /api/seller/applications; identity comes from session; service validates account/email/status and writes application + audit atomically | Forged applicant ID, unauthenticated request, duplicate/retry, already-pending/approved/rejected state | Implemented / unverified |
| 5. Track status | Applicant opens status page | Show persisted pending/approved/rejected/needs-action state and allowed next step | Read API uses the same canonical Seller record | Other user's application cannot be read; status remains correct after reload | Partial / unverified |
| 6. Review | Admin opens seller queue, approves/rejects | Permission-gated queue; rejection requires reason where policy says so; clear confirmation/result | Admin review API, valid state transition, audit log, concurrency-safe update | Non-admin, stale status, double decision, missing rejection reason | Implemented / unverified |
| 7. Create store | Approved seller starts store setup | Only approved applicants can proceed; show draft state and missing setup tasks | Authorized store creation; Store, StoreMarket and exact owner/staff scope. Idempotency must be checked/implemented if retries can create duplicate stores. | Unapproved applicant, repeated create, cross-user/store IDs, no active market configuration | Partial / unverified |
| 8. Finish setup | Configure store and first operational steps | Show only actions supported by backend; profile/market/catalog prerequisites explicit | Store settings and market APIs; later product/warehouse services as scoped | Save errors, unavailable market, partial setup, reload and persisted state | Partial / unverified |
| 9. Verify journey | Exercise from first CTA to approved draft store | Test with real browser/HTTP flow in configured test environment | Disposable PostgreSQL for schema/transaction changes; focused auth/permission tests | Guest, verified/unverified user, duplicate submit, forbidden reviewer, approve/reject, stale transition, idempotent store creation | Not yet evidenced as one complete journey |

**Schema decision gate:** inspect prisma/schema.prisma and docs/architecture/prisma-model-usage-map.md before changing persistence. Reuse the current Seller/application representation if it covers the lifecycle. Add a model/table only if a missing durable business state or relationship is demonstrated; any change needs an additive migration and disposable-PostgreSQL verification. KYC documents, seller tax records and payout activation are separate scopes and must not be implied by basic application approval.

**Static source review on `feat/returns-workflow` (not runtime verification):** `/seller` renders `SellerWorkspacePage`; the application form is embedded in that workspace when `GET /api/seller/stores` returns no seller. The application API validates a strict two-field payload and delegates to `submitSellerApplication`, which requires a current session and verified email, creates a PENDING Seller and AuditLog transactionally, and treats an existing PENDING application as an idempotent replay. The service uses the session-derived user ID, not a client-supplied applicant ID. Admin review requires `users:manage`, a rejection reason, a conditional PENDING→ACTIVE/REJECTED update, role assignment on approval, and audit logging. **Gaps to verify/fix:** the inspected store-creation service creates a new Store per request and does not show an idempotency key or duplicate-store guard; API handlers map broad service errors to 400 in places; a dedicated applicant status route is not present in the audited route tree. These are source observations, not evidence of a browser journey or passing tests.

## C1a. Cross-cutting action audit

For every page added or modified, inventory all interactive controls (including header/footer controls, row menus, pagination, retry and destructive actions). Each control must have one of: a real verified action, an explicitly conditional/disabled state with reason, or be removed until implemented. Check UI → API → auth/validation → service → repository/Prisma → response/refresh. Keep the test set focused on distinct business invariants and security boundaries; do not create a test per helper or visual control.

## D. Platform administration

| Required route | Audience | Owning system(s) | API/service and data to confirm | Initial status | Evidence / gap |
|---|---|---|---|---|---|
| `/admin` | Platform admin | shared administration | admin summary services | Not audited | Permission-aware links and empty/error states |
| `/admin/users` | Authorized admin | 01 | user administration service; User, roles, audit | Not audited | Least privilege and audited mutations |
| `/admin/sellers` | Authorized admin | seller onboarding | `GET /api/admin/sellers`; `POST /api/admin/sellers/[sellerId]/approve`; seller review service in `src/server/marketplace/seller-application.ts`; Seller, UserRoleAssignment, AuditLog | Implemented / unverified | Route tree confirms pending queue and approval/rejection endpoint. Service checks `users:manage`, requires rejection reason, conditionally transitions only PENDING records and audits decisions. Verify admin page path, role scope, API error mapping and complete applicant-to-review journey. |
| `/admin/products` | Catalog moderator | 02 | moderation APIs; Product | Implemented / unverified | Confirm only authorized moderators |
| `/admin/categories`, `/admin/brands` | Catalog admin | 02 | taxonomy administration services | Not audited | Required management surfaces |
| `/admin/markets`, `/admin/currencies` | Platform admin | market configuration | market/currency services | Not audited | Do not infer launch market or exchange rates |
| `/admin/orders` | Authorized admin | 05 | order administration service | Not audited | Audited interventions and immutable history |
| `/admin/returns` | Returns manager | 11 | returns admin API | Implemented / unverified | Current status workflow only; no refund execution |
| `/admin/refunds` | Finance-authorized admin | refund/payment system | refund/payment/ledger service | Conditional / future | Must not appear actionable until refund implementation exists |
| `/admin/reviews`, `/admin/store-reviews` | Moderator | 06 | Product/store moderation, `GET /api/admin/reviews/reports`, `POST /api/admin/reviews/reports/[reportId]/resolve`, `GET /api/admin/reviews/appeals`, `POST /api/admin/reviews/appeals/[appealId]/resolve`; ProductReview, StoreReview, ReviewReport, ReviewAppeal, AuditLog | Implemented / unverified | Product and store queues plus report/appeal queues require `users:manage`. Decisions are conditional, audited, and stale/duplicate actions fail. Verify the moderation journey and PostgreSQL migration. |
| `/admin/questions` | Moderator | 08 | Q&A moderation API | Implemented / unverified | Verify moderation transitions |
| `/admin/support` | Support staff | 09 | ticket administration APIs | Implemented / unverified | Internal notes restricted to staff |
| `/admin/search-synonyms` | Catalog admin | 03 | audited synonym management API; SearchSynonym | Implemented / unverified | Requires `users:manage`; verify permissions and PostgreSQL migration/runtime |
| Coupon management API | Platform admin | 04 | `GET/POST /api/admin/coupons`, `PATCH /api/admin/coupons/[couponId]`; Coupon, CouponRedemption, AuditLog | Implemented / unverified | Requires `users:manage`; fixed coupons are currency-specific; migration and authorization/runtime checks pending |
| `/admin/tax-rates` | Tax admin | 04 | tax rules APIs; MarketTaxRate | Implemented / unverified | Rules require market/legal configuration |
| `/admin/shipping` or documented equivalent | Shipping admin | 04 | shipping configuration service | Not audited | Identify global vs seller configuration |
| `/admin/roles`, `/admin/permissions` | Security admin | 01/shared RBAC | RBAC service; Role, Permission, mappings | Not audited | Changes must be audited and protected against privilege escalation |
| `/admin/audit-log` | Authorized auditor | shared platform | audit query service; AuditLog | Not audited | Read access scoped; immutable event history |
| `/admin/settings`, `/admin/feature-flags`, `/admin/webhooks`, `/admin/integrations` | Authorized admin | platform operations | corresponding settings/flag/webhook services | Not audited / conditional | Only render controls for implemented/configured capabilities |

## E. Property / real-estate and booking domain

| Required route | Audience | Owning system(s) | API/service and data to confirm | Initial status | Evidence / gap |
|---|---|---|---|---|---|
| Public property search/browse | Everyone | property domain | property discovery service | Not audited | Keep separate from product catalog |
| Property detail | Everyone | property domain | property detail service | Not audited | Verify public visibility and ownership |
| Agent/owner public profile | Everyone | property domain | agent/owner profile service | Not audited | Privacy-safe public fields |
| Create/edit property listing | Authorized owner/agent | property domain | listing management service | Not audited | Server-side ownership |
| Owner/agent dashboard | Property owner/agent | property domain | property management services | Not audited | Permission and state checks |
| Booking/request creation and history/detail | Customer/owner/agent | booking domain | booking request services | Not audited | No false booking confirmation without workflow |
| Admin property/booking review | Authorized admin | property/booking domain | moderation/review services | Not audited | Separate authorization and audit trail |

## F. Route audit and evidence log

Complete this registry by comparing every target above with the actual App Router tree on the active branch. Add each real route found in code, including routes not anticipated here. For every route, record the actual page file, API route/service, relevant Prisma entities, role checks, and focused evidence. Replace initial statuses only after inspection.

| Audit date | Branch/commit | Scope checked | Result / blockers | Evidence |
|---|---|---|---|---|
| 2026-11-04 | `feat/returns-workflow` | Initial target inventory authored from blueprint and implementation notes; no full filesystem route-by-route audit performed in this documentation change | Inventory established; actual presence/status of each route still needs direct comparison with code | This document; see `docs/implementation/BUILD_LOG.md` |

## Page completion gate

A route may be marked **Verified** only if:
1. reachable through a visible navigation item or contextual CTA;
2. wired to the appropriate authorized API/domain service and canonical Prisma data where persistence is required;
3. protected against cross-user, cross-store and unauthorized access;
4. handles loading, empty, validation, success and failure states;
5. has focused verification for critical workflows, including disposable PostgreSQL when schema/transaction behavior changes;
6. has current evidence recorded here and in the build log.

Do not add Prisma models merely to satisfy a page checklist. A page without a supported backend must state that the capability is unavailable or pending configuration. Do not claim production readiness from route presence alone.


## Actual App Router filesystem audit — 2026-11-04

**Source:** recursive Git tree for `feat/returns-workflow`, head observed before the follow-up test/documentation commits. This is a static route-presence audit only; it does not prove runtime rendering, navigation reachability, authorization, API success, persistence, or browser completion.

- Actual route files found in the first snapshot: **30** `page.tsx` files; the identity UI follow-up adds five routes (`/login`, `/register` unavailable, `/forgot-password`, `/reset-password`, `/verify-email`), for **35** route files at the current source state.
- Actual API route handlers found: **115** `route.ts` files under `src/app/api/`.
- Every route below is therefore **route-present / journey-unverified** unless a separate exact-commit test record says otherwise. Do not translate route presence into Verified.

### Routes present in the audited App Router tree

| Route | Source file | Initial audit result |
|---|---|---|
| `/` | `src/app/page.tsx` | Present; buyer discovery and homepage action audit still required |
| `/products/[slug]` | `src/app/products/[slug]/page.tsx` | Present; canonical slug route |
| `/cart`, `/checkout` | `src/app/cart/page.tsx`, `src/app/checkout/page.tsx` | Present; buying journey verification remains |
| `/orders/[orderId]` | `src/app/orders/[orderId]/page.tsx` | Present; ownership/payment/return actions require journey verification |
| `/account/orders`, `/account/questions`, `/account/returns`, `/account/reviews`, `/account/wishlist` | matching `src/app/account/*/page.tsx` files | Present; each action remains unverified as a complete journey |
| `/account/messages`, `/account/messages/[conversationId]` | matching message page files | Present; participant scope and send/read journey need evidence |
| `/account/support`, `/account/support/[ticketId]` | matching support page files | Present; customer-visible/staff-only message boundaries need evidence |
| `/notifications` | `src/app/notifications/page.tsx` | Present; preference and read-state journey needs evidence |
| `/seller`, `/seller/products`, `/seller/inventory`, `/seller/orders`, `/seller/staff`, `/seller/reviews`, `/seller/questions`, `/seller/messages` | matching `src/app/seller/**/page.tsx` files | Present; store-scoped actions and complete seller journey remain unverified |
| `/admin/review`, `/admin/tax-rates`, `/admin/returns`, `/admin/reviews`, `/admin/store-reviews`, `/admin/questions`, `/admin/support` | matching `src/app/admin/**/page.tsx` files | Present; permission and state-transition evidence remains required |

### Required route targets absent from the audited tree

The following dedicated page routes were **not found** in the original 30-page filesystem snapshot; the five identity routes listed above were added afterward. Remaining missing dedicated page routes include: Existing API handlers or embedded controls do not make these page routes exist:

- Identity/customer: `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/account`, `/account/profile`, `/account/security`, `/account/sessions`, `/account/addresses`.
- Discovery/public store: `/search`, `/products`, `/categories/[slug]`, `/brands/[slug]`, `/stores/[slug]`, `/stores`.
- Seller: `/sell`, `/seller/apply`, `/seller/application`, `/seller/dashboard`, `/seller/store`, `/seller/store/settings`, `/seller/warehouses`, `/seller/shipping`, `/seller/returns`, `/seller/orders/[orderId]`, `/seller/products/new`, `/seller/products/[productId]/edit`.
- Admin: dedicated `/admin/sellers` and user/role management pages; some moderation actions may be embedded in existing admin screens or API-only at present.

Some absent targets may be intentionally implemented as sections or embedded workflows on an existing route. Before creating new pages, inspect the actual navigation and component behavior; do not duplicate a working embedded workflow just to satisfy a route name. Authentication APIs exist, but the absence of dedicated auth pages must be resolved or explicitly documented as an approved embedded/modal design before release.

### API route audit boundary

API route handlers are present in the tree. Their mere presence is not a pass. For each route touched by a feature, record request method/path, schema, session and permission guard, domain service, Prisma models, error mapping, transaction/idempotency/audit behavior, and focused tests in the feature's journey trace. Prioritize auth, seller application/store creation, checkout/order, returns/refunds, inventory, and admin mutations. A complete endpoint-by-endpoint behavioral audit has not yet been performed.

Review additions on 2026-11-05: product/store report submission requires a verified session and same-origin mutation check; account appeals are author-only; admin report/appeal queues and resolution APIs require `users:manage`; seller responses are limited to store owners or active staff with exact-store `reviews:manage`. See the System 06 matrix row for remaining verification gates.


## Mandatory action-level trace requirement

This registry records route presence and route-level status only. It does **not** certify every button or action on a route. For every route, enumerate all visible controls (including navigation, cards, icon buttons, forms, filters, pagination, dialogs, empty states, seller/admin actions and mobile controls) in the [49-system End-to-End Journey Matrix](END_TO_END_JOURNEY_MATRIX.md) or a linked system-specific action trace. Each action must include its UI handler, API method/path, validation, session/permission/resource scope, domain service, Prisma model/migration or explicit no-schema-change decision, transaction/idempotency/audit behavior, final persisted state and visible outcome, meaningful failure states, and exact-commit test evidence.

A route stays **Implemented / unverified** (or Partial) if any exposed critical action is unverified. A visible nonfunctional action must be removed, disabled or honestly labelled unavailable; do not count it as complete. Route existence alone never upgrades an action or system to Verified.


**Identity UI follow-up (2026-11-04):** Added functional login, registration, password recovery and email verification pages plus a user-facing logout control. `/terms` and `/privacy` now exist as clearly marked v1 development drafts. Registration defaults on in development/test and is unconditionally blocked in production; consent is captured separately for both documents. The flow remains Implemented / unverified until exact-head CI and the configured HTTP/browser journey pass.


## Shared global navigation — implementation slice (2026-11-04)

| Surface | Route / action | Implementation | Backend / data | Status and verification |
|---|---|---|---|---|
| Global header | All application pages | `src/components/site-navigation.tsx`, mounted by `src/app/layout.tsx` | Server-resolved current session via `getCurrentSession()`; no client-supplied identity | Implemented / unverified. Public navigation remains renderable if identity lookup is temporarily unavailable. |
| Brand/home | `/` | Shared header brand link | Existing storefront home | Route exists; navigation/browser verification pending. |
| Shop | `/products` | `src/app/products/page.tsx` reuses the current discovery experience | `GET /api/products`, backed by catalog discovery and existing Prisma catalog entities | Implemented / unverified; dedicated listing composition is a later refinement. |
| Categories | `/#categories` | Anchor to existing category section | Existing `GET /api/categories` data on home | Implemented / unverified; verify anchor behavior on mobile and from other routes. |
| Brands | `/#brands` | Anchor to existing brand section | Existing `GET /api/brands` data on home | Implemented / unverified; section appears only when active brands exist. |
| Cart | `/cart` | Shared header link | Existing cart API and guest cart cookie | Implemented / unverified; verify guest and signed-in cart journey. |
| Favorites / Orders / Account | Existing protected account routes | Shown when a current session resolves | Existing account APIs and User/Favorite/Order models | Implemented / unverified; server-side account layout remains the authorization boundary. |
| Seller workspace | `/seller` | Shared header link | Existing seller application/store APIs and Seller/Store models | Implemented / unverified; route must enforce pending/approved seller permissions. |
| Messages / Notifications | Existing authenticated routes | Shown when a current session resolves | Existing messaging/notification APIs and Prisma entities | Implemented / unverified; ownership and unread-state behavior remain to be tested. |

**Navigation rule:** every shared navigation destination must resolve to a real route. Do not add links for missing destination pages until the route and its backend journey are implemented. The header is global; page-specific actions remain in their owning page and must follow the same UI → API → validation/auth → domain service → Prisma contract.


## Navigation directories and search routes (2026-11-04)

| Route | Entry point | API / persistence | Status |
|---|---|---|---|
| `/search?q=...` | Shared header search form | `GET /api/products` via the existing discovery page state | Implemented / unverified; no autocomplete yet. |
| `/categories` | Shared header Categories link | `GET /api/categories`; existing Category hierarchy | Implemented / unverified; category cards route to the existing product filter query. |
| `/brands` | Shared header Brands link | `GET /api/brands`; existing Brand records | Implemented / unverified; brand cards route to the existing product filter query. |

Dynamic `/categories/[slug]` and `/brands/[slug]` detail routes are intentionally not linked yet. They must be added only with a real category/brand lookup and filtered product journey; the directory pages currently provide working entry points into the existing catalog filters.


## Public catalog and store detail routes — 2026-11-04

| Route | Access | Backend / Prisma source | Status |
|---|---|---|---|
| `/categories/[slug]` | Public | `getActiveCategoryBySlug`; `listDiscoverableProducts({ categoryId })`; Category, CategoryTranslation, ProductCategory, Product | Implemented / unverified. Active categories only; matching published products; inactive/missing slug returns 404. |
| `/brands/[slug]` | Public | `getActiveBrandBySlug`; `listDiscoverableProducts({ brandId })`; Brand, BrandTranslation, Product | Implemented / unverified. Active brands only; matching published products; inactive/missing slug returns 404. |
| `/stores` | Public | `listDiscoverableStores`; Store, Seller, Product | Implemented / unverified. Lists active stores of approved sellers with active products. |
| `/stores/[slug]` | Public | `getDiscoverableStoreBySlug`; `listDiscoverableProducts({ storeId })`; Store, Seller, Product | Implemented / unverified. Hides inactive stores and unapproved sellers; shows products scoped to that store. |

No Prisma schema change was needed. Existing Category, Brand, Store, Seller and Product relations cover these read journeys. Public queries enforce active/approved visibility and do not expose drafts or seller workspace data.


## Build-time rendering note — 2026-11-04

- `/stores` uses request-time rendering because it reads live approved-store data through Prisma. Static build must not require an application database connection. Exact-head build verification is pending after this correction.


## First source-level catalog/discovery audit — 2026-11-04

- Public discovery uses Product, ProductCategory, ProductVariant, ProductPrice, ProductTranslation, SearchSynonym, Store, Seller, Market and Currency. It filters to active products/stores/sellers; market queries require enabled StoreMarket links and active market/country/currency prices.
- Taxonomy uses Category/CategoryTranslation and Brand/BrandTranslation. Public store routes use Store/Seller. No new Prisma table is justified for these read-only routes.
- `/`, `/products` and `/search` currently reuse the same full `StorefrontHomePage`; this is functional reuse but not a finished page-specific experience. Search autocomplete and relevance ranking are not implemented.
- Category, brand and store detail routes currently request only the first 48 products; store directory requests only the first 48 stores, with no pagination controls.
- Category service paginates raw rows before building its hierarchy. Parent/child rows split across pages can be misrepresented; fix hierarchy-preserving pagination before marking taxonomy complete.
- Product detail wires add-to-cart, favorite, store-message, reviews and Q&A. Source wiring is not yet proof of authorization, retry/idempotency, persistence and refresh behavior.
- Corrected homepage category “View all” to navigate to `/categories` instead of clearing the selected filter.


## Category hierarchy pagination correction — 2026-11-04

- `listActiveCategoryTree` now paginates top-level active categories only, then loads active descendants level-by-level before building the tree. Child nodes are no longer split away from their selected root by the page limit.
- Pagination totals now describe top-level categories, which matches the returned page unit (a tree per root category). Malformed cycles cannot cause unbounded traversal; descendants of inactive or orphaned parents are not exposed as independent public roots.
- Focused tests cover multi-level descendants across the page boundary and cycle termination. Exact-head CI/PostgreSQL result pending.

## Search surface update — 2026-11-04

| Route / surface | Search behavior | Backend source | Status |
|---|---|---|---|
| Global navigation | Debounced product and store autocomplete; submit to results | `GET /api/search/suggestions`, discovery and public-store services | Implemented / pending browser/accessibility verification |
| `/search` | Dedicated result page with keyword, market/currency, category, brand, price, in-stock, relevance/name/newest sorting and pagination | `listDiscoverableProducts`, taxonomy services | Implemented / pending PostgreSQL/runtime and browser verification |
| `/seller/products` | Search product name, slug, description, SKU and barcode within selected store | `listSellerStoreProducts` after catalog permission check | Implemented / pending verification |
| `/seller/orders` | Search order number, store, product, SKU and variant across authorized stores | `listSellerVendorOrders` after permission-derived store scope | Implemented / pending verification |
| `/seller/inventory` | Search product, SKU and warehouse name/code within selected store | `listStoreInventory` after inventory permission check | Implemented / pending verification |


## Seller return visibility — 2026-11-04

| Route / action | UI | API / domain | Prisma mapping | Status |
|---|---|---|---|---|
| Seller return queue | `/seller/returns`, linked from `/seller` | `GET /api/seller/returns` → `listSellerReturnRequests` | ReturnRequest → ReturnItem → OrderItem → VendorOrder → Store | Implemented; read-only and grouped per authorized store. |
| Seller scope | Current server session; active owned store or exact-store `orders:manage`; platform admin | Store scope derived in domain service; no client store ID accepted | Seller, Store, SellerStaff, UserRoleAssignment | Exact-head General CI and PostgreSQL passed on `797f8dd61ee5ec3591f8cc0d2abb46b85235a364`; PR #19 merged. Browser journey pending. |

The parent ReturnRequest can span several stores but has a single global status. Do not add seller approval/rejection/receipt mutations until the per-vendor lifecycle design is implemented and verified.


## Seller order preparation route update — 2026-11-04

| Route / action | UI | API / domain | Prisma | Status |
|---|---|---|---|---|
| Seller order preparation | `/seller/orders` | `PATCH /api/seller/orders/[vendorOrderId]/status` → `transitionSellerVendorOrder` | Existing VendorOrder and status-history records plus AuditLog; no schema change | Implemented on PR #25; exact-head CI/PostgreSQL verification pending. Only paid `CONFIRMED → PROCESSING → READY_TO_SHIP` is exposed. |

## Buyer order management and seller tracking — 2026-11-05

| Route / action | UI | API / domain | Prisma | Status |
|---|---|---|---|---|
| Buyer cancellation | `/orders/[orderId]` | `POST /api/orders/[orderId]/cancel` → `cancelOwnedOrder` | Order histories, vendor-order histories, `InventoryMovement.ORDER_CANCELLATION`, CouponRedemption, AuditLog | Only PENDING_PAYMENT orders with no payment attempt can be canceled; per-order payment lock, inventory restoration and coupon release are transactional. Migration applied locally; lifecycle/browser verification pending. |
| Reorder | `/orders/[orderId]` | `POST /api/orders/[orderId]/reorder` → `reorderOwnedOrder` → `addCartItems` | Existing Order/OrderItem and Cart/CartItem | Adds all still-purchasable variants at current market/currency prices, or adds none; stock and quantity limits are revalidated. |
| Seller shipment | `/seller/orders` | `POST /api/seller/orders/[vendorOrderId]/shipment` → `createSellerShipment` | Shipment, ShipmentTrackingEvent, VendorOrder history, Order history, AuditLog | One manual shipment per READY_TO_SHIP vendor order; HTTPS tracking links only. Migration applied locally; no carrier integration. |
| Seller tracking updates | `/seller/orders` | `POST /api/seller/orders/[vendorOrderId]/tracking-events` → `addSellerShipmentTrackingEvent` | ShipmentTrackingEvent, Shipment, VendorOrder/Order histories, AuditLog | Forward-only manual events; seller scope is checked server-side; parent order status aggregates vendor shipments. Database/browser lifecycle verification pending. |
| Invoices and paid cancellation | Not exposed | Not implemented | Future Invoice/InvoiceItem and payment refund workflow | Deferred pending tax/legal invoice requirements and refund/payment policy. |
