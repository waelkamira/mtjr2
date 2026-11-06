# Security Test Results

**Audit date:** 2026-11-06. Testing used synthetic data and a dedicated local PostgreSQL QA database.

| ID | Security control | Test/evidence | Result |
|---|---|---|---|
| SEC-001 | Guest access to protected APIs | Unauthenticated GET probes to account profile, admin users/dashboard, seller stores/orders | PASS: sampled endpoints returned 401 |
| SEC-002 | Store-scope isolation policy | `tests/identity/authorization.test.ts` and PostgreSQL identity integration store-role checks | PASS: exact scope allowed; other-store and expired grants denied |
| SEC-003 | Session token secrecy/revocation | PostgreSQL identity integration tests | PASS: digest-only token persistence and revoked session assertions |
| SEC-004 | Password reset replay/concurrency | PostgreSQL integration and login-reset race tests | PASS: reset token single-use, sessions revoked, race does not create active session |
| SEC-005 | MFA enforcement/recovery | PostgreSQL identity integration test | PASS: privileged enrollment requirement, TOTP, recovery code one-time use |
| SEC-006 | Duplicate-registration race | PostgreSQL integration test | PASS: one registration succeeds; unique constraint rejects the other |
| SEC-007 | Persistent login throttling | PostgreSQL integration test | PASS |
| SEC-008 | Search abuse guard when trusted client IP is unavailable | Local production-mode QA app, no trusted proxy header | PASS secure failure behavior (503); public search remains blocked until trusted proxy configuration is supplied |
| SEC-009 | Tenant isolation across two live seller accounts | No connected browser/API workflow executed | NOT TESTED |
| SEC-010 | Payment callbacks, refunds, finance approvals, privilege audit attribution | No provider or connected order/payment workflow used | NOT TESTED |
| SEC-011 | Production data access/deployment | No production DB or deployment invoked | PASS: not accessed |

## Constraints

- The local production-mode QA process had no `TRUSTED_PROXY_IP_HEADER`; no caller-supplied forwarding header was trusted or fabricated. Configure the real trusted reverse-proxy header and verify it is overwritten by the proxy before release.
- Authorization is server-side; an unauthorized page may render framework not-found content with HTTP 200. API 401 probes are evidence only for the listed endpoints, not all 148 handlers.
- No real emails, SMS, payments, refunds, payouts, advertising, or notifications were initiated.
