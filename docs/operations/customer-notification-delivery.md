# Customer notification delivery operations

## Channels and consent

- In-app notifications remain enabled by default unless a user disables a specific event type.
- Email preferences default to disabled. A user must explicitly enable at least one email event in `/notifications`; this records a `UserConsent` entry of type `NOTIFICATION_EMAIL`.
- Every email enqueue checks the latest consent and per-event preference. The worker checks both again immediately before sending; withdrawn consent/preferences cancel queued work.
- Only ACTIVE accounts with verified email addresses are eligible for delivery.
- Marketing email consent is separate and is not inferred from transactional notification consent.

## Provider configuration

Configure server-side:
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (a sender/domain verified in Resend)
- `APP_URL`
- `CRON_SECRET` (at least 32 random characters)

Set GitHub repository variable `APP_URL` and repository secret `CRON_SECRET` for the scheduled workflow `.github/workflows/notification-delivery.yml`. The workflow invokes `POST /api/cron/notification-delivery` every five minutes. Missing repository configuration skips the workflow safely.

## Delivery lifecycle

`PENDING → PROCESSING → SENT`; temporary errors move to `RETRY`, and exhausted deliveries move to `FAILED`. A worker lock older than five minutes is reclaimable after a process crash. Retry delays grow exponentially from one minute and cap at six hours, with eight attempts by default. `CANCELLED` means the user withdrew the event preference or email consent before send.

The worker uses a stable Resend idempotency key derived from the outbox row ID. The outbox's unique deduplication key prevents the same event from being enqueued twice. The user-scoped `GET /api/notifications` response includes email delivery history; never expose another user's delivery rows.

## Event coverage and known gap

Connected producers: order placed, seller order received, store message, support reply, support SLA escalation, payment confirmed/failed, password changed, and password reset.

The preference for `SHIPMENT_UPDATED` is present, but there is no Shipment/carrier-tracking model or actual SHIPPED/DELIVERED mutation journey yet. Do not emit shipment notifications from checkout estimates or READY_TO_SHIP alone. Add a producer when carrier handoff/tracking state is implemented.

## Verification boundary

CI/PostgreSQL migration tests validate schema and code. A real provider send still requires verified Resend credentials and a reachable deployed app URL; no live delivery is claimed without those configuration values and a confirmed provider response.
