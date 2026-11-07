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
| `/login` | Guest | 01 | `src/app/login/page.tsx` → `src/features/identity/auth-page.tsx`; `POST /api/auth/login`; login/session services; User, UserSession, LoginAttempt, AuditLog | Implemented / unverified | Password and Google sign-in preserve the safe prior path, including query strings; MFA challenges return to the requested route. Protected account/admin routes pass their requested path through `src/proxy.ts`. Verify cookie behavior and full browser journey. |
| `/register` | Guest | 01, 12 | `src/features/identity/register-form.tsx`; `POST /api/auth/register`; registration service; User, Seller, UserConsent | Implemented / unverified | Requires explicit Customer/Buyer or Seller selection, Turnstile, and policy consent. Creates an ACTIVE user and immediate session without email verification; seller applicants remain PENDING and receive no SELLER permissions. Google OAuth registration uses the same bot challenge. Production registration remains hard-blocked. |
| `/forgot-password` | Guest | 01 | `src/app/forgot-password/page.tsx` → shared auth page; `POST /api/auth/password-reset/request`; password-reset service; PasswordResetToken, LoginRateLimitBucket, AuditLog | Implemented / unverified | Generic anti-enumeration response is rendered; verify email delivery, rate limiting and deployed HTTP journey. |
| `/reset-password` | Guest | 01 | `src/app/reset-password/page.tsx` → shared auth page; `POST /api/auth/password-reset/complete`; password-reset service; PasswordResetToken, UserSession, AuditLog | Implemented / unverified | Password update API is wired; token removed from visible URL, sessions revoked by service. Verify expiry/replay and deployed HTTP journey. |
| `/api/auth/google/start`, `/api/auth/google/callback` | Guest | 01 | Google OIDC authorization-code + PKCE; OAuthAccount, User, Seller, UserConsent, UserSession, AuditLog | Implemented / conditional | State + PKCE cookies, verified Google identity/audience/email, no automatic email-based account linking, session creation. Requires Google OAuth credentials and redirect URI registration; provider journey not yet run. |
| `/account` | Customer | 01, 05, 07, 09, 10 | `src/app/account/page.tsx`; navigation to profile, security, sessions, orders, favorites, addresses, returns, reviews, questions, messages, support, notifications, seller workspace | Implemented / unverified | Account dashboard links to existing customer/seller routes; each destination remains independently subject to journey verification. |
| `/account/profile` | Customer | 01 | `src/app/account/profile/page.tsx`; `GET/PATCH /api/account/profile`; User | Implemented / unverified | Reads authenticated user's own profile and updates display name with server session ownership and validation. HTTP/browser verification pending. |
| `/account/security` | Customer / administrator / seller | 01 | `src/app/account/security/page.tsx`; `GET/POST /api/account/security/mfa`; `POST /api/account/security`; UserSession, UserTwoFactor, UserTwoFactorRecoveryCode; `MFA_ENCRYPTION_KEY` | Implemented / unverified | Password change and TOTP enrollment/challenges are connected. TOTP secrets are AES-GCM encrypted, codes are replay-protected, recovery codes are one-time, and administrator/seller accounts cannot disable mandatory MFA. Configure a stable encryption key before production enrollment. |
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
| `/seller` | Authenticated user/seller | seller onboarding and store operations | `src/app/seller/page.tsx` → `src/features/seller/workspace-page.tsx`; `GET /api/seller/stores`, `POST /api/seller/applications`, `POST /api/seller/stores`; Seller, Store, StoreMarket, AuditLog | Implemented / unverified | Inspected on `feat/super-admin-control-panel`: the application form is embedded in the workspace when no Seller record is returned; there is no separate `/seller/apply` or `/seller/application` route in the audited tree. Anonymous `GET /api/seller/stores` returns 401 and the browser now shows sign-in/create-account actions (sign-in returns to `/seller`) instead of an unusable application form. Authenticated application/status/error journeys remain unverified. Store retries with the same slug and setup now return the existing store; conflicting settings and cross-seller slug collisions are rejected. |
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
| 2. Identity gate | Continue/apply while signed out | Sign in/register, then safely return to the application; email verification is not required | Session/auth service and account status | No open redirect; expired/suspended sessions fail closed | Partial / unverified — anonymous 401→sign-in UI observed in shared browser; post-login return remains subject to HTTP/browser verification |
| 3. Form | Enter business/applicant details | Required fields, labels, client validation, loading/disabled submit and accessible errors | Server schema validates same contract; only policy-approved fields collected | Missing/malformed fields, excessive payload, duplicate click, sensitive-document handling | Partial / unverified |
| 4. Submit | Submit application | Calls the real API; no client-side fake success | POST /api/seller/applications; identity comes from session; service validates account/email/status and writes application + audit atomically | Forged applicant ID, unauthenticated request, duplicate/retry, already-pending/approved/rejected state | Implemented / unverified |
| 5. Track status | Applicant opens status page | Show persisted pending/approved/rejected/needs-action state and allowed next step | Read API uses the same canonical Seller record | Other user's application cannot be read; status remains correct after reload | Partial / unverified |
| 6. Review | Admin opens seller queue, approves/rejects | Permission-gated queue; rejection requires reason where policy says so; clear confirmation/result | Admin review API, valid state transition, audit log, concurrency-safe update | Non-admin, stale status, double decision, missing rejection reason | Implemented / unverified |
| 7. Create store | Approved seller starts store setup | Only approved applicants can proceed; show draft state and missing setup tasks | Authorized store creation; Store, StoreMarket and exact owner/staff scope. Same-slug retries with identical owner/name/markets return the existing store; competing configurations and cross-seller collisions are rejected. | Unapproved applicant, repeated create, cross-user/store IDs, no active market configuration | Implemented / journey unverified |
| 8. Finish setup | Configure store and first operational steps | Show only actions supported by backend; profile/market/catalog prerequisites explicit | Store settings and market APIs; later product/warehouse services as scoped | Save errors, unavailable market, partial setup, reload and persisted state | Partial / unverified |
| 9. Verify journey | Exercise from first CTA to approved draft store | Test with real browser/HTTP flow in configured test environment | Disposable PostgreSQL for schema/transaction changes; focused auth/permission tests | Guest, verified/unverified user, duplicate submit, forbidden reviewer, approve/reject, stale transition, idempotent store creation | Not yet evidenced as one complete journey |

**Schema decision gate:** inspect prisma/schema.prisma and docs/architecture/prisma-model-usage-map.md before changing persistence. Reuse the current Seller/application representation if it covers the lifecycle. Add a model/table only if a missing durable business state or relationship is demonstrated; any change needs an additive migration and disposable-PostgreSQL verification. KYC documents, seller tax records and payout activation are separate scopes and must not be implied by basic application approval.

**Static source review on `feat/super-admin-control-panel` (not runtime verification):** `/seller` renders `SellerWorkspacePage`; the application form is embedded in that workspace when `GET /api/seller/stores` returns no seller. The application API validates a strict two-field payload and delegates to `submitSellerApplication`, which requires a current session (email verification is not required), creates a PENDING Seller and AuditLog transactionally, and treats an existing PENDING application as an idempotent replay. The service uses the session-derived user ID, not a client-supplied applicant ID. Admin review requires `users:manage`, a rejection reason, a conditional PENDING→ACTIVE/REJECTED update, role assignment on approval, and audit logging. Store creation uses the unique slug to recognize an identical retry and to recover a concurrent same-slug create; it rejects mismatched or cross-seller use without preventing a seller from creating a different store. Focused tests cover these invariants. Remaining gaps include end-to-end browser/PostgreSQL evidence, generic 400 mapping for some business failures, and the absence of a dedicated applicant status route. These are source observations, not evidence of a complete browser journey.

## C1a. Cross-cutting action audit

For every page added or modified, inventory all interactive controls (including header/footer controls, row menus, pagination, retry and destructive actions). Each control must have one of: a real verified action, an explicitly conditional/disabled state with reason, or be removed until implemented. Check UI → API → auth/validation → service → repository/Prisma → response/refresh. Keep the test set focused on distinct business invariants and security boundaries; do not create a test per helper or visual control.

## D. Platform administration

| Required route | Audience | Owning system(s) | API/service and data to confirm | Initial status | Evidence / gap |
|---|---|---|---|---|---|
| `/admin` | Platform admin | shared administration | No route found | Missing | No `/admin/page.tsx` exists. |
| `/admin/dashboard`, `/admin/control-panel` | Platform admin | 24 | `GET /api/admin/dashboard`; `src/server/admin/dashboard.ts`; User, Seller, Store, Product, Order, Payment, ProductReview, StoreReview, ReturnRequest, SupportTicket | Implemented / unverified | `users:manage` protected database-backed counts and order trends; totals stay currency-specific. Revenue, payout exposure, refunds/disputes, health checks and several drill-through pages are unavailable. CI (Prisma, typecheck, lint, unit tests, production build) and PostgreSQL integration pass on `4eefa77`; browser verification pending. |
| `/admin/control-panel/access-catalog`, `/admin/control-panel/audit-log`, `/admin/control-panel/privilege-requests`, `/admin/control-panel/ai-assistant` | Super Admin only | 01 / 24 / AI | `GET /api/admin/control-panel/access-catalog`, `GET /api/admin/control-panel/audit-log`, `GET/POST /api/admin/control-panel/privilege-requests`, `PATCH /api/admin/control-panel/privilege-requests/[requestId]`, `GET/PATCH /api/admin/control-panel/ai-assistant`; `src/server/admin/platform-*`, `src/server/admin/ai-assistant-settings.ts`; Role, Permission, UserRoleAssignment, AuditLog, PlatformPrivilegeRequest, AiAssistantSetting | Implemented / unverified | Every page/API uses `platform:manage` and mandatory MFA; access catalog is read-only; privilege elevation requires a different Super Admin reviewer; mutation APIs validate same-origin JSON requests; AI settings are audited and cannot override the deployment kill switch or reveal the provider key. CI and PostgreSQL integration pass on `4eefa77`; browser role journeys and first-admin bootstrap remain pending. |
| `/admin/users`, `/admin/users/[userId]` | Authorized admin / Super Admin | 01 | `GET /api/admin/users`, `GET/PATCH/DELETE /api/admin/users/[userId]`, `GET/POST/DELETE /api/admin/users/[userId]/roles`; User, UserSession, UserRoleAssignment, Role, UserConsent, LoginAttempt, AuditLog | Implemented / unverified | Search/detail and reasoned status changes remain. Role assignment/removal is now wired to the existing non-escalation API. Super Admin-only account anonymization disables credentials, revokes sessions, removes public seller/catalog content and eligible identity data, while retaining orders, payment, support, tax, and audit records. MFA state is shown. Migration and database/browser journey remain pending. |
| `/admin/sellers` | Authorized admin | seller onboarding | `GET /api/admin/sellers`; existing seller approval API; `PATCH /api/admin/stores/[storeId]`; Seller, Store, UserRoleAssignment, AuditLog | Implemented / unverified | Paginated seller search and owner context; pending applications use existing approval workflow; store ACTIVE/SUSPENDED changes are reasoned, audited, and state-checked. KYC/document review and full journey remain unavailable. |
| `/admin/products` | Catalog moderator | 02 | `GET /api/admin/products`; existing product approval/rejection APIs; Product, Store, Seller | Implemented / unverified | Pending queue with seller/store/product context and approve/reject actions. Approval does not publish; rejection requires a reason. Queue is bounded to 100 and search is client-side. |
| `/admin/product-management` | Catalog admin | 02 | `GET/POST /api/admin/products/manage`; Product, Store, Seller, OrderItem, AuditLog | Implemented / unverified | Search/filter and archive selected products or products scoped to a store/owner. Operations are bounded to 500, require a reason, and create per-product audit events. Archived products remain for historical order references. |
| `/admin/categories` | Catalog admin | 02 | `GET/POST /api/admin/categories`, `PATCH/DELETE /api/admin/categories/[categoryId]`; Category, ProductCategory, AuditLog | Implemented / unverified | Category create/edit/archive, hierarchy-cycle validation and audit trail. Archiving preserves product links; empty categories remain hidden publicly. Database/browser journey pending. |
| `/admin/brands` | Catalog admin | 02 | taxonomy administration services | Missing | Brand administration route is not implemented. |
| `/admin/markets`, `/admin/currencies` | Platform admin | market configuration | market/currency services | Not audited | Do not infer launch market or exchange rates |
| `/admin/orders`, `/admin/orders/[orderId]` | Authorized admin | 05 | `GET /api/admin/orders`, `GET /api/admin/orders/[orderId]`; `src/server/admin/orders.ts`; Order, OrderAddress, VendorOrder, OrderItem, OrderStatusHistory, VendorOrderStatusHistory, Payment, Shipment, ShipmentTrackingEvent | Implemented / unverified | `users:manage` protected search, stable pagination/status filter, customer and immutable order snapshots, payment status, vendor splits, status and shipment timelines. Intentionally read-only: no unsupported payment/refund/dispute/fulfillment overrides. Focused service tests and typecheck pass; PostgreSQL/browser verification pending. |
| `/admin/payments`, `/admin/payments/[paymentId]` | Finance-authorized admin | 29 | `GET /api/admin/payments`, `GET /api/admin/payments/[paymentId]`; `src/server/admin/payments.ts`; Payment, PaymentWebhookEvent, Order, Currency | Implemented / unverified | Requires global `payments:read`; paginated searchable/filterable attempts, aggregates separated by status/currency, failure and webhook-processing inspection. Provider references, checkout URLs and webhook payloads excluded. Read-only; payouts, refunds, reconciliation and settlement are not available. Focused service tests/typecheck pass; PostgreSQL/browser verification pending. |
| `/admin/commissions` | Super Admin | 30 | `GET/POST /api/admin/commission-rules`, `PATCH /api/admin/commission-rules/[ruleId]`, `GET /api/admin/commissions`; CommissionRule, CommissionTransaction, OrderItem, AuditLog | Implemented / partially verified | Requires `platform:manage`. Effective-dated rules use seller+category → seller → category → global precedence. Successful payments snapshot per-item commission on net merchandise after discounts, excluding shipping and tax. Unconfigured scope resolves to 0%; rule changes are audited and past payment snapshots are immutable. Policy/payment lifecycle unit tests and local migration passed; payment-success PostgreSQL/browser journey remains unverified. |
| `/admin/logistics`, `/admin/logistics/[shipmentId]` | Platform admin | 34 | `GET /api/admin/shipments`, `GET /api/admin/shipments/[shipmentId]`; `src/server/admin/logistics.ts`; Shipment, ShipmentTrackingEvent, VendorOrder, Store, Order | Implemented / unverified | Requires `users:manage`; paginated search/status filtering and recorded tracking-event inspection only. Unsafe/credential-bearing tracking URLs are suppressed. No carrier configuration, label generation, automated delay/exception detection or shipment mutation. Focused service tests/typecheck pass; PostgreSQL/browser verification pending. |
| `/admin/returns` | Returns manager | 11 | returns admin API | Implemented / unverified | Current status workflow only; no refund execution |
| `/admin/refunds` | Finance-authorized admin | refund/payment system | refund/payment/ledger service | Conditional / future | Must not appear actionable until refund implementation exists |
| `/admin/reviews`, `/admin/store-reviews` | Moderator | 06 | Product/store moderation, `GET /api/admin/reviews/reports`, `POST /api/admin/reviews/reports/[reportId]/resolve`, `GET /api/admin/reviews/appeals`, `POST /api/admin/reviews/appeals/[appealId]/resolve`; ProductReview, StoreReview, ReviewReport, ReviewAppeal, AuditLog | Implemented / unverified | Product and store queues plus report/appeal queues require `users:manage`. Decisions are conditional, audited, and stale/duplicate actions fail. Verify the moderation journey and PostgreSQL migration. |
| `/admin/questions` | Moderator | 08 | Q&A moderation API | Implemented / unverified | Verify moderation transitions |
| `/admin/support` | Support staff | 09 | ticket administration APIs | Implemented / unverified | Internal notes restricted to staff |
| `/admin/search-synonyms` | Catalog admin | 03 | audited synonym management API; SearchSynonym | Implemented / unverified | Requires `users:manage`; verify permissions and PostgreSQL migration/runtime |
| Coupon management API | Platform admin | 04 | `GET/POST /api/admin/coupons`, `PATCH /api/admin/coupons/[couponId]`; Coupon, CouponRedemption, AuditLog | Implemented / unverified | Requires `users:manage`; fixed coupons are currency-specific; migration and authorization/runtime checks pending |
| `/admin/coupons` | Platform admin | 04 | Existing coupon management API; Coupon, CouponRedemption, AuditLog | Implemented / unverified | Admin can create, activate, and deactivate global discounts. Funding attribution is not recorded; seller-funded allocation is unsupported. Browser/database verification pending. |
| `/admin/tax-rates` | Tax admin | 04 | tax rules APIs; MarketTaxRate | Implemented / unverified | Rules require market/legal configuration |
| `/admin/shipping` | Shipping admin | 34 | No platform carrier/configuration API exists; current seller shipping rates and admin shipment inspection are separate | Missing | `/admin/logistics` is a read-only shipment workspace, not a shipping configuration or carrier-management surface. |
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

- The 2026-11-04 baseline snapshot contained **30** `page.tsx` files. The current source tree contains **70**; `/verify-email` was retired when registration changed to immediate activation without email verification.
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
| `/admin/users`, `/admin/users/[userId]`, `/admin/sellers`, `/admin/products`, `/admin/orders`, `/admin/orders/[orderId]` | matching `src/app/admin/**/page.tsx` files | User/seller/product/order APIs and services are connected. Role controls and privacy-safe account anonymization are implemented in source; migration, complete browser, and PostgreSQL journeys remain unverified. |
| `/admin/product-management`, `/admin/categories`, `/admin/coupons`, `/admin/commissions` | matching `src/app/admin/**/page.tsx` files | Added bulk product archiving, category CRUD-by-archive, global coupon controls, and Super Admin commission rules/snapshots. Commission policy tests, typecheck, lint, and local migration pass; payment-success database/browser journey remains pending. |
| `/admin/payments`, `/admin/payments/[paymentId]`, `/admin/logistics`, `/admin/logistics/[shipmentId]` | matching `src/app/admin/**/page.tsx` files | Added in Phase 3 as read-only views over persisted payment/webhook and shipment/tracking data; no financial or carrier actions are exposed; PostgreSQL/browser verification remains pending |
| `/admin/dashboard`, `/admin/control-panel`, `/admin/review`, `/admin/tax-rates`, `/admin/returns`, `/admin/reviews`, `/admin/store-reviews`, `/admin/questions`, `/admin/support`, `/admin/search-synonyms` | matching `src/app/admin/**/page.tsx` files | Present; shared admin navigation; permission and state-transition evidence remains required |

### Required route targets absent from the audited tree

The following dedicated page routes were **not found** in the original 30-page filesystem snapshot. Remaining missing dedicated page routes include: Existing API handlers or embedded controls do not make these page routes exist:

- Discovery/public store: `/search`, `/products`, `/categories/[slug]`, `/brands/[slug]`, `/stores/[slug]`, `/stores`.
- Seller: `/sell`, `/seller/apply`, `/seller/application`, `/seller/dashboard`, `/seller/store`, `/seller/store/settings`, `/seller/warehouses`, `/seller/shipping`, `/seller/returns`, `/seller/orders/[orderId]`, `/seller/products/new`, `/seller/products/[productId]/edit`.
- Admin: `/admin` landing page, user role administration, seller detail/KYC pages, taxonomy administration, and additional order exception/action workflows remain absent or incomplete.

Some absent targets may be intentionally implemented as sections or embedded workflows on an existing route. Before creating new pages, inspect the actual navigation and component behavior; do not duplicate a working embedded workflow just to satisfy a route name. Identity routes are present; their complete HTTP/browser journeys remain unverified.

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

## Super Admin access-control hardening — 2026-11-05

| Surface | Route / operation | Server-side boundary | Persistence | Status |
|---|---|---|---|---|
| Shared admin shell | /admin/* | src/app/admin/layout.tsx requires an authenticated session and at least one explicit admin permission before rendering the shell; unauthenticated users are redirected to /login with a safe internal return path; users without admin access receive not-found. Each API remains independently guarded. | Existing UserSession, UserRoleAssignment, RolePermission, Permission | Implemented in source; exact-head CI and authenticated browser verification pending. |
| Platform control panel | /admin/control-panel | Dedicated platform:manage check; ordinary operational ADMIN permissions do not imply platform management. | Existing global SUPER_ADMIN role grant / platform:manage permission | Verified in PR #64 exact-head Browser E2E and PostgreSQL-backed governance journey; deployed/production verification remains separate. |
| First Super Admin bootstrap | npm run db:bootstrap-super-admin | Explicit operator opt-in and confirmation, exact expected PostgreSQL host/database, existing ACTIVE account, serialized one-time operation, refuses if any Super Admin assignment exists. Email verification is not required because registration activates accounts immediately by policy. | UserRoleAssignment + AuditLog in one transaction; no schema change | Requires operator-controlled target confirmation; never run automatically or from a public API. MFA enrollment is mandatory before privileged access. |
| Ordinary role revocation | Existing role-assignment service/API | Refuses to revoke SUPER_ADMIN through delegated role-management flow. | Existing UserRoleAssignment + AuditLog | Implemented in source; focused integration verification pending. |

**Verification boundary:** this records source implementation only. It does not certify a production database bootstrap, live admin session, browser journey, or deployment.

## Super Admin delegated-role boundary correction — 2026-11-05

| Operation | Policy | Persistence | Status |
|---|---|---|---|
| Ordinary role assignment | Rejects both the canonical `SUPER_ADMIN` role and every role containing `platform:manage`; store-manager assignments also require an active target membership and an explicit STORE scope. Denials are enforced in the server service, not only the UI. | Existing UserRoleAssignment + AuditLog for permitted assignments; no schema change. | Policy and focused unit tests added; exact-head CI pending. |

**Deployment note:** Vercel Preview build for commit `2f7e683` failed because required `AUTH_SECRET` was absent at build time. Configure the Preview secret in Vercel; do not bypass the server environment validation or commit a secret.

## Super Admin audit log — 2026-11-05

| Surface | Route | Guard | Backend | Status |
|---|---|---|---|---|
| Platform audit history | `/admin/control-panel/audit-log` | Server page requires `platform:manage`; unauthenticated users return to login; unauthorized users receive not-found. | `GET /api/admin/control-panel/audit-log` → `getPlatformAuditEvents` → existing Prisma `AuditLog`; no-store, validated filters, max 100 rows, keyset pagination. | Verified in PR #64 exact-head CI, PostgreSQL integration and Browser E2E; deployed/production verification remains separate. |

The view is read-only. Audit history is not editable or deletable from this interface. Ordinary role assignment and revocation both protect any role carrying `platform:manage`.

## Super Admin access catalogue — 2026-11-05

| Surface | Route | Guard | Backend | Status |
|---|---|---|---|---|
| Roles and permission inventory | `/admin/control-panel/access-catalog` | Server page requires `platform:manage`; unauthenticated users return to login; unauthorized users receive not-found. | `GET /api/admin/control-panel/access-catalog` → `getPlatformAccessCatalog` → Prisma Role, RolePermission, Permission and assignment counts. | Verified in PR #64 exact-head CI, PostgreSQL integration and Browser E2E; deployed/production verification remains separate. |

Audit metadata is redacted before API serialization. The access catalogue deliberately does not expose role mutation controls until approval and actor-separation safeguards are implemented.

## Super Admin privilege approvals — 2026-11-05

| Surface | Route | Guard | Backend | Status |
|---|---|---|---|---|
| Privilege request and review | `/admin/control-panel/privilege-requests` | Server page requires `platform:manage`; unauthenticated users return to login; unauthorized users receive not-found. | `GET/POST /api/admin/control-panel/privilege-requests`, `PATCH /api/admin/control-panel/privilege-requests/[requestId]` → `platform-privilege-requests.ts`. | Verified in PR #64 exact-head CI, PostgreSQL integration (9 tests) and Browser E2E, including independent reviewer approval; deployed/production verification remains separate. |

The workflow grants only canonical `SUPER_ADMIN` after independent review. The requester cannot decide their own request. Assignment, decision and audit record are transactional. Target must be ACTIVE.

## Manual seller dispatch and buyer tracking — pending verification

| Route / action | UI | API / domain | Prisma | Status |
|---|---|---|---|---|
| Record dispatch | `/seller/orders` → Record dispatch | `POST /api/seller/orders/[vendorOrderId]/shipment` → `createSellerShipment` | Shipment, VendorOrder, VendorOrderStatusHistory, OrderStatusHistory, AuditLog | Implemented on `feat/shipment-tracking-current-main`; exact-head CI/PostgreSQL pending. Requires active owner or exact store-scoped `orders:manage`; only READY_TO_SHIP is accepted. |
| View tracking details | `/orders/[orderId]` | Existing owned-order read serializer | Shipment joined through VendorOrder | Implemented on the same branch; customer sees seller-entered details only. No live carrier tracking is claimed. |


## API anonymous boundary verification — 2026-11-07

PR #68 added an automated anonymous boundary sweep covering 165 route/method combinations, with documented public/guest routes excluded and request-origin/trusted-proxy headers exercised. Exact-head General CI and Browser E2E passed; see Build Log. This sweep verifies unauthenticated boundaries only and does not replace per-role, resource ownership, or store-scope authorization checks.
