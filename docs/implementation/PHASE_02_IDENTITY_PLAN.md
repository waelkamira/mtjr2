# Phase 2 — Identity and access execution plan

This phase is part of the dependency-aware sequence in the repository root README. Do not start Marketplace Core (Phase 3) until the exit gates below are satisfied.

## Scope

Deliver a secure identity and access foundation for buyers, sellers, staff, and administrators. Keep authentication mechanisms separate from authorization policy and enforce all decisions on the server.

## Work packages and status

### 2.1 Identity data and configuration
- [x] Canonical user identity fields and account states in Prisma schema.
- [x] Role, permission, scoped assignment, and join models.
- [x] Session, OAuth, password-reset, email-verification, consent, login-attempt, and audit models.
- [x] Runtime environment validation and Prisma singleton.
- [x] Generate and review the first migration against a disposable PostgreSQL 16 database; commit it as `20261103000000_identity_baseline`.
- [x] Add deterministic, idempotent baseline roles and permissions seed; execute it twice in the clean-database CI workflow.

### 2.2 Authorization foundation
- [x] Pure permission policy with global and exact-resource scope evaluation.
- [x] Reject expired grants and scope/permission mismatches.
- [x] Database grant reader, restricted to trusted server-side user IDs.
- [x] Canonical role-scope normalization.
- [ ] Implement audited role/permission assignment services.
- [x] PostgreSQL integration coverage for grant loading, cross-store denial, and assignment uniqueness (verified in run 41577431835).

### 2.3 Password and session security
- [x] Versioned scrypt password hashing and timing-safe verification.
- [x] High-entropy opaque session tokens; persist only token digests.
- [x] Session create/resolve/revoke and revoke-all operations.
- [x] HttpOnly session cookie helpers; Secure in production.
- [x] Unit tests for password and session primitives/lifecycle.
- [ ] Add session-cookie/API integration tests.
- [x] Add a fail-closed same-origin JSON mutation guard: require exact configured application Origin, reject non-same-origin Fetch Metadata when supplied, and require application/json. Public mutation routes must invoke it before reading bodies or calling domain services.
- [x] Add persistent, HMAC-keyed login rate-limit buckets for normalized identifier/IP pairs and trusted client IPs; store only keyed digests, never raw identifiers/IPs in the throttle ledger.
- [x] Add unit tests for persistent login-throttle key derivation, pair clearing, validation, threshold blocking, and window reset.
- [x] Verify PostgreSQL-backed concurrent login-throttle integration tests, persistent blocking, and pair-bucket clearing (run 41577891224 on commit `399fd314a5c94585b02089e939ae1f3b9bd5e19b`).
- [ ] Tune thresholds using production telemetry before enabling public login.

### 2.4 Registration and email verification
- [x] Validate registration input and require terms/privacy consent.
- [x] Create pending accounts transactionally with hashed passwords.
- [x] Store single-use, expiring email-verification token digests.
- [x] Consume verification tokens atomically and activate accounts only once.
- [x] Require PENDING account state during activation; do not reactivate suspended/disabled accounts.
- [x] Recheck ACTIVE account state atomically when accepting/touching an existing session.
- [x] Implement server-only Resend transactional email adapter for verification and password-reset messages.
- [ ] Configure a Resend API key and verified sender in deployment secrets; perform a real delivery smoke test.
- [x] Add resend-verification abuse throttling (separate persistent budget) and generic anti-enumeration response.
- [x] Add a fail-closed trusted-proxy IP resolver for explicitly configured Cloudflare/Vercel edge headers; arbitrary `X-Forwarded-For` is never trusted. Configure only after the edge overwrites the header and origin bypass is blocked.
- [x] Add minimal HTTP registration, verification, and resend routes with same-origin/JSON checks; real delivery remains blocked on deployment configuration.
- [ ] Configure `TRUSTED_PROXY_IP_HEADER` for the actual deployment edge; keep IP-dependent endpoints closed until verified.
- [ ] Run one HTTP end-to-end registration → verification → login → authenticated request → logout journey after deployment configuration.
- [x] Add user-facing verification and password-reset action pages; submit tokens through same-origin APIs, remove them from the visible URL after use, and set `no-referrer` metadata.

### 2.5 Login, logout, recovery, and enforcement
- [x] Implement password login domain service: normalized identity lookup, dummy-hash verification for unknown accounts, generic credential failures, verified/active account checks, attempt recording, throttling before scrypt, session issuance, and successful-login audit event (CI passed on commit `8d48d92f8b8f7828d2adda953183b46483ba3a6d`, run 41580301822).
- [x] Server-side logout primitive revokes the current cookie-backed session, records an audit event, and clears the cookie even on invalid-session/error paths (unit tests and CI passed on commit `8d48d92f8b8f7828d2adda953183b46483ba3a6d`, run 41580301822). HTTP route remains blocked on CSRF/Origin enforcement.
- [x] Add server-side password-reset challenge issuance for active verified accounts; invalidate older outstanding challenges and persist only SHA-256 token digests (verified by PostgreSQL integration run 41581259836).
- [x] Add atomic one-time password-reset completion, password replacement, session revocation, and audit event (verified by PostgreSQL integration run 41581259836).
- [x] Add reset-request throttling with separate HMAC-keyed identifier/IP buckets (3 per identifier/IP pair and 10 per IP per 15 minutes); reset traffic cannot consume login-attempt budget. The HTTP handler must return the same generic response for unknown, throttled, and eligible accounts.
- [x] Implement server-only Resend email delivery adapter; public recovery remains blocked until credentials and a verified sender are configured and delivery is smoke-tested.
- [x] Server-side current-session resolver for server components/route handlers; reads only the HttpOnly request cookie and resolves it against the session store, with a fail-closed required-session guard (unit tests and CI passed on commit `1de06a1325b29cafbeae5693d3aa78ff7dc339e5`).
- [x] Server-only permission guard composes the verified request session with database-loaded permissions; denies missing permissions and never accepts a client-selected authorization subject (unit tests and CI passed on commit `8d48d92f8b8f7828d2adda953183b46483ba3a6d`, run 41580301822).
- [ ] Security audit events for registration, verification, login failures/success, logout, password reset, and role changes.
- [ ] Negative tests: anonymous access, suspended user, expired/revoked session, cross-store access, replayed token, brute-force limits.

## Minimal verification gates\n\n1. General CI: Prisma validate/generate, typecheck, lint, unit tests, and production build.\n2. PostgreSQL identity integration for registration/verification/login/session/authorization.\n3. PostgreSQL password-reset lifecycle: digest-only token, one-time use, password change, audit, session revocation.\n4. One HTTP end-to-end journey after email/proxy configuration.\n\nDo not add tests for every helper; add tests only for critical security regressions, real bugs, or independent business invariants.\n\n## PostgreSQL integration work

- [x] Add a dedicated integration-test configuration so database tests never run in the mocked/unit CI job.
- [x] Add a PostgreSQL 16 workflow that deploys committed migrations, seeds baseline roles/permissions, and executes real database tests.
- [x] Verify registration, consent persistence, verification-token digest storage, and one-time token consumption against PostgreSQL.
- [x] Verify concurrent verification-token consumption allows exactly one successful consumer.
- [x] Verify store-scoped permission resolution, cross-store denial, assignment uniqueness, session creation, and revocation against PostgreSQL.
- [x] Add PostgreSQL integration coverage for concurrent login-throttle requests, persistent blocking, and pair-bucket clearing.
- [x] Updated integration workflow passed on the current pre-login-service commit.
- [x] Add PostgreSQL integration coverage for password login success/failure, login-attempt persistence, audit creation, session token digest storage, session resolution, and revocation (verified by PostgreSQL integration run 41581259836).
- [ ] Extend database coverage to registration rollback fault injection.
- [x] Add PostgreSQL coverage for password-reset token digest storage, one-time consumption, password replacement, audit event, and session revocation (verified by PostgreSQL integration run 41581259836).

## Exit gates — all required

1. Prisma schema validates and a first migration deploys to a clean PostgreSQL database.
2. Baseline roles/permissions are seeded repeatably.
3. Registration → email verification → login → authenticated request → logout works end to end.
4. Password reset and session revocation behavior is covered.
5. Authorization is enforced server-side and cross-scope access is denied.
6. CI passes Prisma validation/generation, typecheck, lint, all unit/integration tests, and production build.
7. Security review and this plan/build log document evidence and remaining limitations.

**Current position:** the identity baseline migration is committed and has been deployed successfully to a clean PostgreSQL 16 database in CI. The baseline seed is verified for repeatability by two consecutive executions. The general CI and first PostgreSQL-backed identity integration workflow both passed on commit `3a4b040a523922cf927a1732819a946c67951314` (runs 41577431810 and 41577431835). The first integration run verified registration, one-time email verification, scoped authorization, assignment uniqueness, and session revocation. Concurrent verification-token consumption and PostgreSQL-backed login-throttle concurrency tests passed in run 41577891224 on commit `399fd314a5c94585b02089e939ae1f3b9bd5e19b`. General CI run 41577891247 also passed on that exact commit. The password login service and focused unit tests passed CI on commit `87fc2167a3ae97109cb15160d7f28076d8e829f8` (run 41578452511); its PostgreSQL persistence path is now covered by the integration test added on commit `bdd5d195f34f3325dea3d7a1a18299751aad11d2` (run 41580756063). The current-session resolver and its unit tests passed CI on commit `1de06a1325b29cafbeae5693d3aa78ff7dc339e5` (run 41579953764). Logout/recovery endpoints, email delivery, CSRF/origin protection, and full public HTTP E2E remain outstanding. The permission guard and logout primitive passed general CI and PostgreSQL integration on commit `8d48d92f8b8f7828d2adda953183b46483ba3a6d` (runs 41580301822 and 41580301896). The logout primitive itself is unit-tested; there is not yet a cookie-context HTTP logout integration test. The PostgreSQL-backed login service test passed on commit `bdd5d195f34f3325dea3d7a1a18299751aad11d2` (run 41580756063), and general CI passed on that commit (run 41580756068). The password-reset service and PostgreSQL lifecycle test passed in run 41581259836; general CI passed on documentation head 79e260082aebe48d6fe2bca535b4f36a55ba4f3b (run 41581280754). Reset-request throttling now uses distinct action-namespaced HMAC buckets in the existing persistent bucket table, keeping login and recovery budgets isolated. A fail-closed Origin/Fetch Metadata/JSON content-type guard is committed. The first CI attempt exposed a malformed regular-expression escape in that guard; it has been corrected. Resend adapter and corrected guard are awaiting CI. Phase 2 remains incomplete; Phase 3 remains blocked. Password reset has passed its focused PostgreSQL lifecycle test and general CI. Phase 2 remains incomplete; Phase 3 remains blocked.


## Current status — 2026-11-03 (supersedes older status notes above)

- The latest UI/action-page commit is `7a30994e62de079839c8778f3d1f1a368097c2bc`; general CI passed in [run 41645257014](https://github.com/waelkamira/mtjr2/actions/runs/41645257014).
- The identity PostgreSQL integration suite passed on the preceding identity-code commit `da19c57876e39d9564e0ca519726e3b6b2efcf0a` in [run 41643736067](https://github.com/waelkamira/mtjr2/actions/runs/41643736067). The subsequent commit only added UI pages and documentation.
- The integration workflow now also triggers when `src/app/api/auth/**` changes, so future public-route changes cannot silently skip the database integration gate.
- Remaining blockers are operational, not a request for more unit tests: configure Resend API key + verified sender and trusted proxy header in deployment settings; smoke-test email delivery; then run one HTTP journey covering register, verify, login, `/api/auth/me`, logout, and denial after logout.
- Do not expand the suite beyond the existing general CI, PostgreSQL integration, and one HTTP journey. Phase 3 stays blocked until the operational journey is verified.
