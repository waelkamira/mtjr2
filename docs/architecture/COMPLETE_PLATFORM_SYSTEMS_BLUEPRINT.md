# Complete Platform Systems Blueprint

**Project:** Mtjr2 — Global Multi-Vendor Marketplace  
**Status:** Functional target specification for the greenfield implementation  
**Canonical schema target:** `prisma/schema.prisma` (new implementation; schema is being designed)  
**Companion audit:** `docs/PROJECT_AUDIT.md`  
**Model map:** `docs/architecture/prisma-model-usage-map.md`  
**Imported as baseline:** 2026-11-03

> This document is the functional blueprint for the 49 platform systems. It defines what each system must do, the expected screens, the canonical data models, the API surface, and the implementation state evidenced by the current repository audit. It is not a claim that every listed feature already works.

## 1. Rules for using this blueprint

1. **Do not add a Prisma model/table just to create a page.** First identify the business capability, user journey, owning domain, API/service, and existing model/relation that will use it.
2. Treat `prisma/schema.prisma` as the canonical database contract. Do not add legacy compatibility fields merely to silence old queries.
3. Before proposing a schema change, inspect the model map and answer: what exact workflow is missing, why existing models/relations cannot support it, which service/API will write and read it, who owns it, and what migration/test proves it.
4. A page, route, model, or button is not proof of a working feature. A system is **Complete** only after authorization, persistence, validation, error handling, tests, and an end-to-end workflow pass.
5. Implement in dependency order. Preserve user changes and existing customer-facing layout unless a scoped redesign is explicitly approved.
6. Keep the real-estate/property and booking domain separate from product commerce while allowing shared identity and platform services.
7. Financial, stock, order, refund, payout, and webhook operations require database transactions, idempotency, auditability, and concurrency tests.
8. Keep business logic out of UI components. Target flow: UI → page/API route → auth + validation → domain service → repository → Prisma → PostgreSQL.
9. Use pagination, filtering, stable sorting, server-side authorization, and bounded inputs for all management lists.
10. Record implementation evidence and test results in `docs/PROJECT_AUDIT.md` and the relevant domain docs.

## 2. Status definitions

| Status | Meaning |
|---|---|
| **Partial** | A screen, route, helper, or limited workflow exists, but important parts or canonical-schema integration are missing. |
| **Legacy / incompatible** | Functionality exists but still relies on old data fields/contracts and must not be treated as compatible with the canonical schema. |
| **Schema-only** | Models exist, but a complete application workflow has not been demonstrated. |
| **Not implemented** | No reliable end-to-end implementation was identified in the audit. |
| **Needs verification** | The audit found a surface, but permissions, persistence, runtime behavior, or test coverage has not been proven. |
| **Complete** | Reserved for a fully tested end-to-end capability. No system is promoted to this status by inference. |

**Current baseline (rechecked against `main` on 2026-11-03):** `prisma/schema.prisma` contains the identity/access foundation, Country/Currency/Market reference models, and the initial Seller/Store/StoreMarket/SellerStaff schema foundation. These are schema-level capabilities only: market seed/services, seller onboarding, store-scoped authorization workflows, canonical catalog APIs, and storefront product journeys are not yet proven complete. This blueprint remains the target specification, not evidence that all listed models or pages exist. Continue in dependency order from `docs/implementation/PHASE_03_MARKETPLACE_PLAN.md`.

## 3. System inventory — 49 systems

For every system below, the **Pages** and **API** entries describe the required target surface, not a guarantee that every route already exists. Model names are drawn from the canonical schema inventory where available. Shared models may legitimately serve multiple systems; do not duplicate them.

### A. Customer and shopping experience

#### 01. Identity, authentication and customer account
- **Purpose:** Registration, sign-in/out, OAuth, password recovery, optional 2FA, sessions, consent, profile and account security.
- **Pages:** `/(auth)/login`, `/register`, `/forgot-password`, `/reset-password`, `/account/profile`, `/account/security`, `/account/addresses`, `/account/sessions`.
- **Models:** `User`, `UserSession`, `OAuthAccount`, `TwoFactorAuthentication`, `PasswordResetToken`, `VerificationToken`, `UserConsent`, `LoginAttempt`, `UserRoleAssignment`, `Role`, `Permission`, `RolePermission`, `UserAddress`.
- **API:** `/api/auth/*`, `/api/register`, `/api/account/profile`, `/api/account/addresses`, `/api/account/sessions`, `/api/account/security`.
- **Must include:** secure password hashing, verified email, session revocation, rate limits, account status checks, consent history, role resolution and recovery-token single use.
- **Current state:** **Partial / legacy-incompatible.** Auth surfaces exist; audit AUD-001 records mismatches between legacy user fields and canonical user/role relations.

#### 02. Product catalog and discovery
- **Purpose:** Browse products, categories, brands, product details, media, attributes, variants and localized descriptions.
- **Pages:** `/products`, `/products/[id]`, `/categories/[slug]`, `/brands/[slug]`.
- **Models:** `Product`, `ProductCategory`, `Category`, `CategoryTranslation`, `Brand`, `BrandTranslation`, `ProductTranslation`, `ProductMedia`, `AttributeDefinition`, `AttributeTranslation`, `ProductAttribute`, `ProductAttributeValue`, `ProductVariant`, `VariantAttribute`, `ProductIdentifier`, `ProductPrice`.
- **API:** `/api/products`, `/api/products/[id]`, `/api/categories`, `/api/brands`.
- **Must include:** active/approved visibility, canonical store ownership, variant selection, price per currency, media safety, structured attributes, SEO metadata and pagination.
- **Current state:** **Partial.** Canonical `/products` and detail pages were added; legacy catalog endpoints still need migration. Phase Three is not complete.

#### 03. Search, filtering and sorting
- **Purpose:** Search products and stores with useful relevance, facets, typo tolerance and URL-shareable filters.
- **Pages:** `/search`, search results and filter panels; admin search synonym management.
- **Models:** `Product`, `ProductVariant`, `ProductPrice`, `Category`, `Brand`, `SearchSynonym`; PostgreSQL trigram/search indexes where appropriate.
- **API:** `/api/search`, `/api/search/suggestions`, `/api/admin/search-synonyms`.
- **Must include:** query validation, autocomplete, synonyms, category/brand/price/availability filters, stable pagination, relevance sorting and abuse protection.
- **Current state:** **Partial / legacy-incompatible.** Search exists but uses legacy product columns; AUD-002 and AUD-006 apply.

#### 04. Cart and checkout
- **Purpose:** Persistent guest/customer cart and safe conversion into a marketplace order.
- **Pages:** `/cart`, `/checkout`, address, delivery, payment and order-confirmation steps.
- **Models:** `GuestSession`, `Cart`, `CartItem`, `Product`, `ProductVariant`, `ProductPrice`, `Inventory`, `InventoryReservation`, `UserAddress`, `Order`, `OrderItem`, `OrderAddress`, `Coupon`, `TaxLine`, `Shipment`, `Payment`.
- **API:** `/api/cart`, `/api/cart/items`, `/api/checkout/quote`, `/api/checkout`, `/api/orders`.
- **Must include:** guest-to-user merge, variant-based items, server-calculated totals, live stock validation, reservations, shipping/tax/coupon calculation, idempotency and transactional order creation.
- **Current state (2026-11-03):** **Partial — canonical cart, quote/reservations, address, shipping selection, tax snapshot, and initial order creation workflows implemented across stacked PR branches; latest shipping/tax/order verification is pending.** Cart and quote/reservation APIs and UI have passed their original General CI and disposable PostgreSQL runs; delivery-address capture has passed runs 41706908024 and 41706907994. Shipping configuration and per-store checkout selections are implemented on PR #4; the PostgreSQL integration run 41708370004 passed, while a later General CI attempt was cancelled. Market/region tax rules, tax snapshot, admin configuration UI/API and buyer tax calculation are implemented on PR #5; verification pending. PR #6 adds Order/OrderAddress/VendorOrder/OrderItem and status history models, transactional quote-to-order conversion, per-store vendor splits, inventory reservation consumption and SALE movement ledger, buyer order confirmation/history, and seller-scoped order listing UI/API; verification pending. Orders remain PENDING_PAYMENT; payment provider/webhook handling, discounts, and fulfillment transitions are not complete. Legacy cart/checkout flows are not treated as canonical.

#### 05. Orders and order tracking
- **Purpose:** Customer order history, order details, status timeline, invoices, cancellation and reorder.
- **Pages:** `/account/orders`, `/orders/[orderId]`, seller `/seller/orders`; tracking and invoice views remain future slices.
- **Models:** canonical `Order`, `OrderAddress`, `OrderItem`, `OrderStatusHistory`, `VendorOrder`, `VendorOrderStatusHistory`, plus future `Shipment`, `ShipmentTrackingEvent`, `Invoice`, `InvoiceItem`.
- **API:** `GET /api/orders`, `GET /api/orders/[orderId]`, `POST /api/checkout/quote/[quoteId]/place-order`, `GET /api/seller/orders`; cancel/invoice/tracking APIs remain future work.
- **Must include:** customer ownership, split vendor orders, immutable purchase snapshots, valid state transitions, cancellation rules and tracking history.
- **Current state (2026-11-03):** **Initial canonical order slice implemented on PR #6; verification pending.** Checkout quote conversion creates one parent order and one vendor order per store in a serializable transaction, consumes stock reservations and records SALE movements, snapshots the delivery address and monetary values, and returns idempotently by quote. Buyer order confirmation/detail and signed-in order history are connected. Seller order listing is restricted to store owners, exact store-scoped `orders:manage` grants, or platform admins. Orders remain PENDING_PAYMENT; payment/webhook lifecycle, fulfillment transitions, cancellation, shipment tracking, invoices and reorder remain incomplete.

#### 06. Product and store reviews
- **Purpose:** Verified-purchase product reviews and store reputation with moderation.
- **Pages:** product review section, `/account/reviews`, store reviews, `/admin/reviews`, seller review center.
- **Models:** `Review`, `ReviewMedia`, `StoreReview`, `OrderItem`, `Product`, `Store`, `Seller`, `AuditLog`.
- **API:** `/api/products/[productId]/reviews`, `/api/stores/[storeId]/reviews`, `/api/account/reviews`, `/api/admin/reviews/*`, `/api/admin/store-reviews/*`, `/api/seller/reviews/*`.
- **Must include:** verified purchase, one-review policy, rating aggregates, media validation, report/appeal, moderation queue and seller response.
- **Current state (2026-11-03):** **Initial verified product-review slice implemented on `feat/verified-purchase-reviews`.** Added canonical `ProductReview`, `StoreReview` and `ReviewStatus` persistence with migration `20261104001000_verified_product_reviews`; submission is restricted to the signed-in purchaser of a delivered order item/vendor order, one review per customer/product and per customer/store, and all new reviews enter PENDING moderation. Public product/store review lists and aggregates, customer reviewable-purchase and review-history APIs, audited admin moderation APIs, product-detail product/store review panels, delivered-order store review form, seller review center with owner responses, and admin product/store moderation queues are connected. Review media, reports/appeals, staff-scoped seller responses, and advanced moderation remain incomplete.

#### 07. Wishlist, favorites and recommendations
- **Purpose:** Save products, organize wishlists and show relevant recommendations.
- **Pages:** `/account/wishlist`, product favorite control, recommendation sections.
- **Models:** `Favorite`, `Recommendation`, `Product`, `ProductVariant`, `Store`, `User`.
- **API:** `/api/favorites`, `/api/favorites/[productId]`, `/api/recommendations`.
- **Must include:** server-side ownership, guest merge, deduplication, cache reconciliation and privacy-safe recommendation logic.
- **Current state (2026-11-03):** **Initial authenticated favorites slice implemented on `feat/wishlist-favorites`.** Added canonical `Favorite` persistence and migration `20261104002000_customer_favorites`, owner-scoped list/status/add/remove APIs, a connected product-detail save control, and `/account/wishlist` UI. Server-side ownership, active-product checks and unique customer/product deduplication are enforced. Guest wishlist merge, multiple named lists, recommendations, and cache reconciliation remain incomplete.

#### 08. Product questions and answers
- **Purpose:** Pre-purchase questions answered by sellers or authorized staff.
- **Pages:** product Q&A, `/account/questions`, seller Q&A inbox, admin moderation.
- **Models:** `ProductQuestion`, `ProductAnswer`, `Product`, `Store`, `User`, `AuditLog`.
- **API:** `/api/products/[id]/questions`, `/api/questions/[id]/answers`, `/api/seller/questions`, `/api/admin/questions`.
- **Must include:** public/private moderation states, seller ownership, notifications, abuse reporting and answer history.
- **Current state (2026-11-03):** **Initial moderated product Q&A slice implemented on `feat/product-qa`.** Added `ProductQuestion` and `ProductAnswer` persistence with separate moderation states and migration `20261104003000_product_questions_answers`. Authenticated customers can submit questions; only published questions and answers appear publicly. Active store owners can answer published questions; admin moderation is audited and publishing notifies the seller or question author through in-app notifications. Connected product detail Q&A, customer question history, seller inbox/answer form, and admin moderation queue. Staff-scoped answering, abuse reports, attachments, and richer answer editing/history controls remain incomplete.

#### 09. Customer messaging and support
- **Purpose:** Customer-to-store conversations and platform support tickets.
- **Pages:** `/account/messages`, conversation detail, `/account/support`, ticket detail.
- **Models:** `StoreConversation`, `StoreMessage`, `SupportTicket`, `SupportMessage`, `Notification`, `User`, `Store`.
- **API:** `/api/messages`, `/api/messages/[id]`, `/api/support/tickets`, `/api/support/tickets/[id]`.
- **Must include:** participant authorization, read receipts, attachments, ticket priority/status, assignment, SLA and notifications.
- **Current state (2026-11-04):** **Core ticketing and store messaging workflows implemented as an initial vertical slice on `feat/customer-support-tickets` (Draft PR #11).** Added `SupportTicket`/`SupportMessage` and `StoreConversation`/`StoreMessage` Prisma models and migrations. Customer ticket creation/list/detail/replies are connected to `/account/support`; the admin queue at `/admin/support` supports status, priority, self-assignment, internal notes and public replies, with `support:manage` authorization, audit events, first-response timestamps, read receipts, and in-app reply notifications. Customer-to-store messaging is connected through `/api/messages`, `/api/messages/[conversationId]`, store-scoped seller APIs, `/account/messages`, `/account/messages/[conversationId]`, `/seller/messages`, and a product-detail “Message this store” action. Conversation participants are checked server-side, seller access requires owner or active staff with store-scoped `messages:manage`, and message reads update participant read timestamps. **Remaining before System 09 can be called complete:** attachment upload/storage and malware/type/size controls (requires selecting/configuring an object-storage provider), an agreed SLA policy and scheduled escalation worker, staff inbox recipient routing, and outbound email delivery. These are not represented as completed.

#### 10. Customer notifications
- **Purpose:** In-app and email notifications for order, payment, delivery, messages and account events.
- **Pages:** `/notifications`, notification preferences.
- **Models:** `Notification`, `User`, `Order`, `Payment`, `Shipment`, `StoreMessage`, `UserConsent`.
- **API:** `/api/notifications`, `/api/notifications/[id]/read`, `/api/account/notification-preferences`.
- **Must include:** user-scoped reads, delivery status, preferences, deduplication, retries and event-triggered creation.
- **Current state (2026-11-03):** **Initial in-app order notifications implemented on PR #6; broader system remains partial.** Added `Notification` persistence and migration `20261103234000_order_notifications`, authenticated `GET /api/notifications`, owner-scoped read API, and connected `/notifications` UI. Order placement creates buyer and store-owner notifications in the same transaction as order creation, with unique deduplication keys. Email delivery, preferences, retry/outbox processing, payment/shipment/message event coverage, and staff recipient routing remain incomplete.

#### 11. Returns and refunds (customer journey)
- **Purpose:** Request a return/refund, upload evidence and track the resolution.
- **Pages:** `/account/returns`, `/account/returns/new`, return detail.
- **Models:** `ReturnRequest`, `ReturnItem`, `Order`, `OrderItem`, `Refund`, `Payment`, `Shipment`, `AuditLog`.
- **API:** `/api/returns`, `/api/returns/[id]`, `/api/returns/[id]/evidence`.
- **Must include:** return windows, item quantities, reason codes, evidence, shipping instructions, partial refunds and status notifications.
- **Current state:** **Partial / needs verification.** Customer/admin return surfaces were identified; complete canonical workflow is not proven.

### B. Seller systems

#### 12. Seller onboarding, verification and KYC
- **Purpose:** Seller application, identity/business verification, tax documents and approval lifecycle.
- **Pages:** `/seller/apply`, `/seller/onboarding`, `/seller/verification`, `/admin/sellers/[id]/verification`.
- **Models:** `Seller`, `SellerVerification`, `SellerDocument`, `SellerTaxRegistration`, `Store`, `User`, `AuditLog`.
- **API:** `/api/seller/application`, `/api/seller/verification`, `/api/seller/documents`, `/api/admin/sellers/[id]/approval`.
- **Must include:** document review, expiry, rejection reasons, resubmission, jurisdiction-specific requirements and restricted seller capabilities until approval.
- **Current state:** **Partial.** Seller application/approval surfaces exist; complete KYC lifecycle needs verification.

#### 13. Seller dashboard and analytics
- **Purpose:** Seller command center for sales, orders, products, inventory, reputation and financial position.
- **Pages:** `/seller/dashboard`, analytics, performance and action center.
- **Models:** `Seller`, `Store`, `Order`, `VendorOrder`, `OrderItem`, `Product`, `Inventory`, `StoreReview`, `Payout`, `SellerLedgerEntry`, `DailySiteVisit`.
- **API:** `/api/seller/dashboard`, `/api/seller/analytics`, `/api/seller/performance`.
- **Must include:** gross/net sales, pending/available balance, order funnel, low stock, returns, cancellation/delivery rate, rating trends, date filters and drill-down.
- **Current state:** **Partial.** Seller dashboard exists; KPI correctness and canonical financial/inventory integration are not established.

#### 14. Seller product management
- **Purpose:** Create and maintain products, variants, SKUs, translations, media, attributes and prices.
- **Pages:** `/seller/products`, `/seller/products/new`, `/seller/products/[id]`, variant/media/price editors.
- **Models:** `Product`, `ProductCategory`, `ProductTranslation`, `ProductMedia`, `ProductVariant`, `VariantAttribute`, `ProductPrice`, `ProductIdentifier`, `Brand`, `Category`, `Store`, `Seller`.
- **API:** `/api/seller/products`, `/api/seller/products/[id]`, `/api/seller/products/[id]/variants`, `/api/seller/products/[id]/media`.
- **Must include:** store-scoped ownership, drafts, approval, validation, SKU uniqueness, variant inventory linkage, safe uploads and audit history.
- **Current state:** **Partial / legacy-incompatible.** Seller product routes exist but old product field assumptions remain.

#### 15. Seller order management
- **Purpose:** Process vendor-specific order portions, fulfill items, communicate status and handle cancellations.
- **Pages:** `/seller/orders`, `/seller/orders/[id]`, fulfillment queue.
- **Models:** `VendorOrder`, `Order`, `OrderItem`, `OrderStatusHistory`, `Shipment`, `ShipmentItem`, `InventoryReservation`.
- **API:** `/api/seller/orders`, `/api/seller/orders/[id]`, `/api/seller/orders/[id]/fulfill`.
- **Must include:** vendor isolation, allowed transitions, packing/dispatch, partial fulfillment, stock release and customer notification.
- **Current state:** **Legacy / incompatible.** Routes exist but use legacy order fields and lifecycle assumptions.

#### 16. Seller inventory and warehouse management
- **Purpose:** Manage warehouses, stock, reservations, movements, transfers and stock alerts.
- **Pages:** `/seller/inventory`, `/seller/warehouses`, `/seller/inventory/movements`, transfer and adjustment screens.
- **Models:** `Warehouse`, `Inventory`, `InventoryMovement`, `InventoryReservation`, `StockTransfer`, `StockTransferItem`, `ProductVariant`.
- **API:** `/api/seller/warehouses`, `/api/seller/inventory`, `/api/seller/inventory/adjustments`, `/api/seller/inventory/transfers`.
- **Must include:** non-negative stock, reservation expiry, atomic decrement, transfer receive/ship, reconciliation, barcode support and audit.
- **Current state (rechecked 2026-11-03):** Initial Warehouse/Inventory/Movement/Reservation/Transfer schema and seller warehouse, stock-adjustment, and transfer APIs/services are committed. Consolidated CI and PostgreSQL verification are pending; reservation lifecycle, expiry worker, reconciliation, and stock-count workflow remain incomplete.

#### 17. Supplier and procurement management
- **Purpose:** Supplier directory, purchase orders, receiving and supplier invoice reconciliation.
- **Pages:** `/seller/suppliers`, `/seller/purchase-orders`, purchase order detail, goods receipt.
- **Models:** `Supplier`, `SupplierProduct`, `PurchaseOrder`, `PurchaseOrderItem`, `GoodsReceipt`, `GoodsReceiptItem`, `Warehouse`, `InventoryMovement`.
- **API:** `/api/seller/suppliers`, `/api/seller/purchase-orders`, `/api/seller/goods-receipts`.
- **Must include:** supplier terms, cost history, purchase approval, partial receiving, discrepancy handling and inventory posting.
- **Current state:** **Schema-only / partial admin surface.** Supplier admin pages were found; seller procurement workflow is not demonstrated.

#### 18. Shipping and fulfillment (seller)
- **Purpose:** Configure fulfillment preferences, shipping services, packages, labels and tracking.
- **Pages:** `/seller/shipping`, `/seller/shipments`, shipment detail and package builder.
- **Models:** `ShippingCarrier`, `ShippingService`, `ShippingZone`, `ShippingRate`, `Shipment`, `Package`, `PackageItem`, `ShipmentItem`, `ShipmentTrackingEvent`, `OrderAddress`.
- **API:** `/api/seller/shipping`, `/api/seller/shipments`, `/api/seller/shipments/[id]/label`, `/api/seller/shipments/[id]/tracking`.
- **Must include:** carrier/service selection, package dimensions/weight, label generation, tracking webhooks, split shipment and customs data.
- **Current state:** **Partial / schema-only.** Admin shipping surfaces exist; integrated seller fulfillment is not proven.

#### 19. Seller finance, commissions and payouts
- **Purpose:** Transparent seller balance, fees, commissions, settlement statements and payout requests.
- **Pages:** `/seller/finance`, `/seller/transactions`, `/seller/payouts`, payout method and statement detail.
- **Models:** `SellerLedgerEntry`, `LedgerAccount`, `JournalEntry`, `JournalLine`, `CommissionRule`, `CommissionTransaction`, `PayoutMethod`, `Payout`, `Payment`, `Refund`, `Currency`.
- **API:** `/api/seller/finance/summary`, `/api/seller/transactions`, `/api/seller/payouts`, `/api/seller/payout-methods`.
- **Must include:** immutable ledger, double-entry postings, fees/taxes/refunds, holds, available vs pending balance, payout eligibility and reconciliation.
- **Current state:** **Schema-only.** Finance models exist; audit found no direct model delegates or complete seller finance workflow.

#### 20. Seller marketing and promotions
- **Purpose:** Create store-scoped discounts and promotions within platform policy.
- **Pages:** `/seller/marketing`, `/seller/coupons`, promotion editor and performance.
- **Models:** `Promotion`, `Coupon`, `CouponRedemption`, `PromotionProduct`, `PromotionCategory`, `PromotionSeller`, `Store`, `Product`.
- **API:** `/api/seller/promotions`, `/api/seller/coupons`, `/api/seller/promotions/[id]`.
- **Must include:** eligibility, date windows, usage limits, stacking rules, budget caps and abuse prevention.
- **Current state:** **Partial / schema-only.** Admin discounts surface exists; complete seller promotion lifecycle is not proven.

#### 21. Seller reviews and reputation
- **Purpose:** Monitor store/product feedback and respond appropriately.
- **Pages:** `/seller/reviews`, review detail, response composer and reputation analytics.
- **Models:** `StoreReview`, `Review`, `ReviewMedia`, `Store`, `Product`, `OrderItem`, `AuditLog`.
- **API:** `/api/seller/reviews`, `/api/seller/reviews/[id]/response`.
- **Must include:** verified purchase context, response limits, report/escalation, rating trend and no ability to edit customer reviews.
- **Current state:** **Partial / needs verification.** Review surfaces exist; complete seller response and moderation integration is not proven.

#### 22. Seller staff and scoped permissions
- **Purpose:** Invite staff and grant least-privilege store-scoped access.
- **Pages:** `/seller/team`, invite, role/permission editor and access history.
- **Models:** `SellerStaff`, `Seller`, `Store`, `User`, `Role`, `Permission`, `RolePermission`, `UserRoleAssignment`, `AuditLog`.
- **API:** `/api/seller/staff`, `/api/seller/staff/invitations`, `/api/seller/staff/[id]/permissions`.
- **Must include:** owner protection, scoped permissions, invite expiry, revocation, session invalidation and audit log.
- **Current state:** **Schema-only / needs verification.** Role administration exists, but store-scoped staff enforcement is not demonstrated.

#### 23. Store management and settings
- **Purpose:** Manage storefront identity, contact details, policies, localization and public presentation.
- **Pages:** `/seller/store`, `/seller/store/profile`, `/seller/store/policies`, `/seller/store/localization`.
- **Models:** `Store`, `StoreTranslation`, `Seller`, `SellerTaxRegistration`, `Currency`, `Country`.
- **API:** `/api/seller/store`, `/api/seller/store/translations`, `/api/seller/store/policies`.
- **Must include:** verified ownership, public preview, localized content, store status, policy versions and audit.
- **Current state:** **Partial.** Store/admin surfaces exist; audit notes that several store relations and translations are not integrated.

### C. Central administration

#### 24. Platform admin dashboard / command center
- **Purpose:** Platform-wide operational overview and prioritized exception queue.
- **Pages:** `/admin/dashboard`, `/admin/control-panel`, reports and alerts.
- **Models:** `User`, `Seller`, `Store`, `Product`, `Order`, `VendorOrder`, `Payment`, `Refund`, `Dispute`, `Payout`, `DailySiteVisit`, `AuditLog`.
- **API:** `/api/admin/dashboard`, `/api/admin/analytics`, `/api/admin/alerts`.
- **Must include:** GMV vs net revenue, commission, orders, sellers, approval queue, failed payments, disputes, payout exposure and drill-through.
- **Current state:** **Partial.** Admin dashboards exist; metric definitions and canonical finance joins require validation.

#### 25. User administration
- **Purpose:** Search and manage customer accounts, status, roles, sessions and account-risk events.
- **Pages:** `/admin/users`, `/admin/users/[id]`, role and security history.
- **Models:** `User`, `UserSession`, `UserRoleAssignment`, `Role`, `Permission`, `LoginAttempt`, `UserConsent`, `AuditLog`.
- **API:** `/api/admin/users`, `/api/admin/users/[id]`, `/api/admin/users/[id]/status`, `/api/admin/users/[id]/roles`.
- **Must include:** least privilege, protected admin accounts, reasoned status changes, session revocation and audit.
- **Current state:** **Partial.** User/role admin surfaces exist; canonical authorization remains a prerequisite.

#### 26. Seller administration and KYC review
- **Purpose:** Review seller applications, documents, tax registrations, risk and store status.
- **Pages:** `/admin/sellers`, seller detail, verification queue and document review.
- **Models:** `Seller`, `SellerVerification`, `SellerDocument`, `SellerTaxRegistration`, `Store`, `SellerStaff`, `AuditLog`.
- **API:** `/api/admin/sellers`, `/api/admin/sellers/[id]`, `/api/admin/sellers/[id]/approval`, `/api/admin/sellers/[id]/documents`.
- **Must include:** review checklist, approve/reject/suspend, evidence, expiry alerts, reason codes and audit.
- **Current state:** **Partial.** Seller management/approval routes exist; full KYC operations need verification.

#### 27. Catalog administration
- **Purpose:** Govern categories, brands, attributes, products, content quality and approval.
- **Pages:** `/admin/catalog`, `/admin/categories`, `/admin/brands`, `/admin/products`, attribute and translation management.
- **Models:** `Category`, `CategoryTranslation`, `Brand`, `BrandTranslation`, `Product`, `ProductCategory`, `ProductTranslation`, `ProductMedia`, `ProductVariant`, `AttributeDefinition`, `ProductAttribute`, `ProductAttributeValue`.
- **API:** `/api/admin/catalog/*`, `/api/admin/categories/*`, `/api/admin/products/*`, `/api/admin/brands/*`.
- **Must include:** moderation, bulk operations, taxonomy integrity, duplicate detection, media review and change history.
- **Current state:** **Partial / legacy-incompatible.** Admin product/category surfaces exist; legacy product field assumptions are a P0 blocker.

#### 28. Central order operations
- **Purpose:** Platform-wide order search, exception resolution and controlled intervention.
- **Pages:** `/admin/orders`, order detail, vendor split, timeline and exception queue.
- **Models:** `Order`, `VendorOrder`, `OrderItem`, `OrderAddress`, `OrderStatusHistory`, `Shipment`, `InventoryReservation`, `AuditLog`.
- **API:** `/api/admin/orders`, `/api/admin/orders/[id]`, `/api/admin/orders/[id]/actions`.
- **Must include:** immutable history, vendor isolation, controlled overrides, cancellation/refund coordination and audit.
- **Current state:** **Partial / legacy-incompatible.** Admin order surfaces exist but old contracts remain.

#### 29. Payment administration
- **Purpose:** Monitor provider transactions, attempts, refunds, reconciliation and payment failures.
- **Pages:** `/admin/payments`, payment detail, provider health and reconciliation queue.
- **Models:** `PaymentProvider`, `Payment`, `PaymentAttempt`, `PaymentReconciliation`, `Refund`, `Dispute`, `DisputeEvidence`, `Order`, `AuditLog`.
- **API:** `/api/admin/payments`, `/api/admin/payments/[id]`, `/api/admin/payment-reconciliation`.
- **Must include:** verified provider events, idempotent updates, attempt history, refund controls and settlement matching.
- **Current state:** **Partial / legacy-incompatible.** Admin payment and Stripe surfaces exist, but audit records legacy persistence assumptions.

#### 30. Commission management
- **Purpose:** Configure category/store/seller commission rules and calculate immutable transaction-level fees.
- **Pages:** `/admin/commissions`, rule editor, commission ledger and preview calculator.
- **Models:** `CommissionRule`, `CommissionTransaction`, `VendorOrder`, `OrderItem`, `SellerLedgerEntry`, `Currency`, `AuditLog`.
- **API:** `/api/admin/commission-rules`, `/api/admin/commissions`, `/api/admin/commissions/preview`.
- **Must include:** effective dates, precedence, minimums/caps, currency precision, versioning and recalculation policy.
- **Current state:** **Schema-only.** No complete commission management workflow was identified.

#### 31. Accounting and general ledger
- **Purpose:** Double-entry accounting for sales, fees, taxes, refunds, chargebacks and payouts.
- **Pages:** `/admin/finance/ledger`, accounts, journals, trial balance and reconciliation.
- **Models:** `LedgerAccount`, `JournalEntry`, `JournalLine`, `SellerLedgerEntry`, `CommissionTransaction`, `Payment`, `Refund`, `Payout`.
- **API:** `/api/admin/finance/accounts`, `/api/admin/finance/journals`, `/api/admin/finance/reports`.
- **Must include:** balanced journal entries, immutable posted records, reversals instead of destructive edits, period close and audit.
- **Current state:** **Schema-only.** Accounting models exist; no application delegate workflow was identified.

#### 32. Payout administration
- **Purpose:** Review and execute seller settlements with holds, approvals and reconciliation.
- **Pages:** `/admin/payouts`, payout detail, batch processing and failed payout queue.
- **Models:** `Payout`, `PayoutMethod`, `SellerLedgerEntry`, `JournalEntry`, `JournalLine`, `Seller`, `Currency`.
- **API:** `/api/admin/payouts`, `/api/admin/payouts/[id]`, `/api/admin/payouts/[id]/approve`, `/api/admin/payouts/[id]/retry`.
- **Must include:** eligibility, reserve/hold rules, dual control, provider result, idempotency and ledger reconciliation.
- **Current state:** **Schema-only.** No end-to-end payout workflow was demonstrated.

#### 33. Returns, refunds and disputes administration
- **Purpose:** Resolve returns, refund requests, chargebacks and evidence deadlines.
- **Pages:** `/admin/returns`, `/admin/refunds`, `/admin/disputes`, case detail.
- **Models:** `ReturnRequest`, `ReturnItem`, `Refund`, `Dispute`, `DisputeEvidence`, `Payment`, `Order`, `AuditLog`.
- **API:** `/api/admin/returns`, `/api/admin/refunds`, `/api/admin/disputes`, `/api/admin/disputes/[id]/evidence`.
- **Must include:** policy rules, partial refunds, evidence retention, deadlines, provider synchronization and immutable decisions.
- **Current state:** **Partial / schema-only.** Return surfaces exist; refund/dispute lifecycle is not demonstrated.

#### 34. Shipping administration
- **Purpose:** Configure carriers, services, zones, rates and fulfillment integrations.
- **Pages:** `/admin/shipping`, carriers, services, zones, rate tables and shipment exceptions.
- **Models:** `ShippingCarrier`, `ShippingService`, `ShippingZone`, `ShippingRate`, `Shipment`, `Package`, `ShipmentTrackingEvent`, `CustomsDeclaration`.
- **API:** `/api/admin/shipping/carriers`, `/api/admin/shipping/services`, `/api/admin/shipping/zones`, `/api/admin/shipping/rates`.
- **Must include:** country/region coverage, rate calculation, carrier credentials, webhook verification, label errors and fallback rules.
- **Current state:** **Partial.** Admin shipping/method surfaces exist; complete fulfillment integration is not proven.

#### 35. Tax and regulatory compliance
- **Purpose:** Configure tax jurisdictions/rates, seller registrations and customs declarations.
- **Pages:** `/admin/tax/regions`, rates, registrations, customs and compliance reports.
- **Models:** `TaxRegion`, `TaxRate`, `TaxLine`, `SellerTaxRegistration`, `CustomsDeclaration`, `CustomsDeclarationItem`, `Country`, `Currency`.
- **API:** `/api/admin/tax/regions`, `/api/admin/tax/rates`, `/api/admin/customs`.
- **Must include:** effective dates, tax-inclusive/exclusive rules, exemptions, rounding, invoice linkage and jurisdiction-specific compliance.
- **Current state:** **Schema-only.** No end-to-end tax/customs workflow identified.

#### 36. Promotions, coupons, loyalty and gift cards
- **Purpose:** Central campaign management, coupon validation, loyalty accounting and gift-card issuance/redemption.
- **Pages:** `/admin/marketing/promotions`, coupons, loyalty programs, gift cards and campaign analytics.
- **Models:** `Promotion`, `Coupon`, `CouponRedemption`, `PromotionProduct`, `PromotionCategory`, `PromotionSeller`, `LoyaltyProgram`, `LoyaltyTransaction`, `GiftCard`, `GiftCardTransaction`.
- **API:** `/api/admin/promotions`, `/api/admin/coupons`, `/api/admin/loyalty`, `/api/admin/gift-cards`.
- **Must include:** rule evaluation, limits, anti-abuse, balances, expiry, refund reversal and ledger consistency.
- **Current state:** **Partial / schema-only.** Admin discounts exist; loyalty and gift-card UI/workflows were not identified.

#### 37. Review moderation
- **Purpose:** Platform governance for reported, abusive, fraudulent or policy-violating reviews.
- **Pages:** `/admin/reviews`, moderation queue, report detail and appeals.
- **Models:** `Review`, `ReviewMedia`, `StoreReview`, `AuditLog`, `User`, `OrderItem`.
- **API:** `/api/admin/reviews`, `/api/admin/reviews/[id]/moderation`, `/api/admin/reviews/[id]/appeals`.
- **Must include:** moderation reasons, evidence, status history, reviewer notification and tamper-evident audit.
- **Current state:** **Partial / needs verification.** Admin review surfaces exist; full moderation and appeal behavior is unproven.

#### 38. Central customer support
- **Purpose:** Unified support queue for customer and seller cases.
- **Pages:** `/admin/support`, ticket detail, assignment, SLA and escalation dashboards.
- **Models:** `SupportTicket`, `SupportMessage`, `User`, `Seller`, `Order`, `Payment`, `AuditLog`, `Notification`.
- **API:** `/api/admin/support/tickets`, `/api/admin/support/tickets/[id]`, `/api/admin/support/assignments`.
- **Must include:** role-based assignment, internal notes, attachments, macros, SLA timers and customer-visible status.
- **Current state (2026-11-04):** **Central support desk initial slice delivered by System 09 shared ticket foundation.** Admin queue, priority/status, assignment, internal notes, public replies, support:manage authorization, audit, read receipts and first-response timestamps exist on Draft PR #11. This system remains open for attachment handling, agreed SLA policy/escalation, team routing, workload/analytics, email delivery and operational runbooks; avoid duplicating the customer-facing ticket models from System 09.

#### 39. CMS and content administration
- **Purpose:** Manage static pages, translations, banners, navigation and publish scheduling.
- **Pages:** `/admin/content/pages`, page editor, translations, banners and navigation.
- **Models:** `SitePage`, `SitePageTranslation`, `MarketplaceSetting`, `FeatureFlag`.
- **API:** `/api/admin/control-panel/site-pages`, `/api/admin/control-panel/site-pages/[slug]`, `/api/site-pages/[slug]`.
- **Must include:** draft/publish, revision history, preview, localization, sanitization and SEO metadata.
- **Current state:** **Partial.** Site-page admin and public routes exist; advanced publishing/versioning needs verification.

#### 40. Platform settings and governance
- **Purpose:** Configure marketplace behavior, feature availability, legal policies and operational parameters.
- **Pages:** `/admin/settings`, marketplace settings, feature flags and audit history.
- **Models:** `MarketplaceSetting`, `FeatureFlag`, `AuditLog`, `User`, `Role`, `Permission`.
- **API:** `/api/admin/settings`, `/api/admin/feature-flags`.
- **Must include:** typed settings, validation, secrets outside database, change approval, audit and safe rollout.
- **Current state:** **Partial.** Admin settings surface exists; comprehensive governance and audit integration are not proven.

### D. Global, financial and operational platform systems

#### 41. Global markets, currency, FX and localization
- **Purpose:** Support countries, regions, languages, currencies, exchange rates and market-specific availability.
- **Pages:** market/currency/language selectors; admin country, currency, FX and localization settings.
- **Models:** `Currency`, `ExchangeRate`, `Country`, `StateProvince`, `City`, `UserAddress`, `StoreTranslation`, `ProductTranslation`, `CategoryTranslation`.
- **API:** `/api/markets`, `/api/currencies`, `/api/exchange-rates`, `/api/admin/markets/*`.
- **Must include:** canonical currency storage, rate source/time, rounding, market restrictions, locale formatting and address validation.
- **Current state:** **Partial / schema-only.** Core models exist; most location/FX/localization workflows lack direct integration.

#### 42. Invoicing and credit notes
- **Purpose:** Issue customer/vendor invoices and legally traceable credit notes.
- **Pages:** customer invoice view/download, seller invoice center, admin invoice search.
- **Models:** `Invoice`, `InvoiceItem`, `CreditNote`, `Order`, `OrderItem`, `TaxLine`, `Currency`, `SellerTaxRegistration`.
- **API:** `/api/invoices/[id]`, `/api/orders/[id]/invoice`, `/api/admin/invoices`, `/api/admin/credit-notes`.
- **Must include:** immutable snapshots, numbering rules, tax details, currency, PDF generation, credit-note linkage and access control.
- **Current state:** **Partial.** Invoice page exists but reads order data; invoice/credit-note models have no direct delegate workflow in the audit.

#### 43. Analytics and reporting
- **Purpose:** Reliable operational, sales, seller, customer and financial reporting.
- **Pages:** `/admin/analytics`, `/admin/reports`, seller analytics and export center.
- **Models:** `Report`, `DailySiteVisit`, `Order`, `VendorOrder`, `Payment`, `Refund`, `Payout`, `Product`, `Seller`.
- **API:** `/api/analytics/*`, `/api/admin/reports`, `/api/seller/analytics`.
- **Must include:** explicit metric definitions, date/timezone boundaries, permission-scoped data, export limits and reconciliation with ledger/order sources.
- **Current state:** **Partial.** Analytics aggregation has repository/service tests; broader marketplace reporting remains incomplete.

#### 44. External integrations and provider adapters
- **Purpose:** Manage payment, shipping, tax, identity, email and storage providers through controlled adapters.
- **Pages:** `/admin/integrations`, provider configuration and health/status.
- **Models:** `Integration`, `PaymentProvider`, `ShippingCarrier`, `Webhook`, `MarketplaceSetting`, `AuditLog`.
- **API:** `/api/admin/integrations`, provider-specific server endpoints and verified callback routes.
- **Must include:** encrypted credentials in secret storage, least privilege, health checks, timeouts, retries and provider-independent domain services.
- **Current state:** **Partial / schema-only.** Some provider paths exist (e.g. Stripe/Resend); unified integration management is not demonstrated.

#### 45. Background jobs, event processing and outbox
- **Purpose:** Reliable asynchronous work for email, webhook delivery, inventory expiry, payouts, reports and retries.
- **Pages:** `/admin/operations/jobs`, failed jobs, outbox and retry inspection.
- **Models:** `OutboxEvent`, `BackgroundJob`, `Webhook`, `WebhookDelivery`, `Notification`, `AuditLog`.
- **API:** `/api/admin/operations/jobs`, `/api/admin/operations/jobs/[id]/retry`; internal worker handlers.
- **Must include:** transactional outbox writes, leases, retry/backoff, dead-letter handling, deduplication, observability and replay safety.
- **Current state:** **Schema-only.** No direct delegates or complete worker lifecycle identified.

#### 46. Security, audit and platform risk controls
- **Purpose:** Enforce authorization, record sensitive actions, rate-limit abuse and investigate security events.
- **Pages:** `/admin/security/audit-logs`, access review, risk and incident views.
- **Models:** `AuditLog`, `UserSession`, `LoginAttempt`, `UserConsent`, `Role`, `Permission`, `UserRoleAssignment`, `SellerStaff`.
- **API:** `/api/admin/audit-logs`, `/api/admin/security/*`; shared auth/authorization middleware.
- **Must include:** deny-by-default authorization, tenant/store scoping, immutable audit, secret handling, CSRF/XSS/SSRF protections, rate limits and security tests.
- **Current state:** **Partial / P0 prerequisite.** Auth helpers and rate limiting exist, but canonical role/permission mapping is unresolved (AUD-001).

#### 47. SEO and public discovery
- **Purpose:** Ensure indexable product/category/store/content pages and correct canonical metadata.
- **Pages:** metadata on `/products/[id]`, category/store pages, sitemap, robots and social previews.
- **Models:** `Product`, `Category`, `Brand`, `Store`, `SitePage`, translation models.
- **API:** `/api/sitemap` or generated sitemap route; public canonical metadata endpoints only where needed.
- **Must include:** canonical URLs, localized metadata, structured data, pagination rules, noindex for private pages and valid redirects.
- **Current state:** **Partial.** Sitemap and metadata surfaces exist; full structured-data and localization coverage need verification.

#### 48. Newsletter and lifecycle email
- **Purpose:** Consent-based subscriptions, confirmation, preferences and unsubscribe.
- **Pages:** newsletter signup, confirmation, preference center and admin subscriber list.
- **Models:** `NewsletterSubscriber`, `UserConsent`, `OutboxEvent` (for reliable delivery where adopted).
- **API:** `/api/newsletter`, `/api/newsletter/confirm`, `/api/newsletter/unsubscribe`, `/api/admin/control-panel/subscribers`.
- **Must include:** double opt-in, token hashing/expiry/single-use, consent evidence, unsubscribe suppression and delivery retries.
- **Current state:** **Partial, tested vertical slice.** Newsletter route/service/repository/token/email layers and focused tests exist; broader lifecycle automation remains.

#### 49. Property listings and booking domain (separate bounded context)
- **Purpose:** Preserve Mtjr2's real-estate listing and booking-request capabilities without coupling them to product checkout.
- **Pages:** `/properties`, `/properties/[id]`, seller property creation, `/properties/[id]/book`, account wishlist, admin property moderation.
- **Models:** `Property`, `PropertyMedia`, `PropertyTranslation`, `PropertyWishlist`, `BookingRequest`, shared `User`, `Seller`, `Store`.
- **API:** `/api/properties`, `/api/properties/[id]`, `/api/properties/[id]/wishlist`, `/api/properties/wishlist`, `/api/bookings`, `/api/admin/properties/*`.
- **Must include:** listing lifecycle, media/localization, ownership, moderation, booking request status and notifications. Do not reuse product `Order` or `Cart` semantics unless a separately designed requirement justifies it.
- **Current state:** **Partial.** Property pages/APIs exist; media/translations/booking integration require further verification.

## 4. Required dashboard navigation

These are target information architectures. Existing route names may be retained or migrated incrementally; do not create duplicate pages merely to match labels.

### Customer account
- Overview
- Profile and security
- Addresses
- Orders and tracking
- Returns and refunds
- Wishlist
- Reviews and questions
- Messages and support
- Notifications and preferences
- Invoices

### Seller center
- Overview
- Products and variants
- Orders and fulfillment
- Inventory and warehouses
- Suppliers and purchase orders
- Shipping
- Reviews and reputation
- Marketing and coupons
- Finance, transactions and payouts
- Team and permissions
- Store profile, policies and localization
- Reports and settings

### Platform administration
- Command center
- Users and access control
- Sellers, KYC and stores
- Catalog and moderation
- Orders and exceptions
- Payments, refunds and disputes
- Commissions, ledger and payouts
- Shipping and logistics
- Tax and customs
- Promotions, loyalty and gift cards
- Reviews and support
- CMS and SEO
- Markets, currencies and localization
- Analytics and reports
- Integrations, webhooks and jobs
- Security, audit and settings
- Property listings and bookings

## 5. Canonical model ownership and schema-change gate

The model names below are the canonical domain inventory to reuse. The model map is the authority for current callsites and relationships. A model appearing here does not authorize creating another similarly named table.

| Domain | Target canonical models (add incrementally; verify actual presence in schema) | Primary owner |
|---|---|---|
| Identity/access | User, UserSession, OAuthAccount, Role, Permission, RolePermission, UserRoleAssignment, TwoFactorAuthentication, PasswordResetToken, VerificationToken, UserConsent, LoginAttempt, UserAddress | Identity |
| Global markets | Currency, ExchangeRate, Country, StateProvince, City | Platform markets |
| Seller/store | Seller, SellerVerification, SellerDocument, SellerTaxRegistration, Store, StoreTranslation, SellerStaff | Seller |
| Catalog | Category, CategoryTranslation, Brand, BrandTranslation, Product, ProductCategory, ProductTranslation, ProductMedia, AttributeDefinition, ProductAttribute, ProductAttributeValue, ProductVariant, VariantAttribute, ProductIdentifier, ProductPrice | Catalog |
| Inventory/procurement | Warehouse, Inventory, InventoryMovement, InventoryReservation, StockTransfer, StockTransferItem, Supplier, SupplierProduct, PurchaseOrder, PurchaseOrderItem, GoodsReceipt, GoodsReceiptItem | Inventory/procurement |
| Cart/orders | GuestSession, Cart, CartItem, Order, OrderAddress, VendorOrder, OrderItem, OrderStatusHistory | Commerce |
| Payments/finance | PaymentProvider, Payment, PaymentAttempt, Refund, PaymentReconciliation, Dispute, DisputeEvidence, LedgerAccount, JournalEntry, JournalLine, SellerLedgerEntry, CommissionRule, CommissionTransaction, PayoutMethod, Payout | Payments/finance |
| Tax/logistics/returns | TaxRegion, TaxRate, TaxLine, CustomsDeclaration, CustomsDeclarationItem, ShippingCarrier, ShippingService, ShippingZone, ShippingRate, Shipment, Package, PackageItem, ShipmentItem, ShipmentTrackingEvent, ReturnRequest, ReturnItem | Tax/fulfillment |
| Growth/trust/support | Promotion, Coupon, CouponRedemption, PromotionProduct, PromotionCategory, PromotionSeller, LoyaltyProgram, LoyaltyTransaction, GiftCard, GiftCardTransaction, Review, ReviewMedia, StoreReview, Favorite, Recommendation, ProductQuestion, ProductAnswer, SupportTicket, SupportMessage, StoreConversation, StoreMessage | Growth/trust/support |
| Documents/property | Invoice, InvoiceItem, CreditNote, Property, PropertyMedia, PropertyTranslation, PropertyWishlist, BookingRequest | Documents / Property |
| Platform operations | Notification, AuditLog, SitePage, SitePageTranslation, MarketplaceSetting, FeatureFlag, Webhook, WebhookDelivery, Integration, OutboxEvent, BackgroundJob, Report, DailySiteVisit, SearchSynonym, NewsletterSubscriber | Platform operations |

### Mandatory schema proposal template

Any proposed new model or field must be accompanied by all of the following in the same change proposal:

- **Business capability:** the exact user/business problem.
- **Workflow:** the screen/action that creates or changes the data, and the screen/API that consumes it.
- **Owner:** the bounded context responsible for the data.
- **Existing-model review:** why current models, relations, enums, JSON fields or event records cannot support the requirement.
- **Data contract:** fields, types, uniqueness, indexes, foreign keys, deletion policy and lifecycle.
- **API/service:** exact endpoint/service/repository that will use it.
- **Authorization:** who may read/write it and how scope is enforced.
- **Migration:** forward/backward and data-preservation plan.
- **Tests:** unit, integration, concurrency/idempotency and end-to-end evidence as relevant.

If any item is missing, defer the schema change.

## 6. Implementation order and gates

| Order | Workstream | Exit gate |
|---:|---|---|
| 0 | Preserve repository state and reconcile documentation | Confirm branch/commit and working changes; no overwrites. |
| 1 | Canonical schema, migrations and model map | Validate schema, generate client, replay active migrations on isolated DB, explain drift, refresh model-to-callsite map. |
| 2 | Architecture, identity and authorization | Repository/service/validation boundaries; canonical role and store-scope tests; no unauthorized access. |
| 3 | Catalog and product domain | Category/product/variant/media/price/stock reads and writes use canonical schema. |
| 4 | Search and discovery | Search, filters, pagination, synonyms and URL state use canonical catalog. |
| 5 | Cart and checkout | Guest/customer cart, variant stock, server totals, reservations, tax/shipping quote, idempotent order creation. |
| 6 | Orders, payments and fulfillment | Valid order lifecycle, provider-verified idempotent payments, vendor orders, shipments and stock movement. |
| 7 | Seller operations | Seller onboarding, store isolation, product/order/inventory workflows and scoped staff. |
| 8 | Finance and platform administration | Commission, ledger, refunds, payouts, reconciliation, tax and audited admin actions. |
| 9 | Reviews, support, messaging and notifications | Complete customer/seller/admin workflows and abuse controls. |
| 10 | Global markets, CMS, SEO and growth | Localization, market rules, content, promotions and lifecycle communication. |
| 11 | Property bounded context | Independently tested listing and booking workflows. |
| 12 | Reliability, security and performance | Threat model, job retries, observability, load/query checks and recovery tests. |
| 13 | UX and visual QA | Responsive, accessible and consistent customer/seller/admin experiences; no broken controls. |
| 14 | Release readiness | CI green, migration rehearsal, staging smoke tests, rollback and deployment documentation. |

**Do not skip dependencies.** In particular, do not build full checkout before canonical catalog, inventory, identity and payment contracts are integrated.

## 7. Cross-system acceptance checklist

A system may be marked **Complete** only when applicable checks pass:

- [ ] Every page is linked from the correct role-specific navigation.
- [ ] Every visible button has a real, permission-checked action and useful loading/error/success states.
- [ ] API inputs are validated and bounded; output DTOs do not leak private fields.
- [ ] All reads/writes go through the domain service/repository boundary.
- [ ] Tenant, seller, store and customer ownership are enforced server-side.
- [ ] Database constraints and transactions protect invariants.
- [ ] Retry-sensitive operations are idempotent.
- [ ] Audit events exist for sensitive administrative and financial changes.
- [ ] Empty, loading, error, permission-denied and success states are designed.
- [ ] Unit and integration tests cover normal, invalid, unauthorized and failure cases.
- [ ] End-to-end tests cover the complete user journey against an isolated PostgreSQL database.
- [ ] Responsive and accessibility checks pass.
- [ ] Documentation records exact commands, results, known gaps and commit reference.

## 8. Reference UI images and design direction

The following are **external inspiration references**, not screenshots of Mtjr2 and not requirements to copy. Use them to guide information hierarchy, density, tables, filters, charts and operational workflows. Before implementation, create Mtjr2-specific screens consistent with its brand and existing design system.

| System / visual reference | Reference |
|---|---|
| Multi-vendor admin command center | [Marketplace admin dashboard example](https://badavyapar.com/uploads/20260703144856-c615c5f7fe35.png) |
| Seller center and seller performance | [ABOUT YOU SellerCenter dashboard preview](https://partner.aboutyou.com/static/images/landingpage/stage/sellercenter-dashboard-preview.a5a182b8104f.png) |
| Review moderation | [Stamped moderation dashboard example](https://images.g2crowd.com/uploads/attachment/file/197189/CNrThb2E0fQCEAE_.png) |
| Warehouse / procurement operations | [Warehouse procurement dashboard example](https://apps.shopify.com/) |
| Warehouse receiving, putaway and transfers | [Warehouse management workflow reference](https://apps.shopify.com/) |
| Customer order account | [Shopify customer order account examples](https://apps.shopify.com/) |
| General dashboard patterns | [Adobe Commerce admin dashboard guidance](https://experienceleague.adobe.com/docs/commerce-admin/start/admin/tools/admin.html) |

### Visual standards for Mtjr2
- **Admin:** dense but readable command center, persistent navigation, saved filters, bulk actions, status chips, audit trail and drill-down.
- **Seller:** revenue and fulfillment first; quick actions, inventory alerts, clear pending-vs-available balances and store-scoped navigation.
- **Customer:** simple shopping and account journeys, clear delivery/return status and transparent totals.
- **Tables:** server pagination, column sorting, search, filters, empty states, responsive overflow and explicit row actions.
- **Charts:** label units and date ranges; show definitions and distinguish gross sales from net revenue.
- **Accessibility:** keyboard navigation, focus visibility, semantic labels, contrast and non-color status indicators.
- Do not alter the existing homepage section order/category-grid distribution as a side effect of building dashboards. Treat homepage redesign as a separate approved task.

## 9. Current known blockers — read before coding

1. **P0 — Identity contract:** legacy auth code assumes fields such as `User.password`, `userImage`, `googleId` and scalar `role`; canonical schema uses different fields and role relations. Resolve the mapping before protected writes.
2. **P0 — Catalog contract:** legacy code assumes `Product.userId`, `sellerId`, `images`, `basePrice`, `stockQuantity`, numeric `categoryId` and `approvalStatus`; canonical product ownership, variants, prices, media and inventory are relational.
3. **P0 — Checkout/order/payment contract:** current handlers use legacy order/payment fields and lifecycle values. Rebuild against canonical order/vendor-order/payment models, provider verification and idempotency.
4. **P1 — Cart persistence:** current cart is client-local and not a canonical server cart keyed by variant.
5. **P1 — Inventory:** canonical warehouse/inventory models exist but a tested reservation/decrement/transfer workflow is not demonstrated.
6. **P1 — Financial operations:** ledger, commissions and payouts are modeled but do not have proven application workflows.
7. **P1 — Shipping, tax and returns:** models and some admin surfaces exist; end-to-end integration remains incomplete.
8. **Phase Three:** canonical catalog pages are a bounded milestone only; visual/browser QA and full product-to-checkout journey remain outstanding.
9. **Type/build debt:** consult the latest `docs/PROJECT_AUDIT.md` checkpoint before relying on old test counts; the audit recorded remaining generated-client contract errors at its latest checkpoint.

Do not attempt to solve these blockers by adding duplicate tables or copying legacy columns into the canonical schema.

## 10. How to maintain this document

For each system, update its status only with evidence:
- **Implementation:** commit SHA and exact pages/API/service/repository paths.
- **Schema:** model names used; link to the model map. Record schema changes and migration IDs.
- **Tests:** exact command, database target type (isolated test DB only), pass/fail counts and skipped tests.
- **UX:** screenshots or review artifact, viewport sizes and accessibility notes.
- **Known gaps:** explicit remaining work and owner/next dependency.

When the model map or schema changes, regenerate/review `docs/architecture/prisma-model-usage-map.md` and update this blueprint in the same workstream. Keep `docs/PROJECT_AUDIT.md` as the chronological execution log; this file is the target-state functional map, not a replacement for the audit log.

---

**Copilot instruction:** Before implementing a system, read this blueprint, `docs/PROJECT_AUDIT.md`, `docs/architecture/prisma-model-usage-map.md`, and `prisma/schema.prisma`. Trace the existing route → service → repository → model path first. Reuse the canonical schema. Do not invent tables, routes, or completed functionality. Implement one dependency-ready vertical slice, test it, and document the result before moving on.

## 11. Integrity re-check — 2026-11-03 (supersedes the earlier static warning)

A fresh static inspection of `prisma/schema.prisma` on the current `main` branch after the market and seller/store schema commits found:

| Check | Current result |
|---|---|
| Prisma model declarations | 21 |
| Duplicate model names | None found |
| Unresolved Git conflict markers in Prisma schema | None found |
| Seller/store ownership and market relations | Present at schema level |
| Prisma validation / client generation after latest changes | Pending CI evidence |
| Migration replay against clean isolated PostgreSQL | Pending |

The earlier SNAP-01 through SNAP-05 findings described a prior repository snapshot and must not be treated as current defects without rechecking the exact file revision. The current schema scan does not reproduce the conflict-marker or duplicate-model findings. The earlier referenced companion paths `docs/PROJECT_AUDIT.md` and `docs/architecture/prisma-model-usage-map.md` were not found at those exact paths during this recheck; verify their current locations before relying on them or generating a replacement.

### Current schema gate

Until CI validates the latest schema and both committed migrations are replayed against a clean isolated PostgreSQL database:
- Do not connect to or migrate the owner's production database.
- Do not mark market or seller/store workflows Complete; only their schema foundations are committed.
- Do not create additional marketplace models without the business capability, workflow, owner, API/service, authorization, migration, and test evidence required by Section 5.

After the current schema is validated:
1. Complete the market seed/repository/service slice and its focused PostgreSQL integration gate.
2. Implement seller onboarding and store-scoped authorization using existing identity and scoped role-assignment models.
3. Continue with category/brand taxonomy, then product/variant/media/pricing according to the Phase 3 plan.
4. Refresh the model-to-callsite map when its canonical location is confirmed.

**Scope note:** this is a remote static inspection only. No local runtime validation, Prisma generation, database migration replay, or production database access was performed as part of this documentation update.


## Buying Core implementation update — 2026-11-03

The current implementation status is tracked in `docs/implementation/PHASE_04_BUYING_PLAN.md`. Cart, checkout quote/reservation, and delivery-address capture have passed their focused CI and disposable PostgreSQL gates. Configurable store shipping rates and per-store quote selections have been implemented on the stacked shipping branch, including Prisma persistence, migration, seller configuration UI, buyer checkout UI, and APIs; their verification is pending. Tax, discount, final order totals, order creation, payment, and shipment execution are not yet complete. Do not mark the buying system complete until its remaining workflows and verification gates pass.


## Buying Core update — shipping and tax implementation (2026-11-03)

- Store-level shipping rates and quote-owned per-store shipping selections are implemented on the stacked shipping branch; final General CI was cancelled and the shipping slice remains pending final verification.
- Market tax configuration is now implemented on the next stacked branch with `MarketTaxRate` and `CheckoutTaxSnapshot`, admin configuration API/UI, and buyer quote tax calculation API/UI.
- The current tax slice supports explicit market-wide or exact-region rules, inclusive/exclusive basis-point calculation, optional shipping taxation, and quote snapshots. It intentionally does not infer statutory rates or claim complete jurisdictional compliance.
- The next buying milestone is server-side final quote validation and order/vendor-order creation. Discounts and payment remain incomplete.
