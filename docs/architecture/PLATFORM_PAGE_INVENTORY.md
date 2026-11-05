# Platform Page and Route Inventory

**Purpose:** Complement `COMPLETE_PLATFORM_SYSTEMS_BLUEPRINT.md` with a page-by-page delivery checklist. The 49 systems describe business capabilities; this document describes the screens and user journeys required to make those capabilities usable.

**Status rule:** Listed routes are required targets, not a claim that they currently exist or work. Before marking a route complete, verify the page, access policy, API/service integration, loading/empty/error states, responsive behavior, and its critical user journey. Keep implementation status in the build log and project audit.

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
- [ ] `/verify-email` — Verification token handling, expired/invalid states, resend action.
- [ ] `/forgot-password` — Request password reset without account enumeration.
- [ ] `/reset-password` — Token validation and password update.
- [ ] `/logout` — Safe session termination and redirect.
- [ ] `/account/security` — Active session/security controls, password change, and future MFA management as supported.
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
- [ ] `/seller/staff` — Staff invitations, roles/permissions, revoke access.
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
- [ ] `/403`, `/404`, global error and maintenance pages.
- [ ] Status/incident information for operators where appropriate.

Legal copy, return windows, taxes, supported markets, payment methods, and shipping promises must not be invented: publish only after the responsible policies are approved.

## 10. Cross-page completion checklist

For each route, record:

1. Intended audience and access policy (anonymous, customer, seller/store-scoped staff, support, admin, operations).
2. Data source and domain API/service; no direct Prisma calls from UI.
3. Main actions and their server-side authorization/validation.
4. Loading, empty, validation, forbidden, not-found, and service-failure states.
5. Responsive/accessibility review.
6. One critical workflow test plus focused integration checks for financial, stock, permission, and ownership boundaries.
7. Evidence, limitations, and status in `docs/implementation/BUILD_LOG.md` and `docs/PROJECT_AUDIT.md`.

**Important:** This inventory is intentionally broader than the first delivery slice. Implement pages in dependency order, connect each one to real APIs, and label demo-only content clearly. Do not add fake product/review/sales data or claim a workflow complete because its route renders.
