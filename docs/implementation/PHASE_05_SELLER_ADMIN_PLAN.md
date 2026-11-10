# Phase 5 — Seller operations and administration execution plan

**Systems:** 12–18, 20–28, 34, 38 (admin operational surfaces only; customer trust ownership remains Phase 7).  
**Status:** Partial implementation exists; exact end-to-end acceptance is still required.

**Seller portal sub-slice (2026-11-09):** the current seller navigation/workspace surfaces were verified on main at a5bb22e212973be2f14c7c2fc8d7383ba7948a16. See the closeout evidence in PAGE_ROUTE_REGISTRY.md, END_TO_END_JOURNEY_MATRIX.md and BUILD_LOG.md. This does not close Phase 5 as a whole: procurement, the broader admin command center, and least-privilege staff-role design remain separate work packages. Seller payout execution remains Phase 6.


## Objective
Enable approved sellers and authorized staff to operate stores, products, stock, procurement, orders and fulfillment, while platform administrators review and govern these workflows with least privilege.

## Work packages
1. Seller onboarding operations: application state, required evidence, review decisions, rejection reasons, re-submission and audit.
2. Store lifecycle: profile/settings, market eligibility, store status, staff invitations, acceptance, revocation and exact STORE-scoped permissions.
3. Catalog operations: product draft/edit/submit, moderation queue, approval/rejection, publication and immutable public eligibility checks.
4. Inventory and warehouse operations: warehouse lifecycle, stock adjustment, movement ledger, transfers, stock count/reconciliation and reservation handoff to checkout.
5. Procurement: supplier records, purchase orders, receiving and stock movements; do not count a supplier record alone as procurement.
6. Seller order operations: vendor-order queues, allowed state transitions, packing, shipment handoff and exception handling.
7. Admin command center: domain-specific queues and actions; root admin must not bypass financial/security invariants; sensitive actions require re-authentication/dual control.
8. Seller analytics: derived from canonical order/catalog/inventory data with clear time zone, currency and permission scope.

## UI-to-database contract
Every action follows UI → route → session/permission/resource-scope check → Zod validation → seller/admin service → repository/Prisma transaction → audit/event → response → refreshed UI. Store IDs and user IDs are resolved/authorized server-side, never trusted from the browser.

## P0 acceptance
- Seller application → admin review → approved seller → store access. Source audit: the application is owner-unique (`Seller.ownerId @unique`), store is seller-unique (`Store.sellerId @unique`), store creation serializes per seller with a PostgreSQL advisory transaction lock, and repeat identical requests are idempotent. UI/API/PostgreSQL end-to-end journey remains pending; do not mark P0 accepted until verified.
- Cross-store reads/writes denied, including delegated staff with wrong/missing scope.
- Product draft → moderation → publish/reject; rejected product never appears in public search.
- Stock adjustment and transfer are transactional, idempotent where retried, and preserve non-negative/reservation invariants.
- Seller receives only their vendor orders; admin action is permission-checked and audited.
- Staff revocation takes effect immediately for subsequent requests.

## Exit criteria
- Each seller/admin workflow has route registry entries and exact action traces.
- PostgreSQL integration proves ownership, scope, uniqueness, state transitions and rollback.
- UI exposes no inert control or fake status.
- Typecheck/lint/build and focused tests pass on exact head.
- External KYC, carrier and supplier integrations remain Conditional until provider contracts/credentials are approved.

## Boundaries
Financial ledger/payout execution belongs to Phase 6. Customer return eligibility and trust moderation belong to Phase 7. Market legal activation belongs to Phase 9.
