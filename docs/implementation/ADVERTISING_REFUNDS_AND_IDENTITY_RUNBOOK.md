# Advertising, refunds, and identity operations

## Sponsored advertising lifecycle

1. A seller creates a campaign for an active store and an approved product.
2. The campaign must target an active market and enabled store-market/currency pair.
3. The seller supplies a total budget, daily budget, and CPC bid. The server validates positive amounts and enforces daily budget <= total budget and CPC <= daily budget.
4. An administrator with the advertising moderation permission approves or rejects the submitted campaign.
5. Only an approved campaign can be activated, and only inside its approved schedule.
6. Sponsored placements are rendered in product discovery, search, category discovery, and product detail.
7. Impression and click events are signed, time-limited, rate-limited, and idempotent. Impressions are counted without a charge; valid clicks create CPC spend ledger entries.
8. Delivery stops when campaign schedule, total budget, or daily budget limits are reached.

## Advertising invoicing

- Monthly invoices are generated for each store/currency/month from recorded advertising spend.
- Invoice generation is idempotent for the store, currency, and billing period.
- The scheduled workflow calls the protected `/api/cron/advertising-invoices` endpoint with a Bearer `CRON_SECRET`.
- Configure GitHub Actions repository secrets `APP_URL` and `CRON_SECRET` before relying on the monthly schedule. `CRON_SECRET` must be at least 32 characters.
- Invoice settlement is deliberately a manual finance action: an authorized administrator records an external payment reference only after confirming payment outside Matjar. This implementation does not initiate a card/bank charge or call a payment provider.

## Manual return refunds

- A refund can be requested only after the return workflow marks the return request as received and exactly one captured payment is identified.
- The service reserves the refundable balance across pending and completed refunds, uses serializable transactions and an order-scoped advisory lock, and uses a deterministic idempotency key per return request.
- Refund amounts are allocated to received return items from the order-item line totals. Shipping and tax are not automatically included.
- The finance operator completes the refund only after issuing it outside Matjar, then records a unique external reference. Completion updates the payment to partially refunded or refunded without allowing a later/replayed payment-success webhook to erase that state.
- No automated provider refund is claimed by this manual workflow.

## Account session security

- The account session page lists active sessions and allows the signed-in user to revoke all sessions.
- The operation requires an authenticated session that passes the current identity/MFA policy, validates the same-origin mutation boundary, revokes every active session for that user, writes an audit event, and clears the current browser cookie.

## Environment and deployment gates

- Preview deployments use Vercel's unique `VERCEL_URL` as the preview `APP_URL` only when `VERCEL_ENV=preview`. Production still requires an explicit stable `APP_URL` or `NEXT_PUBLIC_APP_URL`.
- Configure a dedicated production `AUTH_SECRET` (32+ characters) before production deployment. The preview-only secret must not be reused in production.
- Configure a production stable URL and the required database, mail, MFA-encryption, OAuth, and payment-provider settings before enabling those integrations.
- Do not treat a successful CI build as a production smoke test. Production deployment, live provider payment/refund calls, and external credential validation require the relevant production secrets and an explicit release window.

## Google OAuth and registration policy

- Google ID tokens are verified locally against Google's published RS256 JWKS; issuer, audience/authorized party, expiry, issued-at, verified email, and the one-time OAuth nonce are checked before linking or creating an account.
- OAuth state comparison uses a constant-time comparison. Existing linked Google identities can sign in under the existing public-registration policy.
- Customer registration receives the seeded GLOBAL CUSTOMER role. Seller registration creates a PENDING seller application and does not grant seller-management permissions before approval.
