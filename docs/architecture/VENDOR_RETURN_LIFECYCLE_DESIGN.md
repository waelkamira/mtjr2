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
