# Payment Provider Control Center

## Product contract

The Super Admin owns platform payment-provider configuration. Seller accounts never receive provider secrets and cannot change global payment rails.

Target route: `/admin/payment-providers`
Target API:
- `GET /api/admin/payment-providers`
- `POST /api/admin/payment-providers`
- `PATCH /api/admin/payment-providers/[id]`
- `POST /api/admin/payment-providers/[id]/enable`
- `POST /api/admin/payment-providers/[id]/disable`
- `POST /api/admin/payment-providers/[id]/verify`
- `POST /api/admin/payment-providers/rotate-credentials` (MFA-protected, audited, resumable re-encryption)
- `DELETE /api/admin/payment-providers/[id]` (soft-delete only)

## Provider lifecycle

`DRAFT -> CONFIGURED -> ACTIVE -> DISABLED -> ARCHIVED`

- A provider can be activated only after its required credentials and webhook verification are validated.
- Disabled providers are hidden from new checkout sessions immediately.
- Disabling a provider MUST NOT disable webhook verification or event processing for existing payment records. Historical and in-flight payments must continue to reconcile.
- Deletion is archival, never physical deletion. Archive is blocked while an attempt is INITIATING, REQUIRES_ACTION or PROCESSING, or while unresolved webhook/reconciliation work exists.
- Existing Payment.provider values and provider references remain immutable historical facts.
- Provider keys are stable adapter identifiers (for example `stripe`), not user-supplied executable module names. Adding a provider requires a reviewed server-side adapter implementation; the admin UI only configures adapters already shipped with the application.

## Configuration model

Reuse `Payment`, `PaymentWebhookEvent` and `AuditLog`. `PaymentProviderConfig` is now implemented and related to `Payment`; each new payment stores its provider configuration, environment and encrypted credential snapshot.

Suggested fields:
- `id`, `providerKey`, `displayName`, `environment` (TEST/LIVE), `status` (DRAFT/CONFIGURED/ACTIVE/DISABLED/ARCHIVED)
- `encryptedCredentials` (ciphertext only), `credentialsKeyVersion`, `credentialFingerprint` (non-secret display hint)
- `supportedCurrencies`, `supportedCountries`, `enabledPaymentMethods` (validated JSON or normalized child tables)
- `sortOrder`, `createdById`, `updatedById`, timestamps, `archivedAt`
- Unique constraint on providerKey + environment; indexes on status and sortOrder.

Do not persist raw API keys, webhook secrets, private keys, or cardholder data in plaintext, logs, audit payloads, analytics, or API responses. Do not return ciphertext to the browser.

## Secrets and key management (P0 prerequisite)

- Use authenticated encryption (AES-256-GCM) with a random nonce per write and an explicit key version.
- Master encryption key must be a high-entropy secret injected at runtime (not stored in PostgreSQL, source control, browser code, or the same database backup). Generate a 32-byte key with `openssl rand -hex 32` and set `PAYMENT_PROVIDER_ENCRYPTION_KEY`.
- Support key rotation by version; fail closed if the configured key is missing or invalid.
- Mask secrets in UI; updates must be explicit and blank fields must mean “keep existing secret”, never “clear”.
- Never offer a “reveal secret” action. Show only a non-reversible fingerprint/last few characters where safe.
- Do not implement credential storage until the environment schema, secret bootstrap/rotation runbook, and deployment secret delivery are agreed and documented.

## Authorization and audit

- Every write is Super Admin-only with a dedicated permission (e.g. `payment.providers.manage`); ordinary admin, finance staff, seller and support roles are denied by default.
- Enforce authorization in server-side API/domain services, never only in navigation or UI.
- Require a recent MFA-assured session for enabling LIVE mode, replacing LIVE credentials, and archiving a provider.
- Record actor, provider config ID, action, before/after non-secret fields, reason, request correlation ID and timestamp in existing `AuditLog`.
- Audit payloads must never contain credentials, ciphertext, signatures, access tokens, or full webhook payloads.

## Checkout and webhook behavior

- Checkout discovery returns only ACTIVE configurations matching market country, order currency, environment and payment method.
- The checkout service resolves a configured providerKey to a compiled, allowlisted adapter. It never dynamically imports code or executes configuration values.
- Before calling an adapter, verify the order's currency, country, amount and current payment state server-side.
- Provider requests use idempotency keys, bounded timeouts, strict HTTPS URLs and response validation.
- Webhooks resolve the historical provider configuration/environment needed for the referenced payment. Signature verification remains enabled for disabled/archived providers while any historical payment may send events.
- Event processing checks signature, event uniqueness, amount/currency/reference matching, event ordering and payment state transitions.
- Provider disable/archive cannot invalidate webhook secrets needed to reconcile existing payments. Secret rotation must retain a versioned verification secret until all related attempts are terminal and the retention window has elapsed.

## Admin UI

The provider list should show provider, environment, status, enabled methods, countries/currencies, last verification result, last successful webhook, and updated time. Secrets are always masked.

Actions:
- Add a configured adapter.
- Edit display, markets, currencies, methods and credentials.
- Verify connection (non-charge health/credential check only).
- Enable/disable new checkout.
- Change display order.
- Archive after explicit typed confirmation and server-side in-flight checks.
- Open immutable audit history and related payment attempts.

The UI must have loading, empty, validation, permission-denied, conflict, provider-unavailable and success states. No action may optimistically claim success before the API confirms it.

## Rollout sequence

1. Inventory current adapters, checkout, webhook and admin authorization contracts.
2. Implement encryption/key-version service and runtime env validation.
3. Add migration and repository for PaymentProviderConfig.
4. Implement dedicated Super Admin permission, MFA assurance, audit events and guarded APIs.
5. Refactor provider registry to load enabled configuration while preserving adapter allowlisting and historical webhook verification.
6. Build admin provider management UI and navigation.
7. Add supported-adapter setup guides and operational key-rotation/incident runbook.
8. Only then connect live credentials and enable production payment methods.

## Explicit exclusions

- Do not claim arbitrary new gateways can be added without shipping a reviewed adapter.
- Do not physically delete provider records, historical payment rows, webhook events or audit entries.
- Do not allow disabling a gateway to strand an in-flight checkout or block its signed webhook.
- Do not implement refunds, payouts, settlement or seller balances as a side effect of provider management.
- Do not enable production charging before test-mode verification and a live-mode approval process.

## Current observed baseline

- `Payment` and `PaymentWebhookEvent` exist.
- Stripe and PayPal adapters are compiled and registered from server environment variables. PayPal uses server-side Orders v2 create/capture and PayPal-verified capture webhooks.
- `/admin/payments` is a transaction-inspection page, not a provider-management console.
- `GET /api/payments/providers` exposes currently registered provider keys.
- The persistent provider configuration model, Super Admin management API and bilingual page are now implemented as tranche 1. Provider activation now controls new checkout selection through the database-managed TEST/LIVE configuration. Each new Payment stores its provider configuration relation and an encrypted credential snapshot; webhooks and PayPal return/capture resolve the original snapshot so credential rotation does not invalidate existing payment verification. Legacy payments without snapshots continue through the environment-configured adapter fallback.


## PayPal adapter implementation update — 2026-11-10

- Added the compiled `paypal` adapter at `src/server/payments/providers/paypal.ts` using PayPal REST Orders v2.
- The server creates the order from the persisted Matjar payment amount/currency, redirects the buyer to the validated PayPal approval URL, and captures the approved order server-side through `/api/payments/paypal/return`.
- The return handler records success only after the server receives a capture and the shared payment service validates the exact amount and currency against the stored payment.
- The generic payment webhook route now supports PayPal through the same adapter contract. The adapter verifies the webhook signature with PayPal's `verify-webhook-signature` endpoint and the configured webhook ID before normalizing capture completed/pending/denied events.
- Legacy environment fallback settings: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, and `PAYPAL_MODE=sandbox|live`. New database-managed setups enter credentials in `/admin/payment-providers`; the independent vault key `PAYMENT_PROVIDER_ENCRYPTION_KEY` is required. The adapter implementation is compiled into the server; environment registration is retained only for legacy fallback.
- Configure the PayPal webhook endpoint as `/api/webhooks/payments/paypal` and subscribe to `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.PENDING`, and `PAYMENT.CAPTURE.DENIED`.
- The initial PayPal adapter was environment-configured. It is now also wired to the Super Admin provider control center through the database-managed credential resolver and payment snapshots.
- Sandbox credentials and webhook setup are still required before checkout can expose PayPal. No live transaction or credential verification was performed.


## Provider configuration center — implementation tranche 1

- Added `PaymentProviderConfig`, `PaymentProviderEnvironment` and `PaymentProviderConfigStatus` with a forward-only PostgreSQL migration at `prisma/migrations/20261110120000_payment_provider_control_center`.
- Added a dedicated `payment.providers.manage` permission to the identity seed; the service requires both this permission and the global Super Admin `platform:manage` gate, which enforces the platform MFA step-up policy.
- Added AES-256-GCM credential encryption with a fresh 96-bit nonce and authentication tag per write. The 32-byte master key is supplied as `PAYMENT_PROVIDER_ENCRYPTION_KEY` (64 hexadecimal characters), never stored in the database. API responses expose only a one-way credential fingerprint and configured/not-configured state.
- Added server-side create, metadata/credential update, non-charge connection verification, enable/disable state changes and soft-archive operations. All changes create AuditLog entries without secret values. Archive blocks while the provider has in-flight payment attempts or unprocessed webhook events.
- Added the Super Admin page at `/admin/payment-providers`, bilingual controls, navigation entry, add/edit forms, masked credential display, verification, enable/disable and archive actions.
- Runtime binding is now implemented in the second tranche: active database configurations drive new checkout selection; Payment records retain encrypted provider credential snapshots and historical webhook/PayPal return handlers resolve those snapshots. Legacy payments without snapshots retain the environment fallback.
- At the time of the initial runtime tranche, master-key rotation was outstanding; it is now implemented as a multi-version key ring with an audited batch re-encryption action. Payment-to-config snapshots, country/currency filtering and historical webhook routing are implemented for new payments.


## Provider runtime binding — implementation tranche 2

- The Stripe and PayPal adapters accept credentials supplied by the server-side payment resolver. Database-managed records are authoritative for their provider/environment; a disabled or unconfigured managed record cannot silently fall back to environment credentials for new payments.
- New payment attempts are bound to PaymentProviderConfig and retain the encrypted credentials snapshot and TEST/LIVE environment used at creation. Updating provider credentials does not overwrite the snapshot held by existing payments.
- New checkout selection enforces the configured currency allowlist and country allowlist. If a country allowlist is present but the order has no known country, the provider is rejected.
- The generic webhook route finds the payment by provider reference or provider metadata, then verifies with that payment's snapshot. The PayPal return/capture route also uses the snapshot. Legacy payments without snapshots continue to use the legacy environment configuration.
- Disabling a provider blocks new attempts while an existing attempt with a stored snapshot can still resume and its webhook can still be verified. Public provider discovery is no-store to avoid stale enabled-provider lists.
- Remaining: database migration application and owner-side sandbox/live journey verification. No tests or builds were run in this tranche.


## Versioned credential encryption and rotation

- AES-256-GCM envelopes are versioned (`vN`) and every provider config/payment snapshot stores the matching key version.
- Legacy `PAYMENT_PROVIDER_ENCRYPTION_KEY` remains supported as version 1. For rotation, configure `PAYMENT_PROVIDER_ENCRYPTION_KEYS` as a JSON object mapping integer versions to 64-hex-character keys, set `PAYMENT_PROVIDER_ENCRYPTION_KEY_VERSION` to the active version, and retain every older key in the key ring.
- The Super Admin page exposes an audited re-encryption operation. It migrates provider configurations and historical payment snapshots in bounded batches, uses conditional updates to avoid overwriting concurrent changes, and reports remaining rows. It is safe to rerun after an interruption.
- Do not remove an older key until the operation reports both remaining counts as zero and a separate backup/recovery plan is confirmed. Restoring an old database backup also requires restoring the corresponding historical key material.
- No migration is required for key rotation; the key version is already persisted in both models. Key material must never be committed to source control or stored in database backups.


## Key rotation operations

The vault supports multiple simultaneous key versions. Keep the old version in the key ring while selecting a new active version; then use the Super Admin page's **Re-encrypt with active key** action. It updates provider configuration secrets and historical payment snapshots in batches, audits the counts, and is repeatable if interrupted. Only remove a retired key after both remaining counts are zero and backups/restore points no longer require it. Existing `PAYMENT_PROVIDER_ENCRYPTION_KEY` is treated as version 1 for backward compatibility.


- The payment snapshot columns have a database-level all-or-none CHECK constraint to prevent partial credential snapshots. The rotation operation fails closed on malformed snapshots and processes bounded, resumable batches (up to 100 rows per table per request).
- The compiled adapters currently enforce only their supported payment methods: Stripe `card`, PayPal `paypal`. Unsupported method names are rejected when configuration is saved.
- Checkout discovery is market-aware: restricted providers are hidden when the current order country/currency is missing or unsupported, and the server independently enforces the same rules when creating a payment.


- Webhook delivery handling distinguishes permanent malformed/invalid-signature payloads (4xx) from provider API, encryption-key and database outages (503/5xx with retry guidance). This prevents a temporary PayPal verification outage or missing historical key from being acknowledged as a permanently invalid webhook.
