# Matjar page inventory and route audit

**Audit date:** 2026-11-09  
**Scope:** Marketplace application pages and required-but-unimplemented route targets.  
**No deployment was performed.**

## Status key

| Status | Meaning |
|---|---|
| `COMPLETE` | Page and key workflows were verified across access, integration, responsive UI, states, and controls. |
| `INCOMPLETE` | Source exists, but an identified required capability or state is absent. |
| `MISSING` | No matching App Router page exists. |
| `BROKEN` | A reproducible source/runtime defect prevents intended use. |
| `NEEDS_REDESIGN` | Existing page/shell conflicts with the approved shared design or information architecture. |
| `NEEDS_TESTING` | Source exists, but the complete page contract has not been verified. |

`page.tsx` presence is not completion evidence. This audit inspected the App Router page/layout files, shared navigation, route feature imports, API route tree, existing route registry and platform page inventory. A fresh local browser tab verified the unknown-route 404 and its recovery links at a 390px viewport with no horizontal overflow. The supplied tabs could not be reopened; the remaining page journeys, responsive behavior and controls remain unverified. Authentication and authorization below describe intended/server-side boundaries found in source, not a claim that every control has been exercised.

## Cross-cutting shell and exceptional states

| Page/state | Route or source | Exists | Components/layout | Access and integration | Status |
|---|---|---:|---|---|---|
| Storefront shell | All routes; `src/app/layout.tsx` | Yes | Root layout, `SiteNavigation`, registration notice, Sonner toaster, global CSS/theme tokens | Global navigation links map to existing public routes; authenticated links depend on session. Responsive visual behavior has not been browser-tested. | NEEDS_TESTING |
| Not-found page | Next.js `not-found.tsx` convention (not a `/404` URL) | Yes, added in this audit | `src/app/not-found.tsx`; root layout | Safe home/product recovery links; Next.js handles unmatched URLs and `notFound()` results. | NEEDS_TESTING |
| Root loading state | Root segment loading boundary | Yes, added in this audit | `src/app/loading.tsx`, `RouteLoadingState` | Generic accessible skeleton for streamed route content. | NEEDS_TESTING |
| Root render failure | Root segment error boundary | Yes, added in this audit | `src/app/error.tsx`, `RouteErrorState` | Retry and home recovery; does not expose error message or stack. | NEEDS_TESTING |
| Root-layout failure | Global error boundary | Yes, added in this audit | `src/app/global-error.tsx`, `RouteErrorState`, `globals.css` | Replaces root layout, includes its own document and recovery controls. | NEEDS_TESTING |
| Account loading/failure | `/account/**` | Yes, added in this audit | `src/app/account/loading.tsx`, `src/app/account/error.tsx` | Inherits authenticated account layout; full session-expiry/recovery journey not browser-tested. | NEEDS_TESTING |
| Seller loading/failure | `/seller/**` | Yes, added in this audit | `src/app/seller/loading.tsx`, `src/app/seller/error.tsx` | Seller API/service authorization remains the enforcement boundary; browser journey not tested. | NEEDS_TESTING |
| Admin loading/failure | `/admin/**` | Yes, added in this audit | `src/app/admin/loading.tsx`, `src/app/admin/error.tsx` | Admin layout requires an eligible permission and privileged MFA; operation-specific API permissions remain authoritative. | NEEDS_TESTING |
| Forbidden state | No dedicated `/403` route | No URL page; authorization exists | Admin layout maps missing permission to not-found; APIs return forbidden where applicable | A URL is not an authorization control. Verify each protected page/API pair independently. | NEEDS_TESTING |
| Inline empty/error/success states | Individual API-backed pages | Partial | Implemented inside several feature components | Source shows local states in some pages, but there is no shared, exhaustive state audit. | INCOMPLETE |
| Maintenance/status page | No route | No | None | No maintenance mode/status workflow found. | MISSING |

**Shell findings:** Root `SiteNavigation` wraps all page segments. Account, seller workspace, and admin areas also render local page/workspace navigation in places. Their visual hierarchy and responsive behavior need a browser review before calling the design system consistent. Theme tokens exist in `src/app/theme.css`; token adoption, contrast, keyboard behavior, and mobile layouts have not been verified across all pages.

## Existing App Router pages

There are **79 `page.tsx` routes** in the audited source tree: 20 public/auth/commerce routes, 17 account routes, 12 seller routes, and 30 admin routes. All existing pages are `NEEDS_TESTING` unless an identified gap makes them `INCOMPLETE`. “Page source” is the actual route file; feature component is shown where imported. Root layout wraps every route, with the account/admin segment layouts noted below.

### Public marketplace, cart, checkout, authentication, and legal

| Page | Actual route | Exists | Page/component source | Layout / access | API and persistence evidence | Status |
|---|---|---:|---|---|---|---|
| Homepage | `/` | Yes | `src/app/page.tsx` → `features/storefront/home-page.tsx` | Root; public | Live catalog/discovery data; exact data-state and action journey not browser-verified. | NEEDS_TESTING |
| Product directory | `/products` | Yes | `src/app/products/page.tsx` → `features/storefront/catalog-discovery-page.tsx` | Root; public | `/api/products`, catalog/discovery services and Prisma catalog models. | NEEDS_TESTING |
| Product detail | `/products/[slug]` | Yes | `src/app/products/[slug]/page.tsx` → `features/storefront/product-detail.tsx` | Root; public | Product detail API/service; cart, favorites, reviews and Q&A integrations exist in source. | NEEDS_TESTING |
| Search | `/search` | Yes | `src/app/search/page.tsx` → `features/storefront/catalog-discovery-page.tsx` | Root; public | Search and suggestions APIs; URL-backed filtering is implemented in source. | NEEDS_TESTING |
| Category directory | `/categories` | Yes | `src/app/categories/page.tsx` → `features/storefront/category-directory-page.tsx` | Root; public | `/api/categories`; active categories with discoverable products. | NEEDS_TESTING |
| Category detail | `/categories/[slug]` | Yes | `src/app/categories/[slug]/page.tsx` → `features/storefront/catalog-product-grid.tsx`, `catalog-list-controls.tsx` | Root; public | Active category and discoverable products from catalog services. | NEEDS_TESTING |
| Brand directory | `/brands` | Yes | `src/app/brands/page.tsx` → `features/storefront/brand-directory-page.tsx` | Root; public | `/api/brands`; active brands. | NEEDS_TESTING |
| Brand detail | `/brands/[slug]` | Yes | `src/app/brands/[slug]/page.tsx` → `features/storefront/catalog-product-grid.tsx`, `catalog-list-controls.tsx` | Root; public | Active brand and discoverable products from catalog services. | NEEDS_TESTING |
| Store directory | `/stores` | Yes | `src/app/stores/page.tsx` → `features/storefront/catalog-list-controls.tsx` | Root; public | Discoverable stores service; seller-managed logo, banner and description render in directory cards; pagination/search completeness remains to verify. | NEEDS_TESTING |
| Store detail | `/stores/[slug]` | Yes | `src/app/stores/[slug]/page.tsx` → catalog grid, list controls, `features/storefront/store-reviews.tsx` | Root; public | Store/catalog/reviews services; seller-managed public description, HTTPS logo and banner URLs are persisted and rendered on the public store detail page; messages and review controls require journey tests. | NEEDS_TESTING |
| Cart | `/cart` | Yes | `src/app/cart/page.tsx` → `features/cart/cart-page.tsx` | Root; guest/customer | `/api/cart`, `/api/cart/items`; persisted cart lines and server-side price/stock validation. | NEEDS_TESTING |
| Checkout | `/checkout` | Yes | `src/app/checkout/page.tsx` → `features/checkout/checkout-review-page.tsx` | Root; guest/customer, quote-scoped | Checkout quote, address, shipping, tax and order APIs; payment is not implied by placing an order. | NEEDS_TESTING |
| Sign in | `/login` | Yes | `src/app/login/page.tsx` → `features/identity/auth-page.tsx` | Root; guest | `/api/auth/login`, session service, MFA challenge and safe return-path logic. | NEEDS_TESTING |
| Registration | `/register` | Yes | `src/app/register/page.tsx` → `features/identity/register-form.tsx` | Root; guest | `/api/auth/register`, bot challenge, consent persistence, active session creation. | NEEDS_TESTING |
| Password reset request | `/forgot-password` | Yes | `src/app/forgot-password/page.tsx` → `features/identity/auth-page.tsx` | Root; guest | `/api/auth/password-reset/request`; generic response intended to prevent account enumeration. | NEEDS_TESTING |
| Password reset completion | `/reset-password` | Yes | `src/app/reset-password/page.tsx` → `features/identity/auth-page.tsx` | Root; guest with reset token | `/api/auth/password-reset/complete`; token validation and session revocation service. | NEEDS_TESTING |
| Notifications | `/notifications` | Yes | `src/app/notifications/page.tsx` → `features/notifications/notifications-page.tsx` | Root; authenticated notification data | `/api/notifications`, read-state and preferences APIs. | NEEDS_TESTING |
| Customer order detail | `/orders/[orderId]` | Yes | `src/app/orders/[orderId]/page.tsx` → `features/orders/order-detail-page.tsx` | Root; authenticated owner | Order detail, payment, cancel/reorder APIs; owner scoping is server-side. | NEEDS_TESTING |
| Terms | `/terms` | Yes | `src/app/terms/page.tsx` (page-local) | Root; public | Static v1 development draft; requires legal approval. | INCOMPLETE |
| Privacy | `/privacy` | Yes | `src/app/privacy/page.tsx` (page-local) | Root; public | Static v1 development draft; requires legal approval. | INCOMPLETE |

### Customer account

The segment layout is `src/app/account/layout.tsx`; it calls the centralized session resolver and redirects unauthenticated visitors to sign-in with a validated return path.

| Page | Actual route | Exists | Page/component source | Access / integration | Status |
|---|---|---:|---|---|---|
| Account overview | `/account` | Yes | `src/app/account/page.tsx` (page-local) | Authenticated session; shortcuts link to account and seller routes. | NEEDS_TESTING |
| Profile | `/account/profile` | Yes | `src/app/account/profile/page.tsx` (page-local) | Authenticated own-profile API; persists User profile fields. | NEEDS_TESTING |
| Address book | `/account/addresses` | Yes | `src/app/account/addresses/page.tsx` (page-local) | Authenticated address/country APIs; UserAddress and Country; create/list are wired. Edit and delete controls are absent. | INCOMPLETE |
| Favorites alias | `/account/favorites` | Yes | `src/app/account/favorites/page.tsx` → `features/account/wishlist-page.tsx` | Favorites APIs and Favorite persistence; guest/customer merge behavior is server-owned. | NEEDS_TESTING |
| Wishlist | `/account/wishlist` | Yes | `src/app/account/wishlist/page.tsx` → `features/account/wishlist-page.tsx` | Same Favorite-backed feature as `/account/favorites`; intentional alias, not a separate implementation. | NEEDS_TESTING |
| Message inbox | `/account/messages` | Yes | `src/app/account/messages/page.tsx` (page-local) | Participant-scoped messaging APIs; StoreConversation and StoreMessage records. | NEEDS_TESTING |
| Message conversation | `/account/messages/[conversationId]` | Yes | `src/app/account/messages/[conversationId]/page.tsx` (page-local) | Participant-scoped conversation API; StoreConversation/StoreMessage ownership must be exercised. | NEEDS_TESTING |
| Account notifications | `/account/notifications` | Yes | `src/app/account/notifications/page.tsx` → `features/notifications/notifications-page.tsx` | Notification/read/preferences APIs; Notification and NotificationPreference records. | NEEDS_TESTING |
| Order history | `/account/orders` | Yes | `src/app/account/orders/page.tsx` → `features/orders/customer-orders-page.tsx` | Authenticated own-order API; Order and VendorOrder records. | NEEDS_TESTING |
| Product Q&A | `/account/questions` | Yes | `src/app/account/questions/page.tsx` → `features/account/questions-page.tsx` | Customer-owned question API/data; ProductQuestion and ProductAnswer; moderation-state journey needs testing. | NEEDS_TESTING |
| Returns | `/account/returns` | Yes | `src/app/account/returns/page.tsx` → `features/account/returns-page.tsx` | Authenticated return APIs; ReturnRequest/ReturnItem; no refund/payment movement is claimed. | NEEDS_TESTING |
| Reviews | `/account/reviews` | Yes | `src/app/account/reviews/page.tsx` → `features/account/reviews-page.tsx` | Own review and appeal APIs; ProductReview/StoreReview and appeal data; ownership/refresh journey needs testing. | NEEDS_TESTING |
| Security | `/account/security` | Yes | `src/app/account/security/page.tsx` → `features/identity/security-page.tsx` | Session, password and MFA APIs; User, UserSession, UserTwoFactor and recovery-code records; privileged MFA is mandatory. | NEEDS_TESTING |
| Sessions | `/account/sessions` | Yes | `src/app/account/sessions/page.tsx` (page-local) | Authenticated own-session API and UserSession data. | NEEDS_TESTING |
| Seller workspace alias | `/account/store` | Yes | `src/app/account/store/page.tsx` → `features/seller/workspace-page.tsx` | Same Seller/Store workspace as `/seller`; seller API checks remain authoritative. | NEEDS_TESTING |
| Support ticket detail | `/account/support/[ticketId]` | Yes | `src/app/account/support/[ticketId]/page.tsx` → `features/account/support-ticket-page.tsx` | Authenticated ticket participant API; SupportTicket/SupportMessage; internal notes must remain private. | NEEDS_TESTING |
| Support tickets | `/account/support` | Yes | `src/app/account/support/page.tsx` → `features/account/support-page.tsx` | Authenticated support APIs and SupportTicket/SupportMessage persistence. | NEEDS_TESTING |

### Seller portal

The seller segment layout is `src/app/seller/layout.tsx` and wraps seller routes with `src/features/seller/seller-navigation.tsx` and `src/features/seller/seller-topbar.tsx`: a responsive pastel-clay grouped icon sidebar, compact mobile navigation and seller-wide product search, paired with lavender, mint, peach and soft blue raised surfaces. The seller shell was refreshed on 2026-11-09; visual and responsive browser review remains deferred. Route APIs and services remain the authorization boundary for seller/store membership and per-action permissions. `/seller` embeds application/status and store setup; do not add redundant apply/status routes without a separate workflow requirement.

| Page | Actual route | Exists | Page/component source | API/data and access | Status |
|---|---|---:|---|---|---|
| Seller workspace/onboarding | `/seller` | Yes | `src/app/seller/layout.tsx` → `features/seller/seller-navigation.tsx` + `seller-topbar.tsx`; `src/app/seller/page.tsx` → `features/seller/workspace-page.tsx` | Shared grouped icon navigation/search; seller application/store APIs; Seller, Store, StoreMarket, Warehouse, Inventory and StoreShippingRate data; anonymous state offers sign-in. Cool blue-grey clay palette and real dashboard metrics are source-connected; responsive/browser journey remains unverified. | NEEDS_TESTING |
| Inventory | `/seller/inventory` | Yes | `src/app/seller/inventory/page.tsx` → `features/seller/inventory-page.tsx` | Store-scoped inventory/adjustment/transfer APIs, movement ledger, and quarantine release/disposal via `POST /api/seller/inventory/quarantine`; Inventory, Warehouse, InventoryMovement, StockTransfer and StockTransferItem. | NEEDS_TESTING |
| Seller messages | `/seller/messages` | Yes | `src/app/seller/messages/page.tsx` (page-local) | Store message APIs; StoreConversation/StoreMessage; member scope and inbox controls require testing. | NEEDS_TESTING |
| Seller orders | `/seller/orders` | Yes | `src/app/seller/orders/page.tsx` → `features/orders/seller-orders-page.tsx` | Store-scoped vendor-order/status/shipment/tracking APIs; paid-order delivery address is exposed only after payment confirmation, and carrier tracking links are shown when supplied. VendorOrder, OrderAddress, Shipment and tracking records. | NEEDS_TESTING |
| Seller shipping | `/seller/shipping` | Yes | `src/app/seller/shipping/page.tsx` → `features/seller/shipping-page.tsx`; `GET/POST /api/seller/shipping-rates`, `PATCH /api/seller/shipping-rates/[id]` | Store-scoped rates; customer-facing major-unit input is converted with BigInt using selected currency precision; edit preserves the rate currency. Checkout eligibility uses active market/currency/region/effective dates. Runtime journey remains to be verified. | NEEDS_TESTING |
| Seller advertising | `/seller/advertising` | Yes | `src/app/seller/advertising/page.tsx` → `features/seller/advertising-page.tsx` | Seller campaign and ad billing APIs; store-scoped campaigns and spend/invoice data; provider/budget and billing journeys need verification. | NEEDS_TESTING |
| Seller commission statements | `/seller/commissions` | Yes | `src/app/seller/commissions/page.tsx` → `src/features/seller/commissions-page.tsx`; `GET /api/seller/commissions`; CommissionTransaction, OrderItem, Currency | Owner or store-scoped `orders:read` access to immutable commission snapshots plus completed RefundItem allocations scoped through the owning VendorOrder. All-time commission and completed-refund totals are grouped per currency; commission details use cursor pages of 100, completed-refund details show the latest 100, and CSV export includes totals and visible details. BigInt-safe localized money formatting; refund amounts remain separate and are not netted into seller balance. Seller ledger, holds, withdrawals and payout status remain unimplemented. | NEEDS_TESTING |
| Seller financial overview | `/seller/finance` | Yes | `src/app/seller/finance/page.tsx` → `src/features/seller/finance-overview-page.tsx`; `GET /api/seller/stores`, `GET /api/seller/commissions`, owner-only `GET /api/seller/stores/[storeId]/export`; Store, CommissionTransaction, RefundItem, Product, ProductVariant, ProductPrice, Inventory, Warehouse | Read-only sales/commission/refund overview by currency plus owner-only bounded Excel-compatible workbook export for store profile, catalog, variants/prices and inventory. Export is audited, private/no-store and tenant-scoped. Does not calculate seller payable or available-to-withdraw balances. | SOURCE_MERGED; targeted tests and browser E2E passed on merged PRs |
| Seller products | `/seller/products` | Yes | `src/app/seller/products/page.tsx` → `src/features/seller/products-page.tsx`; `GET /api/seller/products`, `POST /api/products`, `PATCH /api/products/[productId]` | Product, ProductVariant, ProductPrice, category attributes and media. Draft create/edit includes category-dependent fields, all active SKU prices per enabled market, customer-facing currency input with BigInt minor-unit conversion, transactional price updates, image upload/retry/replace/remove/reorder and full-size preview. Latest price-edit flow still needs later runtime verification. | NEEDS_TESTING |
| Seller Q&A | `/seller/questions` | Yes | `src/app/seller/questions/page.tsx` → `features/seller/questions-page.tsx` | Seller question/answer APIs; ProductQuestion/ProductAnswer; store authorization must be verified. | NEEDS_TESTING |
| Seller returns | `/seller/returns` | Yes | `src/app/seller/returns/page.tsx` → `features/seller/returns-page.tsx` | Store-scoped return queue; approve/reject return items and record physical receipt into a warehouse quarantine state. Uses ReturnRequest/ReturnItem, Warehouse, Inventory and audit services. Receipt is not a refund and does not make stock sellable. Permission and browser journeys need exact-head verification. | NEEDS_TESTING |
| Seller reviews | `/seller/reviews` | Yes | `src/app/seller/reviews/page.tsx` → `features/seller/reviews-page.tsx` | Seller review/response APIs; ProductReview/StoreReview; response permissions and success/error states need testing. | NEEDS_TESTING |
| Store staff | `/seller/staff` | Yes | `src/app/seller/staff/page.tsx` → `features/seller/staff-page.tsx` | Owner-only invitations, seven-day expiry/renewal, role selection and role changes; seeded catalog, inventory, order, customer-care, marketing and full-manager roles are granted only within the store after invitee acceptance. Revocation removes the scoped role assignment. | NEEDS_TESTING |

### Admin and Super Admin portal

The segment layout is `src/app/admin/layout.tsx`: it requires at least one recognized admin permission, applies mandatory MFA enrollment/verification, and hides permission-denied pages. This broad page gate is not a substitute for resource/action-specific API checks. The admin nav targets implemented admin sections; individual active routes and horizontal overflow remain browser-test items.

| Page | Actual route | Exists | Page/component source | Access / API and Prisma data evidence | Status |
|---|---|---:|---|---|---|
| Admin dashboard | `/admin/dashboard` | Yes | `src/app/admin/dashboard/page.tsx` → `features/admin/dashboard-page.tsx` | Admin layout; dashboard API. | NEEDS_TESTING |
| Control-panel dashboard alias | `/admin/control-panel` | Yes | `src/app/admin/control-panel/page.tsx` → `features/admin/dashboard-page.tsx` | Admin layout; same dashboard feature as `/admin/dashboard`. | NEEDS_TESTING |
| Users | `/admin/users` | Yes | `src/app/admin/users/page.tsx` → `features/admin/users-page.tsx` | Admin users API; User/UserSession/UserRoleAssignment data; account deletion controls need browser verification. | NEEDS_TESTING |
| User detail | `/admin/users/[userId]` | Yes | `src/app/admin/users/[userId]/page.tsx` → `features/admin/user-detail-page.tsx` | Admin user/role APIs; User, Seller and role assignments; destructive action and authorization tests exist in source. | NEEDS_TESTING |
| Sellers | `/admin/sellers` | Yes | `src/app/admin/sellers/page.tsx` → `features/admin/sellers-page.tsx` | Admin sellers/approval APIs; Seller and Store records. | NEEDS_TESTING |
| Products | `/admin/products` | Yes | `src/app/admin/products/page.tsx` → `features/admin/products-page.tsx` | Product review/approve/reject APIs; Product/ProductVariant records. | NEEDS_TESTING |
| Product management | `/admin/product-management` | Yes | `src/app/admin/product-management/page.tsx` → `features/admin/catalog-products-management-page.tsx` | Bulk management API; Product/ProductCategory records; bounded scope/audit behavior needs browser testing. | NEEDS_TESTING |
| Categories | `/admin/categories` | Yes | `src/app/admin/categories/page.tsx` → `features/admin/categories-page.tsx` | Category CRUD/archive APIs; Category/CategoryTranslation/ProductCategory persistence. | NEEDS_TESTING |
| Commissions | `/admin/commissions` | Yes | `src/app/admin/commissions/page.tsx` → `features/admin/commissions-page.tsx` | CommissionRule/CommissionTransaction APIs; `platform:manage`, audited rule updates. The regular-user browser session received the expected permission-hidden 404; authorized UI remains unverified. | NEEDS_TESTING |
| Coupons | `/admin/coupons` | Yes | `src/app/admin/coupons/page.tsx` → `features/admin/coupons-page.tsx` | Coupon administration APIs; Coupon/CouponRedemption data. | NEEDS_TESTING |
| Logistics | `/admin/logistics` | Yes | `src/app/admin/logistics/page.tsx` → `features/admin/logistics-page.tsx` | Shipment APIs; Shipment and ShipmentTrackingEvent. | NEEDS_TESTING |
| Shipment detail | `/admin/logistics/[shipmentId]` | Yes | `src/app/admin/logistics/[shipmentId]/page.tsx` → `features/admin/shipment-detail-page.tsx` | Admin shipment detail API; Shipment and tracking events. | NEEDS_TESTING |
| Orders | `/admin/orders` | Yes | `src/app/admin/orders/page.tsx` → `features/admin/orders-page.tsx` | Read-only admin order API; Order/VendorOrder data; operation controls intentionally limited. | NEEDS_TESTING |
| Order detail | `/admin/orders/[orderId]` | Yes | `src/app/admin/orders/[orderId]/page.tsx` → `features/admin/order-detail-page.tsx` | Read-only order detail API; Order, VendorOrder and OrderItem snapshots. | NEEDS_TESTING |
| Payments | `/admin/payments` | Yes | `src/app/admin/payments/page.tsx` → `features/admin/payments-page.tsx` | `payments:read`, bounded read-only payment API; Payment records. | NEEDS_TESTING |
| Payment detail | `/admin/payments/[paymentId]` | Yes | `src/app/admin/payments/[paymentId]/page.tsx` → `features/admin/payment-detail-page.tsx` | `payments:read`, Payment detail API; no refund workflow claimed. | NEEDS_TESTING |
| Seller payout verification | `/admin/seller-payout-methods` | Yes | `src/app/admin/seller-payout-methods/page.tsx` → `features/admin/seller-payout-review-page.tsx`; admin payout review API | Platform-management/MFA protected queue; masked beneficiary details, evidence reference, reason, approve/reject and AuditLog. Manual evidence only; no payout execution. | NEEDS_TESTING |
| Product questions | `/admin/questions` | Yes | `src/app/admin/questions/page.tsx` → `features/admin/product-qa-page.tsx` | Admin question/moderation API; ProductQuestion/ProductAnswer data. | NEEDS_TESTING |
| Question reports | `/admin/questions/reports` | Yes | `src/app/admin/questions/reports/page.tsx` → `features/admin/product-qa-reports-page.tsx` | Question report moderation APIs; ProductQuestionReport data. | NEEDS_TESTING |
| Returns | `/admin/returns` | Yes | `src/app/admin/returns/page.tsx` → `features/admin/returns-page.tsx` | Admin return review APIs; ReturnRequest/ReturnItem; funds movement is not claimed. | NEEDS_TESTING |
| Review queue | `/admin/review` | Yes | `src/app/admin/review/page.tsx` → `features/admin/review-page.tsx` | Admin review queue; review records and action-to-API checks pending. | NEEDS_TESTING |
| Product reviews | `/admin/reviews` | Yes | `src/app/admin/reviews/page.tsx` → `features/admin/reviews-page.tsx` | Review/moderation/report/appeal APIs; ProductReview/ReviewReport/ReviewAppeal data. | NEEDS_TESTING |
| Search synonyms | `/admin/search-synonyms` | Yes | `src/app/admin/search-synonyms/page.tsx` → `features/admin/search-synonyms-page.tsx` | Admin synonym APIs and SearchSynonym data. | NEEDS_TESTING |
| Store reviews | `/admin/store-reviews` | Yes | `src/app/admin/store-reviews/page.tsx` → `features/admin/store-reviews-page.tsx` | Store-review moderation APIs; StoreReview persistence. | NEEDS_TESTING |
| Support | `/admin/support` | Yes | `src/app/admin/support/page.tsx` → `features/admin/support-page.tsx` | Admin ticket APIs; SupportTicket/SupportMessage; internal notes must remain access restricted. | NEEDS_TESTING |
| Tax rates | `/admin/tax-rates` | Yes | `src/app/admin/tax-rates/page.tsx` (page-local) | Admin tax-rate API; MarketTaxRate persistence; policy/configuration changes need end-to-end testing. | NEEDS_TESTING |
| Access catalog | `/admin/control-panel/access-catalog` | Yes | `src/app/admin/control-panel/access-catalog/page.tsx` → `features/admin/platform-access-catalog-page.tsx` | Restricted access catalog API; Role/Permission/RolePermission data; privilege delegation and MFA need browser verification. | NEEDS_TESTING |
| Audit log | `/admin/control-panel/audit-log` | Yes | `src/app/admin/control-panel/audit-log/page.tsx` → `features/admin/platform-audit-log-page.tsx` | Restricted audit-read API; AuditLog; immutable/read-only behavior needs testing. | NEEDS_TESTING |
| Privilege requests | `/admin/control-panel/privilege-requests` | Yes | `src/app/admin/control-panel/privilege-requests/page.tsx` → `features/admin/platform-privilege-requests-page.tsx` | Privileged request/review APIs; PlatformPrivilegeRequest and audit data. | NEEDS_TESTING |

## Required pages not found in the route tree

These are roadmap targets, not permission to create duplicates. Existing aliases and embedded workflows are called out explicitly. Provider-, policy-, or system-dependent pages remain deferred until their underlying workflow exists.

| Page | Required target route | Exists | Existing equivalent / dependency | Status |
|---|---|---:|---|---|
| Dedicated seller directory | `/sellers` | No | `/stores` is the current store directory; do not duplicate it until seller-level discovery is distinct. | MISSING |
| Dedicated order-detail alias | `/account/orders/[orderId]` | No | Canonical customer page is `/orders/[orderId]`; keep one page and link to it. | MISSING |
| Payment methods/history | `/account/payments` | No | Payment provider/method workflow is not implemented. | MISSING |
| Invoices | `/account/invoices` | No | Invoice generation is not implemented. | MISSING |
| Loyalty/rewards | `/account/loyalty` | No | Loyalty system is not implemented. | MISSING |
| Seller store/settings pages | `/seller` (embedded) and `/seller/settings` | Yes | Store profile/dispatch uses `PATCH /api/seller/stores/[storeId]`; seller identity uses owner-scoped `GET/PATCH /api/seller/profile` with validation, row lock and AuditLog; hub links to shipping, notifications, security and team workflows. | PARTIAL | Public description, logo and banner URLs and provider storage keys persist. Logo/banner files use the seller-scoped uploader with Imgur ID rotation and ImageKit/Cloudinary fallback; staged uploads carry signed temporary-delete tokens, and the delete endpoint blocks removal while an asset is referenced by a saved store logo/banner or ProductMedia row. The editor previews, replaces and detaches images and exposes a store-scoped reusable media library (latest 100 uploads). Saved asset deletion checks store branding and ProductMedia references before provider deletion; unsupported provider deletion leaves the library record intact. Detaching a saved logo/banner does not automatically delete the remote asset. Seller-managed shipping, returns, privacy and terms-of-sale policies now persist on Store and render on the public store detail page; policy localization/versioning remains future work. |
| Seller shipping settings | `/seller/shipping` | Yes | `src/app/seller/shipping/page.tsx` → `src/features/seller/shipping-page.tsx`; seller shipping-rate APIs and `StoreShippingRate`. | NEEDS_TESTING |
| Seller notification settings | Shared `/notifications` | Partial | Seller settings hub links to the shared user-scoped `/api/account/notification-preferences` workflow; no seller-only notification taxonomy or dedicated `/seller/notifications` route. | PARTIAL |
| Seller finance | `/seller/finance` | Yes | Informational commission/refund overview and bounded owner-only Excel store export exist; seller payable ledger integration, held/available balances and settlement statements do not. | PARTIAL |
| Seller commissions | `/seller/commissions` | Yes | Seller read-only commission snapshot page and store-scoped API exist; this is not a payable ledger. | PARTIAL |
| Seller payout methods | `/seller/payouts` | Yes | `src/app/seller/payouts/page.tsx` → `src/features/seller/payout-methods-page.tsx`; `GET/POST /api/seller/payout-methods`, `PATCH/DELETE /api/seller/payout-methods/[methodId]`; SellerPayoutMethod, Seller, Currency | Owner-only encrypted IBAN beneficiary management, masked account identifiers, default per currency, audited save/disable. New methods remain PENDING_VERIFICATION; local bank account entry is disabled pending country-specific validation. No ownership verification, payable balance, withdrawal, settlement or transfer execution. | MERGED; PostgreSQL integration, CodeQL and Browser E2E passed |
| Seller settings | `/seller/settings` | Yes | `src/app/seller/settings/page.tsx` → `src/features/seller/settings-page.tsx`; owner-scoped `GET/PATCH /api/seller/profile` persists public seller name, contact, address, description and social URLs through `seller-profile.ts` with an audit event; hub links to store, shipping, notification, security and staff workflows. | PARTIAL | Store policies are managed from the main workspace editor and rendered publicly; policy localization/versioning, market/currency settings and seller-specific notification controls remain future work. |
| Admin root alias | `/admin` | No | `/admin/dashboard` is the canonical dashboard route; no duplicate page required. | MISSING |
| Seller detail review | `/admin/sellers/[sellerId]` | No | Seller list and approve API exist; no seller detail page. | MISSING |
| Store directory/management | `/admin/stores` | No | Store detail API exists but no admin store list page. | MISSING |
| Store detail | `/admin/stores/[storeId]` | No | `PATCH /api/admin/stores/[storeId]` exists; no corresponding admin page/read workflow. | MISSING |
| Product detail moderation | `/admin/products/[productId]` | No | Product list and approve/reject APIs exist; no corresponding detail page. | MISSING |
| Brand management | `/admin/brands` | No | Public brand route exists; admin brand mutation UI/API absent. | MISSING |
| Market management | `/admin/markets` | No | Public market read APIs exist; admin management page absent. | MISSING |
| Currency management | `/admin/currencies` | No | Currency read API exists; admin management page absent. | MISSING |
| Locale management | `/admin/locales` | No | Locale administration absent. | MISSING |
| Refunds | `/admin/refunds` | No | Payment/refund provider workflow not implemented. | MISSING |
| Disputes | `/admin/disputes` | No | Dispute provider/workflow not implemented. | MISSING |
| Shipping administration | `/admin/shipping` | No | Seller shipping rates exist; platform-wide shipping management absent. | MISSING |
| Admin notifications | `/admin/notifications` | No | No delivery operations page. | MISSING |
| Admin roles/permissions aliases | `/admin/roles`, `/admin/permissions` | No | `/admin/control-panel/access-catalog` is the existing access-catalog surface; avoid duplicate access pages. | MISSING |
| Editorial content | `/admin/content`, `/admin/banners`, `/admin/pages` | No | CMS and featured-placement workflows absent. | MISSING |
| Reporting | `/admin/reports` | No | Validated comprehensive operational/financial reports absent. | MISSING |
| Global settings | `/admin/settings`, `/admin/feature-flags`, `/admin/integrations` | No | Global settings, flags and integrations controls absent. | MISSING |
| Backup controls | Admin/operations route TBD | No | Encrypted storage, provider, retention and restore procedure must exist first. | MISSING |
| Bulk notification campaigns | Admin/operations route TBD | No | Audience, delivery, consent and retry workflow absent. | MISSING |
| IP blocking | Admin/security route TBD | No | Durable block list and trusted request enforcement absent. | MISSING |
| Public seller entry | `/sell` | No | Root navigation links directly to `/seller`; no separate informational entry page. | MISSING |
| Help center | `/help` | No | No help center page. | MISSING |
| Contact | `/contact` | No | No approved operator/contact page. | MISSING |
| FAQ | `/faq` | No | No FAQ page. | MISSING |
| Cookie policy | `/policies/cookies` | No | No cookie policy page. | MISSING |
| Returns policy | `/policies/returns` | No | No returns policy page; policy approval required. | MISSING |
| Shipping policy | `/policies/shipping` | No | No shipping policy page; policy approval required. | MISSING |
| Seller policy | `/policies/seller` | No | No seller policy page; policy approval required. | MISSING |
| Accessibility | `/accessibility` | No | No accessibility statement page. | MISSING |
| Property directory/detail | `/properties`, `/properties/[slug]` | No | Separate property/booking domain is not implemented. | MISSING |
| Property submission/owner workspace | `/property/submit`, `/property-owner/**` | No | Separate property/booking domain is not implemented. | MISSING |
| Property customer requests | `/account/property-requests/**` | No | Separate property/booking domain is not implemented. | MISSING |
| Property administration | `/admin/properties`, `/admin/property-requests` | No | Separate property/booking domain is not implemented. | MISSING |

`/logout` and `/403` are not required page routes: logout is an action/API (`POST /api/auth/logout`), while authorization must be enforced by server guards and APIs rather than a URL. No email verification or resend-verification page is required.

## Shared interaction/state audit

| Concern | Source-level finding | Required verification still open |
|---|---|---|
| Navigation | Global storefront links target existing primary routes; admin nav targets implemented admin pages. Account shortcuts and seller workspace links are present. | Crawl all links, verify hidden/role-dependent links, broken IDs, back/forward behavior and mobile navigation. |
| Responsive behavior | Tailwind responsive utilities and responsive admin/workspace navigation are present in source. | Test at narrow mobile, tablet and desktop breakpoints; check horizontal overflow, focus order and touch targets. |
| Loading | Root/account/admin/seller route skeleton boundaries were added in this audit. Data pages also contain local loading logic inconsistently. | Exercise delayed requests, navigation interruption and loading-to-result transitions for all 74 pages. |
| Empty states | Some pages have explicit empty messaging; no unified coverage across every list/queue was established. | Verify useful browse/create/clear-filter action on every empty collection and search result. |
| Errors and recovery | Root/global/segment error boundaries and not-found UI were added. API-backed pages may still need local field/operation errors. | Force API, permission, validation, conflict, unavailable dependency and stale-data failures per control. |
| Success states | Some forms show inline success, toast or refreshed server data. | Verify each mutation persists, updates after refresh, and only reports success after confirmed server response. |
| Authentication | Account layout redirects guests with safe return path. Admin layout checks permission and MFA. Seller APIs are expected to guard store scope. | Test guest, expired session, buyer, seller, scoped staff, admin and Super Admin separately. |
| API/database | Source tree contains 143 API `route.ts` files and Prisma-backed services; route presence does not establish a page's complete binding. | Map every visible control to request/schema/permission/service/Prisma transaction and test persistence with disposable PostgreSQL. |
| Design system | Centralized theme tokens are in `src/app/theme.css` and global primitives in `src/app/globals.css`. | Audit all page components for token use, typography, spacing, shadows, color contrast, keyboard/focus states and duplicate headers. |

## Implementation and verification progress

Implemented in this audit, in dependency order:

1. Added shared route loading/error presentation primitives.
2. Added branded not-found, root error, and global-error boundaries.
3. Added loading and error boundaries for account, seller, and admin segments.
4. Added this actual-route inventory without creating duplicate commerce or account pages.

Validation results are recorded in the root README and build log after running the targeted checks. No Vercel deployment or production database changes were performed.
