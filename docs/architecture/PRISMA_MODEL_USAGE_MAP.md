# Prisma Model Usage Map

**Canonical schema:** `prisma/schema.prisma`  
**Purpose:** A navigation and change-impact index for schema review. It does not replace reading the model definitions, migrations, service implementation, or tests before changing persistence.  
**Audit baseline:** branch `feat/returns-workflow`, 2026-11-04; 74 Prisma models and 24 enums in the audited schema snapshot.  
**Rule:** A model is not proof that its workflow is implemented. Every schema change must name the missing business fact/relation, owning service, API/page consumers, migration, and focused verification.

## 1. Identity, authorization, and audit — System 01 / shared platform

| Prisma models | Primary code ownership | Notes |
|---|---|---|
| `User`, `UserSession`, `OAuthAccount`, `PasswordResetToken`, `VerificationToken`, `UserConsent`, `LoginAttempt`, `LoginRateLimitBucket` | `src/server/identity/*`; `src/app/api/auth/*` | Account lifecycle, session security, verification and abuse controls. OAuth/MFA routes must remain conditional until providers and full flows exist. |
| `Role`, `Permission`, `RolePermission`, `UserRoleAssignment` | `src/server/identity/authorization.ts`, `permission-guard.ts`, `permission-repository.ts`, `role-assignment.ts`, `role-scope.ts` | Global grants and exact resource-scoped grants. Resolve actor and scope on the server. |
| `AuditLog` | Domain services that perform sensitive writes | Cross-cutting audit record; do not create duplicate audit tables per domain without a demonstrated need. |

## 2. Markets and seller/store foundation — Systems 02, 03, 12 and shared operations

| Prisma models | Primary code ownership | Notes |
|---|---|---|
| `Country`, `Currency`, `Market`, `MarketCurrency` | `src/server/marketplace/market-query.ts`; `src/app/api/markets/*`, `countries`, `currencies` | Reference data and market/currency availability. Launch activation and seed data remain owner decisions. |
| `Seller`, `Store`, `StoreMarket`, `SellerStaff` | `src/server/marketplace/seller-application.ts`, `store-staff.ts`; `src/app/api/seller/*`, `src/app/api/stores/*` | Seller application, stores, active markets, and store-scoped staff. Store creation retry/duplicate behavior remains an acceptance gap. |

## 3. Catalog and discovery — Systems 02–03

| Prisma models | Primary code ownership | Notes |
|---|---|---|
| `Category`, `CategoryTranslation`, `Brand`, `BrandTranslation` | `src/server/catalog/taxonomy.ts`, `category-query.ts`, `category-tree.ts` | Taxonomy and localized labels. Seed activation requires an approved taxonomy. |
| `Product`, `ProductCategory`, `ProductTranslation`, `ProductMedia`, `ProductVariant`, `ProductIdentifier`, `ProductPrice` | `src/server/catalog/products.ts`, `discovery.ts`; seller product APIs | Canonical product lifecycle, localized content, media, variants and market prices. |
| `AttributeDefinition`, `AttributeTranslation`, `ProductAttribute`, `ProductAttributeValue`, `VariantAttribute` | Catalog domain; product create/update services | Typed product/variant attributes. Confirm consumer coverage before changing attribute semantics. |
| `SearchSynonym` | `src/server/catalog/discovery.ts`, taxonomy/discovery APIs | Current synonym expansion; typo-tolerant ranking and autocomplete remain future scope. |

## 4. Inventory and shipping — Systems 04, 12 and fulfillment dependencies

| Prisma models | Primary code ownership | Notes |
|---|---|---|
| `Warehouse`, `Inventory`, `InventoryMovement`, `InventoryReservation`, `StockTransfer`, `StockTransferItem` | `src/server/inventory/stock.ts`; seller inventory APIs | Stock ledger, reservations, and inter-warehouse transfers. Keep quantity constraints and transactional movement invariants. |
| `StoreShippingRate`, `CheckoutShippingSelection` | `src/server/shipping/shipping.ts`; seller shipping and checkout shipping APIs | Store/market/currency scoped shipping rates and immutable quote selection snapshots. Carrier integrations are not implied. |

## 5. Cart, checkout, tax, and orders — Systems 04–07

| Prisma models | Primary code ownership | Notes |
|---|---|---|
| `GuestSession`, `Cart`, `CartItem` | `src/server/cart/cart.ts`, `guest-cookie.ts`; cart APIs | Guest/customer cart ownership, merge, and market/currency partition. |
| `CheckoutQuote`, `CheckoutQuoteLine`, `CheckoutQuoteAddress` | `src/server/checkout/quotes.ts`, `delivery-address.ts` | Time-bounded quote, item and address snapshots. Address changes invalidate dependent shipping/tax snapshots. |
| `UserAddress` | `src/server/account/addresses.ts`, checkout delivery-address service | Customer address book and market-country constraints. |
| `MarketTaxRate`, `CheckoutTaxSnapshot` | `src/server/tax/tax.ts`; admin tax and checkout tax APIs | Initial configurable market/region tax rule and immutable quote calculation; not a complete jurisdictional tax engine. |
| `Order`, `OrderAddress`, `VendorOrder`, `OrderItem`, `OrderStatusHistory`, `VendorOrderStatusHistory` | `src/server/orders/orders.ts`, `seller-orders.ts` | Parent order and store-specific vendor orders. Current order state is pending payment until verified provider events exist. |

## 6. Returns, trust, engagement, and support — Systems 06–11

| Prisma models | Primary code ownership | Notes |
|---|---|---|
| `ReturnRequest`, `ReturnItem` | `src/server/returns/returns.ts`; customer/admin return APIs | Return eligibility and review workflow. Current slice does not execute refunds or move money. |
| `ProductReview`, `StoreReview` | `src/server/reviews/product-reviews.ts`; review APIs | Verified-purchase review lifecycle and moderation. |
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

This schema snapshot does not yet provide a complete implementation for all 49 systems. Payment provider intents/webhooks/refunds/disputes, payout and double-entry accounting, customs/tax compliance, supplier/procurement, loyalty/promotions, invoices, CMS/legal content, feature flags, webhooks/outbox, logistics/carrier integrations, KYC documents, and the separate property/booking domain require their own reviewed data contracts and workflows. Do not invent models or claim these systems are implemented merely because they appear in the 49-system blueprint.


## Seller order preparation — 2026-11-04

- `VendorOrder`, `VendorOrderStatusHistory`, `Order`, `OrderStatusHistory`, and `AuditLog` are consumed by `src/server/orders/seller-orders.ts` for the initial seller preparation transitions.
- No Prisma change is required for `CONFIRMED → PROCESSING → READY_TO_SHIP`; shipment labels/tracking and later delivery states are not implemented by this slice.

