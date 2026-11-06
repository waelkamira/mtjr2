# Defect Register

**Audit date:** 2026-11-06

| ID | Severity | Defect / finding | Reproduction and impact | Resolution/status |
|---|---|---|---|---|
| DEF-001 | Critical | Unresolved merge-conflict markers prevented the application from compiling. | Opening the site showed a Next.js build error in `src/app/layout.tsx`; the same conflict markers existed in `tests/config/env.test.ts`. | **FIXED.** Merged complementary layout features and consolidated environment tests. Production build, type-check, tests and lint now execute. |
| DEF-002 | Medium (test setup) | A freshly migrated PostgreSQL database lacks seeded system roles and permissions required by integration tests. | The first clean QA integration run had 2 failures at lookups for `STORE_MANAGER` and `SUPER_ADMIN`; 5 tests passed. | **RESOLVED FOR QA.** Ran the repository's repeatable identity seed before integration tests; all 7 PostgreSQL integration tests passed. This is a documented seed prerequisite, not a modified test assertion. |
| DEF-003 | High (release/configuration blocker) | Public GET search/product-list abuse protection has no trusted client-IP source in the isolated production-mode app. | On the local production-mode QA app with no `TRUSTED_PROXY_IP_HEADER`, `/api/search` and GET `/api/products` returned 503. Search code intentionally fails closed when client IP cannot be resolved. | **OPEN / BLOCKED.** Configure the trusted proxy header for the actual deployment environment and verify the proxy overwrites it. No authentication/security guard was weakened, and no deployment settings were changed. |
| DEF-004 | Low (test environment) | Browser could not load some externally hosted Unsplash images. | Browser logs included blocked external image requests while QA pages rendered. | **OPEN / ENVIRONMENT LIMITATION.** No marketplace workflow failure established; external media delivery and allowed-host configuration need separate verification. |
| DEF-005 | Low (maintenance) | ESLint reports 22 warnings although lint exits successfully. | `npm run lint`: 0 errors, 22 warnings across support routes, AI assistant, storefront/account/admin/seller image elements, and a product-detail navigation warning. | **OPEN.** Warnings are outside the merge-conflict repair and were not broadly changed during this audit. |
| OBS-006 | Informational | Guest product detail triggers expected 401 responses for authenticated-only favorites/review-eligibility lookups. | Browser UI handles guest favorites locally and shows sign-in guidance for reviews; DevTools still records the HTTP 401 responses as console errors. | **FUNCTIONAL BEHAVIOR PASS; CONSOLE NOISE OPEN.** Consider avoiding authenticated-only lookups until session state is known; no authorization response was weakened. |

## Scope gaps, not defects claimed as fixed

- Payment/refund providers, advertising workflows, full global settings/backups, and property/booking screens remain absent or incomplete per [`PAGE_INVENTORY.md`](../../PAGE_INVENTORY.md).
- The mandatory connected marketplace purchase and tenant-isolation journeys remain untested; see [`USER_JOURNEYS.md`](USER_JOURNEYS.md).
- Authentication/authorization coverage is not equivalent to exhaustive role-specific browser testing.
