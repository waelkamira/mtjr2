# Phase 2 — Identity and access execution plan

This phase is part of the dependency-aware sequence in the repository root README. Do not start Marketplace Core (Phase 3) until the exit gates below are satisfied.

## Scope

Deliver a secure identity and access foundation for buyers, sellers, staff, and administrators. Keep authentication mechanisms separate from authorization policy and enforce all decisions on the server.

**Current registration policy (2026-11-06):** email confirmation is not part of registration or account activation. Password registration creates an active account and session immediately after a valid Cloudflare Turnstile challenge. Google registration uses the same challenge before starting OAuth. Persistent per-email/IP and per-IP throttles limit repeated attempts. Historical verification/resend notes below describe retired behavior; legacy database fields remain for compatibility.

## Current identity rebuild update — 2026-11-06

- Password and Google registration activate accounts without an email-confirmation or resend step. Email-verification schema fields remain only for legacy compatibility.
- Unknown-account and incorrect-password failures now share the same public login message and code.
- Password and Google login/registration return to the validated prior same-origin route, including query strings. Protected account/admin routes preserve their requested path through `src/proxy.ts` before redirecting guests to sign-in; MFA challenges return to the same protected destination.
- TOTP MFA is implemented with AES-GCM encrypted secrets, one-time recovery codes, replay protection, and a 12-hour session assurance window. Accounts holding `platform:manage` must enroll; enabled MFA must be verified before protected server operations. Configure a stable, unique `MFA_ENCRYPTION_KEY` before production enrollment; changing it makes existing TOTP secrets undecryptable.
- `/account/security` supports enrollment, confirmation, MFA challenges, one-time recovery-code display, and optional MFA removal for non-platform administrators. Password and Google login both require the challenge when MFA is enabled.
- The additive schema migration is `20261106120000_identity_mfa`. Prisma schema validation passed; client generation, exact-head CI, PostgreSQL migration replay and configured deployment HTTP journeys remain pending.

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
- [x] Implement audited role/permission assignment and revocation services; PostgreSQL integration passed on `74e76a0`.
- [x] PostgreSQL integration coverage for grant loading, cross-store denial, and assignment uniqueness (verified in run 41577431835).

### 2.3 Password and session security
- [x] Versioned scrypt password hashing and timing-safe verification.
- [x] High-entropy opaque session tokens; persist only token digests.
- [x] Session create/resolve/revoke and revoke-all operations.
- [x] HttpOnly session cookie helpers; Secure in production.
- [x] Unit tests for password and session primitives/lifecycle.
- [x] Bind MFA assurance to server-managed sessions and require renewed verification at least every 12 hours.
- [x] Require TOTP enrollment and fresh verification for accounts holding `platform:manage`.
- [x] Encrypt TOTP secrets, prevent code replay, and store one-time recovery-code digests.
- [ ] Covered by the single deployment HTTP end-to-end journey below; no separate cookie/API test suite.
- [x] Add a fail-closed same-origin JSON mutation guard: require exact configured application Origin, reject non-same-origin Fetch Metadata when supplied, and require application/json. Public mutation routes must invoke it before reading bodies or calling domain services.
- [x] Add persistent, HMAC-keyed login rate-limit buckets for normalized identifier/IP pairs and trusted client IPs; store only keyed digests, never raw identifiers/IPs in the throttle ledger.
- [x] Add unit tests for persistent login-throttle key derivation, pair clearing, validation, threshold blocking, and window reset.
- [x] Verify PostgreSQL-backed concurrent login-throttle integration tests, persistent blocking, and pair-bucket clearing (run 41577891224 on commit `399fd314a5c94585b02089e939ae1f3b9bd5e19b`).
- [ ] Tune thresholds using production telemetry before enabling public login.

### 2.4 Registration and bot protection
- [x] Validate registration input and require terms/privacy consent.
- [x] Create active accounts transactionally with hashed passwords and do not require email confirmation.
- [x] Verify Cloudflare Turnstile tokens server-side, including registration action and configured hostname checks.
- [x] Apply persistent HMAC-keyed limits of 3 attempts per normalized email/IP pair and 10 attempts per IP per 15-minute window.
- [x] Require the same bot challenge before starting Google account registration.
- [x] Issue an authenticated session after password registration and return users to their validated prior page.
- [x] Allow legacy PENDING password accounts to become active only after successful password verification.
- [x] Recheck ACTIVE account state atomically when accepting/touching an existing session.
- [x] Remove verification/resend pages, endpoints, and registration email delivery. Keep legacy verification schema data unused for compatibility.
- [x] Add a fail-closed trusted-proxy IP resolver for explicitly configured Cloudflare/Vercel edge headers; arbitrary `X-Forwarded-For` is never trusted. Configure only after the edge overwrites the header and origin bypass is blocked.
- [x] Use a fixed loopback rate-limit bucket only in local development when no trusted proxy is configured; test and production environments remain fail-closed.
- [x] Protect password and Google registration challenge routes with same-origin/JSON checks and fail closed when Turnstile is unavailable.
- [x] Apply the public-registration gate to Google OAuth account creation as well as password registration; already-linked Google accounts remain eligible to sign in.
- [x] Add authenticated password change with current-password verification, atomic hash replacement, revocation of other sessions and outstanding recovery links, and an audit event.
- [ ] Configure `TRUSTED_PROXY_IP_HEADER` for the actual deployment edge; keep IP-dependent endpoints closed until verified.
- [ ] Run one HTTP end-to-end registration → immediate session → authenticated request → logout journey after deployment configuration.

### 2.5 Login, logout, recovery, and enforcement
- [x] Implement password login domain service: normalized identity lookup, dummy-hash verification for unknown accounts, generic credential failures, active-account checks, attempt recording, throttling before scrypt, session issuance, and successful-login audit event (CI passed on commit `8d48d92f8b8f7828d2adda953183b46483ba3a6d`, run 41580301822).
- [x] Server-side logout primitive revokes the current cookie-backed session, records an audit event, and clears the cookie even on invalid-session/error paths (unit tests and CI passed on commit `8d48d92f8b8f7828d2adda953183b46483ba3a6d`, run 41580301822). HTTP route remains blocked on CSRF/Origin enforcement.
- [x] Add server-side password-reset challenge issuance for active accounts without requiring email verification; invalidate older outstanding challenges and persist only SHA-256 token digests (verified by PostgreSQL integration run 41581259836).
- [x] Add atomic one-time password-reset completion, password replacement, session revocation, and audit event (verified by PostgreSQL integration run 41581259836).
- [x] Add reset-request throttling with separate HMAC-keyed identifier/IP buckets (3 per identifier/IP pair and 10 per IP per 15 minutes); reset traffic cannot consume login-attempt budget. The HTTP handler must return the same generic response for unknown, throttled, and eligible accounts.
- [x] Implement server-only Resend email delivery adapter; public recovery remains blocked until credentials and a verified sender are configured and delivery is smoke-tested.
- [x] Server-side current-session resolver for server components/route handlers; reads only the HttpOnly request cookie and resolves it against the session store, with a fail-closed required-session guard (unit tests and CI passed on commit `1de06a1325b29cafbeae5693d3aa78ff7dc339e5`).
- [x] Server-only permission guard composes the verified request session with database-loaded permissions; denies missing permissions and never accepts a client-selected authorization subject (unit tests and CI passed on commit `8d48d92f8b8f7828d2adda953183b46483ba3a6d`, run 41580301822).
- [x] Security audit events for registration, login failures/success, logout, password reset, and role changes. Failed logins remain in the dedicated keyed `LoginAttempt` ledger.
- [x] Essential negative cases are covered by the existing focused unit/PostgreSQL suites: anonymous/invalid session, inactive account, cross-store denial, token replay/expiry, and rate-limit enforcement. No additional matrix planned.

## Minimal verification gates\n\n1. General CI: Prisma validate/generate, typecheck, lint, unit tests, and production build.\n2. PostgreSQL identity integration for registration/verification/login/session/authorization.\n3. PostgreSQL password-reset lifecycle: digest-only token, one-time use, password change, audit, session revocation.\n4. One HTTP end-to-end journey after Turnstile/proxy configuration.\n\nDo not add tests for every helper; add tests only for critical security regressions, real bugs, or independent business invariants.\n\n## PostgreSQL integration work

- [x] Add a dedicated integration-test configuration so database tests never run in the mocked/unit CI job.
- [x] Add a PostgreSQL 16 workflow that deploys committed migrations, seeds baseline roles/permissions, and executes real database tests.
- [x] Verify registration, consent persistence, verification-token digest storage, and one-time token consumption against PostgreSQL.
- [x] Verify concurrent verification-token consumption allows exactly one successful consumer.
- [x] Verify store-scoped permission resolution, cross-store denial, assignment uniqueness, session creation, and revocation against PostgreSQL.
- [x] Add PostgreSQL integration coverage for concurrent login-throttle requests, persistent blocking, and pair-bucket clearing.
- [x] Updated integration workflow passed on the current pre-login-service commit.
- [x] Add PostgreSQL integration coverage for password login success/failure, login-attempt persistence, audit creation, session token digest storage, session resolution, and revocation (verified by PostgreSQL integration run 41581259836).
- [ ] Registration rollback fault injection deferred; not an exit gate unless a concrete transaction regression is found.
- [x] Add PostgreSQL coverage for password-reset token digest storage, one-time consumption, password replacement, audit event, and session revocation (verified by PostgreSQL integration run 41581259836).

## Exit gates — all required

1. Prisma schema validates and a first migration deploys to a clean PostgreSQL database.
2. Baseline roles/permissions are seeded repeatably.
3. Registration → immediate session → authenticated request → logout works end to end.
4. Password reset and session revocation behavior is covered.
5. Authorization is enforced server-side and cross-scope access is denied.
6. CI passes Prisma validation/generation, typecheck, lint, all unit/integration tests, and production build.
7. Security review and this plan/build log document evidence and remaining limitations.

**Historical position:** the identity baseline migration is committed and has been deployed successfully to a clean PostgreSQL 16 database in CI. The baseline seed is verified for repeatability by two consecutive executions. The general CI and first PostgreSQL-backed identity integration workflow both passed on commit `3a4b040a523922cf927a1732819a946c67951314` (runs 41577431810 and 41577431835). The first integration run verified registration, one-time email verification, scoped authorization, assignment uniqueness, and session revocation. Concurrent verification-token consumption and PostgreSQL-backed login-throttle concurrency tests passed in run 41577891224 on commit `399fd314a5c94585b02089e939ae1f3b9bd5e19b`. General CI run 41577891247 also passed on that exact commit. The password login service and focused unit tests passed CI on commit `87fc2167a3ae97109cb15160d7f28076d8e829f8` (run 41578452511); its PostgreSQL persistence path is now covered by the integration test added on commit `bdd5d195f34f3325dea3d7a1a18299751aad11d2` (run 41580756063). The current-session resolver and its unit tests passed CI on commit `1de06a1325b29cafbeae5693d3aa78ff7dc339e5` (run 41579953764). Logout/recovery endpoints, email delivery, CSRF/origin protection, and full public HTTP E2E remain outstanding. The permission guard and logout primitive passed general CI and PostgreSQL integration on commit `8d48d92f8b8f7828d2adda953183b46483ba3a6d` (runs 41580301822 and 41580301896). The logout primitive itself is unit-tested; there is not yet a cookie-context HTTP logout integration test. The PostgreSQL-backed login service test passed on commit `bdd5d195f34f3325dea3d7a1a18299751aad11d2` (run 41580756063), and general CI passed on that commit (run 41580756068). The password-reset service and PostgreSQL lifecycle test passed in run 41581259836; general CI passed on documentation head 79e260082aebe48d6fe2bca535b4f36a55ba4f3b (run 41581280754). Reset-request throttling now uses distinct action-namespaced HMAC buckets in the existing persistent bucket table, keeping login and recovery budgets isolated. A fail-closed Origin/Fetch Metadata/JSON content-type guard is committed. The first CI attempt exposed a malformed regular-expression escape in that guard; it has been corrected. Resend adapter and corrected guard are awaiting CI. Phase 2 remains incomplete; Phase 3 remains blocked. Password reset has passed its focused PostgreSQL lifecycle test and general CI. Phase 2 remains incomplete; Phase 3 remains blocked.


## Historical status — 2026-11-03 (superseded by current registration policy)

- The latest UI/action-page commit is `7a30994e62de079839c8778f3d1f1a368097c2bc`; general CI passed in [run 41645257014](https://github.com/waelkamira/mtjr2/actions/runs/41645257014).
- The identity PostgreSQL integration suite passed on the preceding identity-code commit `da19c57876e39d9564e0ca519726e3b6b2efcf0a` in [run 41643736067](https://github.com/waelkamira/mtjr2/actions/runs/41643736067). The subsequent commit only added UI pages and documentation.
- The integration workflow now also triggers when `src/app/api/auth/**` changes, so future public-route changes cannot silently skip the database integration gate.
- Remaining blockers were operational, not a request for more unit tests: configure Resend and trusted proxy settings; run one HTTP journey covering register, email verification, login, `/api/auth/me`, logout, and denial after logout.
- Do not expand the suite beyond the existing general CI, PostgreSQL integration, and one HTTP journey. Phase 3 stays blocked until the operational journey is verified.


## Role-management update — 2026-11-03

- Implemented audited role assignment and revocation services. Assignment requires a verified actor with `roles:assign`, an ACTIVE target account, rejects `SUPER_ADMIN`, rejects expired grants, and prevents delegating permissions the actor does not hold in the requested scope.
- Added `POST` and `DELETE /api/admin/users/[userId]/roles` endpoints with same-origin/JSON mutation validation.
- Corrected revocation so the assignment must belong to the user identified by the route path; mismatches return not-found rather than revoking another user's grant.
- General CI passed on the exact latest commit `61213d50c70e759d5f9a9af57c8718a7e5adba19` ([run 41646776279](https://github.com/waelkamira/mtjr2/actions/runs/41646776279)): Prisma validate/generate, typecheck, lint, unit tests, and production build.
- PostgreSQL identity integration passed on preceding commit `fc853041398d825e67998bbb6cdba7ebb4bb58f7` ([run 41646756451]). The role-management code was not covered by that run.
- The integration workflow path filter now needs to include the admin role route; the next PostgreSQL run will verify the latest role-management changes through the existing essential suite. No helper-by-helper tests are planned.
- Phase 2 remains open pending the PostgreSQL run on the latest role-management code and the deployment-only email/proxy smoke test plus one HTTP identity journey. Phase 3 remains blocked until the exit gates pass.


## Historical status — 2026-11-03 (superseded by current registration policy)

- Latest application/test commit: `f15d994e8504c89c981c0de04473799da66c4848`.
- General CI passed on that exact commit: [run 41648336062](https://github.com/waelkamira/mtjr2/actions/runs/41648336062). This includes Prisma validate/generate, typecheck, lint, the existing unit suite, and production build.
- PostgreSQL identity integration passed on `0ffb3b4651b06d90c9eecb10eed960c87bae0348`: [run 41647984160](https://github.com/waelkamira/mtjr2/actions/runs/41647984160). This includes the role-management path filter's database gate and identity/audit lifecycle coverage.
- The initial CI on `0ffb3b4` exposed a mock setup gap after audit events were added. Fixed by extending the existing registration/verification test in `f15d994`; no new test file or broad test matrix was added.
- **Implementation status:** identity/authentication/authorization code is implemented; code verification gates are passing.
- **Only remaining Phase 2 exit work:**
  1. Add deployment secrets `RESEND_API_KEY` and verified `RESEND_FROM_EMAIL`; perform one real email-delivery smoke test.
  2. Configure `TRUSTED_PROXY_IP_HEADER` for the actual edge, ensure the edge overwrites it, and block direct origin access.
  3. Run exactly one deployed HTTP journey: register → immediate session → `/api/auth/me` → logout → confirm anonymous access is denied.
  4. Record the deployment evidence and security review; then close Phase 2 and start Phase 3 (Marketplace Core).
- No more helper-level tests are planned. Registration rollback fault injection and separate cookie/API tests are deferred; the single HTTP journey is the final route-level verification.


## Historical frontend journey update — 2026-11-04

- Added dedicated `/login`, `/forgot-password`, `/reset-password`, and `/verify-email` pages wired to the existing same-origin JSON APIs. The shared client flow handles pending, server errors, generic anti-enumeration responses, and a same-origin-only post-login return path.
- Verification tokens are removed from the visible URL immediately after being read into page state. Reset and verification tokens are submitted only to their matching API endpoints.
- `/register` exposes a development-only test account form when `NODE_ENV=development` and `PUBLIC_REGISTRATION_ENABLED` is unset or `true`; production registration remains hard-disabled and defaults to `false`. Do not enable production account creation until the owner approves the legal documents and the UI can present them before consent.
- Password and Google login accept only validated same-origin `returnTo` paths and otherwise return to `/`. Google login authenticates only an already-linked Google identity; it does not create accounts or automatically link Google to an existing password account.
- Added a user-facing Sign out button to `/account/orders`; it posts to `/api/auth/logout`, disables while pending, displays errors, and redirects only after server success. Still requires deployed verification that the cookie is cleared and `/api/auth/me` denies the revoked session.
- These new pages are source-implemented but await exact-head CI and deployed HTTP/browser verification. They do not close Phase 2. Real email delivery and trusted proxy configuration remain deployment-only gates.


## Historical identity system audit — 2026-11-05 (PR #36; superseded)

The identity feature review is governed by System 01 and the Phase 2 exit gates above. This historical UX slice added duplicate-email HTTP 409 handling (including Prisma P2002 race handling), a registration redirect to email verification, and distinct unknown-email versus wrong-password feedback for eligible accounts.

**Current exact verification state:** PR #36 head `fb417184da3c576c985a2d54c0a435a778f88527`. The preceding merged PR test candidate (merge commit `050bb6079012538cc48e2d24109e3e76de12d458`) passed Prisma validate/generate, typecheck and lint, but unit tests exposed one stale assertion expecting a raw `userId: null` in LoginAttempt. The implementation correctly stores only HMAC digests; the assertion was corrected. The PostgreSQL workflow pull-request path filter was also corrected to run when identity services, auth routes, account identity APIs, identity tests or integration tests change. New exact-head CI and PostgreSQL results are pending; no build success is claimed.

**Scope findings — still not complete:**
- Core password registration/login, logout service/route, password reset, authenticated password change, current-session resolution, session listing/revocation, profile update, consent capture, audit events, persistent rate limits, same-origin mutation protection, role/permission evaluation and audited role assignment/revocation are implemented in source. Email verification and resend flows are retired.
- The account address surface now supports list/create/edit/default selection/delete through owner-scoped APIs and a bilingual account UI. PR #79 merged as `cc5545b`; focused service tests, exact-head General CI, disposable PostgreSQL, and the Browser E2E suite passed. No new Prisma model or migration was required. The broader identity and address browser/provider journeys remain distinct release gates.
- Google OIDC/PKCE code exists, but provider-backed sign-in/registration has not been exercised with real Google credentials and redirect URI.
- TOTP MFA and one-time recovery codes are implemented; Super Admin operations require enrollment and fresh verification. Passkeys are not implemented.
- Real Resend delivery for password reset, Turnstile configuration, trusted-proxy header configuration/edge overwrite and origin-bypass prevention, and one deployed HTTP journey (register → immediate session → /api/auth/me → logout → anonymous denial) remain operational exit gates.
- Production public registration remains disabled until policy/legal and operational approval. Development/test registration may be enabled by the environment gate; never infer production readiness from that.
- The former email-versus-password error distinction is retired; public login failures are generic to reduce account enumeration.

**Decision:** System 01 / Phase 2 remains **Implemented / not Verified / not Complete**. Do not close Phase 2 or unblock its final release gate until exact-head General CI, PostgreSQL identity integration, configured delivery/proxy controls and the single deployed HTTP journey are evidenced. Keep verification focused; no broad helper-level test expansion.


### 2.6 Sign-in and registration experience alignment
- [x] Align the sign-in and registration page hierarchy with the Akaar flow while retaining Mtjr2's marketplace design tokens and account safeguards.
- [x] Keep email/password sign-in, password recovery, seller-vs-customer registration, required policy consent, and Turnstile bot protection in one connected journey; account activation does not require email verification.
- [x] Add Google sign-in for existing linked accounts as a distinct OAuth intent; login intent cannot create an account, silently link an email, or record registration consent.
- [x] Preserve safe same-origin return paths through the Google OAuth state-cookie flow.
- [x] Add focused regression coverage for linked Google login and rejection of unlinked identities during login.
- [ ] Verify exact-head CI/PostgreSQL integration and complete one deployed registration → immediate session → account → logout journey after Turnstile and trusted-proxy configuration.



## 2026-11-08 — Password registration policy aligned and merged

- PR #78 is merged into `main` as `fde3b47b098b1f15ed40a141b6c66b9a6c237946`.
- Password registration creates an ACTIVE customer account and attempts immediate server-side session creation. A post-creation session/cookie failure returns a clear sign-in-required response instead of a misleading registration failure.
- Password registration/login no longer require email verification. Legacy pending registrations can activate after valid password proof; administrator-imposed PENDING holds retain their reason and cannot be cleared by user login.
- Seller applications remain pending and do not grant seller permissions before approval.
- Exact PR-head General CI, disposable PostgreSQL, and Browser E2E passed (runs 42489542922, 42489548427, 42489548337, 42489548167).
- Fresh checks on the squash-merged `main` commit are running: General CI 42489984972, platform PostgreSQL 42489984985, and clean migration replay 42489985055. Record their final outcomes before closing this verification item.
- **Phase 2 remains Implemented / not Verified / not Complete.** Remaining exit gates are operational: production Turnstile configuration, verified Resend sender and one password-reset delivery smoke test, trusted-proxy header/edge overwrite and direct-origin bypass prevention, plus one deployed HTTP journey (register → immediate session → `/api/auth/me` → logout → anonymous denial). Do not access production settings or database without explicit owner approval.


## 2026-11-08 — Saved address lifecycle completed in main

- PR #79 merged as `cc5545b96cbb00c82757819a6b1c58fbd338b805`.
- Customer address management now supports create, edit, default selection, and delete, in addition to list. Mutations are owner-scoped, use same-origin JSON protection, and serialize default-address changes per customer.
- Deleting the default promotes the newest remaining address. Existing checkout quote snapshots remain intact because the source-address relation is nullable with `ON DELETE SET NULL`.
- Focused address service tests, General CI, disposable PostgreSQL, and the Browser E2E suite passed on the exact PR head; merged-main General CI also passed. The browser suite did not add a dedicated address interaction test.
- Phase 2 remains open for real Turnstile/Resend/trusted-proxy configuration and the single deployed HTTP identity journey.
