# PayPal integration — source review and Matjar implementation

**Source repository:** [waelkamira/cartoon](https://github.com/waelkamira/cartoon)  
**Source files reviewed:**
- `app/api/paypal/route.js`
- `components/paypal/paypalButton.js`
- `components/paypal/subscriptionPage.jsx`
- `app/payment-success/page.jsx`
- `app/api/user/route.js`
- `components/paypal/subscribedOrNot.jsx`

## Findings in Cartoon

The Cartoon implementation was useful for identifying the original PayPal Checkout flow and the monthly/yearly subscription choices, but it is not safe to transplant unchanged:

1. The create-order endpoint accepts the plan and payer email from the browser and derives the price from that untrusted plan value.
2. The browser captures the order through the JavaScript SDK. The application does not independently verify the capture server-side before granting access.
3. The payment-success component updates subscription fields through a general user-update endpoint. That endpoint accepts an email address and subscription fields from the request without binding the update to an authenticated user and verified PayPal capture.
4. The subscription-page markup is currently commented out, so the UI is not an active end-to-end payment journey in this revision.
5. The repository contains an environment file with credential-like values committed to source control. Treat any actual secret values in that file as exposed: revoke/rotate them with the relevant providers and remove the tracked secret file/history through a carefully reviewed cleanup. Do not copy those values into Matjar.

The Cartoon subscription amounts ($1 monthly / $10 yearly) are specific to that media site's business model and are not used for Matjar marketplace order pricing.

## Matjar implementation

Added to `main`:

- `src/server/payments/providers/paypal.ts` — server-only PayPal adapter using OAuth client credentials, Orders v2 order creation/capture, currency-minor-unit conversion, approval URL validation, and PayPal webhook signature verification.
- `src/app/api/payments/paypal/return/route.ts` — server-side approval return and capture flow. It resolves the PayPal order against the stored payment reference and passes the verified capture into the shared payment lifecycle.
- `src/lib/env.ts` — validates the complete PayPal environment configuration as an all-or-none set.
- `src/server/payments/providers/registry.ts` — registers PayPal only when credentials and webhook ID are configured.
- `.env.example` — documents the server-only settings and required webhook events.

No Prisma schema change was needed. The implementation reuses the existing owner-scoped payment intent service, `Payment`, `PaymentWebhookEvent`, and verified event processor. The generic checkout UI already discovers compiled providers through `GET /api/payments/providers`.

## Configuration required before use

Set these values in the server runtime environment (never in browser-exposed `NEXT_PUBLIC_*` variables):

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_MODE=sandbox` initially; use `live` only after a separately approved live rollout.

Register the webhook endpoint:

`https://YOUR_MATJAR_HOST/api/webhooks/payments/paypal`

Subscribe to:
- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.PENDING`
- `PAYMENT.CAPTURE.DENIED`

## Explicitly not claimed

- No sandbox or live credentials were supplied or verified.
- No live charge was attempted.
- No tests, builds, typechecks or browser checks were run, consistent with the current instruction to defer validation.
- The Super Admin payment-provider management center (persistent provider records, encrypted credential editing, enable/disable/archive, market/currency policy and audit UI) is still separate work.
- Refund execution, disputes, settlement and reconciliation are not added by this adapter.
