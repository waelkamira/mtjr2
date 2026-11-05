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
