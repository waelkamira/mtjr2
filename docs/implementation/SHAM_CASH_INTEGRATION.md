# Sham Cash payment integration

**Status:** Planned — awaiting merchant API approval and official technical documentation.  
**Admin surface:** `/admin/payment-providers`  
**Checkout availability:** Disabled / not registered.

## Current implementation

The payment-provider administration page shows a bilingual Sham Cash readiness panel. It explains that the provider is not yet available at checkout and cannot be activated. No credentials are accepted, no Sham Cash payment records are created, and no callback is trusted at this stage.

This is intentional. The existing provider architecture requires a reviewed, compiled server-side adapter; adding a provider name to a database row is not sufficient to create a safe payment integration.

## Required material from Sham Cash

1. Written merchant approval and API access.
2. Official API documentation and sandbox/production base URLs.
3. Authentication method, credential scopes, token expiry and rotation.
4. Invoice/checkout creation request and response contract.
5. Payment status lookup endpoint and authoritative final statuses.
6. Callback/webhook signature verification, event identifiers, retry policy and replay protection.
7. Supported countries/currencies, amount precision, limits, fees and settlement schedule.
8. Refund/reversal/dispute capabilities and their API contracts, if supported.
9. Sandbox credentials, sample signed events and test scenarios.
10. Production onboarding and support/escalation contacts.

## Implementation plan after approval

- Review the official contract and threat model before writing the adapter.
- Add `sham_cash` to the server-side allowlist only after the adapter exists.
- Validate credentials server-side and store them only in the existing encrypted credential vault.
- Create invoices from persisted Matjar order totals; never accept client-submitted amount or currency as authoritative.
- Bind every provider invoice to one immutable Matjar payment ID and use stable idempotency keys.
- Verify callback signatures using the official algorithm, enforce timestamp/replay bounds, and resolve the exact historical provider configuration.
- Query the provider's authoritative status when required; redirects and uploaded receipts are never payment proof.
- Pass only verified events through `processVerifiedPaymentEvent`, which must continue checking payment reference, exact amount, currency, event uniqueness and allowed state transitions.
- Keep webhook verification operational for in-flight/historical payments even after the provider is disabled.
- Implement refunds only if the official API supports them; otherwise expose the limitation explicitly.
- Add sandbox tests for invalid signatures, replay, duplicates, out-of-order events, mismatched payment IDs, amount/currency mismatch, timeouts and retry safety.
- Complete a database-backed sandbox checkout journey before a separately approved, controlled live verification.

## Activation policy

Sham Cash must remain unavailable in checkout until all of the following are true:

- Official merchant approval and technical documentation have been received and reviewed.
- The adapter, credential validation, webhook verification and reconciliation are implemented.
- Sandbox tests and a full Matjar order/payment journey pass.
- The platform owner explicitly approves production activation.

Never activate a placeholder configuration or mark a payment successful based on a screenshot, manually entered transfer number, client redirect or unverified callback.
