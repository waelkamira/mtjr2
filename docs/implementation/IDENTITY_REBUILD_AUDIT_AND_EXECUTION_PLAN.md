# Identity System Rebuild — Audit and Execution Record

**Repository:** `waelkamira/mtjr2`  
**Working branch:** `rebuild/identity-iam`  
**Baseline:** `main` at the start of this rebuild  
**Status:** Phase 1 audit in progress; no production, Vercel, or live database changes.

## Governing rules

This document is the execution record for the Identity and Access Management rebuild. The user-approved identity plan is authoritative.

1. Inspect the existing repository before changing code.
2. Preserve working marketplace behavior and data; do not create duplicate identity systems.
3. Keep one server-authoritative identity and authorization source.
4. Never trust client-supplied user IDs, roles, grants, or resource ownership.
5. Enforce authorization at server boundaries and verify resource/store scope.
6. Do not grant Super Admin through public registration or ordinary role assignment.
7. Super Admin is explicitly in scope: audit, repair, and rebuild its pages, components, APIs, data model, bootstrap, privilege approval, audit trail, and security boundary wherever required. Preserve verified capabilities, but do not preserve insecure behavior merely for compatibility.
8. Do not deploy to Vercel or change Vercel configuration/secrets.
9. Use only disposable/local/CI PostgreSQL for schema and integration verification unless the owner separately approves otherwise.
10. Mark a capability complete only with exact-commit test evidence and documented limitations.

## Approved scope

The rebuilt system must cover authentication, authorization, roles, fine-grained permissions, scoped grants, account lifecycle, sessions, OAuth, email/phone verification where configured, recovery, MFA, audit/security events, route and component access, API and Server Action enforcement, resource ownership, seller/store staff boundaries, admin and Super Admin isolation, Prisma persistence, automated tests, and documentation.

Required actor classes: Guest, Customer, Seller, Seller Staff, Support Agent, Moderator, Finance Admin, Operations Admin, Admin, and Super Admin. Role names alone are not sufficient; sensitive operations require permission and resource-scope checks.

## Phase 1 — Repository and identity baseline audit

### Existing implementation confirmed on `main`

- `package.json` exposes Prisma validation/generation, TypeScript checking, ESLint, unit tests, PostgreSQL integration tests, and production build scripts.
- `prisma/schema.prisma` already contains `User`, `UserStatus`, `Role`, `Permission`, `RolePermission`, `UserRoleAssignment`, `UserSession`, `OAuthAccount`, `PasswordResetToken`, `VerificationToken`, `UserConsent`, `LoginAttempt`, `LoginRateLimitBucket`, and `AuditLog`.
- The schema also contains `Seller`, `Store`, and `SellerStaff`; staff membership is store-scoped at the data-model level.
- Server-only identity modules already exist for current-session resolution, pure authorization policy, permission grant loading, permission enforcement, role assignment/revocation, and related account/security flows.
- Current-session resolution reads the HttpOnly session cookie and resolves it against persisted session state. The permission guard derives the authorization subject from that verified session rather than accepting a client-selected user ID.
- Existing authentication endpoints include registration, login, logout, and `/api/auth/me`. Registration and login use the shared same-origin/JSON mutation guard; login also requires a trusted client IP resolver.
- The repository already has focused identity unit tests and PostgreSQL integration coverage, including registration/verification, session lifecycle, permission scope, role assignment, throttling, and password reset.
- `docs/implementation/PHASE_02_IDENTITY_PLAN.md` records significant completed work and explicitly leaves operational exit gates open.

### Confirmed gaps and risks to verify in subsequent phases

- The current Phase 2 plan does **not** mark the complete HTTP journey as passed: register → verify email → login → authenticated `/api/auth/me` → logout → anonymous denial remains an open gate.
- Real transactional email delivery and a verified sender remain external operational checks; do not claim email verification is operationally complete merely because the adapter exists.
- Trusted proxy configuration and origin-bypass protection remain deployment-specific open checks. Do not trust arbitrary forwarding headers.
- The current schema excerpt contains no dedicated MFA authenticator/recovery-code model and no explicit user-device inventory model. Inspect all identity migrations and existing implementations before designing these additions.
- The current schema excerpt contains no direct user-permission grant model. Decide whether this is genuinely required or whether role assignments are sufficient; do not add unused authorization tables.
- The `main` role-assignment service blocks only the literal `SUPER_ADMIN` key. It does not reject an alternate/custom role carrying `platform:manage`; the Super Admin branch contains a stronger `isProtectedPlatformRole` policy that must be ported and tested. The separate `feat/super-admin-control-panel` branch contains the control-panel UI/API, bootstrap script, and two-person privilege workflow, but it is 77 commits ahead and 19 commits behind `main`; it must not be merged wholesale. Its privilege-request POST/PATCH handlers currently do not call the shared same-origin/JSON mutation guard, a verified CSRF/origin-protection gap to fix before adoption.
- `src/middleware.ts` was not found at the inspected path. Determine whether route protection is implemented through Next.js proxy conventions, layouts, route handlers, or service boundaries; do not add middleware as a substitute for server-side checks.
- A repository-wide route/component/API inventory and systematic authorization coverage review is still required. Search results show broad server-side use of identity guards, but that is not proof every sensitive entry point is protected.
- The identity implementation has multiple named modules and conventions; consolidate only after mapping dependencies and tests. Do not rewrite working flows solely to rename files.

### Phase 1 deliverables

- [x] Confirm canonical repository and safe working branch.
- [x] Inspect package scripts and core Prisma identity schema.
- [x] Inspect canonical session, authorization, permission repository, permission guard, and role assignment services.
- [x] Inspect the existing Phase 2 execution plan and README status claims.
- [ ] Inventory every identity-related source file, migration, route handler, Server Action, layout, page, and component.
- [ ] Map all public, authenticated, customer, seller, staff, admin, and Super Admin routes to server-side policies.
- [ ] Map all sensitive APIs/actions to permission checks and ownership/scope checks.
- [ ] Review all identity migrations against the current Prisma schema and clean PostgreSQL replay.
- [ ] Inventory every Super Admin page, component, API, server service, role/permission, bootstrap path, and privilege-approval workflow.
- [ ] Review and remediate Super Admin UI, API, database, bootstrap, MFA/reauthentication, two-person approval, and audit controls.
- [ ] Record baseline CI and PostgreSQL test evidence for the exact branch head.
- [ ] Publish the completed audit and prioritized remediation list in README.

**Phase 1 is not complete until every unchecked inventory item has evidence or an explicit documented blocker.**

## Rebuild sequence after Phase 1

### Phase 2 — Canonical identity architecture
Define the single identity/session/authorization boundary, trusted actor shape, error contracts, account states, and server-only module ownership. Remove duplicate or conflicting paths only after all consumers are migrated and tests prove equivalence.

### Phase 3 — Authentication and account lifecycle
Verify registration, password login, logout, logout-all, email verification, resend, password recovery/change, OAuth state/PKCE/linking rules, account suspension, and session invalidation. Add phone verification only with an actual configured provider and product requirement.

### Phase 4 — Roles, permissions, and scoped authorization

This phase includes Super Admin protection: reject any role that contains `platform:manage` from ordinary assignment or revocation paths, regardless of its role key; permit platform privilege only through the separately audited bootstrap/approval workflows.
Audit and normalize role/permission keys, system roles, scoped assignments, expiration/revocation, non-escalating delegation, store staff permissions, and admin grants. Define safe Super Admin bootstrap separately from ordinary role assignment.

### Phase 5 — Sessions and account security
Verify opaque token hashing, cookie flags, expiry/rotation, revocation, concurrent requests, session listing, device inventory, password-change revocation, and suspicious-session handling. Add MFA only with secure enrollment, recovery, replay protection, and tests.

### Phase 6 — Route, page, and component protection
Produce a complete route registry. Keep public storefront routes public; protect customer account routes; enforce seller status and store scope; enforce per-permission admin access; isolate Super Admin routes. UI gates are presentation only, never the security boundary.

### Phase 7 — API, Server Action, and data protection
Audit every route handler, Server Action, service, and sensitive database operation. Enforce authenticated actor, active account, permission, server-resolved ownership, store scope, state transition, validation, CSRF/origin protections, rate limits, and idempotency where applicable.

### Phase 8 — Audit, abuse prevention, and operational security
Verify immutable security audit events, login/reset/resend throttling, trusted IP derivation, generic anti-enumeration responses, secret handling, and privileged-action reauthentication/MFA.

### Phase 9 — Prisma and migration integrity
Make only evidence-driven schema changes. Review migrations for forward safety, constraints, indexes, referential behavior, and clean-database replay. Never delete production or user data.

### Phase 10 — Automated verification
Run focused identity unit tests, PostgreSQL integration tests, authorization matrix tests, API/HTTP journey tests, E2E tests where supported, typecheck, lint, Prisma validation/generation, and build. Record exact commit and run URLs.

### Phase 11 — Documentation and closure
Update README, Phase 2 plan, route registry, permission catalog, security review, and build log with actual evidence. Do not mark complete while an exit gate is open.

## Current implementation policy

This is a controlled rebuild, not a destructive rewrite. Existing verified capabilities remain in place until a replacement is implemented, tested, and safely adopted. The canonical schema remains `prisma/schema.prisma`. No Vercel deployment/configuration, production secrets, or production database access is in scope.


## Super Admin audit findings — 2026-11-06

- [x] Confirmed the `main` authorization guard derives the actor from the verified HttpOnly session.
- [x] Confirmed the `main` role assignment service rejects `SUPER_ADMIN` by key but does not reject arbitrary roles carrying `platform:manage`.
- [x] Located the separate Super Admin control-panel candidate branch and measured divergence: 77 commits ahead / 19 behind `main` at audit time.
- [x] Inspected candidate two-person privilege approval, targeted bootstrap, access catalog, and audit-log services.
- [ ] Port the protected-platform-role policy and tests to the rebuild branch.
- [ ] Port the Super Admin UI/API selectively, adapting every mutation route to the canonical request-security guard.
- [ ] Add/verify MFA or step-up authorization for privileged operations.
- [ ] Verify the complete Super Admin route/API/data boundary with negative tests.

The candidate privilege-request `POST` and `PATCH` handlers parse JSON and call state-changing services without invoking `validateIdentityMutationRequest`. These handlers are not safe to adopt as-is. The rebuild must validate origin, fetch metadata, and JSON content type before reading request bodies.
