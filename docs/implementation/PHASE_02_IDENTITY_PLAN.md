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
- [ ] Add integration tests against PostgreSQL for grant loading and assignment uniqueness.

### 2.3 Password and session security
- [x] Versioned scrypt password hashing and timing-safe verification.
- [x] High-entropy opaque session tokens; persist only token digests.
- [x] Session create/resolve/revoke and revoke-all operations.
- [x] HttpOnly session cookie helpers; Secure in production.
- [x] Unit tests for password and session primitives/lifecycle.
- [ ] Add session-cookie/API integration tests and CSRF/origin checks for state-changing routes.
- [x] Add persistent, HMAC-keyed login rate-limit buckets for normalized identifier/IP pairs and trusted client IPs; store only keyed digests, never raw identifiers/IPs in the throttle ledger.
- [x] Add unit tests for persistent login-throttle key derivation, pair clearing, validation, threshold blocking, and window reset (CI-verified in run 41575486446).
- [ ] Add PostgreSQL-backed login throttling integration/concurrency tests and tune thresholds using production telemetry before enabling public login.

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
- [ ] Add end-to-end registration and verification tests.

### 2.5 Login, logout, recovery, and enforcement
- [ ] Login service: normalized identity lookup, password verification, verified/active account checks, attempt recording, throttling, session issuance.
- [ ] Logout route: revoke current session and clear cookie.
- [ ] Password-reset request and completion with one-time tokens and session revocation.
- [ ] Server-side session resolver for route handlers and server components.
- [ ] Authorization guard for permissions and resource scopes.
- [ ] Security audit events for registration, verification, login failures/success, logout, password reset, and role changes.
- [ ] Negative tests: anonymous access, suspended user, expired/revoked session, cross-store access, replayed token, brute-force limits.

## Exit gates — all required

1. Prisma schema validates and a first migration deploys to a clean PostgreSQL database.
2. Baseline roles/permissions are seeded repeatably.
3. Registration → email verification → login → authenticated request → logout works end to end.
4. Password reset and session revocation behavior is covered.
5. Authorization is enforced server-side and cross-scope access is denied.
6. CI passes Prisma validation/generation, typecheck, lint, all unit/integration tests, and production build.
7. Security review and this plan/build log document evidence and remaining limitations.

**Current position:** the identity baseline migration is committed and has been deployed successfully to a clean PostgreSQL 16 database in CI. The baseline seed is implemented and verified for repeatability by two consecutive executions against the same clean PostgreSQL 16 database (CI run 41576588203). This phase is not complete. Email delivery, public routes, login/recovery, PostgreSQL-backed identity integration tests, and end-to-end verification remain outstanding.
