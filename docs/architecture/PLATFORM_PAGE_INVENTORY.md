# Platform Page and Route Inventory

**Purpose:** Canonical, page-by-page inventory of shipped routes, required platform pages, and shared exceptional states. The 49 systems describe business capabilities; this document describes the screens and user journeys required to make those capabilities usable.

**Status rule:** Required routes are not a claim that they currently exist or work. The filesystem snapshot below records source presence only. Before marking a route complete, verify the page, access policy, API/service integration, loading/empty/error states, responsive behavior, and its critical user journey. Keep implementation status in the build log and project audit.

**System placement:** See [`PLATFORM_PAGE_SYSTEM_MAP.md`](PLATFORM_PAGE_SYSTEM_MAP.md) for the owning page and audience for each of the 49 systems, recommended navigation, and dependency-aware delivery order. This file remains the route checklist; it does not certify route presence or workflow completion.

**Detailed functional contents:** See [`GLOBAL_PLATFORM_PAGE_AND_CONTROL_SPEC.md`](GLOBAL_PLATFORM_PAGE_AND_CONTROL_SPEC.md) for required contents and actions inside every storefront, buyer, seller, admin, finance/operations and property workspace, including the complete admin control center and logout journey.

## 1. Shared application shell

- [ ] Global storefront header: logo/home, search, category navigation, market/currency selector, account, wishlist, cart.
- [ ] Responsive navigation/mobile menu and footer with help, policies, seller entry, and contact links.
- [ ] Breadcrumbs and consistent page titles.
- [ ] Reusable loading, empty, not-found, forbidden, and recoverable-error states.
- [ ] Toast/inline feedback, form validation, confirmation for destructive actions.
- [ ] Accessible keyboard navigation, focus states, labels, contrast, and responsive layouts.

## 2. Public storefront and discovery

- [ ] `/` — Homepage: hero, categories, featured/new products based on real API data, brands/stores, search entry, clear calls to action.
- [ ] `/search` — Search results, query persistence, sorting, filters, pagination, no-results and API-error states.
- [ ] `/categories` and `/categories/[slug]` — Category directory and category product listing.
- [ ] `/brands` and `/brands/[slug]` — Brand directory and brand product listing.
- [ ] `/products/[slug]` — Product detail, gallery, variants, market-aware price/availability, store identity, questions/reviews, wishlist, add-to-cart.
- [ ] `/stores` — Public seller/store directory with search and filters.
- [ ] `/stores/[slug]` — Public store profile, catalog, store details, reviews, and contact action.
- [ ] `/sellers` — Seller discovery landing/directory where seller identity is distinct from store identity.
- [ ] Market/currency selection and a clear unavailable-market state.
- [ ] SEO metadata, canonical URLs, sitemap/robots, and product structured data for public pages.

## 3. Authentication and account access

- [ ] `/login` — Sign in, validation, disabled/loading state, safe error messages.
- [ ] `/register` — Customer account creation and consent/terms links.
- [ ] `/forgot-password` — Request password reset without account enumeration.
- [ ] `/reset-password` — Token validation and password update.
- [ ] `/logout` — Safe session termination and redirect.
- [ ] `/account/security` — Active session/security controls, password change, TOTP MFA enrollment/recovery, and mandatory MFA for administrators and sellers.
- [ ] Authenticated-route redirects preserve the intended destination without creating open redirects.

## 4. Customer account

- [ ] `/account` — Account overview and shortcuts.
- [ ] `/account/profile` — Name and profile details.
- [ ] `/account/addresses` — Address book, create/edit/delete, default address.
- [ ] `/account/orders` — Order history, status, search/filter/pagination.
- [ ] `/account/orders/[orderId]` — Order detail, vendor shipments/status, totals, payment state, permitted actions.
- [ ] `/cart` — Cart items, quantity changes, remove item, market/stock/price refresh.
- [ ] `/checkout` — Address, shipping, tax/total quote, reservation expiry, review and place-order flow.
- [ ] `/account/wishlist` — Saved products, remove/move-to-cart actions.
- [ ] `/account/reviews` — Reviews the customer can write/manage.
- [ ] `/account/questions` — Product questions and answers.
- [ ] `/account/messages` and `/account/messages/[conversationId]` — Store conversations.
- [ ] `/account/notifications` — Notification inbox, read/unread and preferences.
- [ ] `/account/support` and `/account/support/[ticketId]` — Support tickets and customer-visible replies.
- [ ] `/account/returns` and `/account/returns/[returnId]` — Eligible items, return requests, status/history.
- [ ] `/account/payments` — Payment methods/history only when supported safely by the selected provider.
- [ ] `/account/invoices` — Customer invoices when invoice generation is implemented.
- [ ] `/account/loyalty` — Points/rewards only when the loyalty system is implemented.

## 5. Seller onboarding and seller center

- [ ] `/sell` — Public seller information and entry point.
- [ ] `/seller/apply` — Seller application and required business information.
- [ ] `/seller/application` — Application status, outstanding requirements, resubmission where permitted.
- [ ] `/seller` — Seller dashboard with real operational summaries and actionable alerts.
- [ ] `/seller/store` and `/seller/store/settings` — Store profile, public details, policies, localization.
- [ ] `/seller/products` — Product list, status filters, pagination, bulk-safe actions.
- [ ] `/seller/products/new` and `/seller/products/[productId]/edit` — Product creation/editing, variants, media, attributes, market pricing.
- [ ] `/seller/inventory` — Stock by warehouse/variant, adjustments, movement history.
- [ ] `/seller/warehouses` — Warehouse management and transfer workflows.
- [ ] `/seller/orders` and `/seller/orders/[orderId]` — Vendor orders, fulfillment and allowed status changes.
- [ ] `/seller/shipping` — Shipping methods/rates and coverage.
- [ ] `/seller/returns` — Seller return review/processing when policy and permissions are defined.
- [ ] `/seller/reviews` — Store/product review responses and moderation state.
- [ ] `/seller/questions` — Questions requiring seller answers.
- [ ] `/seller/messages` and `/seller/messages/[conversationId]` — Store inbox and conversations.
- [x] `/seller/staff` — Owner-scoped invitations with seven-day expiry/renewal, invitee acceptance, seeded least-privilege store roles, transactional role changes and revoke. Runtime verification, session invalidation and delegated administration remain open.
- [ ] `/seller/notifications` — Seller alerts and preferences.
- [ ] `/seller/analytics` — Sales/performance reporting when supported by trustworthy data.
- [ ] `/seller/finance`, `/seller/commissions`, `/seller/payouts` — Financial statements only when ledger/reconciliation/payout workflows are implemented.
- [ ] `/seller/settings` — Security, localization, operational preferences.

## 6. Platform administration

- [ ] `/admin` — Admin dashboard with genuine system/operations summaries.
- [ ] `/admin/users` and `/admin/users/[userId]` — Account lookup and permitted account actions.
- [ ] `/admin/sellers` and `/admin/sellers/[sellerId]` — Seller applications, verification, approval/suspension.
- [ ] `/admin/stores` and `/admin/stores/[storeId]` — Store review and status management.
- [ ] `/admin/products` and `/admin/products/[productId]` — Product moderation and approval.
- [ ] `/admin/categories`, `/admin/brands` — Taxonomy administration.
- [ ] `/admin/markets`, `/admin/currencies`, `/admin/locales` — Market/reference data management with controlled changes.
- [ ] `/admin/orders` and `/admin/orders/[orderId]` — Order investigation, audit trail, allowed operational actions.
- [ ] `/admin/payments`, `/admin/refunds`, `/admin/disputes` — Only as provider integration and financial controls become available.
- [ ] `/admin/returns` — Return review workflow.
- [ ] `/admin/tax-rates`, `/admin/shipping` — Configuration with effective dates and audit trail.
- [ ] `/admin/reviews`, `/admin/store-reviews`, `/admin/questions` — Trust and moderation queues.
- [ ] `/admin/support` — Support queue, assignment, priority, internal notes and replies.
- [ ] `/admin/notifications` — Delivery/notification operational view when implemented.
- [ ] `/admin/roles`, `/admin/permissions`, `/admin/audit-log` — Access and audit management.
- [ ] `/admin/content`, `/admin/banners`, `/admin/pages` — CMS/editorial content when implemented.
- [ ] `/admin/reports` — Operational/financial reporting tied to validated sources.
- [ ] `/admin/settings`, `/admin/feature-flags`, `/admin/integrations` — Restricted configuration and integration health.

### Super Admin request: implementation status

The following records the current source implementation, not a claim that the database migration or browser journey has been deployed and verified.

| Capability | Status | Current behavior / remaining work |
|---|---|---|
| Account deletion | Implemented as privacy-safe anonymization | Disables access, revokes credentials and sessions, closes owned stores, archives products, hides authored reviews/Q&A, and audits the reason. Orders, payments, returns, support, tax, and audit records are retained. Apply the migration and verify against a disposable database before deployment. |
| Role changes | Implemented | User detail exposes assign/remove controls to authorized delegators. Permission non-escalation and protected platform-role checks are enforced and audited; store-manager assignments require an active store membership and explicit STORE scope. |
| Bulk product removal | Implemented as archive/unpublish | Supports selected products, one store, or one store owner; max 500 per scoped operation, reason required, per-product audit events. Historical order references are retained; this is not physical deletion. |
| Category management | Implemented | Create/edit/archive category hierarchies with cycle checks and audit events. Product-linked categories are archived rather than hard-deleted; storefront discovery continues to hide categories with no discoverable products. |
| Review-before-publishing | Partial | Seller and product approval workflows exist. A global optional mode/toggle and store-level review setting are not implemented. |
| Reviews and ratings | Partial | Existing moderation/report/appeal queues can hide or reject content. In-place editing and revision history are not implemented. |
| Global discounts | Partial | Admin UI uses the existing platform-wide coupon API. Funding attribution and per-store/category coupon scope are not recorded or supported. |
| MFA enforcement | Implemented in source | MFA enrollment is required for administrator roles, seller accounts, and store-scoped store managers; disabling is blocked while the account remains privileged. |
| Audit and performance | Partial | Existing audit log plus new account, role, category, and product events. Complete coverage, conversion metrics, inactive-store metrics, and operational health dashboards remain incomplete. |
| Support and returns | Partial | Existing support-ticket and return workflows are available. A unified buyer/seller dispute-resolution workspace is not implemented. |
| Commission, payouts, financial reports | Partial | Super Admins can create effective-dated global/seller/category commission rules. Successful payments create immutable per-item snapshots using discounted merchandise only (excluding shipping/tax), deterministic discount allocation, and seller+category → seller → category → global precedence. No matching rule means 0%. Seller ledger, payout lifecycle, reconciliation, and complete financial reports remain unimplemented; migration is applied only to the local `mtjr2_demo` database and payment-success DB journey is not yet verified. |
| Global payment/shipping/currency/tax settings | Partial | Market tax rules and seller shipping rates exist; global payment-gateway controls, platform shipping methods, and comprehensive currency/tax controls are absent. |
| Backups | Not implemented | Selected design is a provider-adapter/control surface disabled until provider credentials, encrypted storage, retention, access controls, and a tested restore procedure are configured. |
| Bulk notifications | Not implemented | No campaign/audience workflow or delivery controls exist. |
| Banners and paid promotions | Not implemented | No banner/featured-placement model, storefront integration, or fee workflow exists. |
| IP blocking | Not implemented | No persisted block list or trusted-IP enforcement path exists. |

## 7. Global operations and back office

- [ ] Tax/customs configuration and reporting.
- [ ] Fulfillment, shipments, tracking, delivery exceptions.
- [ ] Returns logistics and refund reconciliation.
- [ ] Accounting ledger, journal entries, settlement/reconciliation, seller payouts.
- [ ] Fraud/risk/dispute queues and evidence.
- [ ] Supplier/procurement and purchase-order screens.
- [ ] Invoices, credit notes, exports, and compliance reports.
- [ ] Webhook/event delivery, retry/dead-letter handling, background-job health.
- [ ] Observability, security events, backups, incident/runbook links.
  
These screens may live under a restricted operations namespace rather than the customer-facing `/admin` area. Their route names are implementation targets, not a mandate to expose every tool to every admin role.

## 8. Separate property and booking domain

- [ ] `/properties` — Property directory/search/filter.
- [ ] `/properties/[slug]` — Property detail, gallery, availability and inquiry/booking action.
- [ ] `/property/submit` — Property submission, if enabled.
- [ ] `/account/property-requests` and request detail — Customer inquiry/booking history.
- [ ] `/property-owner` — Owner dashboard and property management.
- [ ] `/property-owner/properties/[propertyId]` — Listing edit and availability.
- [ ] `/admin/properties`, `/admin/property-requests` — Moderation and request handling.
- [ ] Keep property booking/payment policies separate from product-order workflows while sharing identity and platform infrastructure where appropriate.

## 9. System and legal pages

- [ ] `/help`, `/contact`, `/faq`.
- [ ] `/policies/terms`, `/policies/privacy`, `/policies/cookies`, `/policies/returns`, `/policies/shipping`, `/policies/seller`.
- [ ] `/accessibility` and appropriate consent/preferences controls.
- [ ] Forbidden/404 states, root and segment error/loading boundaries, and a maintenance state; dedicated `/403` or `/404` URLs are optional presentation routes, not access controls.
- [ ] Status/incident information for operators where appropriate.

Legal copy, return windows, taxes, supported markets, payment methods, and shipping promises must not be invented: publish only after the responsible policies are approved.

## 10. Cross-page completion checklist

For each route, record:

1. Route and source file (or explicitly **Missing** / **Conditional**).
2. Intended audience and access policy (anonymous, customer, seller/store-scoped staff, support, finance, security, admin, Super Admin, operations).
3. Page purpose, navigation entry point, data source and domain API/service; no direct Prisma calls from UI.
4. Main actions and their server-side authorization/validation.
5. Loading, empty, validation, forbidden, not-found, conflict, unavailable, and service-failure states as relevant.
6. Responsive/accessibility review.
7. One critical workflow test plus focused integration checks for financial, stock, permission, and ownership boundaries.
8. Evidence, limitations, source status and verification status in `docs/implementation/PAGE_ROUTE_REGISTRY.md`, `docs/implementation/BUILD_LOG.md`, and the journey matrix.

**Important:** This inventory is intentionally broader than the first delivery slice. Implement pages in dependency order, connect each one to real APIs, and label demo-only content clearly. Do not add fake product/review/sales data or claim a workflow complete because its route renders.

## 11. Super Admin and privileged platform control

Super Admin is a separate access tier within platform administration, not a synonym for ordinary admin. Every route below requires a server-enforced global role/permission check, mandatory MFA, short privileged sessions, audit logging, and re-authentication/approval for high-risk operations. A page's presence is not evidence that these protections or workflows are complete.

- [ ] `/admin/control-panel` — Root control-panel overview and governed platform-wide controls.
- [ ] `/admin/control-panel/access-catalog` — Global role/permission catalog and delegation boundaries.
- [ ] `/admin/control-panel/privilege-requests` — Review and resolve privileged-access requests; decisions must be reasoned and audited.
- [ ] `/admin/control-panel/audit-log` — Restricted, append-only platform audit review; never expose secrets or allow audit mutation.
- [ ] `/account/security` — MFA setup, verification, recovery-code handling and password/session controls; mandatory MFA for privileged roles.
- [ ] Future root-owner controls — Market launch gates, global policy, provider/operational health, role delegation, security/risk posture and exceptional-action approvals. Add a dedicated route only when its permission model, service and durable workflow are defined.

The current filesystem includes the four `/admin/control-panel*` routes and `/account/security`; this is **source presence only**. See the dated snapshot below and the registry for known implementation gaps.

## 12. Error pages, empty states and exceptional application states

States are part of the page inventory even when they are not separate URLs. Render them in the owning route or the nearest shared boundary. Keep recovery actions available, preserve safe form/search context, and never expose stack traces, secrets, provider payloads, private records or whether an account exists.

| State / page surface | Applies to | Required user-visible behavior and recovery |
|---|---|---|
| Not found / unknown route | All routes; missing product, category, brand, store, order, ticket, shipment or resource | Branded 404 content, explain that the item/page is unavailable, link to a safe relevant destination; do not reveal whether a private resource belongs to another user. |
| Forbidden / insufficient role | Customer, seller, staff, admin and Super Admin routes/actions | 403-style in-page state or safe redirect; explain insufficient access without leaking protected data; provide a route back. Server must enforce the same restriction. |
| Authentication required / expired session | Protected pages and mutations | Preserve only a validated local return path through sign-in; explain session expiry and allow re-authentication. Never loop between login and protected routes. |
| Route render failure | Every route segment and root application | Recoverable error boundary with retry/navigation; root fallback must render without relying on the failing layout. Log diagnostic details server-side only. |
| Initial load / pending mutation | All data-backed pages and forms | Stable loading/skeleton state; prevent duplicate submissions and retain the user's entered values where safe. |
| Empty collection | Catalog, search, cart, account lists, seller queues, admin queues and Super Admin panels | Explain why there is no content and give a relevant next action (clear filters, browse, create, or wait); do not fabricate counts or records. |
| Search/filter no results | Search, product/store/category/brand directories | Echo the active query/filters, provide clear/reset actions and useful browse links; distinguish zero matches from API failure. |
| Validation failure | Auth, profile, address, seller, checkout, admin and privileged forms | Field-level, accessible messages; keep correctable input; do not reveal internal validation or security policy details. |
| Conflict / stale state | Duplicate registration/application, inventory races, stale approval, cart/price/stock changes, concurrent admin actions | Explain that the state changed, refresh server data and offer a safe retry; do not report success when the transition was rejected. |
| Dependency unavailable / network failure | Database/API, search, payment, shipping, tax, email, OAuth, MFA and notification dependencies | Identify the unavailable action, preserve safe context, allow retry where idempotent and avoid claiming a charge, order, email or permission change succeeded without confirmation. |
| Market/currency unavailable | Storefront, product detail, cart and checkout | Explain market or currency unavailability and offer supported alternatives; never silently show a misleading total. |
| Unavailable product / variant / stock | Product detail, cart and checkout | Show current availability, block invalid quantities and offer removal/selection alternatives; revalidate before checkout. |
| Checkout quote expiry / payment pending, declined or unknown | Cart, checkout, order confirmation and order detail | Re-quote/retry safely, distinguish pending from failed/paid, prevent duplicate orders/charges, and show server-confirmed next steps. |
| MFA challenge / invalid, expired or replayed code / recovery | Login and account security | Explain how to obtain a current code from the configured authenticator or use a one-time recovery code; avoid account lockout and never display or log submitted codes. |
| Bot check, rate limit or abuse control | Registration, login, reset and sensitive mutations | Clear retry/slow-down message, preserve non-secret input, provide accessible challenge alternatives where configured; do not disclose detection thresholds. |
| Service maintenance / launch-gated feature | Platform-wide or explicitly unavailable feature | Clearly identify the unavailable capability and provide a safe return path or support/status destination; never show an actionable control for an unconfigured provider/workflow. |
| Data delivery / background work delay | Email, notifications, webhooks, jobs, imports/exports and long-running admin tasks | Distinguish queued, processing, delivered, failed and retrying; show only server-confirmed status and safe recovery options. |
| Access-denied or server-error URL | Direct `/403` or `/500` navigation if retained | These are optional presentation routes, not authorization mechanisms. Use shared forbidden/error boundaries; an unimplemented path must not be mistaken for an access-control check. |

### Framework-level error boundary requirements

- [ ] Custom `src/app/not-found.tsx` for unknown public routes and explicit `notFound()` results.
- [ ] Root `src/app/error.tsx` client boundary with a safe retry action.
- [ ] Root `src/app/global-error.tsx` fallback that can render when the root layout itself fails.
- [ ] Segment-level `error.tsx` and `loading.tsx` for high-risk route groups where local recovery/pending feedback is needed (account, seller, admin).
- [ ] Consistent inline empty/error components for API-backed lists and forms; a global toast must not be the only presentation of a blocking failure.
- [ ] 403 is an authorization result/state, not a route that can grant or enforce access.

## 13. Actual App Router page/source snapshot (2026-11-06)

**Method:** recursive inspection of `src/app` for `page.tsx`, `layout.tsx`, and Next.js special route files. **Result:** 74 `page.tsx` files are present, including 28 admin pages. No custom `not-found.tsx`, `error.tsx`, `global-error.tsx`, `loading.tsx`, or `default.tsx` files were found. This is a static filesystem audit; it does not certify rendering, navigation, API wiring, access control, state coverage, persistence, or journey completion. The table is a route census, not an implementation-complete claim.

For brevity, `src/app/<route>/page.tsx` is the source convention for each route below; `/` maps to `src/app/page.tsx`. Dynamic segment names in brackets match the source directory.

| Area | Source-present routes (purpose / audience) | Audit status |
|---|---|---|
| Shopping and discovery | `/` (storefront home); `/search` (search results); `/products` (catalog); `/products/[slug]` (public product detail); `/categories` and `/categories/[slug]` (taxonomy directory/detail); `/brands` and `/brands/[slug]` (brand directory/detail); `/stores` and `/stores/[slug]` (store directory/profile). | Source present; journey and applicable states unverified. |
| Cart and buying | `/cart` (guest/customer cart); `/checkout` (quote/address/shipping/payment/order flow); `/orders/[orderId]` (customer post-purchase detail and tracking). | Source present; live payment/order outcomes and recovery states require journey evidence. |
| Authentication and security | `/login`; `/register`; `/forgot-password`; `/reset-password`; `/account/security` (password and MFA controls). Google OAuth callback/start and MFA are API routes, not page routes. Registration does not require email verification; do not inventory verification/resend pages. | Source present; full provider and security journeys remain separately verifiable. |
| Customer account | `/account`; `/account/profile`; `/account/addresses`; `/account/orders`; `/account/favorites`; `/account/wishlist`; `/account/reviews`; `/account/questions`; `/account/messages`; `/account/messages/[conversationId]`; `/account/notifications`; `/account/returns`; `/account/sessions`; `/account/store`; `/account/support`; `/account/support/[ticketId]`. `/account/store` is a seller workspace alias, not a buyer store-management entitlement. | Source present; each owner-scoped workflow and empty/error state must be verified. |
| Notifications | `/notifications` and `/account/notifications`. | Both source routes exist; standardize one canonical destination and retain the other only as a deliberate alias/redirect to prevent split inbox behavior. |
| Seller portal | `/seller`; `/seller/products`; `/seller/inventory`; `/seller/orders`; `/seller/messages`; `/seller/questions`; `/seller/returns`; `/seller/reviews`; `/seller/staff`. Application is currently embedded in `/seller` rather than separate `/seller/apply` or `/seller/application` pages. | Source present; store-scoping, role boundaries and seller application journey require verification. |
| Platform admin | `/admin/dashboard`; `/admin/control-panel`; `/admin/control-panel/access-catalog`; `/admin/control-panel/audit-log`; `/admin/control-panel/privilege-requests`; `/admin/categories`; `/admin/commissions`; `/admin/coupons`; `/admin/logistics`; `/admin/logistics/[shipmentId]`; `/admin/orders`; `/admin/orders/[orderId]`; `/admin/payments`; `/admin/payments/[paymentId]`; `/admin/product-management`; `/admin/products`; `/admin/questions`; `/admin/questions/reports`; `/admin/returns`; `/admin/review`; `/admin/reviews`; `/admin/search-synonyms`; `/admin/sellers`; `/admin/store-reviews`; `/admin/support`; `/admin/tax-rates`; `/admin/users`; `/admin/users/[userId]`. | Source present; `/admin` is absent; the root landing/dashboard route is `/admin/dashboard`. Permissions, audit and data journeys are not inferred from source presence. |
| Super Admin / root controls | `/admin/control-panel`; `/admin/control-panel/access-catalog`; `/admin/control-panel/audit-log`; `/admin/control-panel/privilege-requests`; `/account/security` for mandatory administrator and seller MFA. | Source present; account anonymization requires `platform:manage`; migration and high-risk browser journey remain to be verified. |
| Legal/informational | `/terms`; `/privacy`. | Source present; legal content is documented as draft and requires owner/legal approval before publication. |

### Required pages not found in the current route tree

These are platform requirements or conditional targets, not present pages. Some may eventually be fulfilled as clearly scoped sections of existing routes, but do not claim a route exists until it is implemented and linked.

| Area | Missing or conditional targets |
|---|---|
| Shopping/marketplace | `/sellers` as a distinct seller directory (conditional if `/stores` is the intended discovery surface); explicit market/currency selection or unavailable-market page; separately composed confirmation/status page (current order detail may fulfill this only if it represents server-confirmed outcome). |
| Customer account | `/account/returns/[returnId]` (current source has only return list); `/account/payments`, `/account/invoices`, `/account/loyalty`, `/account/property-requests` (conditional on payment/invoice/loyalty/property capabilities). |
| Authentication/security | Dedicated `/logout` and `/verify-email` are not required under the current identity policy: logout may be an action, and accounts activate without verification. Dedicated recovery-code page is optional if safely delivered by `/account/security`. |
| Seller | `/sell`; dedicated `/seller/apply` and `/seller/application` (workflow currently embedded in `/seller`); `/seller/store` and `/seller/store/settings`; `/seller/products/new` and `/seller/products/[productId]/edit`; `/seller/warehouses`; `/seller/shipping`; `/seller/orders/[orderId]`; `/seller/messages/[conversationId]`; `/seller/notifications`; `/seller/analytics`; `/seller/finance`; `/seller/commissions`; `/seller/payouts`; `/seller/settings`. Enable financial routes only after ledger, reconciliation and payout workflows are implemented. |
| Platform admin | `/admin` landing alias/redirect; `/admin/users/[userId]/roles` or equivalent role-mutation surface; seller detail/KYB; stores and store detail; product detail/moderation as needed; categories, brands, markets, currencies, locales; refunds and disputes; shipping configuration; dedicated admin notifications; content/CMS; reports; settings, feature flags, integrations, jobs/events and risk controls. Do not expose unsupported actions as live controls. |
| Super Admin | Additional global policy/market launch/provider-health/role-delegation/exception-approval pages where requirements justify dedicated screens. Current control panel routes do not by themselves establish these workflows. |
| Global operations | Dedicated ledger, commissions, reconciliation, payouts, invoice/credit-note, tax/customs, risk/fraud, provider/integration, outbox/job/dead-letter, observability, incident, backup/restore and status surfaces. Some may be restricted subroutes; all require explicit permission boundaries and real data. |
| Property/booking domain | `/properties`; `/properties/[slug]`; `/property/submit`; `/account/property-requests` and detail; `/property-owner`; `/property-owner/properties/[propertyId]`; `/admin/properties`; `/admin/property-requests`. Entire domain is separate from product checkout/order routes. |
| Legal/help | `/help`; `/contact`; `/faq`; cookie, returns, shipping and seller policies; `/accessibility`; consent/preferences and public status/incident information as approved. Publish only approved policy content. |
| Error presentation | Custom not-found, root and segment error boundaries, and loading fallbacks listed in Section 12. `/403` and `/404` should be shared states or optional presentation URLs, never authorization controls. |

## 14. Audit interpretation and update policy

1. A route in Section 13 is **Present**, not automatically **Wired** or **Verified**. The route registry remains the source for route-level API/service, Prisma and known-gap notes; the End-to-End Journey Matrix remains the action-level evidence source.
2. A missing target must be labeled **Missing**, **Conditional**, or **Fulfilled by an identified existing route/section**. Do not mark an absent route complete because an API handler or menu label exists.
3. Every required page row must have a defined audience/access boundary, purpose, navigation path, data/service, primary actions, and relevant loading/empty/validation/forbidden/not-found/conflict/failure states.
4. Keep cross-cutting state requirements in Section 12 and link each affected route to applicable states; a separate page URL is not required for every state.
5. Re-run the filesystem snapshot when routes change and update the date, count, actual route list, missing targets and route registry together. Do not use stale counts from earlier branch snapshots.
6. Keep verification evidence, conditional provider/policy decisions, and known gaps explicit. Route presence and static source inspection do not certify a complete user journey or production readiness.


| Payment provider control center | `/admin/payment-providers` | Runtime binding implemented; verification pending | Super Admin-only encrypted provider configuration for compiled Stripe/PayPal adapters; active TEST/LIVE records now drive new checkout sessions with country/currency allowlists, and each Payment retains an encrypted credential snapshot for webhook/PayPal return verification. Runtime journey and database migration still require owner-side execution and later verification. |
