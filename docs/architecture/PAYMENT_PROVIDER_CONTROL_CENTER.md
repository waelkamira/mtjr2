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

Reuse `Payment`, `PaymentWebhookEvent` and `AuditLog`. Add one `PaymentProviderConfig` model after the encryption and authorization contracts below are implemented.

Suggested fields:
- `id`, `providerKey`, `displayName`, `environment` (TEST/LIVE), `status` (DRAFT/CONFIGURED/ACTIVE/DISABLED/ARCHIVED)
- `encryptedCredentials` (ciphertext only), `credentialsKeyVersion`, `credentialFingerprint` (non-secret display hint)
- `supportedCurrencies`, `supportedCountries`, `enabledPaymentMethods` (validated JSON or normalized child tables)
- `sortOrder`, `createdById`, `updatedById`, timestamps, `archivedAt`
- Unique constraint on providerKey + environment; indexes on status and sortOrder.

Do not persist raw API keys, webhook secrets, private keys, or cardholder data in plaintext, logs, audit payloads, analytics, or API responses. Do not return ciphertext to the browser.

## Secrets and key management (P0 prerequisite)

- Use authenticated encryption (AES-256-GCM) with a random nonce per write and an explicit key version.
- Master encryption key must be a high-entropy secret injected at runtime (not stored in PostgreSQL, source control, browser code, or the same database backup).
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
- No persistent provider configuration model or provider-management API was found during this review. Provider activation is still environment-driven; the Super Admin control center remains unimplemented.


## PayPal adapter implementation update — 2026-11-10

- Added the compiled `paypal` adapter at `src/server/payments/providers/paypal.ts` using PayPal REST Orders v2.
- The server creates the order from the persisted Matjar payment amount/currency, redirects the buyer to the validated PayPal approval URL, and captures the approved order server-side through `/api/payments/paypal/return`.
- The return handler records success only after the server receives a capture and the shared payment service validates the exact amount and currency against the stored payment.
- The generic payment webhook route now supports PayPal through the same adapter contract. The adapter verifies the webhook signature with PayPal's `verify-webhook-signature` endpoint and the configured webhook ID before normalizing capture completed/pending/denied events.
- Required server-only settings: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, and `PAYPAL_MODE=sandbox|live`. The adapter is registered only when all three credentials/identifiers are present.
- Configure the PayPal webhook endpoint as `/api/webhooks/payments/paypal` and subscribe to `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.PENDING`, and `PAYMENT.CAPTURE.DENIED`.
- This is an environment-configured adapter, not the Super Admin provider control center. No persistent provider config model, credential encryption UI, enable/disable/archive controls, or market-specific provider policy was added.
- Sandbox credentials and webhook setup are still required before checkout can expose PayPal. No live transaction or credential verification was performed.


## Provider configuration center — implementation tranche 1

- Added `PaymentProviderConfig`, `PaymentProviderEnvironment` and `PaymentProviderConfigStatus` with a forward-only PostgreSQL migration at `prisma/migrations/20261110120000_payment_provider_control_center`.
- Added a dedicated `payment.providers.manage` permission to the identity seed; the service requires both this permission and the global Super Admin `platform:manage` gate, which enforces the platform MFA step-up policy.
- Added AES-256-GCM credential encryption with a fresh 96-bit nonce and authentication tag per write. The 32-byte master key is supplied as `PAYMENT_PROVIDER_ENCRYPTION_KEY` (64 hexadecimal characters), never stored in the database. API responses expose only a one-way credential fingerprint and configured/not-configured state.
- Added server-side create, metadata/credential update, non-charge connection verification, enable/disable state changes and soft-archive operations. All changes create AuditLog entries without secret values. Archive blocks while the provider has in-flight payment attempts or unprocessed webhook events.
- Added the Super Admin page at `/admin/payment-providers`, bilingual controls, navigation entry, add/edit forms, masked credential display, verification, enable/disable and archive actions.
- Important runtime boundary: this tranche persists and manages configuration records, but the checkout provider registry still reads its existing server environment configuration. Database records do not yet drive checkout selection or historical webhook credential resolution. The UI states this explicitly; do not treat an ACTIVE record as a live checkout switch until the runtime integration phase is complete.
- Key rotation, payment-to-config environment snapshots, per-market runtime filtering and historical multi-configuration webhook resolution remain prerequisites before replacing the environment-based provider registry.
