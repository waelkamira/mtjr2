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
- [ ] Add session-cookie/API integration tests and CSRF/origin checks for state-changing routes.
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
- [ ] Connect a real transactional email provider through a server-only adapter.
- [ ] Add resend-verification cooldown and anti-enumeration behavior.
- [ ] Add HTTP registration and verification routes only after email delivery and abuse controls are ready.
- [ ] Add end-to-end registration and verification tests through public HTTP endpoints.

### 2.5 Login, logout, recovery, and enforcement
- [x] Implement password login domain service: normalized identity lookup, dummy-hash verification for unknown accounts, generic credential failures, verified/active account checks, attempt recording, throttling before scrypt, session issuance, and successful-login audit event (CI verification pending).
- [ ] Logout route: revoke current session and clear cookie.
- [ ] Password-reset request and completion with one-time tokens and session revocation.
- [ ] Server-side session resolver for route handlers and server components.
- [ ] Authorization guard for permissions and resource scopes.
- [ ] Security audit events for registration, verification, login failures/success, logout, password reset, and role changes.
- [ ] Negative tests: anonymous access, suspended user, expired/revoked session, cross-store access, replayed token, brute-force limits.

## PostgreSQL integration work

- [x] Add a dedicated integration-test configuration so database tests never run in the mocked/unit CI job.
- [x] Add a PostgreSQL 16 workflow that deploys committed migrations, seeds baseline roles/permissions, and executes real database tests.
- [x] Verify registration, consent persistence, verification-token digest storage, and one-time token consumption against PostgreSQL.
- [x] Verify concurrent verification-token consumption allows exactly one successful consumer.
- [x] Verify store-scoped permission resolution, cross-store denial, assignment uniqueness, session creation, and revocation against PostgreSQL.
- [x] Add PostgreSQL integration coverage for concurrent login-throttle requests, persistent blocking, and pair-bucket clearing.
- [x] Updated integration workflow passed on the current pre-login-service commit.
- [ ] Extend database coverage to registration rollback fault injection and password-reset token lifecycle.

## Exit gates — all required

1. Prisma schema validates and a first migration deploys to a clean PostgreSQL database.
2. Baseline roles/permissions are seeded repeatably.
3. Registration → email verification → login → authenticated request → logout works end to end.
4. Password reset and session revocation behavior is covered.
5. Authorization is enforced server-side and cross-scope access is denied.
6. CI passes Prisma validation/generation, typecheck, lint, all unit/integration tests, and production build.
7. Security review and this plan/build log document evidence and remaining limitations.

**Current position:** the identity baseline migration is committed and has been deployed successfully to a clean PostgreSQL 16 database in CI. The baseline seed is verified for repeatability by two consecutive executions. The general CI and first PostgreSQL-backed identity integration workflow both passed on commit `3a4b040a523922cf927a1732819a946c67951314` (runs 41577431810 and 41577431835). The first integration run verified registration, one-time email verification, scoped authorization, assignment uniqueness, and session revocation. Concurrent verification-token consumption and PostgreSQL-backed login-throttle concurrency tests passed in run 41577891224 on commit `399fd314a5c94585b02089e939ae1f3b9bd5e19b`. General CI run 41577891247 also passed on that exact commit. A password login service and focused unit tests were then added in commit `654f581198393d9a981e46460ff92f4deab16957`; their CI result is pending. Logout/recovery endpoints, email delivery, CSRF/origin protection, and full public HTTP E2E remain outstanding. The new login service is not yet CI-verified and is not exposed through an HTTP route. Phase 2 is not complete; Phase 3 remains blocked.
