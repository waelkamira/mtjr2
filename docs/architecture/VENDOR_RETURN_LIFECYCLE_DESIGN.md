# Vendor Return Lifecycle — Design Decision

**Date:** 2026-11-04  
**Branch:** `feat/vendor-return-lifecycle-design` (stacked on PR #16)  
**Status:** Design approved for implementation planning; no schema or runtime changes in this slice.

## Problem

A customer `ReturnRequest` can contain `ReturnItem` rows for multiple `VendorOrder` records, while `ReturnRequest.status` is a single global status. Seller decisions or receipt updates against that parent row would therefore let one store's action affect every other store in the request. The current seller returns page is intentionally read-only.

## Canonical model direction

Add a per-store case, tentatively `VendorReturn`, with:
- `returnRequestId` → parent customer request;
- `vendorOrderId` → exactly one store order;
- a dedicated `VendorReturnStatus` (do not reuse `ReturnRequestStatus`);
- requested/reviewed/received/inspected/closed timestamps and actor references only where the corresponding transition is actually implemented;
- unique `(returnRequestId, vendorOrderId)`, plus indexes for `(vendorOrderId, status, createdAt)` and `(returnRequestId, status)`.

Add `VendorReturnItem` as the association between a vendor case and the existing `ReturnItem` rows. Enforce one case assignment per `ReturnItem` with a unique constraint. The service must verify, inside the transaction, that every assigned ReturnItem belongs to the same parent ReturnRequest and that its OrderItem belongs to the case's VendorOrder. Never trust a client-supplied store/vendor-order identifier as authorization.

Reuse the existing `AuditLog`; record each state transition with actor, resource, exact STORE scope, from/to state and a bounded reason/note. Do not create a second audit subsystem.

## State and actor boundaries

Initial implementation should be deliberately narrow:
- Case creation: generated from a customer's existing ReturnRequest by grouping its ReturnItems by VendorOrder. Must be idempotent under retries and safe for existing requests.
- Seller decision: `REQUESTED → APPROVED | REJECTED`, authorized by active store ownership or a delegated exact-store `returns:manage` grant.
- Seller receipt/inspection actions are **not** included until the return shipping/receipt evidence and policy are specified. A seller must not claim an item was received merely by changing a status.
- Customer cancellation, platform override, shipment tracking, refund calculation/execution and ledger posting remain separate transitions/systems. No refund or money movement is part of this lifecycle slice.

Do not finalize the complete enum or expose transition buttons until the actor for every transition, evidence required, allowed retry, and terminal-state behavior is specified and tested.

## Parent request compatibility

The parent `ReturnRequest` remains the customer-submitted envelope and retains the submitted reason/details. Its single status must not be used as the source of truth for a seller-specific decision. Before implementation, audit and update the customer return center and admin review path:
- customer status must present the set/summary of vendor-case states without implying one store controls another;
- admin review must operate on explicitly selected vendor cases, or be clearly defined as a platform-level override with its own permission and audit event;
- legacy parent status is retained only as a documented compatibility/summary field until a safe migration/backfill and read-path cutover are proven.

## Authorization and API design

- Resolve actor from the verified server session.
- Derive allowed store IDs server-side; seller mutations require exact-store `returns:manage`, not the broader `orders:manage`.
- Resolve the VendorReturn and its VendorOrder/store in the same authorized query/transaction. Reject cross-store IDs and inactive stores.
- Use conditional state updates (`where: { id, status: expected }`) and a transaction containing state update + AuditLog. A stale/duplicate action returns a conflict, not success.
- Validate bounded input with strict schemas; require a meaningful rejection reason if the approved policy requires one.
- Return server-confirmed state; client refreshes from the server. No optimistic success.

## Migration and rollout gates

1. Inspect every existing migration and canonical schema before editing; migration must be additive.
2. Add the new models/enum and relations, then generate a migration from the canonical schema. Do not hand-wave a migration or apply it to production.
3. Backfill one VendorReturn per existing ReturnRequest/VendorOrder grouping, assigning each ReturnItem exactly once. Detect and report orphaned/mismatched rows; abort rather than silently dropping or cross-linking data.
4. Add focused PostgreSQL tests for multi-store grouping, idempotent backfill/creation, unique assignment, cross-vendor rejection, store permission isolation, rejected/approved transitions, duplicate/stale transitions and audit atomicity.
5. Cut customer/admin/seller reads over to vendor cases only after backfill verification. Keep old parent-level mutation disabled or explicitly platform-only during the compatibility window.
6. Verify Prisma validate/generate, full migration replay and focused PostgreSQL tests on disposable CI DB. No owner/local/production DB access.

## Explicit exclusions

No shipping label/carrier integration, customer shipment confirmation, receipt evidence upload, return-window policy, seller notifications, payment provider refund, chargeback/dispute, accounting ledger, or production deployment claim. These require their own approved dependencies and end-to-end journeys.



## Implementation preflight findings — 2026-11-04

### Existing schema and migration
- The current returns migration is `20261104040000_returns_workflow`. It creates only `ReturnRequest` and `ReturnItem`; no per-vendor state or return-item vendor-case assignment exists.
- `ReturnRequest` already has `orderId`; `ReturnItem.orderItemId` joins to `OrderItem.vendorOrderId`, which joins to `VendorOrder.storeId`. This is sufficient to build a deterministic one-case-per-(request, vendor order) backfill.
- `ReturnItem` is unique on `(returnRequestId, orderItemId)`, but it is not globally unique by orderItemId. Do not add a global uniqueness constraint: a customer can legitimately make a later request for remaining quantity after a prior case is rejected/cancelled.
- Add a nullable/unique case assignment on VendorReturnItem rather than putting a seller state on ReturnItem itself. The join table should enforce one assignment per ReturnItem while preserving history and parent request semantics.

### Existing authorization model
- `returns:manage` already exists in the Permission seed and is granted to SUPPORT_AGENT, ADMIN and SUPER_ADMIN.
- SELLER and STORE_MANAGER roles currently do not include `returns:manage`. Add it to those role permission sets only as a store-scoped capability; do not grant a GLOBAL seller/staff assignment. Owners may continue to act through verified ownership; delegated staff must have an exact `STORE` assignment and active membership.
- Seller queue currently checks delegated `orders:manage`; switch return operations to exact-store `returns:manage` when the lifecycle mutation is introduced. Keep the read-only queue compatible until the permission migration/seed is ready.

### Legacy status and customer eligibility implications
- Legacy parent statuses include REQUESTED, APPROVED, REJECTED, RECEIVED and CANCELLED. Backfill must map all five explicitly into the vendor-case state vocabulary; never infer a new seller action or actor.
- Historical parent-level review note/reviewer fields are global. Do not copy those private/admin fields to every seller case or expose them in seller views.
- Customer return eligibility currently sums ReturnItem quantities while excluding rows whose *parent* request is REJECTED or CANCELLED. After a vendor-case cutover, this calculation must be per ReturnItem's VendorReturn status; otherwise rejection by one store incorrectly frees/blocks quantities for other stores in the same parent request.
- Customer return center and detail currently display the single parent status. Replace this with per-vendor case summaries only after a verified backfill. Keep a compatibility fallback for requests with no case only during the rollout window.
- Admin PATCH currently mutates the parent request status (including RECEIVED). It must be replaced by a selected-case operation, or retained as an explicitly platform-wide override that has separate semantics and audit metadata. Do not let it silently overwrite all vendor cases.

### Backfill and rollout invariants
1. Group every ReturnRequest's ReturnItems by OrderItem.vendorOrderId and create exactly one VendorReturn per group.
2. Assign every ReturnItem exactly once. Before writes, detect missing OrderItem/VendorOrder, VendorOrder.orderId mismatch with ReturnRequest.orderId, and empty/invalid quantities; fail the migration/backfill with a diagnostic rather than silently skipping.
3. Preserve legacy status per generated case, but do not invent seller actor IDs, seller decision timestamps, or per-store notes from the old parent-level admin fields.
4. Keep legacy parent status untouched during initial backfill. Once all reads and writes use per-vendor cases, define a separate deprecation migration; do not derive parent status by choosing an arbitrary vendor's status.
5. Update the customer remaining-quantity calculation and all admin/customer/seller views in the same cutover plan. Add multi-vendor mixed-status PostgreSQL fixtures proving one store's rejection does not affect another store's quantity or state.

### Branch / PR dependency
- PR #17 is stacked on the earlier PR #16 head `0a72ae0...`; PR #16 has since advanced to `9502340...` after route-registry corrections. GitHub currently reports PR #17 as not mergeable. Do not merge either PR based on stale branch ancestry; rebase/update the stacked branch after PR #16's final review/merge decision.
