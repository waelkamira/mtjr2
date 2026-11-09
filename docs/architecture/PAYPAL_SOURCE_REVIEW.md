# PayPal source repository review

Date: 2026-11-10

## Repositories inspected

- `waelkamira/cartoon` — contains the original PayPal subscription/payment UI and API.
- `waelkamira/cooking-new` — contains a later copy of the same PayPal flow.
- `waelkamira/Akaar` — contains the platform payment-method administration UI and a PayPal placeholder, but PayPal checkout is explicitly disabled pending a verified server-side integration.
- `waelkamira/cartoon_cloudflare_repo12` — does not contain the PayPal implementation previously searched for.
- The linked GitHub repository inventory (235 repositories) was searched for PayPal credential and webhook integration markers. The functional legacy PayPal flow was located in the cartoon/cooking-new family; Akaar has only the disabled provider placeholder.

## Findings in the legacy cartoon flow

Files:
- `cartoon/app/api/paypal/route.js`
- `cartoon/components/paypal/paypalButton.js`
- `cartoon/components/paypal/subscriptionPage.jsx`
- `cartoon/app/payment-success/page.jsx`
- `cartoon/app/api/user/route.js`

The flow creates one-time PayPal Orders v2 payments with fixed USD amounts ($1 or $10), captures the payment in the browser using `actions.order.capture()`, and then updates subscription flags from client-side code. It does not implement a PayPal webhook receiver or server-side verification of the captured payment before granting the subscription.

The cartoon user update endpoint accepts an email address and subscription fields in a public PUT request, then updates the user row by email without authenticating that the caller owns the account. This makes subscription entitlement changes forgeable and must not be copied into Matjar.

The legacy repository also contains a tracked `.env` file with PayPal credentials. Those credentials are considered exposed. They are deliberately not copied, displayed, or used. The owner must revoke/rotate the PayPal REST app secret and remove the tracked environment file; deleting the file from the latest commit alone does not remove it from Git history.

## Findings in cooking-new

The PayPal UI still performs capture and attempts to update subscription status from the browser. Its current `app/api/user/route.js` PUT handler only updates profile fields (`image`, `name`) and ignores the subscription fields sent by the PayPal UI. Therefore this copy is not a working authoritative subscription implementation either.

## Decision for Matjar

Do not port the legacy subscription entitlement logic. Matjar is a marketplace checkout, not the cartoon subscription product. Instead, implement the useful PayPal Orders v2 transport using Matjar's own server-authoritative payment lifecycle:

- server-side credentials stored encrypted in the Super Admin provider vault;
- server-created Orders v2 with a Matjar payment ID in `custom_id` and `reference_id`;
- server-side PayPal order ownership check and capture after buyer approval;
- PayPal webhook postback verification using the configured webhook ID;
- exact amount/currency comparison against the immutable Matjar Payment record;
- order confirmation and accounting only after a verified provider event;
- idempotency and retained encrypted credential snapshots for historical webhook verification.

This replacement is implemented in:
- `src/server/payments/providers/paypal.ts`
- `src/server/payments/payments.ts`
- `src/app/api/payments/paypal/return/route.ts`
- `src/app/api/webhooks/payments/[provider]/route.ts`
- `src/server/admin/payment-providers.ts`

The source subscription prices and durations ($1/month and $10/year) are product-specific to cartoon and were not imported into Matjar.
