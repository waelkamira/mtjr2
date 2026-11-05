# Phase 4 — Buying Core Implementation Plan

**Project:** Mtjr2 — Global Multi-Vendor Marketplace  
**Blueprint:** `docs/architecture/COMPLETE_PLATFORM_SYSTEMS_BLUEPRINT.md`  
**Canonical data contract:** `prisma/schema.prisma`  
**Status:** In progress — cart, quote/reservation, address, shipping configuration, initial market-tax calculation, transactional order/vendor-order creation, buyer/seller order views, and marketplace coupon calculation are implemented at source level. The coupon migration is applied to the configured local `mtjr2_demo` database; checkout-specific PostgreSQL/browser journey and payment-provider configuration remain pending.

## Objective

Implement the buyer journey as server-owned domain workflows. The browser never determines authoritative prices, stock, totals, reservations, or order state. Each slice connects Prisma persistence, domain service, protected API, buyer UI, focused tests, and recorded evidence.

## 4.1 — Persistent cart foundation

**Implemented and verified.** General CI: [41702592022](https://github.com/waelkamira/mtjr2/actions/runs/41702592022). Disposable PostgreSQL: [41702592323](https://github.com/waelkamira/mtjr2/actions/runs/41702592323).

- Added `GuestSession`, `Cart`, and `CartItem` with ownership, market/currency partitioning, quantity constraints, and migration.
- Guest identity uses an opaque HttpOnly cookie; only its SHA-256 hash is persisted.
- Guest-to-customer cart merge is transactional.
- Added cart read/add/update/remove APIs with server-side market, currency, product, variant, price, and stock validation.
- Connected product detail Add to cart and buyer `/cart` UI to the APIs.

## 4.2 — Checkout quote and inventory reservation

**Implemented and verified.** General CI: [41704221580](https://github.com/waelkamira/mtjr2/actions/runs/41704221580). Disposable PostgreSQL: [41704221517](https://github.com/waelkamira/mtjr2/actions/runs/41704221517).

- Added `CheckoutQuote` and `CheckoutQuoteLine` immutable price/line snapshots.
- Server creates ten-minute quotes and reserves stock atomically across active warehouses belonging to each store.
- Enforced ownership, idempotency, conditional stock updates, and reservation release/expiry.
- Connected cart checkout action and `/checkout` review UI to quote APIs.
- Bounded expiry service exists; scheduled invocation remains an operational follow-up.

## 4.2a — Delivery address capture

**Implemented and verified on PR #3 branch `feat/checkout-address-capture`.** General CI: [41706908024](https://github.com/waelkamira/mtjr2/actions/runs/41706908024). Disposable PostgreSQL: [41706907994](https://github.com/waelkamira/mtjr2/actions/runs/41706907994).

- Added `UserAddress` and quote-owned `CheckoutQuoteAddress` snapshot models with migration `20261103210000_checkout_address_capture`.
- Added authenticated customer address-book APIs and quote-scoped address read/write APIs.
- Guest buyers can provide a one-time address; authenticated buyers can select or save addresses.
- Server derives the destination country from the quote's market and rejects cross-country saved addresses/client overrides.
- Connected checkout delivery-address UI to the APIs.
- Fixed quote reads and idempotent replays to include the saved delivery-address snapshot; without this, a page reload could lose the address in the quote response.
- Address data does not alter item subtotal. Shipping and tax are not guessed or calculated yet.

## 4.3 — Store shipping configuration and checkout options

**Implemented on `feat/store-shipping-options`; verification pending.**

- Added `StoreShippingRate` scoped to store, active market, currency, optional destination region, effective dates, delivery window, and integer minor-unit amount.
- Added `CheckoutShippingSelection` as a quote-owned per-store immutable snapshot. Added `storeId` to `CheckoutQuoteLine` and backfilled it from the variant's product store so multi-vendor shipping cannot cross seller boundaries.
- Added migration `20261103223000_store_shipping_options`; the migration adds constraints for non-negative amounts, delivery-day ranges, effective date ranges, and foreign keys.
- Added seller shipping-rate create/list APIs and connected configuration UI in the seller workspace.
- Added buyer shipping-options read/select APIs and connected the checkout UI. Options are filtered by quote market, currency, destination region, store-market activation, and effective dates.
- No carrier integration, country list, tax, final order total, or default shipping amount is assumed. Unconfigured stores return no shipping options.

**Verification:** Disposable PostgreSQL migration/integration passed (run 41708370004). General CI (run 41708369901) found a BigInt literal target mismatch, fixed in 59a5155; focused shipping tests were added in 2667857. Awaiting a fresh full General CI run; do not mark complete until it passes.

## 4.4 — Market tax configuration and quote calculation

**First tax slice implemented on `feat/checkout-tax-calculation`; verification pending.**

- Added `MarketTaxRate` for explicit platform-managed market and optional destination-region rates, inclusive/exclusive treatment, shipping applicability, priority, and effective dates.
- Added `CheckoutTaxSnapshot` to persist the selected rule and calculated amount against the owned quote.
- Added protected platform configuration API `GET/POST /api/admin/tax-rates` and admin UI at `/admin/tax-rates`.
- Added quote tax calculation API `POST /api/checkout/quote/[quoteId]/tax` and connected buyer checkout tax/estimated-total UI.
- Calculation uses integer minor units and basis points. Region-specific rules take precedence over market-wide rules. No configured rule means no tax is guessed; checkout reports that configuration is missing.
- Current first slice applies one market/region rule to the coupon-discounted quote subtotal and optionally shipping. Product/category exemptions, multiple tax jurisdictions, VAT registration/nexus, and compound taxes remain future jurisdiction-specific work. Do not treat this generic rule engine as legal tax advice or a complete tax-compliance engine.

## 4.5 — Order creation and vendor split

**Initial implementation completed on `feat/order-vendor-order-creation`; verification pending.**

- Added canonical `Order`, `OrderAddress`, `VendorOrder`, `OrderItem`, `OrderStatusHistory`, and `VendorOrderStatusHistory` models, plus `OrderStatus` and `VendorOrderStatus` enums.
- Added migration `20261103233000_order_vendor_order_creation`, including sale inventory movement type and database checks for owner, money totals, and item quantities.
- Added `POST /api/checkout/quote/[quoteId]/place-order`. It requires the owned active quote, address, one shipping selection per seller, and a persisted tax snapshot.
- Order creation is one serializable transaction: creates the parent order and one vendor order per store, copies immutable delivery/item/price/shipping/tax snapshots, consumes stock reservations and on-hand inventory, records SALE movements, converts the quote, and closes the cart.
- Added idempotent replay by quote: a converted quote returns its existing order rather than creating a duplicate.
- Connected buyer checkout confirmation to the order API; added buyer order confirmation/detail and authenticated order-history views.
- Added the first in-app notification slice: order placement atomically notifies the signed-in buyer and each store owner; notifications are listed and marked read through authenticated APIs and `/notifications`. Email and notification preferences remain separate work.
- Added store-scoped seller order listing API and seller orders UI. Staff access requires the exact `orders:manage` store permission; store owners and platform admins can view their allowed orders.
- Orders remain `PENDING_PAYMENT`. No payment is captured and sellers are not authorized to fulfill until a real payment provider and verified webhook lifecycle exist.

## 4.5a — Marketplace coupon calculation

**Implemented at source level; migration/runtime verification pending.**

- Added `Coupon` and `CouponRedemption` models with migration `20261104235500_checkout_coupons`.
- Supports marketplace-wide percentage coupons (basis points, any active currency) and fixed-amount coupons (bound to an active currency), optional start/end times, active state, and an optional total-redemption cap. Coupon stacking and store-specific sponsorship are intentionally excluded.
- Added audited platform-admin `GET/POST /api/admin/coupons` and `PATCH /api/admin/coupons/[couponId]`; requires `users:manage`.
- Added a coupon field to each cart. Checkout creation normalizes the code, checks eligibility, server-calculates discount on merchandise subtotal, snapshots the coupon and discount, and continues to reserve inventory transactionally.
- Tax uses the discounted taxable base. Order placement splits coupon discount and tax across vendor orders, records one redemption, and includes all writes in the serializable order transaction. Retry after a recognized unique/serialization conflict returns the already-created order.
- Focused tests cover coupon validation, currency mismatch, redemption cap, tax arithmetic, seller allocation, and order retry. Migration `20261104235500_checkout_coupons` was applied to the local `mtjr2_demo` database with user approval; verify the checkout journey before considering this slice release-ready.

## 4.6 — Provider-neutral payment lifecycle foundation

The provider-neutral foundation is implemented on a clean branch based on current `main`; it is not considered complete until exact-head CI and disposable PostgreSQL checks pass.

- Canonical `PaymentStatus`, `Payment`, and `PaymentWebhookEvent` models with a forward-only migration.
- Owner-scoped payment intent creation bound to the exact order total and currency, protected by idempotency and order-level advisory locking.
- Provider adapter contract requires idempotent intent creation and cryptographic webhook verification. No provider is registered by default.
- Webhook events are normalized, validated, hashed, and deduplicated. Invalid signatures/payloads return 4xx; unexpected processing failures return retryable 5xx responses.
- Only verified success events may confirm parent/vendor orders, and order history, audit, and notifications are committed in the same transaction.
- Buyer order detail exposes configured providers and explains safely when no provider is configured. No live payment is simulated.
- Concrete provider/market approval, refunds, disputes, settlement reconciliation, and operational monitoring remain incomplete.


## Invariants and test policy

1. `prisma/schema.prisma` is the canonical source of truth; migrations are forward-only.
2. UI → API → auth/validation → domain service → Prisma. No Prisma in React components.
3. Server resolves current price, market, stock, and eligibility.
4. Money uses integer minor units; serialize BigInt as strings.
5. Money/order/inventory writes use transactions and idempotency.
6. Do not access the owner's database, run production migrations, or change Vercel environment variables.
7. Keep verification focused: General CI plus one disposable PostgreSQL migration/integration workflow per schema slice. Add tests only for demonstrated critical regressions.

## Current handoff

- PR #1 cart and PR #2 quote/reservations are stacked predecessors.
- PR #3 delivery address is implemented and its General CI/PostgreSQL workflows pass; it remains a draft stacked on PR #2 pending review/merge.
- The next technical gate is fresh exact-head General CI plus disposable PostgreSQL verification for the reconstructed payment branch, followed by focused buyer checkout/order and order-tracking journey reviews. A concrete provider may be enabled only after launch-market, currency, merchant-account, and payment-method decisions are approved. Refunds/disputes remain separate follow-up slices.



## Exact-head audit — 2026-11-04

- Audited PR #15 head `56e51199e604fab5ed14921b38ac6f9030fac0e9` before continuing implementation.
- Disposable PostgreSQL workflow [41745430005](https://github.com/waelkamira/mtjr2/actions/runs/41745430005) passed: Prisma validate/generate, committed migration deployment, baseline role/permission seed, and the existing PostgreSQL integration suite all succeeded on that head.
- General CI [41745430118](https://github.com/waelkamira/mtjr2/actions/runs/41745430118) failed in the unit suite: 25 test files passed and one failed (116/117 tests). The failure was the delivery-address test fixture missing mocks for the existing shipping-selection and tax-snapshot invalidation calls; Prisma validate/generate, typecheck and lint had passed, while build was skipped after the test failure.
- Corrected the focused fixture on the follow-up commit by mocking and asserting both invalidations. This is a test-contract correction; it does not change application runtime or Prisma schema. A fresh General CI result for the follow-up head is required before claiming the fix verified.
- No migration was applied to the owner's database and no production configuration was accessed.

**Next gate:** obtain a passing General CI on the corrected head, then review the buyer checkout/order journey against the current browser/API states. Payment provider implementation remains conditional on owner-approved launch markets, currencies, merchant account and payment methods. Until those decisions exist, do not choose a provider, create provider-specific schema, simulate payment success, or enable fulfillment for pending-payment orders.


## 4.7 — Seller order preparation (System 15 initial slice)

**Implemented on `feat/seller-order-processing`; verification pending.**

- Added a store-scoped seller status mutation at `PATCH /api/seller/orders/[vendorOrderId]/status` and connected actions to the seller orders page.
- The only enabled transitions are `CONFIRMED → PROCESSING → READY_TO_SHIP`. The first transition is available only after a verified payment webhook has confirmed the vendor order; unpaid orders remain locked.
- The server derives the store from the vendor-order record, checks active seller/store status, and authorizes the store owner, exact store-scoped `orders:manage` staff, or a global `orders:manage` administrator.
- Vendor-order status, status history, parent-order processing state/history, and audit event are written in one serializable transaction with compare-and-set protection against stale or concurrent updates.
- Repeating the current target status is idempotent. The seller cannot change another store's order or regress a status.
- **No Prisma schema change:** `VendorOrderStatus`, `VendorOrderStatusHistory`, `OrderStatus`, `OrderStatusHistory`, and `AuditLog` already cover this bounded workflow.
<<<<<<< HEAD
- Shipment creation, carrier labels/tracking, shipped/delivered transitions, cancellation, and refunds remain disabled until their own policy/provider and inventory/payment reversal rules are implemented. No shipment or delivery success is simulated.
=======
- Manual seller-entered dispatch and buyer-visible tracking details are implemented on `feat/shipment-tracking-current-main` (PR pending). This records seller-supplied carrier/tracking metadata; it is not a carrier API integration, label purchase, live tracking feed, proof of delivery, cancellation, or refund. Exact-head CI and disposable PostgreSQL verification are required before treating this slice as verified.



## 4.7 — Manual seller dispatch and buyer tracking

**Implemented on `feat/shipment-tracking-current-main`; exact-head verification pending.**

- Added `Shipment` as a one-to-one record for a vendor order, with carrier name, tracking number, optional HTTPS tracking URL, dispatch timestamp and creator.
- Added forward-only migration `20261105130000_manual_shipment_tracking`; database checks reject empty carrier/tracking values and non-HTTPS tracking URLs.
- Added `POST /api/seller/orders/[vendorOrderId]/shipment` and `createSellerShipment`. The service resolves the active seller/store from the vendor order, requires owner or exact store-scoped `orders:manage`/global permission, accepts only `READY_TO_SHIP`, creates the shipment, transitions the vendor order to `SHIPPED`, updates the parent order's aggregate fulfillment state, writes status history and audit in one serializable transaction.
- An identical retry returns the existing shipment without creating a duplicate. Changed tracking details are not silently overwritten by this endpoint.
- Connected `/seller/orders` dispatch inputs to the endpoint and displays buyer tracking details on the order detail page. All order serializers include the shipment snapshot after reload.
- No live carrier API, label purchase, carrier event webhook, delivery confirmation, proof of delivery, returns routing or refund behavior is implemented. Tracking link is seller-supplied and must be HTTPS.
- Added focused seller dispatch tests for successful transition/audit, invalid tracking URL, cross-store staff denial and idempotent replay.

**Verification gate:** General CI and disposable PostgreSQL migration/integration must pass on the exact new branch head. The older PR #26 check result is not transferable because its base was stale and the migration timestamp collided with the payment migration already on main.


## Fulfillment aggregation correction — 2026-11-05

- Corrected parent-order fulfillment aggregation after manual dispatch: cancelled vendor orders are terminal and excluded from the set of vendor orders that must be shipped/delivered before the parent becomes FULFILLED.
- A parent remains PARTIALLY_FULFILLED while at least one non-cancelled vendor order remains undispatched. If all non-cancelled vendor orders are SHIPPED/DELIVERED, the parent becomes FULFILLED even when another vendor order was cancelled.
- Added focused regression tests for both mixed cancelled/dispatched and still-active undispatched multi-vendor cases.
- No Prisma change: the existing VendorOrderStatus.CANCELLED enum and OrderStatus fulfillment states already represent this rule.
- Verification is pending exact-head General CI and disposable PostgreSQL integration for the correction branch.


## 2026-11-05 — Store-scoped return decisions

- Added `ReturnItemStatus` plus item-level review note, reviewer and timestamp fields. Existing rows default safely to `REQUESTED` through the forward-only migration `20261105140000_store_scoped_return_decisions`.
- Seller decisions are restricted to pending return lines whose order item belongs to the selected active store. Store ownership or an exact delegated `orders:manage` grant is checked server-side; the client-supplied store ID is never trusted without reauthorization.
- Parent return status remains `REQUESTED` while any line is awaiting a store decision; it becomes `REJECTED` only when every line is rejected, and `APPROVED` once all lines have a non-rejected decision and at least one is approved. Platform review synchronizes item statuses.
- Customer and seller screens display per-item decisions. Rejected line quantities are released for a future return request.
- Seller approval/rejection does not confirm physical receipt, restock inventory, or initiate a refund. Those remain separate workflows; no provider refund is claimed.
- Verification is pending exact-head General CI and PostgreSQL Integration.


### Store-scoped return permission correction (2026-11-05)
- Seller return decisions require `returns:manage` at the exact STORE scope; `orders:manage` alone no longer authorizes a return decision.
- SELLER and STORE_MANAGER role capability sets include `returns:manage`; actual staff authority still requires an active membership and a matching scoped grant.
- No Prisma schema or migration change is required.


### Seller return receipt and inventory quarantine (2026-11-05)
- Physical receipt is a seller/store-scoped operation. The receiving actor must own the active store or hold an active membership with the exact-store `returns:manage` permission; the selected warehouse must belong to that same active store.
- Only that store's `APPROVED` return lines are received. Rejected and pending lines remain unchanged; the parent request stays pending while another store still has undecided lines.
- Added `Inventory.quantityQuarantined` and `InventoryMovement.quarantinedDelta` plus `RETURN_RECEIPT`. Receipt creates a deterministic per-return-item movement and increases quarantined quantity while leaving `quantityOnHand` and sellable availability unchanged.
- Inventory movement, quarantine balance, item state, parent aggregation, and audit record commit in one serializable transaction. A repeated completed receipt is an idempotent no-op.
- Seller returns UI requires a warehouse selection and displays quarantine separately in inventory. Admin approval/rejection no longer provides a bypass that could mark items received without a stock record.
- This is physical receipt only. Inspection/release from quarantine, restock/disposal decisions, and payment refunds remain separate workflows.
>>>>>>> origin/main
