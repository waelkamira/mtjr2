# Implementation log

## 2026-11-03 — Repository bootstrap

**Scope**
- Added the initial Next.js/React/TypeScript application skeleton.
- Added environment template and repository ignore rules.
- Added Prisma singleton infrastructure.
- Added the first identity/access persistence draft: user, role, permission, scoped assignment, session, OAuth account, reset/verification tokens, consent, login attempts, and audit log.
- Added architecture notes and verification requirements.

**Status**
- Files committed to GitHub: yes.
- Dependencies installed: not run (no local shell/runtime attached to this repository).
- Prisma validate/generate: not run.
- PostgreSQL migration: not created or applied.
- Typecheck/lint/tests/build: not run.
- Authentication workflows: not implemented.
- Identity system: foundation draft only; not complete.

**Next**
1. Verify package versions and framework compatibility with Node.js 22.
2. Install dependencies and run Prisma validate/generate.
3. Add a deterministic seed for baseline system roles and permissions.
4. Implement environment validation, structured errors, and server-side authorization policy tests.
5. Implement registration/login/session lifecycle as the first end-to-end vertical slice.

## 2026-11-03 — Blueprint and CI baseline

**Added**
- Imported the complete 49-system blueprint into `docs/architecture/COMPLETE_PLATFORM_SYSTEMS_BLUEPRINT.md` as the target functional specification for Mtjr2.
- Added Tailwind CSS v4 PostCSS configuration.
- Added Vitest configuration and the first email-normalization unit test.
- Added a GitHub Actions CI workflow using Node.js 22 and PostgreSQL 16. It runs Prisma validation/generation, typecheck, lint, unit tests, and production build.
- Added the initial test strategy document.

**Verification**
- Re-fetched the key files from GitHub and confirmed that they exist on `main`.
- GitHub Actions run was created: [CI run](https://github.com/waelkamira/mtjr2/actions/runs/41572745940).
- At the time of this log update, the workflow was still queued. No passing result is claimed.
- No local dependency installation, Prisma validation, client generation, migration, typecheck, lint, or test execution has been performed in this session.

**Next gate**
- Wait for and inspect the CI result; fix any dependency/configuration/schema issues it reports.
- Only after a successful clean PostgreSQL migration rehearsal should the initial identity schema be treated as a validated baseline.


## 2026-11-03 — CI bootstrap failure and correction

**Observed failure**
- The first CI run failed in `actions/setup-node@v4` before dependency installation.
- The workflow requested npm caching, but the repository did not yet contain a lockfile. Consequently all validation and test steps were skipped; this was an infrastructure failure, not a passing or failing application test.

**Correction**
- Removed the npm cache option until a committed lockfile is available.
- The next push should trigger a fresh CI run.

**Verification**
- Workflow file update committed: `07e2c6e989bb6cb9daa2cc8be482e84236117929`.
- The rerun has not yet been observed. Prisma validation, generation, typecheck, lint, tests, and build remain unverified.


## 2026-11-03 — Identity schema review and ECC-informed workflow

**Schema review**
- Found that nullable `scopeType` and `scopeId` fields in the composite unique key for `UserRoleAssignment` would allow duplicate global/scoped assignments when PostgreSQL treats `NULL` values as distinct.
- Changed both columns to non-null strings with the reserved `GLOBAL` default for unscoped grants. Scoped grants must supply a concrete pair; service-level validation is still required.
- Updated the foundation decision record with this invariant. No migration has been generated, so this is still a pre-migration schema correction.

**Engineering method**
- Added `docs/quality/ENGINEERING_WORKFLOW.md` describing the research → plan → test → implement → review → verify → record loop, informed by ECC.
- This does not claim that ECC's plugin, agents, or skills are installed in the repository.

**CI**
- Removed npm caching from setup-node because no lockfile exists yet.
- Corrected workflow is triggering new runs; the final result is pending at this log entry.
- No Prisma/typecheck/lint/test/build pass is claimed until a completed run is inspected.


## 2026-11-03 — First authorization policy slice

**Implemented**
- Added a pure server-side permission evaluation policy in `src/server/identity/authorization.ts`.
- Global grants apply to all scopes; scoped grants apply only to an exact type/identifier match.
- Expired grants, permission mismatches, and scoped grants without a requested scope are denied.
- Added six unit tests covering global allow, exact-scope allow, cross-store denial, expiry, missing scope, and permission mismatch.

**Limit**
- This is only the policy evaluator. Trusted grant loading from the database, authentication/session resolution, API enforcement, and end-to-end tests are still not implemented.

**Verification**
- Both files were re-fetched from GitHub after commit `852c837c70aa648327a170758c4945af08901afc`.
- The latest GitHub Actions run is still executing dependency installation. No test result is claimed yet.


## 2026-11-03 — Environment validation and database-backed permission loading

**Implemented**
- Added Zod-based environment parsing for PostgreSQL `DATABASE_URL`, public application URL, `AUTH_SECRET` (minimum 32 characters), and supported `NODE_ENV` values.
- Prisma singleton now validates configuration before creating a client and receives the validated database URL explicitly.
- Added configuration tests for valid values, invalid database protocol, short auth secret, and invalid app URL.
- Added a server-side permission repository that loads active user role assignments and their permissions from PostgreSQL, then evaluates them with the pure scope-aware policy.
- The repository rejects blank user IDs and documents that the ID must originate from a verified server session, never client input.

**Security boundary / remaining work**
- Authentication and trusted session resolution do not exist yet. The repository must not be exposed through a route until a verified session resolver is implemented.
- Permission assignment write paths, scope-pair validation, audit events, database migration, and integration tests remain outstanding.
- Environment validation is exercised by unit tests; no real production secrets are stored in the repository.

**Verification**
- CI run `41573058187` for commit `852c837c70aa648327a170758c4945af08901afc` completed successfully: Prisma validate/generate, TypeScript, ESLint, Vitest, and production build all passed.
- This successful run includes the pure authorization policy and its six tests, but predates the database permission repository and environment validation changes.
- CI runs for the latest commits have been triggered; their final results are pending. No pass is claimed for the newest files yet.


## 2026-11-03 — Canonical role assignment scopes

**Implemented**
- Added `normalizeRoleScope`: omitted scope resolves to the reserved global pair; scoped assignments require a non-empty type and identifier.
- Scope types are canonicalized to uppercase and identifiers are trimmed.
- The reserved `GLOBAL` marker cannot be used as a real scope type or identifier.
- Added five tests for global defaults, normalization, incomplete scope rejection, and reserved marker rejection.

**Verification**
- Files committed as `fbc6d7a4d72cc87d1a0c4b106101c8a770b2c32e`.
- The CI run for the prior implementation commit is still pending in GitHub Actions; the new tests have not yet been observed passing.


## 2026-11-03 — Session lifecycle and password primitives

**CI failure diagnosis and correction**
- Retrieved the failing TypeScript job log. Prisma validation and client generation passed; typecheck failed because the environment parser accepted `NodeJS.ProcessEnv`, while the unit-test fixture was a plain object whose `NODE_ENV` widened to `string`.
- Changed the parser input type to `Record<string, string | undefined>`, which matches both process environment and test fixtures without weakening runtime Zod validation.
- CI for the corrected change is still running; no passing result is claimed yet.

**Implemented**
- Added 256-bit URL-safe random session tokens. Only SHA-256 digests are persisted.
- Added database-backed session creation restricted to active accounts, session resolution, single-session revocation, and all-session revocation.
- Session resolution rejects missing, malformed, expired, revoked, and inactive-account sessions. It rechecks revocation and expiry atomically when updating last-seen time.
- Added HTTP-only, SameSite=Lax session cookie helpers, Secure in production.
- Added versioned scrypt password hashing with random salts, fixed resource parameters, timing-safe comparison, and a 12–128 character policy.
- Added unit tests for token primitives, password hashing, and mocked database session lifecycle.

**Limitations / next security gates**
- No public registration or login route is exposed yet.
- Login throttling, email verification delivery, password reset workflow, CSRF/origin protection for mutations, and end-to-end browser/API tests remain necessary before production authentication.
- Session/database integration tests currently mock Prisma; a real PostgreSQL migration-backed test run is still required.
- No Prisma migration has been generated or applied.

**Commits**
- Environment parser typing fix: `a0b41291c86640df384b262c504c45c19a83ce01`.
- Session service: `31de4f4708f01ea59e184de2eb487704a6ded225`.
- Password hashing and cookie helpers: `e4790257f6ab54af9a318add766d2c9012c9026b`.
- Session revocation race guard: `ac51ebbea5b93d75c748fcd721d1caa79be8f8e9`.
- Session lifecycle tests: `806493e93245351ad700d039faa7f894c548a2ae`.

**Verification**
- Earlier baseline CI passed at `852c837c70aa648327a170758c4945af08901afc`.
- CI runs for the corrected environment parser and session implementation are pending. Their test/build outcomes must be checked before the identity slice is considered validated.


## 2026-11-03 — CI test alias resolution correction

**Observed**
- CI for commit `a0b41291c86640df384b262c504c45c19a83ce01` passed Prisma validation/generation, TypeScript, and ESLint.
- Vitest then failed before collecting `role-scope.test.ts`: the TypeScript `@/*` path alias was configured, but Vite/Vitest had no matching runtime alias.
- Existing 12 collected tests passed; one suite failed during module resolution. This was test-runner configuration, not an authorization assertion failure.

**Correction**
- Added an explicit `@` alias in `vitest.config.ts` pointing to the repository's `src` directory.
- Added workflow concurrency cancellation so newer pushes supersede older queued/running CI jobs rather than consuming parallel runners unnecessarily.

**Verification**
- The alias fix is committed as `df26102fcaba04288aab92b8cc38d08dbf505ff1`.
- CI for this correction and the new session tests is pending; no complete passing run is claimed yet.


## 2026-11-03 — CI runner simplification (identity unit-test stage)

**Observed**
- The current identity test suite mocks Prisma for session lifecycle checks; it does not connect to PostgreSQL.
- The CI job nevertheless started a PostgreSQL service container on every push. Container initialization was the long-running step and provided no value to the current mocked/unit-test stage.

**Change**
- Removed the unused PostgreSQL service from the unit/build CI job. A syntactically valid CI-only PostgreSQL URL remains for environment parsing and Prisma CLI configuration; no connection is attempted by these steps.
- PostgreSQL will be restored in a dedicated integration/migration workflow when the plan reaches real database integration tests. This is not a replacement for that gate.

**Verification**
- Workflow change committed as `f34daadca924b7c3979ab0ac861c6521cbb72e42`.
- CI has been triggered by this change; its result must be inspected before claiming the current identity slice passes.


## 2026-11-03 — Phase 2 registration and email verification services

**Plan alignment**
- Rechecked the root README delivery sequence. Work remains inside Phase 2 (Identity and access); Phase 3 Marketplace Core is explicitly blocked until Phase 2 exit gates are met.
- Added a dedicated [Phase 2 execution plan](PHASE_02_IDENTITY_PLAN.md) with package-level checklists and measurable exit gates.

**Implemented**
- Added transactional registration service: validates email/password and required terms/privacy consent, normalizes the email, hashes the password, and creates a PENDING user.
- Creates the email-verification challenge in the same database transaction and stores only its SHA-256 digest.
- Adds immutable consent records for the terms and privacy versions accepted at registration.
- Added single-use verification flow. It checks purpose, expiry, and consumption state, atomically consumes the token, then activates the account.
- Added focused tests for registration persistence, password hash handling, consent capture, required-consent rejection, token expiry/replay/wrong-purpose rejection, and atomic consumption races.

**Security and product boundary**
- The raw verification token is returned only to a trusted server-side caller so a future mail adapter can deliver it. It must never be returned by a public API or logged.
- No email provider is configured, so no verification email is sent yet.
- No public registration/verification endpoint is exposed. Login, password recovery, rate limiting, migrations, and PostgreSQL integration remain incomplete.
- This code is a domain-service slice, not a completed registration journey.

**Verification**
- Commit: `f8eae103369ce609c6b64f4889562b67f294aeb4`.
- CI run for this commit is pending; no passing test/build result is claimed.
- Previous CI runs exposed a Vitest alias resolution problem, now fixed in `df26102fcaba04288aab92b8cc38d08dbf505ff1`.
- CI's PostgreSQL service was removed from the unit/build job because current tests mock Prisma and do not connect to a database. A dedicated PostgreSQL integration/migration job remains a mandatory Phase 2 exit gate.
