# Prisma Model Usage Map

**Canonical schema:** `prisma/schema.prisma`  
**Purpose:** A navigation and change-impact index for schema review. It does not replace reading the model definitions, migrations, service implementation, or tests before changing persistence.  
**Audit baseline:** branch `feat/returns-workflow`, 2026-11-04; 74 Prisma models and 24 enums in the audited schema snapshot.  
**Rule:** A model is not proof that its workflow is implemented. Every schema change must name the missing business fact/relation, owning service, API/page consumers, migration, and focused verification.

## 1. Identity, authorization, and audit — System 01 / shared platform

| Prisma models | Primary code ownership | Notes |
|---|---|---|
| `User`, `UserSession`, `OAuthAccount`, `UserTwoFactor`, `UserTwoFactorRecoveryCode`, `PasswordResetToken`, `VerificationToken`, `UserConsent`, `LoginAttempt`, `LoginRateLimitBucket` | `src/server/identity/*`; `src/app/api/auth/*`; `/api/account/security/mfa` | Account lifecycle, single-use email verification challenges, encrypted TOTP secrets, one-time recovery codes, MFA-assured sessions, OAuth and abuse controls. Password registration remains pending until email verification. |
| `Role`, `Permission`, `RolePermission`, `UserRoleAssignment` | `src/server/identity/authorization.ts`, `permission-guard.ts`, `permission-repository.ts`, `role-assignment.ts`, `role-scope.ts` | Global grants and exact resource-scoped grants. Resolve actor and scope on the server. |
| `PlatformPrivilegeRequest` | `src/server/admin/platform-privilege-requests.ts`; `/api/admin/control-panel/privilege-requests` | Two-person Super Admin elevation approval; requester cannot approve their own request. First administrator bootstrap is separate and one-time. |
| `AiAssistantSetting` | `src/server/admin/ai-assistant-settings.ts`, `src/server/ai/assistant-config.ts`; `/api/admin/control-panel/ai-assistant` | Singleton runtime enable flag, fixed approved model and bounded completion tokens. Environment master switch and server-only provider key remain authoritative; every change is audited. |
| `AuditLog` | Domain services that perform sensitive writes | Cross-cutting audit record; do not create duplicate audit tables per domain without a demonstrated need. Super Admin privilege and AI settings changes use this model. |

## 2. Markets and seller/store foundation — Systems 02, 03, 12 and shared operations

| Prisma models | Primary code ownership | Notes |
|---|---|---|
| `Country`, `Currency`, `Market`, `MarketCurrency` | `src/server/marketplace/market-query.ts`; `src/app/api/markets/*`, `countries`, `currencies` | Reference data and market/currency availability. Launch activation and seed data remain owner decisions. |
| `Seller`, `Store`, `StoreMarket`, `SellerStaff`, `StoreMediaAsset` | `src/server/marketplace/seller-application.ts`, `store-staff.ts`, `seller-store-settings.ts`; `src/app/api/seller/*`, `src/app/api/stores/*` | Seller application; one owned store per seller (Seller.ownerId @unique, Store.sellerId @unique) with serialized/idempotent creation; active markets and store-scoped staff. `SellerStaff.expiresAt` persists seven-day invitation expiry; expired invitations can be renewed without duplicate membership. `SellerStaff.roleId` references the selected Role; invitation acceptance grants that role only within the store scope, and owner role changes replace the old scoped assignment transactionally. Seeded store roles separate catalog, inventory, orders, customer care and marketing from the explicit full `STORE_MANAGER` role. `LedgerAccount`, `JournalEntry` and `JournalLine` provide a currency-specific immutable double-entry journal; deferred database checks enforce balance and same-currency active account lines. `postJournalEntry` compares the full immutable payload on idempotent retry and corrections use exact reversals. Migration `20261112130000_journal_append_only_integrity` stores the creation transaction ID and rejects any journal-line insert after that transaction commits, preventing later append-only bypasses. Unit and PostgreSQL integration tests are added but pending execution. This foundation is not connected to seller payable or payout workflows pending accounting policy decisions. Acceptance rejects expired invitations, and the invitee inbox hides them. `StoreMediaAsset` records reusable uploaded images per store with provider storage keys and dimensions; the seller workspace loads the latest 100. Deletion is owner/exact-store catalog-scoped and is blocked while referenced by store branding or ProductMedia. Store.logoStorageKey and bannerStorageKey retain provider identifiers for saved branding assets so temporary and library deletion can be blocked while a store references the asset. Store.shippingContactName, shippingPhone, shippingAddressLine1/2, shippingCity, shippingRegion, shippingPostalCode, shippingCountryCode and shippingInstructions persist the private dispatch origin edited in the seller workspace. `shippingPolicy`, `returnsPolicy`, `privacyPolicy` and `termsOfSale` are seller-managed public policy text, edited through the store settings API and displayed on the public store detail page. Changes are audited by field name only; private dispatch fields are not part of public store serializers. |

## 3. Catalog and discovery — Systems 02–03

| Prisma models | Primary code ownership | Notes |
|---|---|---|
| `Category`, `CategoryTranslation`, `Brand`, `BrandTranslation` | `src/server/catalog/taxonomy.ts`, `category-query.ts`, `category-tree.ts` | Taxonomy and localized labels. Seed activation requires an approved taxonomy. |
| `Product`, `ProductCategory`, `ProductTranslation`, `ProductMedia`, `ProductVariant`, `ProductIdentifier`, `ProductPrice` | `src/server/catalog/products.ts`, `discovery.ts`; seller product APIs | Canonical product lifecycle, localized content, media, variants and market prices. |
| `AttributeDefinition`, `AttributeTranslation`, `ProductAttribute`, `ProductAttributeValue`, `VariantAttribute` | Catalog domain; product create/update services | Typed product/variant attributes. Confirm consumer coverage before changing attribute semantics. |
| `SearchSynonym` | `src/server/catalog/discovery.ts`, `src/server/search/synonyms.ts`, search/admin APIs | Localized synonym expansion, trigram relevance matching, suggestions and audited admin CRUD; database migration/runtime verification remains pending. |

## 4. Inventory and shipping — Systems 04, 12 and fulfillment dependencies

| Prisma models | Primary code ownership | Notes |
|---|---|---|
| `Warehouse`, `Inventory`, `InventoryMovement`, `InventoryReservation`, `StockTransfer`, `StockTransferItem` | `src/server/inventory/stock.ts`; seller inventory APIs | Stock ledger, reservations, and inter-warehouse transfers. Keep quantity constraints and transactional movement invariants. |
| `StoreShippingRate`, `CheckoutShippingSelection` | `src/server/shipping/shipping.ts`; seller shipping and checkout shipping APIs | Store/market/currency scoped shipping rates and immutable quote selection snapshots. Carrier integrations are not implied. |
| `Shipment` | `src/server/orders/seller-orders.ts`; seller shipment API and buyer order serializer | One seller-entered dispatch record per vendor order; HTTPS tracking URL only. Does not represent live carrier events or proof of delivery. |

## 5. Cart, checkout, tax, and orders — Systems 04–07

| Prisma models | Primary code ownership | Notes |
|---|---|---|
| `GuestSession`, `Cart`, `CartItem` | `src/server/cart/cart.ts`, `guest-cookie.ts`; cart APIs | Guest/customer cart ownership, merge, and market/currency partition. |
| `CheckoutQuote`, `CheckoutQuoteLine`, `CheckoutQuoteAddress` | `src/server/checkout/quotes.ts`, `delivery-address.ts` | Time-bounded quote, item, coupon-discount and address snapshots. Address changes invalidate dependent shipping/tax snapshots. |
| `Coupon`, `CouponRedemption` | `src/server/checkout/coupons.ts`, `quotes.ts`, `orders.ts`; admin coupon APIs | Admin-managed percentage or currency-specific fixed coupon, quote snapshot and one redemption per created order. Redemption caps are checked in serializable order creation. |
| `UserAddress` | `src/server/account/addresses.ts`, checkout delivery-address service | Customer address book and market-country constraints. |
| `MarketTaxRate`, `CheckoutTaxSnapshot` | `src/server/tax/tax.ts`; admin tax and checkout tax APIs | Initial configurable market/region tax rule and immutable quote calculation; not a complete jurisdictional tax engine. |
| `Order`, `OrderAddress`, `VendorOrder`, `OrderItem`, `OrderStatusHistory`, `VendorOrderStatusHistory`, `Shipment`, `ShipmentTrackingEvent` | `src/server/orders/orders.ts`, `seller-orders.ts` | Buyer-owned order timelines, safe pre-payment cancellation and all-or-nothing reorder. Seller shipment records and manually entered tracking events are store-scoped and audited; cancellation restores SALE ledger quantities through idempotent `ORDER_CANCELLATION` movements. Paid-order refund execution is implemented through the finance refund workflow and original Stripe/PayPal provider; invoice/credit-note generation and seller-ledger reversal remain unimplemented. |
| `CommissionRule`, `CommissionTransaction` | `src/server/admin/commission-management.ts`; `src/server/payments/payments.ts`; `/api/admin/commission-rules`, `/api/admin/commissions` | Super Admin effective-dated commission policy and immutable per-order-item snapshots at verified payment success. Commission basis is line merchandise net of proportionally allocated vendor discounts; tax/shipping excluded. Rule precedence is seller+category, seller, category, global; no matching rule snapshots 0%. Category ID/name is snapshotted onto OrderItem at order creation. `orderItemId` uniqueness makes each item posting idempotent. No seller ledger, payout, seller payable reversal or settlement reconciliation is implemented; provider refunds are tracked through Refund/Payment and AuditLog, not the general ledger. |

## 6. Returns, trust, engagement, and support — Systems 06–11

| Prisma models | Primary code ownership | Notes |
|---|---|---|
| `ReturnRequest`, `ReturnItem`, `Refund`, `RefundItem` | `src/server/returns/returns.ts`, `src/server/payments/refunds.ts`; customer/admin return/refund APIs | Physical return receipt gates refund creation. Finance can execute idempotent partial/full refunds through the original Stripe/PayPal payment, refresh provider-pending status, or record an externally completed refund after reconciliation. Refund tracks first provider submission time and attempt number to enforce provider idempotency retention; a different finance operator must execute/confirm. Refund/Payment status and AuditLog are updated only after provider-confirmed completion or explicit finance confirmation. The general ledger and seller payable reversal remain intentionally unconnected pending approved account mapping and marketplace accounting policy. |
| `ProductReview`, `StoreReview`, `ReviewMedia`, `ReviewReport`, `ReviewAppeal` | `src/server/reviews/product-reviews.ts`; customer, seller, and admin review APIs | Verified-purchase reviews, URL-validated media references, one-report/one-appeal constraints, moderated report/appeal decisions, aggregates, and audited seller responses. Review image bytes are not uploaded or remotely fetched. |
| `ProductQuestion`, `ProductAnswer` | `src/server/catalog/product-qa.ts`; customer/seller/admin Q&A APIs | Product questions, seller answers, moderation. |
| `Favorite`, `Recommendation` | `src/server/wishlist/favorites.ts`, `src/server/wishlist/recommendations.ts`; favorites and recommendations APIs | Owner-scoped saved products; curated product-to-product links plus per-user category similarity. Recommendation responses are private/no-store and exclude non-public products. |
| `Notification`, `NotificationPreference` | `src/server/notifications/notifications.ts`; notifications APIs | In-app notifications and event preferences. Email delivery preferences are not implied. |
| `SupportTicket`, `SupportMessage` | `src/server/support/tickets.ts`; support APIs | Customer support ticket lifecycle; internal notes must remain staff-only. |
| `StoreConversation`, `StoreMessage` | `src/server/messaging/store-conversations.ts`; messaging APIs | Customer/store conversation and participant-scoped messages. |

## 7. Schema change checklist

Before adding or changing a model:

1. Identify the system (1–49), user journey, and durable business fact/state/relation.
2. Search this map and the canonical schema for an existing model or relation that already represents it.
3. Inspect all listed service/API consumers and repository queries; update this map when ownership or consumers change.
4. Explain why existing models are insufficient; do not add a table just to back a page, form, or button.
5. Define ownership, unique constraints, indexes, delete behavior, transaction/concurrency rules, and idempotency where writes can be retried.
6. Add a forward-safe migration and focused tests only when required by the real schema change.
7. Verify Prisma validate/generate and replay migrations plus relevant integration checks on disposable PostgreSQL.
8. Record model, migration, endpoints, pages/actions, evidence and remaining gaps in `PAGE_ROUTE_REGISTRY.md` and `BUILD_LOG.md`.

## 8. Known boundaries and unmapped future domains

This schema snapshot does not yet provide a complete implementation for all 49 systems. Seller payout destination management and manual administrator ownership review now exist, but seller payable posting, payout/withdrawal execution and reconciliation remain unimplemented. Payment disputes, customs/tax compliance, supplier/procurement, loyalty/promotions, invoices, CMS/legal content, feature flags, webhooks/outbox, logistics/carrier integrations, KYC documents, and the separate property/booking domain still require their own reviewed data contracts and workflows. Do not invent models or claim these systems are implemented merely because they appear in the 49-system blueprint.


## Seller order preparation — 2026-11-04

- `VendorOrder`, `VendorOrderStatusHistory`, `Order`, `OrderStatusHistory`, and `AuditLog` are consumed by `src/server/orders/seller-orders.ts` for the initial seller preparation transitions.
- No Prisma change is required for `CONFIRMED → PROCESSING → READY_TO_SHIP`; shipment labels/tracking and later delivery states are not implemented by this slice.

## Seller inventory count models
- `StockCountSession` — store- and warehouse-scoped count session, tracking progress and completion.
- `StockCountLine` — snapshot quantity and inventory version per SKU; stores the counted quantity and line note.


| `PaymentProviderConfig` | `src/server/admin/payment-providers.ts`; `/admin/payment-providers`; `/api/admin/payment-providers` | Super Admin provider configuration, encrypted credentials, environment/status, supported country/currency/method metadata, verification and soft archive. New Payment records reference the selected configuration and retain an encrypted credential snapshot/key version for historical webhook and PayPal return verification. |


## Seller payout destination and administrator review — 2026-11-12

| Prisma model | Primary code ownership | Notes |
|---|---|---|
| `SellerPayoutMethod` | `src/server/marketplace/seller-payout-methods.ts`; `/api/seller/payout-methods`; `/api/admin/seller-payout-methods`; `/api/admin/seller-payout-methods/[methodId]/review`; `/seller/payouts`; `/admin/seller-payout-methods` | Seller-owned encrypted IBAN destination, masked suffix, seller/currency default and audited disable. `submissionVersion` is a monotonic generation: re-registering a disabled destination increments it and refreshes `submittedAt`; the admin queue orders/displays the current submission timestamp. An administrator review must submit the exact queue generation and the database update atomically checks both generation and `PENDING_VERIFICATION`. Global `platform:manage` permission requires fresh ten-minute TOTP step-up; self-verification is rejected. Admin responses expose masked data only. This is a human attestation recorded with evidence reference/reason, not an automated bank check or transfer. No seller payable balance, withdrawal, payout execution or settlement is implemented. Migration: `20261112090000_seller_payout_submission_version`. |


## Accounting journal transaction guard — 2026-11-12

| Prisma model | Primary code ownership | Notes |
|---|---|---|
| `JournalEntry.createdTransactionId` | `src/server/finance/ledger.ts`; migration `20261112130000_journal_append_only_integrity` | Database-generated PostgreSQL transaction ID captured when a journal is created. A BEFORE INSERT trigger on JournalLine requires the same transaction ID, so nested journal lines are inserted atomically with the entry and cannot be appended in a later transaction. Deferred integrity also rejects inactive accounts. Verification remains pending on disposable PostgreSQL. |
