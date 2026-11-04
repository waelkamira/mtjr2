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
| `/products` | Everyone | 02, 03 | product discovery/list API; Product, ProductPrice, ProductVariant | Not audited | Confirm filters, sorting, pagination and market context |
| `/products/[id]` or canonical slug | Everyone | 02, 06–08 | product detail, reviews, Q&A, favorites, cart APIs | Partial / unverified | Confirm route convention, variants, seller, stock, price and all actions |
| `/search` | Everyone | 03 | search/discovery API | Partial / unverified | Storefront search state exists; dedicated route/autocomplete need audit |
| `/categories/[slug]` | Everyone | 02, 03 | category and product APIs | Not audited | Confirm route and empty/invalid category states |
| `/brands/[slug]` | Everyone | 02, 03 | brand and product APIs | Not audited | Confirm route and filtered listing |
| `/stores/[slug]` | Everyone | seller/store system | public store and catalog services | Not audited | Public storefront profile is distinct from seller workspace |
| `/help`, `/contact`, `/terms`, `/privacy`, `/cookies`, policy pages | Everyone | shared platform/compliance | CMS/static content and consent service as applicable | Not audited / conditional | Approve legal and market-specific content before launch |

## B. Identity and customer account

| Required route | Audience | Owning system(s) | API/service and data to confirm | Initial status | Evidence / gap |
|---|---|---|---|---|---|
| `/login` | Guest | 01 | auth/session service; User, UserSession | Partial / unverified | Verify rate limits, errors, redirect safety and session creation |
| `/register` | Guest | 01 | registration service; User, verification records | Partial / unverified | Verify validation, duplicate account handling and email verification |
| `/verify-email` or equivalent | Guest/customer | 01 | verification-token service | Not audited | Record actual canonical route; tokens must be single-use/expiring |
| `/forgot-password` | Guest | 01 | password-recovery service | Not audited | Must not reveal whether an account exists |
| `/reset-password` | Guest | 01 | recovery-token service | Not audited | Validate single-use token and revoke affected sessions as policy requires |
| OAuth callback route(s) | Guest | 01 | configured OAuth adapter | Conditional | Only expose configured providers |
| `/account` | Customer | 01, 05, 07, 09, 10 | account summary services | Not audited | Account landing/dashboard and useful links |
| `/account/profile` | Customer | 01 | profile API; User | Not audited | Ownership, validation and save/error feedback |
| `/account/security` | Customer | 01 | security/session service | Not audited | Password change and 2FA only if implemented/configured |
| `/account/sessions` | Customer | 01 | session listing/revocation API; UserSession | Not audited | Revoke session safely; do not expose other users' sessions |
| `/account/addresses` | Customer | 01, 04 | address API; UserAddress | Implemented / unverified | Address CRUD and market-country rules need route audit |
| `/account/orders` | Customer | 05 | customer-owned orders API; Order, VendorOrder | Partial / unverified | Confirm history and ownership |
| `/orders/[orderId]` | Customer | 05, 11 | order detail/payment APIs | Partial / unverified | Confirm ownership, status, payment-unavailable state and return entry |
| `/cart` | Guest/customer | 04 | cart APIs; Cart, CartItem | Implemented / unverified | Confirm guest/customer behavior and stock/price errors |
| `/checkout` and its steps | Guest/customer | 04, 05, 07 | quote, address, shipping, tax, order and payment services | Partial / unverified | Payment provider is not configured by default; do not imply checkout is production-ready |
| Order confirmation route | Customer | 05, 07 | order detail/payment status API | Partial / unverified | Must reflect server-side order/payment status |
| `/account/wishlist` | Customer | 07 | favorites API; Favorite | Implemented / unverified | Confirm signed-in state and empty state |
| `/account/reviews` | Customer | 06 | customer review API; ProductReview, StoreReview | Implemented / unverified | Verify delivered-purchase eligibility and moderation messaging |
| `/account/questions` | Customer | 08 | customer Q&A API; ProductQuestion | Implemented / unverified | Verify ownership and moderation states |
| `/account/returns` | Customer | 11 | returns API; ReturnRequest, ReturnItem | Implemented / unverified | No refund/payment movement in current return slice |
| `/account/messages`, `/account/messages/[conversationId]` | Customer | 09 | messaging APIs; StoreConversation, StoreMessage | Implemented / unverified | Participant isolation and read states |
| `/account/support`, `/account/support/[ticketId]` | Customer | 09 | support APIs; SupportTicket, SupportMessage | Implemented / unverified | Internal notes must never be exposed |
| `/notifications` | Customer/seller | 10 | notification APIs; Notification, NotificationPreference | Implemented / unverified | User scoping and preference enforcement |

## C. Seller workspace

| Required route | Audience | Owning system(s) | API/service and data to confirm | Initial status | Evidence / gap |
|---|---|---|---|---|---|
| `/seller` | Authenticated user/seller | seller onboarding | application and seller status APIs | Partial / unverified | Existing seller entry; compare with required dashboard/onboarding journey |
| `/seller/dashboard` | Approved seller | seller/store operations | seller summary services | Not audited | Show real metrics only; useful empty/configuration states |
| `/seller/onboarding` or documented equivalent | Applicant | seller onboarding | application/review APIs; Seller | Partial / unverified | Record actual route and status progression |
| `/seller/store` or documented settings route | Store owner | seller/store | store APIs; Store, StoreMarket | Not audited | Store profile, localization and active markets |
| `/seller/products` | Store owner/authorized staff | 02 | seller catalog APIs; Product, ProductVariant, ProductPrice | Not audited | List/status filters and store isolation |
| `/seller/products/new`, `/seller/products/[productId]/edit` | Store owner/authorized staff | 02 | product create/update/media services | Not audited | Create/edit journey, validation and ownership |
| `/seller/inventory` | Store owner/authorized staff | inventory | inventory APIs; Warehouse, Inventory, InventoryMovement | Implemented / unverified | Verify adjustments, transfers and scope checks |
| `/seller/orders`, `/seller/orders/[orderId]` | Store owner/authorized staff | 05, 07 | seller order APIs; VendorOrder, OrderItem | Partial / unverified | Payment-confirmed fulfillment transitions only |
| `/seller/shipping` or documented equivalent | Store owner | 04 | seller shipping-rate APIs; StoreShippingRate | Implemented / unverified | Confirm route and quote invalidation behavior |
| `/seller/staff` | Store owner/authorized staff | seller access control | staff APIs; SellerStaff/invitation models | Implemented / unverified | Exact store-scoped permissions and invitation lifecycle |
| `/seller/reviews` | Store owner | 06 | seller review API | Implemented / unverified | Verify store scoping |
| `/seller/questions` | Store owner | 08 | seller Q&A API | Implemented / unverified | Verify product/store ownership and moderation |
| `/seller/messages` | Store owner/authorized staff | 09 | seller messaging APIs | Implemented / unverified | Requires exact `messages:manage` scope |
| `/seller/returns` | Store owner/authorized staff | 11 | seller return workflow | Missing / future | Not part of current initial returns slice |
| `/seller/analytics`, `/seller/payouts`, `/seller/finance`, `/seller/settings` | Store owner | relevant finance/platform systems | analytics/ledger/payout/settings services | Not audited / conditional | Do not show fabricated values; expose only implemented workflows |

## C1. Mandatory vertical journey: apply to become a seller

This is a cross-page acceptance trace, not a claim that every step has already been verified. Reconcile each row against the actual files and update the status/evidence only after inspection and verification.

| Step | User-visible entry/action | Required route/UI behavior | Backend and persistence contract | Required failure/security coverage | Initial status |
|---|---|---|---|---|---|
| 1. Discover | Homepage/header/footer seller CTA | Navigate to the real seller entry/application route; never a dead link | No write; route must explain prerequisites | CTA target exists; unavailable onboarding is not advertised as working | Partial / unverified |
| 2. Identity gate | Continue/apply while signed out | Sign in/register, then safely return to the application; verified-email requirement is explained | Session/auth service and verified identity | No open redirect; expired session and unverified email handled | Partial / unverified |
| 3. Form | Enter business/applicant details | Required fields, labels, client validation, loading/disabled submit and accessible errors | Server schema validates same contract; only policy-approved fields collected | Missing/malformed fields, excessive payload, duplicate click, sensitive-document handling | Partial / unverified |
| 4. Submit | Submit application | Calls the real API; no client-side fake success | POST /api/seller/applications; identity comes from session; service validates account/email/status and writes application + audit atomically | Forged applicant ID, unauthenticated request, duplicate/retry, already-pending/approved/rejected state | Implemented / unverified |
| 5. Track status | Applicant opens status page | Show persisted pending/approved/rejected/needs-action state and allowed next step | Read API uses the same canonical seller/application records | Other user's application cannot be read; status remains correct after reload | Partial / unverified |
| 6. Review | Admin opens seller queue, approves/rejects | Permission-gated queue; rejection requires reason where policy says so; clear confirmation/result | Admin review API, valid state transition, audit log, concurrency-safe update | Non-admin, stale status, double decision, missing rejection reason | Implemented / unverified |
| 7. Create store | Approved seller starts store setup | Only approved applicants can proceed; show draft state and missing setup tasks | Authorized/idempotent store creation; Store, StoreMarket and exact owner/staff scope | Unapproved applicant, repeated create, cross-user/store IDs, no active market configuration | Implemented / unverified |
| 8. Finish setup | Configure store and first operational steps | Show only actions supported by backend; profile/market/catalog prerequisites explicit | Store settings and market APIs; later product/warehouse services as scoped | Save errors, unavailable market, partial setup, reload and persisted state | Partial / unverified |
| 9. Verify journey | Exercise from first CTA to approved draft store | Test with real browser/HTTP flow in configured test environment | Disposable PostgreSQL for schema/transaction changes; focused auth/permission tests | Guest, verified/unverified user, duplicate submit, forbidden reviewer, approve/reject, stale transition, idempotent store creation | Not yet evidenced as one complete journey |

**Schema decision gate:** inspect prisma/schema.prisma and docs/architecture/prisma-model-usage-map.md before changing persistence. Reuse the current Seller/application representation if it covers the lifecycle. Add a model/table only if a missing durable business state or relationship is demonstrated; any change needs an additive migration and disposable-PostgreSQL verification. KYC documents, seller tax records and payout activation are separate scopes and must not be implied by basic application approval.

## C1a. Cross-cutting action audit

For every page added or modified, inventory all interactive controls (including header/footer controls, row menus, pagination, retry and destructive actions). Each control must have one of: a real verified action, an explicitly conditional/disabled state with reason, or be removed until implemented. Check UI → API → auth/validation → service → repository/Prisma → response/refresh. Keep the test set focused on distinct business invariants and security boundaries; do not create a test per helper or visual control.

## D. Platform administration

| Required route | Audience | Owning system(s) | API/service and data to confirm | Initial status | Evidence / gap |
|---|---|---|---|---|---|
| `/admin` | Platform admin | shared administration | admin summary services | Not audited | Permission-aware links and empty/error states |
| `/admin/users` | Authorized admin | 01 | user administration service; User, roles, audit | Not audited | Least privilege and audited mutations |
| `/admin/sellers` | Authorized admin | seller onboarding | seller review APIs; Seller | Implemented / unverified | Confirm approve/reject and audit |
| `/admin/products` | Catalog moderator | 02 | moderation APIs; Product | Implemented / unverified | Confirm only authorized moderators |
| `/admin/categories`, `/admin/brands` | Catalog admin | 02 | taxonomy administration services | Not audited | Required management surfaces |
| `/admin/markets`, `/admin/currencies` | Platform admin | market configuration | market/currency services | Not audited | Do not infer launch market or exchange rates |
| `/admin/orders` | Authorized admin | 05 | order administration service | Not audited | Audited interventions and immutable history |
| `/admin/returns` | Returns manager | 11 | returns admin API | Implemented / unverified | Current status workflow only; no refund execution |
| `/admin/refunds` | Finance-authorized admin | refund/payment system | refund/payment/ledger service | Conditional / future | Must not appear actionable until refund implementation exists |
| `/admin/reviews`, `/admin/store-reviews` | Moderator | 06 | moderation APIs | Implemented / unverified | Separate queues and audit |
| `/admin/questions` | Moderator | 08 | Q&A moderation API | Implemented / unverified | Verify moderation transitions |
| `/admin/support` | Support staff | 09 | ticket administration APIs | Implemented / unverified | Internal notes restricted to staff |
| `/admin/search-synonyms` | Catalog admin | 03 | synonym management API; SearchSynonym | Not audited / future | Discovery ranking/autocomplete also incomplete |
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
