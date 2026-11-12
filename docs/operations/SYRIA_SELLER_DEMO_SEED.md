# Local Syria seller demo data

This seed populates the seller account `ramondm4@gmail.com` with clearly marked, repeatable development data for the Syria launch market.

## Safety

- Local PostgreSQL only. The script rejects production mode and non-local database hosts.
- Back up the local database before running it.
- The seller account must already exist. The script will not create a passwordless owner account.
- Demo customers use `@mtjr2.test` addresses.
- Demo orders use the `DEMO-SYR-` prefix and demo return numbers use `DEMO-SYR-RET-`.
- No payment, refund, payout, commission, advertising spend, or ledger entries are created.
- Existing seller-managed support statuses, message history, notification read states, and campaign edits are preserved when rerunning the seed.
- Demo shipping addresses, phone numbers, tracking references, and policies are placeholders. Replace them before treating the store as operational.
- Re-running the script is designed to reuse the seeded catalog and existing demo records.

## Run on Windows PowerShell

From the repository root:

```powershell
git checkout main
git pull --ff-only origin main
npx prisma generate
npx prisma migrate status
```

If migrations are pending, review them and apply them to the local database:

```powershell
npx prisma migrate deploy
```

Back up the local database, then run:

```powershell
$env:ALLOW_SYRIA_SELLER_SEED = "true"
$env:SYRIA_SEED_SELLER_EMAIL = "ramondm4@gmail.com"
$env:SYRIA_SEED_USD_TO_SYP = "147"
npm run db:seed:syria-seller
```

The exchange-rate value is a configurable reference for demo prices, not a live FX feed or a commercial quote. Change it to the rate you want to use before running the seed.

## Expected records

- 20 active products in each of the 8 main demo categories (160 total), with Arabic and English names/descriptions, category links, product images, variants, SKUs, stock, and SYP/USD prices.
- 8 active demo brands.
- One seller-owned store linked only to `SY-SYR`.
- 10 demo customer orders in varied preparation/shipping/completed states.
- 3 pending return requests.
- Low-stock variants and initial inventory movements.
- Store and product reviews, product questions and seller answers.
- Store inbox conversations and replies, support tickets with mixed statuses and messages, in-app notifications and preferences.
- Two editable draft ad campaigns with zero fabricated impressions, clicks, spend, invoices, or ad-ledger entries.
- One local warehouse and a configurable local shipping rate.

All records are intended for local development and dashboard interaction, not real customer transactions.
