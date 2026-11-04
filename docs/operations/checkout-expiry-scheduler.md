# Checkout expiry scheduler (Vercel Hobby)

## Purpose

The checkout quote holds inventory for 10 minutes. The protected endpoint
`GET /api/cron/checkout-expiry` expires due quotes and releases their active
inventory reservations in a bounded, transactional batch (maximum 500).

Vercel Hobby does not support the previous every-minute Vercel Cron expression.
Do not restore that expression unless the project plan changes.

## External scheduler

Use a scheduler that supports HTTPS requests with custom headers. The documented
free service cron-job.org supports custom headers and a minimum interval of one
minute; configure this job every **5 minutes**.

- Method: `GET`
- URL: `https://mtjr2-git-feat-returns-workflow-waelkamiras-projects.vercel.app/api/cron/checkout-expiry`
- Schedule: every 5 minutes
- Custom header name: `Authorization`
- Custom header value: `Bearer <the exact CRON_SECRET configured for this Vercel Preview environment>`
- Request body: none
- Enable execution-failure notifications.

The branch alias above was reported by Vercel for this project's
`feat/returns-workflow` branch. If the alias changes, replace it with the
current Preview deployment URL for the same branch.

## Secret setup

1. Generate a fresh random secret locally (do not send it in chat or commit it):
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
2. Add that value as `CRON_SECRET` in Vercel **Preview** environment variables
   for project `mtjr2`, then redeploy the branch Preview.
3. Enter the same value in cron-job.org's custom `Authorization` header over
   its HTTPS dashboard. Never put the value in the job URL, repository files,
   GitHub issues, or logs.
4. Run the job once manually after Preview is READY. A successful response is
   HTTP 200 with JSON containing `expiredQuotes` and `processedAt`.
   HTTP 401 means the header/secret does not match; HTTP 503 means
   `CRON_SECRET` is not configured in the deployed environment.

## Operational notes

- The route rejects requests without the exact Bearer token.
- The cleanup is idempotent for already expired/released quotes and processes
  at most 100 quotes per invocation by default.
- A 5-minute schedule bounds normal cleanup delay after quote expiry, subject
  to external scheduler delays and Preview availability.
- cron-job.org documents support for arbitrary custom headers and HTTPS, but
  it does not guarantee exact punctuality. Monitor its execution history and
  enable failure notifications.
- This setup is for the feature-branch Preview only. Configure Production
  separately only after an explicit production-release decision.
