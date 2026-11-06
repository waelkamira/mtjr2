# User Journey Results

**Audit date:** 2026-11-06. Results separate actual execution from unit coverage and source inspection.

## Journey A — Complete marketplace purchase

| Steps | Required actions | Status | Evidence / blocker |
|---|---|---|---|
| 1–3 | Seller registers/applies; admin reviews and approves store | NOT TESTED | Seller application and admin seller unit suites exist, but no browser or connected PostgreSQL seller→admin workflow was executed. |
| 4–7 | Seller creates product; moderation approves; product becomes public | NOT TESTED | QA contains seeded synthetic products, not a product created through the seller UI and moderated by an admin. |
| 8–9 | Customer searches and opens product | PASS (GUEST SAMPLE) | QA-backed server-rendered `/search?q=Nova` returned seeded products and product detail loaded. Public search/product-list API still returns 503 in production-mode when trusted proxy IP configuration is absent. |
| 10–14 | Customer adds/removes/re-adds favorite | PARTIAL | Guest wishlist was toggled in the UI and stored locally; authenticated favorite DB add/remove was not tested. |
| 15–19 | Add/change/remove cart item; verify persistence | PASS (GUEST FLOW) | Browser added a seeded product, changed quantity to 3, and removed it. PostgreSQL assertions observed quantity 3 then zero matching cart items. |
| 20 | Proceed to checkout | PASS (QUOTE ONLY) | Cart UI created a server quote; checkout page rendered product, price and quote details. |
| 21–23 | Sandbox payment; verify order/payment/inventory/idempotency | BLOCKED | No sandbox provider configured; no order/payment database workflow run. Payment/webhook unit tests are not a substitute. |
| 24–29 | Seller fulfillment, shipment tracking, delivery and customer view | NOT TESTED | Shipment/tracking unit suites exist; no order consumed by seller UI or tracking flow. |
| 30–35 | Return, seller/finance processing, sandbox refund, ledger and audit | BLOCKED | No connected order/return/refund or ledger journey and no sandbox payment/refund provider. |

**Overall Journey A: NOT COMPLETE.** Guest catalog → cart → quote → reservation release is verified, but no order, payment, fulfillment, return or refund is claimed.

## Journey B — Identity and access control

| Step/area | Actual execution | Result |
|---|---|---|
| Guest browsing | Public routes sampled in browser | PASS (sampled) |
| Customer registration/verification | PostgreSQL integration tests call registration and verification services using synthetic identities | PASS; no external email delivery |
| Duplicate registration | Concurrent duplicate registration integration test | PASS; exactly one accepted |
| Login/password reset | PostgreSQL integration tests include login, concurrent reset/login and reset revocation | PASS |
| Session lifecycle | PostgreSQL integration tests assert persisted digest-only session and revocation | PASS |
| MFA | PostgreSQL integration test exercises Super Admin enrollment, TOTP verification and one-time recovery codes | PASS |
| Login throttling | PostgreSQL integration test checks concurrent persistent throttling | PASS |
| Guest/customer/seller/admin protected API checks | Local API probes returned 401 for sampled protected routes | PASS (sampled) |
| Seller onboarding/staff roles | Source and unit suites inspected; no connected browser journey | NOT TESTED |
| Administrator and Super Admin UI | Unauthenticated admin dashboard showed not-found content; API unauthorized probes returned 401 | PARTIAL |
| Suspended/unverified account matrix, all scopes, privilege approvals and audit attribution | Unit/source coverage exists; no exhaustive DB/browser matrix | NOT TESTED |

**Overall Journey B: PARTIAL.** Seven real PostgreSQL integration tests passed; provider email and complete role/browser matrix remain unverified.

## Journey C — Seller lifecycle

Registration through store approval, synthetic document upload, product create/edit/moderate/delete, pricing/inventory, order fulfillment, return, commission/payout, analytics, and Seller A/B isolation was **NOT TESTED end to end**. Seller application, inventory, return, staff, moderation, and authorization unit tests exist. No cross-tenant live workflow was executed.

## Journey D — Advertising lifecycle

Create/edit/draft/review/approve/schedule/budget/activate/pause/archive, campaign analytics, and seller isolation are **NOT IMPLEMENTED** in the current route/system inventory. No ad campaign or spend was created.

## Journey E — Other marketplace systems

| System | Evidence | Status |
|---|---|---|
| Search/filter/sort/pagination | Search query tests; server-rendered catalog; API blocked without trusted proxy configuration | PARTIAL / BLOCKED |
| Favorites | Unit suite only | NOT TESTED end to end |
| Cart and checkout | Unit suites for cart, quotes, address, coupons and order creation | NOT TESTED end to end |
| Multi-seller order and inventory reservation | Domain tests exist; no connected database journey | NOT TESTED |
| Payments and webhook idempotency | Payment lifecycle/webhook unit suites | NOT TESTED against DB/provider |
| Reviews, Q&A and moderation | Domain tests exist | NOT TESTED end to end |
| Notifications and support | Delivery/SLA/upload unit suites; no real delivery sent | NOT TESTED end to end |
| Shipping and tracking | Unit suites exist | NOT TESTED end to end |
| Returns/refunds | Unit suites exist; no sandbox refund | NOT TESTED end to end |
| Commissions/payouts/financial reconciliation | Rules and unit suites exist; payout/ledger lifecycle absent or incomplete | PARTIAL |
| CMS, advertisements, backup, platform settings | Route inventory identifies missing capabilities | NOT IMPLEMENTED |
| AI assistant | Safe default is disabled; no provider call made | NOT TESTED |
