# Vercel deployment — Phase 2 exit checklist

Vercel is the selected application hosting platform for Mtjr2. This document records the production setup required to finish Phase 2. It does not claim that a Vercel project, production database, secrets, or domain have already been connected.

## 1. Required services

- A Vercel project connected to `waelkamira/mtjr2`, deploying the `main` branch.
- A managed PostgreSQL 16+ database reachable from Vercel.
- A Resend account with a verified sending domain/address.

## 2. Vercel project settings

- Framework preset: Next.js (auto-detected).
- Root directory: repository root.
- Node.js runtime: 22.x or a compatible version satisfying `package.json` (`>=22`).
- Build command: `npm run build`.
- Install command: `npm install`.
- Do not add a custom output directory.
- Configure all production variables in Vercel Project → Settings → Environment Variables. Keep secrets out of Git.

## 3. Environment variables

Set these for Production (and Preview only when using isolated preview resources):

| Variable | Required value |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string for the production database. Use the provider's runtime-compatible connection string. |
| `NEXT_PUBLIC_APP_URL` | Exact canonical HTTPS production URL, with no trailing slash. |
| `AUTH_SECRET` | Random secret of at least 32 characters; generate a unique value for each environment. |
| `RESEND_API_KEY` | Resend API key with permission to send from the verified domain. |
| `RESEND_FROM_EMAIL` | Sender address verified by Resend, e.g. `Mtjr2 <no-reply@example.com>`. |
| `TRUSTED_PROXY_IP_HEADER` | Set to `x-vercel-forwarded-for` only after confirming the deployed request path is exclusively through Vercel and the origin cannot be reached directly. |

Never use the example values from `.env.example` in production. Do not expose `AUTH_SECRET`, database credentials, or the Resend key as `NEXT_PUBLIC_*` variables.

## 4. Database migration

Before sending production traffic, apply committed migrations to the production database using the repository script:

```bash
npm ci
npx prisma generate
npm run db:deploy
```

Run `db:deploy` from a trusted deployment/operations environment with the production `DATABASE_URL`. Do not run `prisma migrate dev` against production. Confirm the migration completes before enabling public identity flows.

## 5. Trusted client IP boundary

The application intentionally does not trust arbitrary `X-Forwarded-For`. Configure `TRUSTED_PROXY_IP_HEADER=x-vercel-forwarded-for` only after verifying:

1. Production requests arrive through Vercel's edge.
2. The selected header is supplied/overwritten by the trusted edge, not accepted unchanged from an untrusted client.
3. There is no public direct-origin path that bypasses the edge.

If any condition is uncertain, leave the variable unset. IP-dependent public identity endpoints must remain fail-closed until this boundary is verified.

## 6. Minimum production verification — one journey

After deployment and DNS/HTTPS are ready, perform exactly one controlled journey using a dedicated test account and mailbox:

1. Register a new account and confirm the verification email arrives.
2. Open the verification action and confirm the account becomes active.
3. Log in and confirm `GET /api/auth/me` returns the authenticated user.
4. Log out.
5. Repeat `GET /api/auth/me` and confirm anonymous access is denied.

Also confirm the Vercel deployment is healthy and review its runtime logs for errors during this journey. Do not record tokens, passwords, cookies, or secret values in the build log.

## 7. Phase 2 closure evidence

Record the following in `docs/implementation/BUILD_LOG.md` only after they actually pass:

- Vercel production deployment URL and deployment identifier.
- Migration deployment result.
- Resend delivery smoke-test result (no secret values).
- Trusted proxy/origin-bypass verification.
- The single HTTP journey result and date.

Until these operational checks pass, Phase 2 is implementation-complete and CI-verified but not operationally closed. Phase 3 (Marketplace Core) remains gated by the single HTTP journey.
