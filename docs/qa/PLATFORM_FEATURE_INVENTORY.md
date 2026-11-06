# Platform Feature Inventory

**Audit date:** 2026-11-06  
**Scope:** Current Matjar source routes, API handlers, tests, and isolated local PostgreSQL QA database. Source presence is not workflow completion.

## Status definitions

- **VERIFIED (partial):** The named check ran and passed; this does not certify every UI journey.
- **PARTIAL:** Some source/tests or representative browser checks exist, but required end-to-end coverage is incomplete.
- **BLOCKED:** A specific environment/provider prerequisite prevents a valid test.
- **NOT IMPLEMENTED:** The capability is absent or only a placeholder according to the existing route inventories.
- **NOT TESTED:** No sufficient execution evidence was collected for this audit.

## Route and feature areas

| Area | Current routes/surfaces | Evidence | Status |
|---|---|---|---|
| Global shell, navigation, footer, localization | Root layout; shared navigation/footer; Arabic default and locale switch | Arabic home and several route renders; 390px viewport had no horizontal overflow | PARTIAL |
| Errors, loading, not-found | Root/global/account/seller/admin boundaries; Next not-found convention | Production build; sampled routes; not every boundary forced in browser | PARTIAL |
| Marketplace and catalog | `/`, `/products`, `/products/[slug]`, `/search`, categories, brands, stores | 80 synthetic products; taxonomy APIs returned 200; product directory, `Nova` search results and product detail rendered | PARTIAL |
| Search, filtering, sorting, pagination | `/search`, catalog controls, `/api/search`, `/api/products` | Server-rendered `/products` used QA catalog; `/api/search` and GET `/api/products` returned 503 without trusted proxy IP configuration | BLOCKED |
| Customer account | `/account/**`, including profile, addresses, orders, favorites, support, messages and security | Unauthenticated profile API returned 401; route source and unit suites inspected; no authenticated browser journey | PARTIAL |
| Cart and checkout | `/cart`, `/checkout`, cart and quote APIs | Browser added a synthetic product, persisted quantity 3, removed it, created an active quote/reservation, and released it; DB assertions showed no order/payment | PARTIAL |
| Payment, refund, ledger, payouts | Payment APIs/webhook, commission management and payment services | Webhook/payment unit tests; no configured sandbox provider or payment/refund DB journey | BLOCKED |
| Identity and sessions | Login/register, verification, reset, session, MFA | 7 PostgreSQL integration tests passed; broad unit coverage; provider email delivery not exercised | VERIFIED (partial) |
| Seller onboarding and store operations | `/seller/**`, applications, stores, staff, inventory, products and order APIs | Seller/inventory/returns unit tests; unauthenticated seller APIs returned 401; no seller-admin browser workflow | PARTIAL |
| Admin and Super Admin | `/admin/**`, control panel, users, roles, audit, moderation, commissions | Dashboard, user, policy and MFA unit tests; unauthenticated admin APIs returned 401; no privileged browser journey | PARTIAL |
| Moderation and taxonomy | Admin product/seller/category/review/question queues | Catalog, review, seller and moderation unit tests; no approval UI-to-publication journey | PARTIAL |
| Shipping and delivery | Seller rates, shipment/tracking APIs, order status | Shipping/fulfillment unit tests; mock provider or end-to-end order shipment not run | PARTIAL |
| Returns and refunds | Customer/seller/admin return workflows | Return policy/service tests; no connected order → return → sandbox refund workflow | PARTIAL |
| Support and communications | Support tickets, messages, notifications | SLA/upload/policy unit tests; no email or user notification sent; no multi-role ticket journey | PARTIAL |
| Advertising and paid placement | No implemented campaign/featured-placement system found in route inventory | No route/model/workflow evidence | NOT IMPLEMENTED |
| CMS, global settings, backups, IP block controls | Gaps documented in `PAGE_INVENTORY.md` and architecture inventory | No verified implementation | NOT IMPLEMENTED |
| Property/booking domain | Required routes listed in architecture inventory; no App Router implementation | No route/workflow evidence | NOT IMPLEMENTED |
| Legal and informational pages | `/about`, `/contact`, `/terms`, `/privacy` | Pages returned HTTP 200 in the local browser sweep; legal drafts still need responsible approval | PARTIAL |
| Browser-wide interaction/accessibility audit | 78 page routes; 148 API handlers | Representative 20-route smoke sweep; no exhaustive control, keyboard, screen-reader, or role matrix | NOT TESTED |

## Source inventories

- [`PAGE_INVENTORY.md`](../../PAGE_INVENTORY.md): actual routes, components, access boundaries, missing targets, and per-page status.
- [`docs/architecture/PLATFORM_PAGE_INVENTORY.md`](../architecture/PLATFORM_PAGE_INVENTORY.md): broader required screens and system capabilities.
- [`docs/systems/SYSTEM_INTEGRATION_MATRIX.md`](../systems/SYSTEM_INTEGRATION_MATRIX.md): system dependencies.

Route counts are source counts, not counts of complete features.
