# Seller Payout Policy — Decisions Required Before Posting Money

**Status:** BLOCKED — policy approval required  
**Owner:** Marketplace business/finance owner  
**Scope:** Seller payable recognition, settlement, refunds, chargebacks and withdrawals  
**Related system:** `docs/systems/19-seller-finance-commissions-and-payouts.md`

This document is a decision register, not an accounting policy. No implementation may infer the choices below from the current commission report or from `VendorOrder.total`.

## Why this gate exists

The current marketplace records order components (subtotal, discount, shipping, tax and total), commission snapshots and completed refund allocations. These are not, by themselves, a seller payable ledger. The double-entry journal foundation exists, but it is intentionally not connected to payment, refund or seller payout events. A displayed sales total must never be treated as withdrawable cash.

## Decisions requiring explicit approval

| ID | Decision | Options that must be selected | Required implementation consequence |
|---|---|---|---|
| FIN-01 | Seller earnings basis | Per-item net merchandise after allocated discounts; or another explicitly defined basis | Deterministic allocation of order discount and item-level seller proceeds |
| FIN-02 | Shipping ownership | Seller-owned; platform-owned; or split by a documented rule | Separate shipping payable/revenue/clearing accounts and refund allocation |
| FIN-03 | Tax ownership and liability | Platform collects/remits; seller is merchant/tax-liable; or jurisdiction-specific responsibility | Tax payable accounts and jurisdiction-aware posting; never count tax as seller earnings by default |
| FIN-04 | Payable recognition trigger | Payment capture; shipment; delivery; or delivery plus return-window expiry | State transition that releases seller payable; idempotent source event |
| FIN-05 | Reserve / hold | None; fixed amount/percentage; risk-tiered; or return-window hold | Per-currency held vs available subledger; release schedule and audit trail |
| FIN-06 | Refunds | Reverse original allocations proportionally; item-specific allocation; shipping/tax policy | Immutable reversal entries linked to original source lines; no editing posted journals |
| FIN-07 | Chargebacks and disputes | Seller liability; platform risk; shared/risk-based allocation | Dispute lifecycle, reserve consumption and negative-balance policy |
| FIN-08 | Negative seller balances | Carry forward; freeze payouts; recover from future earnings; manual review | Explicit debit-balance handling; no silently clamping balances to zero |
| FIN-09 | Payout rail and fees | Supported provider/bank transfer methods, fee payer, minimum and maximum | Provider-specific transfer state machine and fee accounting |
| FIN-10 | Currency / FX | Payout only in source currency; or approved conversion with rate source and timestamp | Currency-specific journals; never net unlike currencies; explicit FX gain/loss |
| FIN-11 | Seller eligibility | Required identity/business verification, account ownership checks and risk gates | Payout eligibility policy and immutable verification/audit events |
| FIN-12 | Settlement cadence | On demand; daily; weekly; monthly; jurisdiction/provider constraints | Settlement batching, cutoff, reconciliation and retry rules |

Every selected policy must state its effective date, applicable countries/currencies, exception handling and approver. If a choice varies by jurisdiction, define the jurisdiction rule rather than selecting a global default.

## Non-negotiable technical invariants

1. Use integer minor units or Prisma Decimal with explicit currency; never JavaScript floating point for money.
2. Journal entries are immutable and balanced per currency. Corrections use linked reversal entries only.
3. Every source posting has a unique idempotency key and a stable source reference. A retry must return the original posting, not duplicate it.
4. A payout request reserves available seller payable atomically. Concurrent requests cannot reserve the same funds.
5. A payout is not complete when requested or submitted. It becomes paid only after provider/bank confirmation is recorded and reconciled.
6. Provider callbacks are signature-verified, replay-safe and state-transition checked.
7. Store ownership, seller identity, currency and payout-method ownership are verified server-side on every operation.
8. Bank account details are encrypted at rest, masked in responses and never logged. Verification state is separate from account creation.
9. A failed transfer releases or retains the reservation according to an explicit recoverable state; it must never silently erase the payable.
10. Every manual adjustment requires a reason, actor, permission and audit event; no direct balance editing.
11. Refunds and chargebacks reference the original captured payment and seller allocation. Do not post a second independent refund amount from an aggregate report.
12. Cross-currency balances are never combined into one withdrawable number.

## Implementation sequence after approval

1. Publish the approved policy and chart-of-accounts codes, including per-currency bootstrap.
2. Add deterministic allocation functions for merchandise, discount, shipping and tax, with boundary tests.
3. Add source-specific journal posting for capture, payable release, refund, chargeback, reserve/hold and release.
4. Add per-seller, per-store and per-currency statements derived from posted journal lines.
5. Add payout-method ownership verification and provider-specific validation.
6. Add withdrawal reservation, approval, submission, webhook confirmation, failure recovery and reconciliation.
7. Expose available, held, pending and paid amounts separately in seller UI; expose review queues and audit history to authorized finance staff.
8. Verify P0 scenarios against PostgreSQL: duplicate webhook, concurrent withdrawal, partial refund, full refund, chargeback after payout, failed transfer, cross-store order and unauthorized seller access.

## Release gate

Do not enable seller withdrawal, display an available-to-withdraw amount, or claim the payout system is operational until all policy decisions above are approved, the relevant migrations and journal posting paths are implemented, and the P0 database/integration tests pass.

## Current implementation boundary

- Existing seller finance overview and commission/refund reports are informational records only.
- Existing double-entry journal is an internal primitive and is not yet connected to marketplace payment/refund flows.
- Encrypted seller payout-method management is implemented for owner-managed IBAN beneficiary records only; all new methods remain PENDING_VERIFICATION until a separate Super Admin records manual external evidence and a reason. This manual attestation is not an automated bank ownership check. No withdrawal request, transfer execution or settlement path exists.
- Seller payable balances, holds, settlement, withdrawal requests and bank/provider reconciliation are not implemented.
- This decision register does not approve any accounting treatment.


## Jurisdiction-aware policy design

The cross-domain rule-selection design, scope precedence, immutable rule-version requirements, and fail-closed evaluation outcomes are documented in [JURISDICTION_AWARE_FINANCIAL_POLICY_ENGINE.md](./JURISDICTION_AWARE_FINANCIAL_POLICY_ENGINE.md). This design does not approve any FIN-01 through FIN-12 accounting or payout decision.
