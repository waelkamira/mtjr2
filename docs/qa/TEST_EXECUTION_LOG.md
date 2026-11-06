# Test Execution Log

**Date:** 2026-11-06  
**Environment:** Windows local development workstation; no deployment. Destructive database operations used only the separately created local PostgreSQL database `mtjr2_qa_test`.

| Run ID | Test/action | Result | Evidence/notes |
|---|---|---|---|
| RUN-001 | Open `http://localhost:3000` before fixes | FAIL, reproduced | Browser displayed a Next.js build error: unresolved conflict markers in `src/app/layout.tsx`. |
| RUN-002 | Merge layout and environment-test conflict sections | PASS | Both footer and conditional AI assistant retained; duplicate tests consolidated; no conflict markers remain in checked source/test paths. |
| RUN-003 | `npm run build` | PASS | Optimized Next.js build compiled; type generation and all static page generation completed. |
| RUN-004 | `npm run typecheck` | PASS | A first check raced Prisma client regeneration and failed on the AI-assistant model; subsequent type-check after generation passed. |
| RUN-005 | `npm test` with non-production test env | PASS | 78 files and 369 tests passed. |
| RUN-006 | `npm run lint` | PASS WITH WARNINGS | Exit code 0; 0 errors and 22 warnings in existing files (unused imports/variables, raw `<img>`, and one internal `window.location.assign`). |
| RUN-007 | Create `mtjr2_qa_test`; run `prisma migrate deploy/status/validate` | PASS | Local role can create DB; 44 migrations applied, schema up to date, Prisma schema valid. Configured `mtjr2_demo` database was not used for destructive operations. |
| RUN-008 | First PostgreSQL integration run before identity seed | FAIL (fixture prerequisite) | Five tests passed; two failed because system roles were absent in a clean migrated DB. No assertions were weakened. |
| RUN-009 | Run repeatable identity seed, then PostgreSQL integration suite | PASS | 6/6 identity PostgreSQL tests plus 1/1 password-reset/login race test passed (7/7 total). Expected unique-constraint error logs occurred in duplicate-registration tests. |
| RUN-010 | Run opt-in demo catalog seed twice against QA DB | PASS | Stable on rerun: 80 products, 8 active top-level categories, 4 active stores, 80 inventory rows; seed reports 34 categories including subcategories. |
| RUN-011 | Direct QA DB aggregate assertions | PASS | `migrations=44`, `unvalidated_fks=0`, `roles=6`, `permissions=24`, `role_permissions=72`, `demo_products=80`, `active_demo_categories=8`, `active_demo_stores=4`, `demo_inventories=80`, `negative_inventory=0`. |
| RUN-012 | Local browser route sweep | PASS (SAMPLED) | Public, auth, legal, cart/checkout, account, seller and admin URLs checked. Public pages and auth pages rendered; `/admin/dashboard` showed its unauthorized not-found content. The `/forgot-password` navigation timed out once during a concurrent compilation/network interruption, then returned HTTP 200 on retry. |
| RUN-013 | 390px viewport check | PASS (SAMPLED) | At the time of check document/body width was 375px in a 390px viewport; no horizontal overflow. |
| RUN-014 | Unauthenticated protected API probes | PASS (SAMPLED) | `/api/account/profile`, `/api/admin/users`, `/api/admin/dashboard`, `/api/seller/stores`, `/api/seller/orders` returned 401. Guest cart returned 200; taxonomy/brand/market reads returned 200. |
| RUN-015 | Public search/product-list API in isolated production-mode app | BLOCKED | GET `/api/search` and GET `/api/products` returned 503 because no trusted client-IP proxy header is configured in this local production-mode setup. The fail-closed abuse guard was not bypassed. |
| RUN-016 | QA-backed search and product detail | PASS (SAMPLED) | Server-rendered `/search?q=Nova` returned Nova products; `/products/demo-phones-electronics-01` rendered price, product details, wishlist, cart, review and Q&A states. Guest-only favorite/review eligibility requests return handled 401s; browser DevTools logs these expected responses as errors. |
| RUN-017 | Guest wishlist, cart add/quantity/remove | PASS (SCOPED) | Browser toggled guest wishlist using local storage; added seeded product via UI, persisted quantity 3, then removed item. DB assertions observed one item/quantity 3 and, after removal, zero matching items. Guest favorite was not a database record. |
| RUN-018 | Checkout quote/reservation/release (no order/payment) | PASS (SCOPED) | UI created a quote from the guest cart, showed the server price and line, reserved one unit, then cancelled the reservation and returned to cart. Final DB state: one released quote, zero active quotes, zero reserved stock, zero cart items, zero orders/payments, no negative inventory. |
| RUN-019 | Full purchase and financial lifecycle | NOT RUN | No sandbox payment provider, synthetic privileged browser account, order shipment, return/refund or connected checkout-to-refund journey was executed. |
| RUN-020 | PostgreSQL integration rerun after UI cart/quote journey | PASS | 7/7 tests passed again; post-run QA DB assertion confirmed zero orders, payments, returns, active quotes and cart items. |

The browser loaded some externally hosted Unsplash images that the browser environment blocked; external image delivery is therefore not certified. Test environment secrets are stored only in ignored `.env.qa.local` and are not included in this log.
