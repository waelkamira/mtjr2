# Seller payout foundation — implementation contract

> This document defines the safe implementation boundary for seller bank details and payouts. It does not claim that payout APIs, bank verification, or bank transfers are live.

## Current verified baseline

- `CommissionTransaction` stores immutable commission snapshots created from verified payment success.
- `/seller/commissions` and `/seller/finance` are read-only views. Refund totals are shown separately; they are not silently netted into a seller balance.
- `LedgerAccount`, `JournalEntry`, and `JournalLine` plus `postJournalEntry` provide a currency-specific, immutable double-entry journal primitive. The database enforces append-only journal rows, balanced debit/credit totals, and account/journal currency equality.
- The journal primitive intentionally does not determine when a seller becomes payable or how commissions, refunds, disputes, shipping, taxes, reserves, and chargebacks affect the seller liability.
- No payout method, withdrawable balance, payout request, transfer execution, or reconciliation workflow is currently verified.

## Bank payout method security contract

A future `PayoutMethod` record must be seller-owned and must never be addressable by a client-supplied seller ID. The seller identity must be resolved from the authenticated server session and `Seller.ownerId`.

Required data policy:

1. Store only the minimum bank details required by the selected payout rail and jurisdiction.
2. Encrypt account-holder name and account/routing identifiers at application level using authenticated encryption (AES-256-GCM), a dedicated key derived from a dedicated environment secret, a versioned AAD context, and a random 96-bit IV per encryption.
3. Persist ciphertext, IV, authentication tag, key version, provider/country/rail, currency, masked display suffix, and non-sensitive verification state. Never persist plaintext bank identifiers.
4. Never return ciphertext, full account identifiers, encryption metadata, or raw provider tokens to the browser. Return only masked identifiers and safe metadata.
5. Never log request bodies, bank identifiers, ciphertext, provider secrets, or full payout payloads. Audit events record actor, method ID, action, timestamp, and non-sensitive reason only.
6. Require recent step-up authentication for add, replace, verify, disable, and payout destination changes. MFA enrollment/verification errors must be handled explicitly.
7. New or changed payout destinations enter a pending verification state. They cannot receive a payout until the selected provider or documented manual process verifies ownership.
8. Prevent removal or replacement while a payout is processing; retain immutable references to the exact payout destination snapshot used for every payout.
9. Apply CSRF/origin validation, strict Zod schemas, request-size limits, rate limits, idempotency keys, and owner-only authorization.
10. Key rotation must support decrypting the old key version and re-encrypting records without exposing plaintext outside the server process.

## Payout and accounting invariants

- A payout request is a state transition, not a client-side balance subtraction.
- Available balance must be derived from posted ledger entries and explicit holds/reserves in the same currency. Never derive it by subtracting commission/refund UI totals.
- A payout request reserves funds atomically with a unique idempotency key and a serializable transaction; concurrent requests must not spend the same funds.
- Payout lifecycle must distinguish at least requested, approved, processing, paid, failed, rejected, and cancelled outcomes, with controlled transitions and an immutable history.
- Every provider submission must use a stable idempotency key and persist provider reference/status before retry. A timeout must not create a second transfer.
- A paid payout must be posted to the ledger exactly once and reconciled against provider settlement evidence. A failed payout releases its reservation exactly once; it must not erase history.
- Corrections use reversals and compensating entries. Posted journal rows are never updated or deleted.
- Currency is immutable per payout. No cross-currency netting or implicit conversion is permitted.
- Admin approval, manual payment confirmation, destination changes, and payout failure resolution require actor identity, reason, audit trail, and appropriate permissions.

## Required policy decisions before calculating withdrawable balance

These are business-owner decisions, not implementation guesses:

- When seller payable is recognized: payment capture, dispatch, delivery, or after a return window.
- Whether a reserve/rolling hold applies, its duration, and how disputes/chargebacks extend it.
- Who owns shipping charges, taxes, discounts, and provider fees in each market.
- How refunds and partial refunds reverse seller payable and commission allocations.
- Minimum/maximum payout, payout frequency, supported currencies/markets, and payout fees.
- Negative seller balances, debt recovery, and seller suspension treatment.
- Which payout providers and bank rails are actually supported in each seller country.
- Whether payouts are automatic or manually approved and which role may approve/reconcile them.

Until these are approved and implemented, the seller UI must not display an available-to-withdraw amount or enable a real withdrawal.

## Required implementation sequence

1. Add payout-method schema, encrypted storage service, migration, safe DTOs, owner-only APIs, audit, and step-up verification.
2. Add account/currency bootstrap and source-specific double-entry postings for captured payment, seller payable release, refunds, disputes, and chargebacks according to the approved policy.
3. Add immutable seller ledger statements and pending/held/available calculations derived only from posted entries and holds.
4. Add payout request reservation, approval, provider adapter, idempotent execution, settlement reconciliation, and reversal/release paths.
5. Add seller pages for payout methods, balance breakdown, payout history, and statement detail.
6. Add XLSX exports for store profile, products, inventory, orders, and financial statements. Export only the authenticated seller's authorized store scope; stream bounded datasets, preserve currency/minor-unit values, and audit exports.
7. Verify API authorization, duplicate submissions, concurrent payout reservation, idempotent retries, key rotation, masked responses, audit redaction, and database invariants before enabling payouts.

## Excel export contract

- Use a real `.xlsx` workbook, not a renamed CSV file.
- Export is generated server-side from authorized database queries, not from client-supplied rows.
- Include an export timestamp, store identifier, currency code, and explicit amount units in each financial sheet.
- Store money as exact integer minor units and provide a human-readable formatted column; never use floating-point arithmetic for financial totals.
- Neutralize spreadsheet formula injection for untrusted text cells beginning with `=`, `+`, `-`, or `@`.
- Apply bounded row limits and cursor pagination; large exports should be queued rather than held in a single long request.
- Do not include private customer information unless the export's purpose, permission, and data minimization rules explicitly allow it.
