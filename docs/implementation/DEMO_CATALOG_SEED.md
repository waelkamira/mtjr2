# Demo catalog seed

This seed is for local/disposable development databases only. It is not launch-market reference data and must never be run against production.

## Contents

Running the demo catalog seed creates or updates:
- 8 active bilingual categories: phones/electronics, clothing/fashion, furniture/home, home appliances, beauty/personal care, sports/outdoors, books/stationery, and automotive accessories.
- 10 active products per category (80 total), with Arabic and English names/descriptions.
- 8 demo brands and 4 demo seller users, approved seller profiles, and active stores.
- A dedicated `DEMO-US` market, US country reference, USD currency, and enabled store-market links.
- Product media, one standard variant per product, USD prices with compare-at prices, a demo warehouse, and initial stock with receipt movements.
- Search synonyms in English and Arabic.

The catalog-only seed does **not** create customer reviews, verified purchases, orders, payments, refunds, or fabricated ratings. The separate dashboard fixture below does create clearly named test records for those workflows.

## Platform overview dashboard fixtures

To exercise all 20 platform overview cards, the optional dashboard fixture creates at least 20 database records for each card's underlying metric: users, sellers, stores, products, orders, payments, reviews, returns, and support tickets. It creates linked demo carts, quotes, order addresses, vendor orders, and order items where required. Each card chart uses up to 20 matching database records; transaction metrics follow the selected order date filters, while platform-wide counts use their matching current records. Charts never pad missing data with invented points.

This fixture is repeatable and is only for a disposable database. It may affect operational counts, queues, and admin screens. Never enable it against a database containing real customer or production data.

The same safety gates apply: set `ALLOW_DEMO_CATALOG_SEED=true`, provide a `DEMO_DATABASE_URL` with a `demo`, `test`, `ci`, or `dev` database-name marker, and do not run with `NODE_ENV=production`. The script uses the explicit demo URL and refuses to fall back to `DATABASE_URL`.

After applying migrations and generating the Prisma client as described above, run:

```powershell
$env:DEMO_DATABASE_URL = "******localhost:5432/mtjr2_demo"
$env:ALLOW_DEMO_CATALOG_SEED = "true"
$env:NODE_ENV = "development"
npm run db:seed:demo-dashboard
```

The command seeds the catalog first, then creates the dashboard fixture and verifies that the metric tables contain at least 20 matching records. Re-running it updates the same named fixtures instead of duplicating them.

## Safety gates

All of the following are mandatory when enabling the demo catalog:
- `NODE_ENV` must not be `production`.
- `SEED_DEMO_CATALOG=true`.
- `ALLOW_DEMO_CATALOG_SEED=true`.
- `DEMO_DATABASE_URL` must point to a separate PostgreSQL database whose database name contains `demo`, `test`, `testing`, `ci`, `dev`, or `development`.
- The seed uses `DEMO_DATABASE_URL` as an explicit Prisma datasource override. It never falls back to `DATABASE_URL` for demo catalog writes.

The marker is an additional guard, not proof that a database is disposable. Confirm the host and database name before running the command.

## Local setup

Create a separate database, for example `mtjr2_demo`, then apply the repository migrations with `DATABASE_URL` pointed at that database:

```powershell
$env:DATABASE_URL = "postgresql://USER:PASSWORD@localhost:5432/mtjr2_demo"
npx prisma migrate deploy
npx prisma generate
```

Then enable the demo seed. Set `DEMO_DATABASE_URL` to the same isolated demo database; the seed uses this explicit URL rather than the default datasource environment variable:

```powershell
$env:DEMO_DATABASE_URL = "postgresql://USER:PASSWORD@localhost:5432/mtjr2_demo"
$env:SEED_DEMO_CATALOG = "true"
$env:ALLOW_DEMO_CATALOG_SEED = "true"
$env:NODE_ENV = "development"
npm run db:seed
```

Run `npm run db:seed` again to verify repeatability. Existing demo stock is not replenished on reruns.

## Verification checklist

- [ ] Prisma migrations deploy successfully to the disposable PostgreSQL database.
- [ ] First seed reports 80 products, 8 categories, and 4 stores.
- [ ] Second seed leaves those counts unchanged and does not duplicate media, variants, prices, translations, inventory, or stock movements.
- [ ] Public active-market, category, product listing, product detail, and search endpoints return demo records.
- [ ] The storefront shows the seeded categories and products using the normal API path.

No Prisma schema change is required for this seed. If a future product requirement needs a new persisted field, update the model only after tracing its API/UI consumer and add an additive migration with a separate reason.
