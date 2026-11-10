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
