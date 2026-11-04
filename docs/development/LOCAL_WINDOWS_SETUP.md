# Local development — Windows / PowerShell

This guide starts the real Mtjr2 Next.js application against a separate local PostgreSQL database populated with the repository's 80 demo products. It does not require Vercel, production credentials, Supabase, Cloudinary, OpenAI, or EmailJS.

## 1. Prerequisites

- Windows 10/11 with PowerShell 7 (Windows PowerShell also works).
- Node.js 22 or newer and npm.
- PostgreSQL 16 or newer running locally.
- Git.

From the repository folder:

```powershell
node --version
npm --version
psql --version
```

## 2. Clone or update the correct repository

```powershell
git clone https://github.com/waelkamira/mtjr2.git
cd mtjr2
git pull origin main
```

If the repository is already on your computer, open PowerShell in its folder and run `git pull origin main`.

## 3. Create an isolated demo database

Create a database named exactly `mtjr2_demo` (or another local database name containing `demo`).

Using PostgreSQL command-line tools:

```powershell
createdb -U postgres mtjr2_demo
```

Alternatively, create `mtjr2_demo` from pgAdmin. Do not point this setup at a production, shared, or personal working database.

## 4. Create the local environment file

```powershell
Copy-Item .env.example .env
notepad .env
```

In `.env`:
- Replace `YOUR_LOCAL_PASSWORD` in both database URLs with your local PostgreSQL password.
- Replace `AUTH_SECRET` with a random value generated locally. For example:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

- Keep `DATABASE_URL` and `DEMO_DATABASE_URL` pointed to the same isolated `mtjr2_demo` database for this local demo.
- Keep `SEED_DEMO_CATALOG=true` and `ALLOW_DEMO_CATALOG_SEED=true`.
- Leave Resend and Google credentials blank if you only want to browse the storefront. Do not paste production keys into this file.
- Keep `PUBLIC_REGISTRATION_ENABLED=false`; registration stays disabled while the policy documents are development drafts.

The `.env` file is ignored by Git. Never commit it.

## 5. Install, migrate, and load the catalog

Run these commands from the repository root:

```powershell
npm install
npx prisma generate
npm run db:deploy
npm run db:seed
```

The demo seed is guarded: it refuses production, requires both explicit opt-in flags, and checks that the database name contains a demo/test/dev marker. It does not create fake orders, payments, or customer reviews.

Expected seed summary:
- 8 active categories.
- 80 active products (10 per category).
- 4 demo seller stores.
- USD demo pricing and initial stock.

## 6. Start the website

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Try the homepage, category pages, product listing, product detail, search, and add-to-cart flow. The cart and checkout flows write only to your local demo database. Payment-provider execution and real email delivery are not configured by this browsing setup.

To stop the development server, press `Ctrl+C`.

## 7. Useful commands

```powershell
npm run db:studio
npm run typecheck
npm run lint
npm test
```

Prisma Studio opens a local database UI. Stop it with `Ctrl+C`.

## Troubleshooting

- **Can't connect to PostgreSQL:** confirm the PostgreSQL Windows service is running and the host, port, username, and password in both URLs are correct.
- **Database does not exist:** create `mtjr2_demo` first using pgAdmin or `createdb`.
- **Prisma migration error:** verify `DATABASE_URL` points to the empty local demo database, then rerun `npm run db:deploy`.
- **Seed refuses to run:** confirm the three demo flags are set in `.env`, `NODE_ENV=development`, and the database name contains `demo`, `test`, or `dev`.
- **Images do not load:** demo product media uses remote image URLs; browsing still works if a remote image host is temporarily unavailable.
- **Registration/email/Google sign-in unavailable:** this is expected with the local browsing defaults. Registration is deliberately disabled and provider credentials are optional.

## Environment variables actually used by this repository

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Prisma application and migration database connection. |
| `APP_URL` | Server-side canonical URL used for redirects, origin checks, and action links. |
| `AUTH_SECRET` | Server-side authentication/session cryptographic secret. |
| `PUBLIC_REGISTRATION_ENABLED` | Development registration feature switch; production is hard-disabled by policy. |
| `DEMO_DATABASE_URL`, `SEED_DEMO_CATALOG`, `ALLOW_DEMO_CATALOG_SEED` | Explicitly guarded demo catalog seeding. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional Google OpenID Connect. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Optional server-side transactional email. |
| `CRON_SECRET` | Optional secret for protected scheduled endpoints. |
| `TRUSTED_PROXY_IP_HEADER` | Deployment-only trusted edge header; leave unset locally. |

Supabase, Cloudinary, OpenAI, and EmailJS variables are not part of the current application's validated environment contract or active integration paths. Do not add those credentials unless a corresponding integration is implemented.
