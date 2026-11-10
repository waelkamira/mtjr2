# Seller payout destinations

## Current scope

Seller owners can save a bank payout destination for future settlement. The current implementation is a secure destination registry only; it does not calculate seller payable balances, initiate transfers, or claim that a bank account is verified.

New records are always created as `PENDING_VERIFICATION`. No seller-facing or public API can set `VERIFIED`. A future verification workflow must be authorized, audited, and backed by a bank/provider ownership check before any payout execution is connected.

## Data protection

- Account identifiers, account-holder names, and optional routing codes are encrypted together with AES-256-GCM.
- The database stores a fixed placeholder instead of the account-holder name in plaintext; the authenticated seller API decrypts it only for that seller.
- The browser receives only the account type and last four characters, plus non-secret bank metadata.
- A seller-scoped HMAC fingerprint prevents duplicate registration for the same seller and settlement currency without storing a searchable plaintext account identifier.
- Fingerprint derivation is pinned to key version 1. Keep that key available for as long as any payout destination exists, including after active encryption-key rotation.
- Never log account identifiers, routing codes, encryption envelopes, or key material.
- Encryption keys must be stored outside PostgreSQL and source control.

## Ownership and defaults

Every read or mutation resolves the authenticated seller from the session and verifies an active seller account. A seller cannot address another seller's payout destination by ID.

A seller may register the same bank destination for more than one settlement currency, and may keep one default destination per currency. Database unique and partial unique indexes enforce these invariants even under concurrent requests. Disabling a destination clears its encrypted payload and removes its default status.

## Validation and verification

IBANs are checked for supported country-specific length, country prefix, and MOD-97 checksum. Local bank account entry is deliberately disabled until country-specific account and routing rules are implemented. Format validation is not proof of account ownership.

Before transfers are enabled, implement and audit:
1. Country- and rail-specific bank-detail validation for local account formats before enabling them.
2. Ownership verification (for example, provider verification or an approved micro-deposit flow).
3. A privileged verification/rejection workflow with actor, evidence reference, timestamps, and audit trail.
4. Seller payable ledger postings, holds, settlement schedule, payout approval, idempotent transfer submission, webhook verification, and reconciliation.
5. A rule that only a verified destination may receive a payout.

Until those controls exist, no withdrawal or transfer API should be exposed.
