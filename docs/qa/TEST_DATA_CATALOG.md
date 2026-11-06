# Test Data Catalog

**Audit date:** 2026-11-06

## Isolated database

| Property | Value |
|---|---|
| Provider | PostgreSQL 17 |
| Host | Localhost |
| Database | `mtjr2_qa_test` |
| Prisma datasource | `DATABASE_URL` read from ignored `.env.qa.local` for QA commands |
| Production isolation | No production host or database was contacted. Existing `mtjr2_demo` was inspected only to classify its name; destructive operations targeted only `mtjr2_qa_test`. |
| Migration state | 44 applied migrations; `prisma migrate status` reports up to date |
| Schema checks | `prisma validate` passed; 175 foreign keys, all validated |
| Credentials | Generated QA-only `AUTH_SECRET` and local DB URL remain in ignored `.env.qa.local`; values are intentionally not recorded. |

## Synthetic fixtures

| Fixture | Source/creation | Final asserted state |
|---|---|---|
| System roles | `prisma/seed.cjs`, repeatable identity seed | 6 system roles |
| Permissions | `prisma/seed.cjs` | 24 permissions |
| Role grants | `prisma/seed.cjs` | 72 role-permission links |
| Demo marketplace | Opt-in `prisma/seed.cjs` with QA-only `DEMO_DATABASE_URL`, `SEED_DEMO_CATALOG=true`, and `ALLOW_DEMO_CATALOG_SEED=true` | 80 demo products, 8 active top-level demo categories (34 including subcategories), 4 active stores, 80 inventory rows |
| Demo identities | Created only by demo seed | Synthetic demo seller accounts; no actual customer credentials or personal data |
| Integration identities | Random UUID email under `example.test`; created by integration tests | Test code removes created users after assertions; password hashes and sessions are not retained from those journeys. |
| Payment/email/shipping | No external provider exercised | No real payment, refund, email, SMS, or notification sent |

## Safe reset and reseed

Only reset this explicitly named QA database. Before any destructive command, verify the host is local and database is exactly `mtjr2_qa_test`; never substitute `.env`'s `mtjr2_demo`.

```powershell
# Load the ignored QA-only variables into this PowerShell process.
Get-Content .env.qa.local | ForEach-Object {
  if ($_ -match '^([A-Z][A-Z0-9_]*)="?(.*?)"?$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
  }
}
npx prisma migrate deploy
npm run db:seed

# Demo catalog is opt-in and requires its own isolated datasource override.
$env:DEMO_DATABASE_URL = $env:DATABASE_URL
$env:SEED_DEMO_CATALOG = "true"
$env:ALLOW_DEMO_CATALOG_SEED = "true"
npm run db:seed
```

`prisma migrate reset` is intentionally omitted from the routine procedure. If schema recreation is needed, first verify `current_database() = 'mtjr2_qa_test'` and localhost using `psql`; never run a destructive reset against an ambiguous URL.
