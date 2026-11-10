# Seller workspace page-by-page audit

Date: 2026-11-10  
Repository: `waelkamira/mtjr2`  
Target branch: `main`

## Scope reviewed

The review covered every seller route currently present in `src/app/seller`, the corresponding feature components, seller-specific API route inventory, the shared seller shell, and the product-location data path. This is a source-level implementation review, not a runtime verification.

| Route | Page / responsibility | Current integration and review notes |
|---|---|---|
| `/seller` | Seller onboarding, workspace overview, store identity, warehouses and delivery setup | Uses seller workspace/store APIs; one-store-per-seller is enforced in the server transaction with an advisory lock and existing-store check. Store details, public phone/address, logo/banner, warehouse and shipping data are editable from the workspace. Dashboard sales/order charts now support 7-, 30- and 90-day ranges through the existing date-filtered analytics API. |
| `/seller/products` | Product drafts, media, categories, attributes, variants, prices, real-estate fields and location | Connected to product APIs, category attributes, markets and media upload. Topbar search query is hydrated into the catalog filter. Location hierarchy and map place search use imported OpenSyria records only. Exact street address is now a separate seller-entered field. |
| `/seller/orders` | Vendor orders, fulfillment status, dispatch and tracking events | Connected to seller order/status/shipment/tracking APIs. Currency formatting follows the active locale. |
| `/seller/inventory` | Warehouses, stock ledger, adjustments, counts, quarantine and transfers | Connected to warehouse, inventory, stock-count, adjustment, quarantine and transfer APIs. Quantity actions are guarded by required selections and busy states. |
| `/seller/shipping` | Store delivery services and rate management | Connected to shipping-rate APIs; store/market selection and rate editing are present. |
| `/seller/returns` | Return review, decision and warehouse receipt | Connected to seller returns APIs; approval/rejection and receipt actions are guarded by action state and warehouse availability. |
| `/seller/messages` | Store inbox and customer replies | Connected to store-scoped message APIs. Added explicit inbox/conversation loading, send-busy state, stale-thread protection, and visible send/refresh errors. |
| `/seller/questions` | Product Q&A, answer submission/editing, revision history and analytics | Connected to seller questions and answer APIs. Reworked the compressed component, localized status/chart/date labels, and added history loading and action feedback. |
| `/seller/reviews` | Customer reviews, media and public seller responses | Connected to seller review/response APIs. Localized chart labels/dates/statuses, required a non-empty response, and normalized the card surface. |
| `/seller/advertising` | Campaign creation, targeting, budgets, lifecycle and invoices | Connected to campaign and invoice APIs. Campaign budget/click-cost fields use currency minor-unit conversion; campaign lifecycle actions refresh server data. |
| `/seller/finance` | Read-only store financial overview | Reuses recorded commission and completed-refund data. It explicitly does not represent those figures as a payable or withdrawable balance. The selected store follows the shared active-store preference and broadcasts changes to the seller workspace/sidebar. |
| `/seller/commissions` | Commission snapshots, refund allocations and CSV | Read-only statements based on immutable commission snapshots and completed refund item allocations. Refunds remain separately displayed. |\n| `/seller/payouts` | Bank destination management | Owner-only IBAN/local bank account entry, masked listing, default selection and soft disable; AES-256-GCM encryption, keyed duplicate fingerprint and audit events. New destinations remain pending verification; transfers are not implemented. |
| `/seller/staff` | Store team and invitations | Connected to store staff/invitation APIs; active-store selection is synchronized with the shared sidebar. |
| `/seller/settings` | Seller profile and shortcuts to store operations/settings | Connected to seller profile API; store-specific operational settings remain linked to their existing workspace/shipping flows. |
| Shared shell | Desktop sidebar, mobile navigation, topbar, loading/error states | All current seller routes are represented in navigation. Sidebar store identity now refreshes when the active store changes in the same tab or another tab. Topbar product search is connected to the product filter. |

## Geographic source decision

- Sole structured geographic source: [OpenSyria Data Geography v0.1.5](https://github.com/Open-Syria/data-geography/tree/v0.1.5), licensed CC BY 4.0.
- Expected pinned coverage: 14 governorates, 62 districts, 272 subdistricts and 7,605 localities.
- The Akaar-derived neighbourhood JSON/importer and runtime import command were removed. The legacy Prisma model and product relation are removed by a follow-up migration; existing product neighbourhood labels are copied to the seller-editable text field before the legacy table is dropped.
- OpenSyria v0.1.5 does not publish a separate verified neighbourhood directory. The neighbourhood label and exact street address are therefore seller-entered text; they are not fabricated or presented as official administrative units.
- Map place search now searches the imported OpenSyria database records (governorates, districts, subdistricts and localities). Users can refine street-level accuracy with the map pin and exact-address field.

## Outstanding seller-finance scope

A seller bank-destination management page and API now exist on this feature branch (`/seller/payouts`, `/api/seller/payout-methods`, `SellerPayoutMethod`). There is still no payout request/withdrawal API, `Payout` model, verification workflow, seller payable ledger balance or transfer/reconciliation pipeline.

This is not a UI-only omission. The accounting journal foundation exists, but it is not connected to captured payments/refunds to calculate seller payables. Settlement timing, reserves/holds, shipping/tax ownership, chargebacks, negative balances and reconciliation policy are not approved. Until those policies are implemented, the UI must not invent an available balance or allow withdrawal requests. The existing finance and commission pages correctly remain read-only and separate recorded figures.

## Changes made during this review

- Removed all active Akaar-derived geography from the application and import pipeline; added a migration to remove the legacy table/relation without losing existing product neighbourhood text.
- Changed map place search to OpenSyria database records and localized returned place labels.
- Added a separate `Product.streetAddress` field and wired it through product creation, draft editing, seller API validation and Prisma.
- Confirmed the existing topbar query hydration and removed a duplicate initial-search effect.
- Synchronized the sidebar's selected-store identity with active-store changes.
- Synchronized the seller finance page with the same active-store preference; selecting a store in finance updates the shared workspace selection, and changing the store elsewhere updates finance.
- Added 7/30/90-day range controls to seller performance charts using the existing server-validated analytics date range (maximum 90 days); no schema change was required.
- Hardened seller inbox sending/loading/error states.
- Reworked seller Q&A and localized Q&A/review/product/order/status presentation.
- Preserved the existing one-store-per-seller server-side lock and validation.

## Verification boundary

Per the current instruction, no tests, builds, typechecks, browser journeys, or database imports were run. The OpenSyria geography import and Prisma migrations must be applied to the same PostgreSQL database used by the app before the updated location selector can display the new source data.


## Store data export
- Added a one-click Excel-compatible workbook export to the seller performance header. The workbook contains separate sheets for store profile/shipping/policies, selected-period analytics and sales by currency, order-status and daily-sales breakdowns, top products, currently loaded inventory, and the recent orders already available in the workspace.
- Export is generated in the browser from the selected store's already-authorized workspace data; it is not uploaded to a third-party conversion service. The button is disabled while analytics are loading or unavailable.
- The current workbook uses Excel 2003 XML (.xls) for a dependency-free multi-sheet export. It is not an Office Open XML .xlsx package. Product catalog full export, full historical order pagination, and commission/refund detail export remain separate follow-up scope.
