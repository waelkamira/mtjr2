# Seller workspace page-by-page audit

Date: 2026-11-10  
Repository: `waelkamira/mtjr2`  
Target branch: `main`

## Scope reviewed

The review covered every seller route currently present in `src/app/seller`, the corresponding feature components, seller-specific API route inventory, the shared seller shell, and the product-location data path. This is a source-level implementation review, not a runtime verification.

| Route | Page / responsibility | Current integration and review notes |
|---|---|---|
| `/seller` | Seller onboarding, workspace overview, store identity, warehouses and delivery setup | Uses seller workspace/store APIs; one-store-per-seller is enforced in the server transaction with an advisory lock and existing-store check. Store details, public phone/address, logo/banner, warehouse and shipping data are editable from the workspace. |
| `/seller/products` | Product drafts, media, categories, attributes, variants, prices, real-estate fields and location | Connected to product APIs, category attributes, markets and media upload. Topbar search query is hydrated into the catalog filter. Location hierarchy and map place search use imported OpenSyria records only. Exact street address is now a separate seller-entered field. |
| `/seller/orders` | Vendor orders, fulfillment status, dispatch and tracking events | Connected to seller order/status/shipment/tracking APIs. Currency formatting follows the active locale. |
| `/seller/inventory` | Warehouses, stock ledger, adjustments, counts, quarantine and transfers | Connected to warehouse, inventory, stock-count, adjustment, quarantine and transfer APIs. Quantity actions are guarded by required selections and busy states. |
| `/seller/shipping` | Store delivery services and rate management | Connected to shipping-rate APIs; store/market selection and rate editing are present. |
| `/seller/returns` | Return review, decision and warehouse receipt | Connected to seller returns APIs; approval/rejection and receipt actions are guarded by action state and warehouse availability. |
| `/seller/messages` | Store inbox and customer replies | Connected to store-scoped message APIs. Added explicit inbox/conversation loading, send-busy state, stale-thread protection, and visible send/refresh errors. |
| `/seller/questions` | Product Q&A, answer submission/editing, revision history and analytics | Connected to seller questions and answer APIs. Reworked the compressed component, localized status/chart/date labels, and added history loading and action feedback. |
| `/seller/reviews` | Customer reviews, media and public seller responses | Connected to seller review/response APIs. Localized chart labels/dates/statuses, required a non-empty response, and normalized the card surface. |
| `/seller/advertising` | Campaign creation, targeting, budgets, lifecycle and invoices | Connected to campaign and invoice APIs. Campaign budget/click-cost fields use currency minor-unit conversion; campaign lifecycle actions refresh server data. |
| `/seller/finance` | Read-only store financial overview | Reuses recorded commission and completed-refund data. It explicitly does not represent those figures as a payable or withdrawable balance. |
| `/seller/commissions` | Commission snapshots, refund allocations and CSV | Read-only statements based on immutable commission snapshots and completed refund item allocations. Refunds remain separately displayed. |
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

The seller bank-destination page `/seller/payouts` and owner-scoped `/api/seller/payout-methods` routes now exist. This is **beneficiary management only**, not a payout/withdrawal workflow:

- Active seller owner can create an IBAN destination, list masked destinations, set a per-currency default and disable a destination. Full account identifiers are encrypted at rest; responses expose only the last four characters.
- IBAN country prefix and MOD-97 checksum are validated. Local bank account formats remain disabled until country-specific validation exists.
- New destinations start as `PENDING_VERIFICATION`. The platform admin review page `/admin/seller-payout-methods` records manual external evidence and a reason, requires a separate platform administrator with fresh TOTP step-up, and uses submission-version concurrency protection. This is human attestation, not an automated bank ownership check.
- No `/api/seller/payouts`, withdrawal request, transfer execution, seller payable balance, settlement or bank/provider reconciliation exists. The `SellerPayoutMethod` model is not a `Payout` model.

The accounting journal foundation exists but is not connected to captured payments/refunds to calculate seller payables. FIN-01 through FIN-12 remain owner decisions: settlement timing, reserves/holds, shipping/tax ownership, chargebacks, negative balances, currency/FX and reconciliation must not be inferred. Until approval and implementation, the UI must not invent an available balance or allow withdrawal requests. The existing finance and commission pages correctly remain read-only and show recorded figures separately.

## Changes made during this review

- Removed all active Akaar-derived geography from the application and import pipeline; added a migration to remove the legacy table/relation without losing existing product neighbourhood text.
- Changed map place search to OpenSyria database records and localized returned place labels.
- Added a separate `Product.streetAddress` field and wired it through product creation, draft editing, seller API validation and Prisma.
- Confirmed the existing topbar query hydration and removed a duplicate initial-search effect.
- Synchronized the sidebar's selected-store identity with active-store changes.
- Hardened seller inbox sending/loading/error states.
- Reworked seller Q&A and localized Q&A/review/product/order/status presentation.
- Preserved the existing one-store-per-seller server-side lock and validation.

## Verification boundary

Per the current instruction, no tests, builds, typechecks, browser journeys, or database imports were run. The OpenSyria geography import and Prisma migrations must be applied to the same PostgreSQL database used by the app before the updated location selector can display the new source data.


## Finance and payout scope correction — 2026-11-12

The earlier outstanding-finance paragraph was historical and is superseded by the implementation described above:

- `/seller/payouts` is present for active seller owners and manages encrypted IBAN beneficiary records only. It does not create payout requests or transfer money.
- `/admin/seller-payout-methods` provides a separate manual evidence/reason review with Super Admin permission and fresh TOTP step-up; this is not an automated bank ownership check.
- `/seller/finance` and `/seller/commissions` remain read-only and explicitly do not calculate payable or withdrawable balances.
- `/admin/finance/ledger` is now a read-only platform-admin page for chart-of-account and cursor-paginated journal-line inspection; it is not connected to payment/refund/seller payable events.
- Exact code SHA `c4ec8375bcd5bd1f161eaa8aa28b7569aaa712e0` passed CI, TypeScript, ESLint, full unit suite, production build, Browser E2E (14/14) and CodeQL. The dedicated Super Admin ledger browser journey is included. The seller payout destination page itself is not part of that 14-test browser run and should retain its own route-level verification status.
- FIN-01 through FIN-12 in `docs/finance/SELLER_PAYOUT_POLICY_DECISIONS.md` remain unapproved. No seller payable balance, withdrawal request, transfer execution or settlement/reconciliation is enabled.
