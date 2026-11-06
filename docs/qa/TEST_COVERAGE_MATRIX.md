# Test Coverage Matrix

**Audit date:** 2026-11-06. “Passed” means the named command/test was actually executed in this session or the immediately preceding verification for the same source state.

| ID | Area/journey | Automated evidence executed | Browser/API evidence | Database evidence | Status |
|---|---|---|---|---|---|
| QA-001 | Build/type safety | `npm run build`, `npm run typecheck` passed | — | — | PASS |
| QA-002 | Unit/regression suite | `npm test`: 78 files, 369 tests passed | — | Mocked/unit persistence boundaries only | PASS |
| QA-003 | Lint | `npm run lint`: exit 0, 0 errors, 22 warnings | — | — | PASS WITH WARNINGS |
| QA-004 | Prisma migration/schema | `prisma migrate deploy`, `prisma migrate status`, `prisma validate` | — | 44 migrations applied/up to date | PASS |
| QA-005 | Isolated test fixtures | `npm run db:seed` twice (identity; then opt-in demo catalog) | — | Stable counts: 6 roles, 24 permissions, 72 role links, 80 products, 8 categories, 4 stores, 80 inventory | PASS |
| QA-006 | Identity PostgreSQL integration | `vitest run --config vitest.integration.config.ts`: 7 tests passed | No email provider/browser email journey | Real PostgreSQL registration, verification service, roles, sessions, MFA, throttling and reset assertions; synthetic records cleaned by tests | PASS (PARTIAL SCOPE) |
| QA-007 | Public page rendering | — | Representative public/auth/account/seller/admin routes checked; HTTP 200 responses and expected headings on sampled routes | QA-backed server returned catalog records | PASS (SAMPLED) |
| QA-008 | Mobile layout | — | Home/products sampled at 390px; document width did not exceed 390px | — | PASS (SAMPLED) |
| QA-009 | Protected API denial | — | Unauthenticated account/admin/seller reads returned 401 | No unauthorized record mutation | PASS (SAMPLED) |
| QA-010 | Public taxonomy APIs | — | Categories, brands, markets returned 200 on isolated app | Data came from synthetic QA database | PASS (SAMPLED) |
| QA-011 | Search API / product GET API | — | Both returned 503 in production-mode local QA app without trusted proxy-IP header | No data mutation | BLOCKED (TRUSTED PROXY CONFIG) |
| QA-012 | Guest cart and checkout quote | — | UI added item, changed quantity to 3, opened quote, and released it | Cart item persisted at quantity 3 then removal left 0; quote transitioned to RELEASED; reservation returned to 0; no order/payment created | PASS (SCOPED) |
| QA-013 | Purchase payment, stock fulfillment, shipping, return/refund | Unit suites exist for individual domains | No connected browser journey or sandbox provider execution | No order/payment/refund ledger assertions across a real purchase | BLOCKED / NOT TESTED |
| QA-014 | Seller approval/product moderation | Relevant domain/unit tests exist | No seller-to-admin-to-public UI journey | No end-to-end audit trail assertions | NOT TESTED |
| QA-015 | Advertising lifecycle | No corresponding implemented feature found | — | — | NOT IMPLEMENTED |
| QA-016 | Full route/action/accessibility matrix | — | 78 routes not exhaustively exercised; no complete keyboard/screen-reader review | — | NOT TESTED |

Detailed execution records: [`TEST_EXECUTION_LOG.md`](TEST_EXECUTION_LOG.md). Database assertions: [`DATABASE_ASSERTIONS.md`](DATABASE_ASSERTIONS.md). Security checks: [`SECURITY_TEST_RESULTS.md`](SECURITY_TEST_RESULTS.md).
