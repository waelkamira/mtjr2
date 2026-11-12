# Phase 6 — Financial integrity execution plan

**Systems:** 19, 29–32, 42; payment/order interfaces shared with System 04/05.  
**Status:** Partial foundations only; no live payment, settlement or payout readiness is implied.

## Objective
Make every monetary movement explainable, idempotent, auditable and reconcilable from order intent through provider settlement, refund, seller payable and payout.

## Work packages
1. Payment lifecycle contract: provider-neutral intents, authorization/capture/void/refund, signed webhooks, deduplication and provider reconciliation. Phase 4 owns checkout entry and order state; Phase 6 owns financial integrity.
2. Commission engine: versioned commission policy, immutable calculation snapshot, seller/platform allocation and adjustments.
3. Double-entry ledger: chart of accounts, journal, balanced debit/credit postings, currency partition, immutable posted entries and controlled reversals.
4. Seller finance: payable balance, reserves/holds, negative balances, fees, adjustments and statement history.
5. Payouts: verified beneficiary, eligibility, approval/dual control, idempotent payout request, provider status and failure/reversal handling.
6. Refunds/disputes: partial/full refund allocation across vendor orders, provider outcome, ledger posting, dispute evidence and chargeback lifecycle.
7. Invoices/credit notes: legally approved numbering/content per market, immutable snapshots and cancellation/correction flows.
8. Reconciliation: provider transactions ↔ platform payment records ↔ ledger ↔ bank/settlement statements; unmatched items become actionable cases.

## Non-negotiable invariants
- Never mark a payment successful from browser input or a synchronous redirect alone; require verified provider evidence.
- Store money as integer minor units with explicit ISO currency and minor-unit precision.
- Ledger entries balance per journal/currency; posted entries are not silently edited/deleted.
- Use transactions, unique idempotency keys, concurrency-safe state transitions and audit events.
- Separate payment provider status from order, vendor-order, refund, payout and ledger status.
- High-risk refunds/payouts require limits, re-authentication and dual approval policy.

## P0 acceptance
- Duplicate/out-of-order webhook deliveries do not duplicate capture, refund or ledger posting.
- Invalid signatures and replayed events are rejected/audited.
- Partial multi-vendor refund produces correct per-vendor allocations and balanced journal entries.
- Concurrent payout attempts cannot spend the same payable balance twice.
- Reconciliation exposes unmatched/late/duplicate provider records without fabricating success.

## Exit criteria
Disposable PostgreSQL integration proves accounting invariants, idempotency, rollback and concurrency. Provider sandbox tests pass for the selected approved provider. Production credentials, bank rails, tax treatment and merchant approval remain explicit launch gates.


## 2026-11-10 — Provider refund implementation status
- Source implementation: Stripe and PayPal partial/full refund adapters, original-payment identity checks, deterministic provider idempotency, persisted provider-pending/failure states, finance execution and provider status refresh are present.
- Financial integrity safeguards: refund reservations include pending, processing, failed and completed refunds; order-scoped serializable transactions prevent aggregate refunds from exceeding the captured payment. Payment state changes only after provider-confirmed completion or explicit manual external-reference confirmation.
- Not yet verified: migration deployment, PostgreSQL concurrency integration, duplicate/retry/pending Sandbox behavior and end-to-end finance browser journey.
- Still blocked by policy: journal account mapping for processor clearing, seller payable, tax, shipping, reserves/holds and refund allocation. The ledger foundation is intentionally not posted to until Finance approves the chart of accounts and recognition policy. High-risk refund dual-approval/reauthentication policy also remains to be finalized; current API permission is `payments:refund`.

- Dual-control implementation: the refund requester cannot execute or manually confirm the same refund; a different authorized finance account is required. This does not replace the still-required MFA step-up and amount-limit policy.

- Provider idempotency retention: first submission time is persisted; automatic retries are blocked after conservative provider-specific retention windows (Stripe 23 hours, PayPal 44 days), requiring manual provider reconciliation after expiry.

- Provider retry lifecycle: confirmed provider failure clears the old provider reference, increments `Refund.providerAttempt`, and permits a new idempotency key; ambiguous requests retain the same attempt/key and are retried only inside the persisted retention window. Returned references must be reconciled before any new attempt.

## 2026-11-12 — Current implementation checkpoint

- The currency-specific immutable double-entry journal primitive is present in `src/server/finance/ledger.ts`; the admin ledger page/API are read-only and protected by `platform:manage` plus MFA/step-up. Account activity is cursor-paginated. No balances are exposed.
- Journal retries compare the full immutable entry payload; reversals must exactly negate the original lines. The latest append-only database migration restricts line insertion to the parent-entry creation transaction and enforces balance, active-account and same-currency constraints. The latest hardening still requires exact-HEAD CI and disposable PostgreSQL reruns; older passing commits are not evidence for later changes.
- Financial policy resolution now includes category scope in matching, specificity and preview context. This is policy selection plumbing only; it does not approve any accounting treatment.
- Commission category snapshot review: checkout reads only `ProductCategory.isPrimary` rows and persists the chosen category ID/name onto `OrderItem`; the webhook uses those immutable order-item snapshot fields rather than re-reading the live product taxonomy. Checkout category selection now has deterministic `sortOrder` then `categoryId` ordering, so multiple legacy primary rows cannot cause nondeterministic commission scope. This does not replace a database invariant ensuring at most one primary category per product; current seller product creation submits one selected category, while legacy/import paths still warrant a dedicated data audit.
- Payment lifecycle source review: verified webhook processing checks the stored payment amount/currency, records provider event identity with a unique provider/event key, rejects reused event IDs with a different payload hash, and applies payment/order/vendor-order/commission snapshot changes in one serializable transaction guarded by an order advisory lock. Commission snapshots are unique per order item and use the vendor merchandise subtotal less the deterministic vendor-level coupon allocation; the stored line values are separate from vendor shipping and tax fields.
- Refund source review found a mismatch: return refunds previously calculated from pre-discount `OrderItem.lineTotalMinor`, while commission snapshots used the net merchandise base after vendor coupon allocation. This could over-refund merchandise on discounted orders while still remaining below the overall captured payment total. The refund service now reuses `allocateDiscountAcrossLines`, validates item totals against the saved vendor subtotal, and allocates partial/full return refunds from each item's net discounted merchandise amount. Existing committed quantity/value reservations and payment-level caps remain in place.
- Focused regression coverage was added to `tests/payment-refunds.test.ts`: a 3,000-minor-unit line with a 300-minor-unit vendor discount and quantity two yields 1,350 for one returned unit; separate return requests cannot consume the same net value or quantity twice. `tests/admin/commission-policy.test.ts` also covers full discount allocation, invalid discounts and negative line values. Existing payment lifecycle tests cover discounted commission snapshots and webhook state preservation. These tests have not been executed in this session; exact-HEAD CI and disposable PostgreSQL verification remain required.
- Refunds still represent merchandise value only in this flow. Shipping/tax refunds, seller-level refund allocation, commission reversal and journal reversal are not inferred or implemented; they remain blocked on explicit tax/shipping and seller accounting policy decisions.
- The route registry and System 31 specification were corrected to distinguish the current read-only ledger from obsolete baseline notes.
- **Next safe engineering work:** complete exact-HEAD validation of journal/policy changes; then add non-posting read-only diagnostics for ledger integrity only if they can be derived from persisted journal lines without assuming seller allocation policy.
- **Still blocked:** FIN-01..FIN-12 owner decisions and approved per-currency chart-of-accounts mapping. Until those are explicitly approved, do not add capture/refund journal postings, seller payable/available balances, holds/releases, payout requests, transfers or settlement reconciliation.
