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


## 2026-11-03 — Identity lifecycle race hardening

**Plan alignment**
- Continued Phase 2 only; no Marketplace Core work was started.
- Reviewed the registration and session services against the security requirements in the Phase 2 plan.

**Changes**
- Email verification now activates a user only through a conditional update requiring the account to remain `PENDING`. A valid token cannot reactivate a suspended or disabled account.
- Session resolution now rechecks that the related user is still `ACTIVE` in the same atomic database update that refreshes `lastSeenAt`. This closes the gap where an account could be suspended after the initial read but before the session was accepted.
- Expanded mocked lifecycle tests to assert both database predicates and the fail-closed result when the account state changes.

**Verification**
- The preceding commit `8177b9fd62d2c25212d030fc33bbb2c4863edec0` passed GitHub Actions run `41574008123`: Prisma validate/generate, TypeScript, ESLint, Vitest, and production build all completed successfully.
- The race-hardening changes are committed separately; their own CI run must pass before they are treated as verified.
- These are unit tests with mocked Prisma. PostgreSQL migration-backed integration tests remain a required Phase 2 gate.

**Remaining Phase 2 work**
- Login throttling integration/concurrency tests and telemetry-based threshold tuning.
- Transactional email provider adapter and resend anti-enumeration/cooldown.
- Login/logout/password reset and server-side session/authorization guards.
- Initial migration, deterministic role/permission seed, PostgreSQL integration tests, and end-to-end identity journey.


## 2026-11-03 — Persistent login-abuse throttling foundation

**Plan alignment**
- Continued Phase 2 identity work; Marketplace Core remains blocked.
- Implemented the persistent throttling primitive before exposing any login endpoint.

**Design**
- Added a dedicated `LoginRateLimitBucket` table with an atomic counter, fixed rolling-window start, and temporary block expiry.
- Rate-limit keys are HMAC-SHA256 digests using the server-only `AUTH_SECRET`; raw email identifiers and IP addresses are not stored in throttle buckets.
- A successful login clears only its identifier/IP pair bucket; IP-wide counters remain, so successful sign-in does not reset network abuse signals.
- Reworked the `LoginAttempt` schema to store keyed identifier/IP digests rather than raw values, preserving the future audit trail without retaining direct login identifiers or network addresses.
- Current conservative defaults: 5 attempts per normalized identifier/IP pair and 30 attempts per trusted client IP within 15 minutes; threshold crossing blocks that key for 15 minutes. Pair-based throttling avoids globally locking a victim's account when an attacker targets the email from unrelated IP addresses.
- Client IP must be derived only from a correctly configured trusted-proxy boundary. Do not trust arbitrary `X-Forwarded-For` values from the public request.

**Implementation boundary**
- This commit provides the persistence model and reusable rate-limit service only. No public login route is exposed.
- A future login service must consume a rate-limit slot before expensive password verification, clear the identifier/IP pair bucket after successful authentication, record the final attempt outcome, use generic failure responses, and add abuse controls for distributed attacks.
- The schema change has no migration yet. A clean PostgreSQL migration rehearsal and real concurrency/integration tests remain mandatory.

**Verification**
- The previous account-state hardening commit passed CI run `41574444085` in full.
- This new schema/service/test change is pending its own CI run. No pass is claimed here.


## 2026-11-03 — Login throttle CI failure diagnosis

**Observed failure**
- CI run [41575113522](https://github.com/waelkamira/mtjr2/actions/runs/41575113522) completed with failure. Prisma validation/generation, typecheck, and lint passed; Vitest reported 2 failures in `login-throttle.test.ts` (41 tests passed, 2 failed), so the production build was skipped.
- The tests asserted hard-coded HMAC key values even though the service correctly derives per-input digests. Their expected database predicates therefore did not match the actual keys.
- Reviewing the implementation also exposed a real consistency defect: successful-login clearing derived the pair key from JSON tuple serialization, while attempt consumption used a colon-delimited string. The clear operation could never target the same bucket.

**Correction prepared**
- Standardized both operations on the same JSON tuple serialization for the identifier/IP pair key.
- Updated throttle tests to assert against the actual keys passed to Prisma, and to verify reset behavior for both pair and IP buckets.
- Corrected the earlier log wording and synchronized the remaining-work list with the implemented throttle foundation.

**Verification**
- Correction commit: `021a8527a0be6c3dd819441b8d1e1cd4a7953543`.
- CI run [41575486446](https://github.com/waelkamira/mtjr2/actions/runs/41575486446) completed successfully: Prisma validate/generate, TypeScript, ESLint, all unit tests, and production build passed.
- The corrected throttle unit tests are now CI-verified. PostgreSQL-backed throttle/concurrency tests and telemetry-based threshold tuning remain open; no migration or public login route exists yet.

## 2026-11-03 — Phase 2 validation checkpoint

**Verified**
- Confirmed `main` points to `021a8527a0be6c3dd819441b8d1e1cd4a7953543`.
- Confirmed successful CI run `41575486446` on that exact commit. All quality steps completed successfully, including the production build.
- Updated the throttle pair-key implementation and tests after the previous CI failure; the successful run verifies this correction at unit-test/build level.

**Next work package (still Phase 2)**
1. Generate the initial identity migration from the canonical Prisma schema using the pinned Prisma CLI.
2. Apply it to a disposable, clean PostgreSQL 16 instance in CI and inspect the generated SQL before committing it.
3. Add deterministic, repeatable baseline roles and permissions seed.
4. Add real PostgreSQL integration tests for uniqueness, scoped grant loading/assignment, session lifecycle, registration transactionality, and rate-limit concurrency.

**Boundary**
- The successful CI run uses mocked Prisma for unit tests and a CI-only DATABASE_URL for CLI configuration; it does not prove a PostgreSQL connection or migration works.
- Phase 2 remains in progress. Phase 3 is not authorized until every exit gate in `PHASE_02_IDENTITY_PLAN.md` is satisfied.


## 2026-11-03 — Committed identity migration and repeatable baseline seed

**Migration**
- Generated the initial migration from the canonical `prisma/schema.prisma` using the pinned Prisma 6.19.0 CLI.
- Reviewed the generated SQL structure: three PostgreSQL enums, 13 tables, primary/unique/index definitions, and foreign-key constraints for the identity/access foundation.
- Applied the generated migration to a clean PostgreSQL 16 service and verified `prisma migrate status`.
- Committed `prisma/migrations/migration_lock.toml` and `prisma/migrations/20261103000000_identity_baseline/migration.sql` as `5dcfc614840d96221394c29a670da43061eef1b1`.
- The successful rehearsal run is [41576239995](https://github.com/waelkamira/mtjr2/actions/runs/41576239995). It completed every step, including committing the generated migration.

**Repeatable seed**
- Added `prisma/seed.cjs` and the `db:seed` package script.
- Seed uses stable role/permission keys and Prisma upserts; it creates no user and assigns no privileged role to any user.
- Baseline roles: CUSTOMER, SELLER, STORE_MANAGER, SUPPORT_AGENT, ADMIN, SUPER_ADMIN.
- SUPER_ADMIN is a role definition only; it is never assigned automatically. Store-level roles still require scoped user-role assignments.
- The database workflow now deploys the committed migration and runs the seed twice against the same clean database to verify idempotent execution.

**Verification boundary**
- The migration deployment is verified by run 41576239995.
- The updated committed-migration + double-seed workflow and the package changes are being tested by the next CI runs; no seed pass is claimed until those runs finish.
- PostgreSQL-backed tests for real authorization/session/registration/throttle operations remain open. A migration rehearsal is not a substitute for those integration tests.

**Next**
1. Verify the committed-migration workflow and two consecutive seed executions.
2. Add database-backed integration tests for uniqueness, scoped grants, registration transactions, session lifecycle, and throttle concurrency.
3. Continue login/recovery/session resolver work and close the Phase 2 exit gates. Phase 3 remains blocked.


## 2026-11-03 — Clean PostgreSQL baseline and CI lint correction

**Verification**
- Database Baseline run [41576588203](https://github.com/waelkamira/mtjr2/actions/runs/41576588203) passed on commit `5106f13755ff51a00e40707bf82282ef02b11cb1`.
- The workflow verified the committed migration, deployed it to a clean PostgreSQL 16 database, checked migration status, and executed `npm run db:seed` twice successfully.
- The seed created/updated 6 system role definitions, 21 permissions, and their role-permission links; it did not assign any role to a user.
- The general CI run [41576588184](https://github.com/waelkamira/mtjr2/actions/runs/41576588184) failed only at ESLint: CommonJS `require` in the executable seed was flagged, and an unused test import was reported. Prisma validation/generation and TypeScript passed; tests/build were skipped due to lint failure.

**Correction**
- Kept the seed as CommonJS because the package script invokes the `.cjs` file directly; added a narrowly scoped lint suppression with an explanatory comment rather than changing runtime module semantics.
- Removed the unused `IdentityConflictError` test import.
- This correction must pass the full CI pipeline before being treated as complete.

**Next**
1. Verify the new full CI run after the lint correction.
2. Add PostgreSQL-backed tests for authorization scope, registration/session transactions, and rate-limit concurrency.
3. Continue the remaining Phase 2 authentication journey; Phase 3 remains blocked.


## 2026-11-03 — First PostgreSQL-backed identity integration slice

**Implemented**
- Added a dedicated Vitest integration configuration and `npm run test:integration`; integration tests are excluded from the default mocked/unit test run.
- Added `.github/workflows/identity-integration.yml`, which starts PostgreSQL 16, deploys only committed migrations, seeds baseline roles/permissions, and runs the integration suite.
- Added a real-database journey test for registration, consent persistence, verification-token digest storage and single-use consumption, store-scoped permission resolution, scoped-assignment uniqueness, session creation, and revocation.
- Updated the Phase 2 plan with this package and its verification boundary.

**Verification boundary**
- The test and workflow files have been authored and committed, but the new workflow has not yet completed. No PostgreSQL integration pass is claimed.
- The test does not yet cover password reset, rollback fault injection, login-throttle concurrency, HTTP routes, cookies, or a full browser/API authentication journey.
- Phase 3 remains blocked until every Phase 2 exit gate passes.

**Next**
1. Inspect the first Identity PostgreSQL Integration run and fix any failing test or workflow issue.
2. Add real-database rollback and login-throttle concurrency coverage.
3. Implement login, logout, password reset, trusted session resolution, and server-side authorization enforcement.


## 2026-11-03 — PostgreSQL integration verification and concurrency expansion

**Verified**
- General CI run [41577431810](https://github.com/waelkamira/mtjr2/actions/runs/41577431810) passed every step on commit `3a4b040a523922cf927a1732819a946c67951314`: dependency install, Prisma validate/generate, TypeScript, ESLint, unit tests, and production build.
- Identity PostgreSQL Integration run [41577431835](https://github.com/waelkamira/mtjr2/actions/runs/41577431835) passed every step: PostgreSQL 16 startup, committed migration deployment, baseline seed, and real-database integration tests.
- The passing integration slice covered transactional registration data, consent records, token digest persistence and single-use verification, scoped permission loading and cross-scope denial, role-assignment uniqueness, and session lifecycle/revocation.

**Added after the passing run**
- Changed the verification test to race two consumers against the same token and assert exactly one succeeds.
- Added concurrent PostgreSQL login-throttle requests, persisted block verification, and pair-bucket clearing coverage.
- These new assertions are committed separately and must pass the next integration workflow before they are marked verified.

**Remaining Phase 2 gates**
- Login/logout service and routes; trusted server-side session resolver and authorization guards.
- Password-reset token lifecycle and session revocation.
- Real email adapter and resend anti-enumeration/cooldown.
- CSRF/origin protections and public HTTP E2E journey.
- Security review and final evidence in this log.

**Boundary**
- Phase 2 remains in progress. No Marketplace Core (Phase 3) work has started.


## 2026-11-03 — PostgreSQL concurrency verification and password-login service

**Verified on commit `399fd314a5c94585b02089e939ae1f3b9bd5e19b`**
- General CI run [41577891247](https://github.com/waelkamira/mtjr2/actions/runs/41577891247) passed dependency installation, Prisma validate/generate, TypeScript, ESLint, all unit tests, and production build.
- Identity PostgreSQL Integration run [41577891224](https://github.com/waelkamira/mtjr2/actions/runs/41577891224) passed PostgreSQL startup, committed migration deployment, baseline seed, and real database integration tests.
- The updated integration tests verified that concurrent consumers of one verification token produce exactly one successful activation.
- They also verified concurrent login-throttle requests, persisted blocking, and clearing only the identifier/IP pair bucket while retaining the IP-wide counter.
- The earlier runs 41577859328 and 41577859276 on the parent commit were cancelled during dependency installation when newer pushes superseded them. They are not counted as failures or passes; the replacement runs above passed on the corrected commit.

**Implemented next — commit `654f581198393d9a981e46460ff92f4deab16957`**
- Added `src/server/identity/login.ts` as a server-side password-login domain service.
- The service normalizes email, consumes persistent throttling before scrypt, performs dummy-hash verification for unknown accounts, uses a generic credential failure for unknown/wrong-password/unverified/inactive accounts, and issues sessions only to active email-verified accounts.
- It records successful and failed login attempts using HMAC-keyed identifier/IP digests, updates last-login time, and writes a successful-login audit event. If the success-recording transaction fails after session creation, it revokes that session.
- Added focused unit tests for successful login, unknown-account timing path, inactive accounts, throttle short-circuiting, and invalid input.

**Verification boundary**
- Commit `654f581198393d9a981e46460ff92f4deab16957` has been pushed. Its general CI and PostgreSQL integration workflows must complete before the new login service is marked verified.
- No public login/logout HTTP route exists yet. Trusted proxy IP resolution, CSRF/origin enforcement, logout, password reset, real email delivery, session resolver/route guards, and public HTTP E2E remain open.
- The integration workflow currently verifies the identity persistence/throttle slice; it does not yet exercise the new login service against PostgreSQL.

**Next**
1. Inspect CI and PostgreSQL integration runs for commit `654f581198393d9a981e46460ff92f4deab16957`.
2. Fix any test/type/lint/build failures before moving forward.
3. Extend PostgreSQL integration coverage to login-attempt persistence, successful login/session issuance, and inactive/unverified rejection.
4. Then implement the trusted server session resolver and logout/recovery flows. Phase 3 remains blocked.


## 2026-11-03 — Premium marketplace visual foundation

**Direction approved**
- Reviewed the two user-provided visual references.
- Adopted a premium botanical/editorial direction: deep forest green, sage, warm ivory, and restrained copper accents, with soft depth, rounded surfaces, generous spacing, and image-led product presentation.
- Adapted the visual language for a global multi-vendor marketplace rather than copying grocery/plant-shop content or screen layouts.

**Implemented**
- Added `docs/design/VISUAL_DESIGN_SYSTEM.md` covering palette, surface hierarchy, shape, typography, marketplace component principles, responsive behavior, RTL/LTR, accessibility, rollout sequence, and acceptance criteria.
- Replaced the starter CSS colors with shared semantic design tokens in `src/app/globals.css`.
- Added visible keyboard focus styling and reduced-motion support.
- Updated README to make the design system an official project reference.

**Boundary**
- This is the visual foundation only. Storefront pages, shared components, seller center, and admin UI have not yet been implemented or visually verified.
- Design foundation proceeds in parallel and does not alter Phase 2 identity/security exit gates. Phase 3 remains blocked until Phase 2 is complete.


## 2026-11-03 — Request-bound server session resolver

**Implemented**
- Added `src/server/identity/current-session.ts` as a server-only request-bound session resolver.
- The resolver reads the HttpOnly session cookie through Next.js request cookies and validates it through the existing database-backed session lifecycle service.
- Added `requireCurrentSession`, which fails closed with a typed `AuthenticationRequiredError` for protected server operations.
- Added unit tests for valid cookie resolution, missing cookie short-circuit, invalid session rejection, and authenticated resolution.
- Updated the Phase 2 plan. This resolver is an internal server primitive; no public route or client-controlled user-ID authentication path was introduced.

**Verification**
- CI for the visual foundation commit `23a2c242c6d8c5b03facdf93ca6ceddcc76d63c0` is still in progress (run 41579469059); its final result is not yet known.
- The new resolver and tests are committed in this change and remain pending CI verification.

**Next**
1. Verify this commit with CI.
2. Add a server-side permission guard that composes the verified current session with the scoped permission repository.
3. Implement logout with server-side revocation and cookie clearing, then add database-backed lifecycle coverage.
4. Continue CSRF/origin controls and password-reset lifecycle before public authentication routes.


## 2026-11-03 — Vitest server-only resolution fix

- CI on commit `4507382bffc27aeecee4a99626b72409aa72ae00` found one unit-test environment issue: Vitest could not resolve Next.js's `server-only` poison-pill package when importing the server session resolver.
- PostgreSQL integration passed on that commit. Prisma validation/generation, typecheck, and lint passed; 48 unit tests passed, while the new current-session test suite failed at module resolution before its assertions. Production build was skipped after the test failure.
- Added a Vitest-only alias to a local empty shim under `tests/mocks`. This shim is used only by Vitest; the production source still imports `server-only`, preserving Next.js's server/client boundary enforcement.
- The fix is awaiting CI rerun. Do not count the current-session unit suite or production build as verified until the new run passes.


## 2026-11-03 — Current-session CI verification and server permission guard

**Verification**
- CI run [41579953764](https://github.com/waelkamira/mtjr2/actions/runs/41579953764) passed on commit `1de06a1325b29cafbeae5693d3aa78ff7dc339e5`: Prisma validate/generate, typecheck, ESLint, all unit tests, and production build.
- This verifies the Vitest-only `server-only` alias and the request-bound current-session resolver unit tests.
- PostgreSQL integration run [41579638692](https://github.com/waelkamira/mtjr2/actions/runs/41579638692) passed on commit `4507382bffc27aeecee4a99626b72409aa72ae00`. It verifies the existing migration-backed identity integration suite, not the later permission guard.

**Implemented next**
- Added `src/server/identity/permission-guard.ts` as a server-only enforcement boundary.
- It requires the current verified request session, obtains the authorization subject exclusively from `session.userId`, loads database-backed grants, and denies requests without the requested permission.
- Added tests for allowed scoped permission, denied permission, unauthenticated short-circuit, and ignoring an attacker-selected user ID.
- Updated the Phase 2 execution plan to reflect verified session resolver status and the new guard.

**Verification boundary**
- The permission guard is committed but awaits its own CI run. The current integration suite does not yet test this new guard against PostgreSQL.
- The guard is a server-side primitive; no public route has been exposed and no resource route has yet adopted it.

**Next**
1. Verify this guard in CI.
2. Add PostgreSQL coverage for login service success/failure and login-attempt persistence.
3. Implement logout service/route behavior: revoke the current session and clear the HttpOnly cookie.
4. Add password-reset lifecycle, CSRF/origin controls, and HTTP-level negative tests before exposing authentication endpoints.


## 2026-11-03 — Server-side scoped permission guard and logout primitive

**Implemented**
- Added `src/server/identity/permission-guard.ts`: requires the cookie-backed verified session, loads database grants for `session.userId`, and denies missing permissions. No client-supplied identity is used as the authorization subject.
- Added unit tests for allowed/denied permission, unauthenticated short-circuit, and attacker-selected identity input.
- Added `src/server/identity/logout.ts`: resolves and revokes the current cookie-backed session, writes a logout audit event on successful revocation, and clears the cookie in a `finally` path.
- Added logout tests for successful revocation/audit, missing cookie, invalid session, and revocation failure.
- Updated the Phase 2 plan. No public logout route was added: CSRF/Origin enforcement must precede state-changing public endpoints.

**Verification**
- CI run [41579953764](https://github.com/waelkamira/mtjr2/actions/runs/41579953764) passed on commit `1de06a1325b29cafbeae5693d3aa78ff7dc339e5`, including the current-session resolver tests and production build.
- Permission-guard CI run [41580232391](https://github.com/waelkamira/mtjr2/actions/runs/41580232391) and PostgreSQL run [41580232470](https://github.com/waelkamira/mtjr2/actions/runs/41580232470) were started on commit `37d026617ac5ea36f3394ef3a8300af90f752a03`; they were still running at the time this logout primitive was authored. Therefore the permission guard is not yet marked CI-verified.
- The logout primitive is new and awaits CI.

**Next**
1. Verify permission guard and logout primitive in CI.
2. Add PostgreSQL-backed login service tests (session issuance, login-attempt persistence, inactive/unverified rejection).
3. Add database-backed logout lifecycle/audit test.
4. Implement password reset and trusted-proxy/CSRF/Origin boundary before adding public authentication routes.


## 2026-11-03 — Phase 2 verification and PostgreSQL login coverage

**Verified on commit `8d48d92f8b8f7828d2adda953183b46483ba3a6d`**
- General CI run [41580301822](https://github.com/waelkamira/mtjr2/actions/runs/41580301822) passed: Prisma validate/generate, TypeScript, ESLint, unit tests, and production build.
- PostgreSQL integration run [41580301896](https://github.com/waelkamira/mtjr2/actions/runs/41580301896) passed: clean migration deployment, repeatable seed, and existing database-backed identity integration tests.
- These runs include the permission guard and server-side logout primitive added in this commit.

**Added next**
- Extended the PostgreSQL integration suite with a real password-login journey: register and verify a user, reject a wrong password with the generic response, accept the correct password, persist both login attempts, verify audit event creation, verify only the token digest is stored, resolve the new session, and revoke it.
- Expanded cleanup to remove every integration-created user.
- Corrected Phase 2 plan checkboxes and attached exact CI evidence for the permission guard/logout work.

**Verification boundary**
- The new login integration test is committed but not yet run in CI. The previous PostgreSQL workflow did not exercise the login service directly.
- The logout primitive passed unit tests; cookie-bound HTTP logout, CSRF/Origin checks, password reset, email delivery, and full HTTP E2E remain outstanding.


## 2026-11-03 — Password reset service and PostgreSQL lifecycle coverage

**Implemented**
- Added `src/server/identity/password-reset.ts`.
- Reset challenges are generated with 256 bits of entropy; only SHA-256 digests are persisted, with a one-hour expiry.
- Issuing a new challenge invalidates previous outstanding challenges for the same account.
- Challenge issuance is restricted to active accounts with verified email addresses. The trusted caller receives the raw token only for server-side email delivery; public HTTP responses must remain generic.
- Completion hashes the new password before opening the transaction, atomically consumes the challenge, updates the password only for an active account, revokes all existing sessions in the same transaction, and records an audit event.
- Added a PostgreSQL integration scenario covering digest-only storage, one-time consumption, password replacement, audit evidence, and session revocation.
- Updated the Phase 2 plan and retained the Phase 3 block.

**Verification**
- Changes were committed directly to `main`; the latest code/documentation commit at this log entry is `e148bf6dbf0b0ad3d3a4840488895c470b3da55e`.
- CI and PostgreSQL integration for the password-reset implementation have not yet been observed. No pass is claimed.
- No local tests were run in this session.

**Remaining before public exposure**
- Add request throttling/cooldown and generic HTTP response behavior.
- Integrate a real transactional email provider through a server-only adapter.
- Add CSRF/Origin enforcement before exposing mutation routes.
- Add route-level HTTP tests and review concurrency/error handling.


## 2026-11-03 — Focused password-reset verification and test-scope decision

**Verified**
- PostgreSQL integration run [41581259836](https://github.com/waelkamira/mtjr2/actions/runs/41581259836) passed on commit `6dcd566c6bbd5fdf8eb903e4c4b7f3ca636ff944`. Its password-reset scenario verifies digest-only token persistence, one-time consumption, password replacement, audit event creation, and revocation of existing sessions.
- General CI run [41581280754](https://github.com/waelkamira/mtjr2/actions/runs/41581280754) passed on commit `79e260082aebe48d6fe2bca535b4f36a55ba4f3b`, including Prisma validation/generation, typecheck, lint, unit tests, and production build.
- The subsequent changes in this commit only correct documentation; no application code changed.

**Test strategy decision**
- Avoid adding a separate test for every helper or trivial branch.
- Keep the essential gates: general CI (schema/type/lint/unit/build), one PostgreSQL-backed identity journey covering registration/verification/login/session, one PostgreSQL password-reset lifecycle, and one public HTTP end-to-end journey once routes exist.
- Add a new test only for a security-critical regression, a real bug, or a distinct business invariant not already covered.

**Remaining Phase 2 blockers**
- Request throttling and generic response behavior for password-reset requests.
- Server-only email delivery adapter.
- CSRF/Origin enforcement before public mutation routes.
- A single critical public HTTP authentication journey, then focused security review.
- Phase 3 remains blocked until these essentials pass.


## 2026-11-03 — Reuse login throttling for password-reset requests

**Implemented**
- Added `requestPasswordReset(email, trustedIpAddress)` as the entry point for reset requests.
- Reuses the existing persistent HMAC-keyed identifier/IP rate-limit buckets; no new throttle schema or duplicate rate-limit implementation was introduced.
- A blocked request does not issue a reset token. Unknown, throttled, and eligible accounts must receive the same generic HTTP response from the future route.
- Trusted IP resolution remains the responsibility of the configured trusted-proxy layer; arbitrary client-supplied forwarding headers must not be trusted.

**Verification**
- Existing PostgreSQL integration covers the underlying persistent throttle behavior.
- The new wrapper has not yet been run through CI. Current main commit after this change and documentation is `64a25274b1981c53e407f826005f9b666c004187`.
- No extra test suite was added: this reuses already-tested throttling behavior and will be covered by the single public HTTP auth journey.

**Next**
- Configure a real server-only transactional email adapter before exposing recovery routes.
- Then add CSRF/Origin protection and one public HTTP authentication journey.


## 2026-11-03 — Isolate password-reset abuse budget from login

**Review correction**
- The first reset-throttling wrapper reused login bucket keys. Review identified that this would let reset requests consume login attempts and potentially cause unrelated login lockouts.
- Corrected this before exposing any public route: password-reset requests now use action-namespaced HMAC keys and separate thresholds (3 attempts per identifier/IP pair and 10 per IP per 15-minute window), while sharing only the tested persistent bucket storage/atomic counter implementation.
- Login buckets and their successful-login clearing behavior remain independent from password-reset buckets.

**Verification**
- The previous general CI passed for the first wrapper implementation: run 41581773538, commit `00404c2dbef8ddde168431699c3a919abfae62de`.
- The isolation correction and documentation are newer commits and are awaiting CI. No claim of test success is made for these latest changes.
- No new test matrix was added; the focused HTTP auth journey will verify reset throttling without expanding tests for each helper.

**Next**
- Keep public recovery routes blocked until a server-only email delivery adapter and CSRF/Origin checks are in place.


## 2026-11-03 — Separate recovery throttling and add mutation request guard

**Implemented**
- Password-reset abuse limits now use distinct action-namespaced HMAC keys (3 per identifier/IP pair and 10 per IP per 15 minutes). The login and recovery budgets are isolated while sharing the same persistent atomic bucket implementation.
- Added `validateIdentityMutationRequest`: it fails closed when Origin is missing or differs from the configured application origin, rejects non-same-origin Fetch Metadata when present, and requires JSON content type.
- All future public identity mutation handlers must invoke this guard before reading request bodies or calling domain services.

**Verification**
- The initial reset-throttle wrapper passed general CI on commit `00404c2` (run 41581773538), but its shared login budget was identified in review and corrected.
- The isolation correction, Origin guard, and documentation are pending a fresh general CI run. They have not yet been reported as passing.
- No public HTTP routes or email provider are configured yet; the guard is not evidence that the endpoints are already protected.

**Next**
- Add a server-only email delivery contract with a configured provider before public registration/recovery endpoints.
- Add the minimal public route set and one end-to-end HTTP identity journey only after delivery and abuse controls are ready.


## 2026-11-03 — Resend adapter and CI failure correction

**Implemented**
- Added a server-only Resend adapter for email verification and password reset.
- Added optional `RESEND_API_KEY` and `RESEND_FROM_EMAIL` environment validation and documented placeholders in `.env.example`.
- The adapter uses Resend's HTTPS email API, requires a confirmed provider message ID, uses the configured application URL for action links, and does not log or return raw tokens/provider response bodies.
- Corrected the JSON content-type regular expression in the same-origin mutation guard after CI caught malformed escaping.

**Configuration still required**
- The repository does not contain a Resend API key or a verified sender address. These must be added as deployment secrets/environment variables by the project owner. No real email has been sent or verified yet.
- Public registration and recovery routes remain disabled until Resend is configured, a real delivery smoke test passes, and trusted-proxy IP resolution is defined.

**Verification**
- CI run 41582452462 failed at TypeScript parsing in `request-security.ts` due to the malformed regex. Prisma validation/generation passed; subsequent lint/tests/build were skipped.
- The regex correction, Resend adapter, env changes, and documentation are newer than that failed run and are awaiting a fresh CI run.


## Resend decision — accepted

The project owner approved Resend as the transactional email provider. The server-only adapter is implemented for verification and password-reset messages. Deployment configuration remains intentionally absent from source control: add `RESEND_API_KEY` and a verified `RESEND_FROM_EMAIL` as protected environment secrets. Until those are supplied and a real delivery smoke test succeeds, the provider integration is code-complete but operationally unconfigured; public email-dependent routes must remain closed.


## Trusted proxy boundary — implemented, deployment configuration pending

- Added `src/server/identity/trusted-client-ip.ts` to resolve client IPs only from an explicitly selected Cloudflare or Vercel proxy header.
- The resolver validates IPv4/IPv6 values, handles the Vercel proxy chain, rejects ambiguous Cloudflare values, and never falls back to arbitrary `X-Forwarded-For`.
- Added `TRUSTED_PROXY_IP_HEADER` environment validation and documented the deployment contract in `.env.example`.
- Added focused tests for unset configuration, untrusted forwarding headers, valid IPv6, Vercel proxy chains, and malformed values.
- **Deployment is not configured yet.** The operator must select the actual edge header, ensure the edge overwrites it, and block direct origin access. Until then, IP-dependent public identity routes must fail closed.
- Public routes remain blocked pending verified Resend delivery, resend-verification throttling, and the trusted proxy deployment contract.


## 2026-11-03 — Verification resend CI correction

- General CI on commit `4db0ed483afc2b8f8f3e9925d57325df9d4efac5` failed TypeScript checking because the resend route referenced a missing challenge service and throttle export.
- Added the missing server-only challenge issuer. It only issues challenges for pending, unverified accounts, invalidates previous unused challenges transactionally, stores a SHA-256 digest, and returns the raw token only to the trusted mail adapter.
- Added a separate HMAC-namespaced persistent rate-limit budget for verification sends (3 per identifier/IP pair and 10 per trusted IP per 15-minute window); it does not share login/reset buckets.
- PostgreSQL integration workflow passed on the affected commit, but general CI failed; the correction is awaiting CI. No broader test suite was added.


## 2026-11-03 — Identity action pages

- Added functional email-verification and password-reset pages, using the existing API endpoints and the established visual tokens.
- Tokens are submitted only to same-origin APIs, never displayed in page content, and removed from the visible URL after successful processing. Both pages set `no-referrer` metadata.
- No helper-by-helper test expansion was added. The existing general CI and PostgreSQL integration gates remain the required checks for this change.
- Phase 2 remains blocked only on passing CI for this commit and deployment-only verification: configure Resend credentials/verified sender and trusted edge IP header, verify real email delivery, then execute one HTTP journey (register → verify → login → `/api/auth/me` → logout → anonymous request denied). No real email or deployed HTTP journey is claimed.


## 2026-11-03 — Keep route changes inside the integration gate

- General CI passed on the latest UI/action-page commit `7a30994e62de079839c8778f3d1f1a368097c2bc` ([run 41645257014](https://github.com/waelkamira/mtjr2/actions/runs/41645257014)).
- The PostgreSQL identity integration suite passed on `da19c57876e39d9564e0ca519726e3b6b2efcf0a` ([run 41643736067](https://github.com/waelkamira/mtjr2/actions/runs/41643736067)); the latest commit changed only UI pages and documentation.
- Updated the integration workflow path filter to include `src/app/api/auth/**`. Future API-route changes now trigger the essential database suite.
- No new test cases added. The only remaining Phase 2 exit work is real deployment configuration, a delivery smoke test, and one end-to-end HTTP journey. Keep Phase 3 blocked until that journey passes.


## 2026-11-03 — Identity audit-event coverage

- Added transactional audit events for account registration, successful email verification, and verification-email resend. Each event is committed atomically with the corresponding account/token change; raw verification tokens are never included.
- Failed login attempts remain recorded in the dedicated `LoginAttempt` table with keyed identifier/IP digests; no duplicate audit stream was added.
- Keep the existing focused PostgreSQL integration suite and general CI as the only automated gates for this work. No new helper-level test suite is being introduced.


## 2026-11-03 — Phase 2 identity implementation verification

- Latest code/test commit: `f15d994e8504c89c981c0de04473799da66c4848`.
- General CI passed on that exact commit ([run 41648336062](https://github.com/waelkamira/mtjr2/actions/runs/41648336062)): Prisma validate/generate, typecheck, lint, unit tests, and production build.
- PostgreSQL identity integration passed on `0ffb3b4651b06d90c9eecb10eed960c87bae0348` ([run 41647984160](https://github.com/waelkamira/mtjr2/actions/runs/41647984160)).
- The CI mock gap introduced by transactional registration/verification audit events was fixed by extending the existing test in `f15d994`; no separate test suite was added.
- Role assignment/revocation, registration/verification/login/logout/password-reset audit coverage, scoped authorization, session lifecycle, and password-reset lifecycle are implemented and covered by the existing focused gates.
- Remaining Phase 2 work is deployment-only: configure Resend credentials/sender, configure and secure the trusted edge IP header, smoke-test actual email delivery, then execute one deployed HTTP journey (register → verify → login → `/api/auth/me` → logout → anonymous denied).
- No further helper-level tests or expanded test matrix are planned. Phase 3 remains gated only by that final operational HTTP journey.


## 2026-11-03 — Resume Phase 3 planning; defer production-only gates

**Repository review**
- Rechecked the live `main` branch, canonical Prisma schema, README, and platform blueprint before resuming implementation.
- Confirmed that `prisma/schema.prisma` currently contains the identity/access foundation only; marketplace domain models and the catalog workflow are not implemented.
- Corrected the blueprint's baseline statement so it no longer claims that 136 marketplace models or canonical catalog pages already exist.
- Added `docs/implementation/PHASE_03_MARKETPLACE_PLAN.md` with dependency-ordered delivery slices and a first vertical slice: Country + Currency + Market.
- Updated the README: Phase 2 production email/proxy/HTTP journey remains deferred and is not marked passed; local/CI Marketplace Core development may proceed without production database access.

**Safety boundary**
- No production database connection, credential read, migration, or deployment environment mutation was performed.
- Use only local/disposable/CI PostgreSQL for Phase 3 development until the owner explicitly approves production access.

**Verification**
- Documentation files were committed to `main`:
  - Phase 3 plan: `34f3bac2cb6be8416b1b22ad21426443f8e8b6de`
  - README plan/status: `c3b11f35c39750c04c9fddb2921c63ae3ea2d946`
  - Blueprint baseline correction: `1a48052b030d7c967ed906285d4def146cb34018`
- No application code or Prisma schema changed in this documentation-only step; no new application test result is claimed.
- Vercel status for the latest commit was still pending at the time of this entry. The existing successful General CI and PostgreSQL identity runs remain the latest application-code verification evidence.

**Next**
1. Implement the Country + Currency + Market schema slice, with constraints and deterministic seed.
2. Generate a migration for CI/local disposable PostgreSQL only.
3. Run the existing General CI plus one focused PostgreSQL integration gate; do not expand the test matrix without a concrete invariant.


## 2026-11-03 — Phase 3.1 market reference schema

**Implemented**
- Added canonical `Country`, `Currency`, `Market`, and `MarketCurrency` models to `prisma/schema.prisma`.
- Added ISO country/currency code constraints, market lifecycle status, default market currency relation, enabled market-currency links, foreign keys, lookup indexes, and a database check limiting currency minor units to 0–4.
- Added additive migration `20261103010000_market_reference_data`; the existing identity baseline migration was not modified.
- Updated the Phase 3 plan to record the schema/migration work.

**Verification**
- No production or owner-local database was accessed.
- Prisma validation, client generation, migration deployment, and integration tests have not yet been observed for this new schema. Do not mark the slice verified until CI completes.
- No country/currency sample data was seeded yet; avoid inventing launch-market coverage. The authoritative reference-data seed is the next implementation task.

**Next**
1. Confirm Prisma validation and generated-client compatibility in General CI.
2. Add a deterministic reference-data seed from an explicit, versioned ISO data source.
3. Add one PostgreSQL integration check for ISO uniqueness, default-currency relation, and market-currency membership.


## 2026-11-03 — Phase 3 seller and store schema foundation

**Implemented**
- Extended the canonical Prisma schema with `Seller`, `Store`, `StoreMarket`, and `SellerStaff`, plus seller/store/staff lifecycle enums.
- Linked seller ownership and store staff membership to the existing `User` model.
- Linked stores to markets through `StoreMarket`, allowing a store to opt into multiple markets without duplicating market or currency records.
- Kept authorization roles canonical: store staff permissions are intended to use existing scoped `UserRoleAssignment` grants; no parallel role/permission tables were added.
- Added additive migration `20261103020000_seller_store_foundation`.
- Corrected the migration to contain only the four new tables, three enums, indexes, and foreign keys; no unrelated marker columns remain.

**Schema inspection**
- Current schema contains 21 model declarations.
- Static scan found no duplicate model names and no unresolved Git conflict markers.
- The old integrity warning in the blueprint (SNAP-01 through SNAP-05) does not describe the current `main` schema snapshot; the checked-in schema currently has no conflict markers or duplicate declarations. The schema is not yet Prisma-validated after these changes.

**Verification and safety**
- No Prisma CLI execution or PostgreSQL migration replay has been observed for this commit; validation remains pending.
- Vercel status for the schema commit was pending; this is not evidence of a successful schema build.
- No production/local owner database connection, environment mutation, or migration was performed.

**Remaining**
1. Run the existing General CI (Prisma validate/generate, typecheck, lint, unit tests, build).
2. Run the existing PostgreSQL integration workflow against an isolated disposable database to replay both migrations.
3. Complete the Market seed/repository/service slice and implement seller onboarding and scoped authorization before claiming either workflow complete.


- Blueprint consistency follow-up: clarified that the 49-system model inventory is a **target inventory**, not a declaration that all models already exist. Refreshed the schema baseline and replaced the stale SNAP conflict/duplicate warning with the current static inspection result. Blueprint documentation commit: `cd1b7cfeacde516c5e501afc89a87e07a813f884`.


## 2026-11-03 — Phase 3.3 catalog taxonomy schema

**Implemented**
- Added hierarchical `Category` with parent/children relation, unique slug, status, sort order, and optional image.
- Added `CategoryTranslation` with locale-unique translations and SEO fields.
- Added `Brand` and `BrandTranslation` with status, unique slug, localized names/descriptions, and SEO fields.
- Added additive migration `20261103030000_catalog_taxonomy`.
- Generalized the existing PostgreSQL integration workflow name/scope to Platform PostgreSQL Integration. It already deploys all committed migrations on an isolated PostgreSQL 16 service, runs the idempotent identity seed, and executes the existing integration suite. No second DB workflow or test matrix was added.

**Verification**
- Static schema scan after the taxonomy additions: 25 Prisma models, no duplicate model declarations, no conflict markers.
- Prisma validation/client generation and PostgreSQL migration replay are pending the GitHub Actions run triggered by the schema/migration changes.
- No production or owner-local database was accessed.
- No category or brand sample data was invented or seeded.

**Remaining**
1. Confirm General CI and Platform PostgreSQL Integration pass on the current schema.
2. Implement safe category tree reads with bounded depth/pagination and cycle prevention in the service layer.
3. Implement market reference data seed/repository/service.
4. Continue with Product, ProductVariant, ProductMedia, localized product data, attributes, identifiers, and prices only after the taxonomy and store authorization foundations are verified.


## 2026-11-03 — Phase 3.4 product catalog schema foundation

**Implemented**
- Added `Product` with canonical Store ownership, optional Brand, store-unique slug, draft/active/archive status, approval status, and publication timestamps.
- Added explicit product-category links, localized product content, media metadata, product variants, and typed external identifiers.
- Added `ProductPrice` per variant + market + currency using integer `BigInt` minor units (not floating point).
- Added database checks preventing negative prices and compare-at prices below the base amount.
- Added additive migration `20261103040000_product_catalog_foundation`.

**Static verification**
- Canonical schema now declares 32 models and 10 enums.
- No duplicate model/enum declarations or unresolved conflict markers were found.
- Static relation inspection confirmed Product↔Store/Brand/Category, ProductPrice↔Variant/Market/Currency, and Category↔ProductCategory inverse relations.
- Static inspection is not a substitute for `prisma validate`, generated-client compatibility, or migration replay.

**Pending verification**
- General CI and the Platform PostgreSQL Integration workflow must pass on the latest schema/migration commit. The integration workflow deploys all committed migrations against an isolated PostgreSQL 16 service before running the existing integration suite.
- No production database access or Vercel environment changes were performed.
- Product attributes/variant attribute definitions, publishability services, product write APIs, and storefront discovery remain unimplemented.


## 2026-11-03 — Phase 3.4 structured product attributes

**Implemented**
- Added `AttributeDefinition` with typed values (TEXT, NUMBER, BOOLEAN, SELECT, MULTI_SELECT), variant-level/filterable/required flags, and localized `AttributeTranslation`.
- Added product-level `ProductAttribute` and ordered `ProductAttributeValue` records.
- Added `VariantAttribute` for explicit variant option values rather than relying only on opaque JSON.
- Added additive migration `20261103050000_product_attributes`.

**Static verification**
- Canonical schema now declares 37 models and 11 enums.
- No duplicate model/enum declarations or unresolved conflict markers were found.
- Prisma validation, generated-client compatibility, and full migration replay are still pending CI; static inspection does not substitute for those checks.

**Remaining**
1. Confirm general CI and the single Platform PostgreSQL Integration workflow pass on the latest schema.
2. Implement typed attribute validation, variant-level enforcement, product publishability, and server-side store/market authorization in domain services.
3. Implement market reference seed/repository/service and category-tree read service.
4. Continue to discovery/search only after product write and read contracts are established.


## 2026-11-03 — Phase 3.5 search synonym persistence

**Implemented**
- Added localized `SearchSynonym` records with active state and unique locale/term/synonym combinations.
- Added lookup index for locale + term + active state.
- Added additive migration `20261103060000_search_synonyms`.
- Search execution, normalization, typo handling, filters, ranking, and API endpoints remain unimplemented.

**Verification**
- Schema/migration are committed but Prisma validation, generated-client compatibility, and isolated PostgreSQL replay remain pending.
- No production database or deployment environment was accessed.


## 2026-11-03 — Phase 3 read-side foundations

**Implemented**
- Added a localized active-category tree query with a 500-row cap and maximum depth 1–10.
- Added a pure category-tree builder that omits orphaned/cyclic branches and applies localized labels when available.
- Added four focused unit cases for localization/hierarchy, cycles/orphans, depth bounds, and invalid depth configuration.
- Added an active-market read query that returns enabled currencies only and rejects a market when its default currency is not enabled in that market.
- Files: `src/server/catalog/category-tree.ts`, `src/server/catalog/category-query.ts`, `tests/catalog/category-tree.test.ts`, `src/server/marketplace/market-query.ts`.

**Verification**
- The focused unit tests have been added but have not been executed in this environment; General CI is the verification gate.
- The Platform PostgreSQL Integration workflow is configured to deploy every committed migration to an isolated PostgreSQL 16 service.
- Current Vercel status remains QUEUED and is not treated as successful CI evidence.
- No production database or Vercel environment variables were accessed or changed.


## 2026-11-03 — Seller application submission service

**Implemented**
- Added `submitSellerApplication` as a server-only domain service using the verified HttpOnly-cookie session; callers cannot supply an owner ID.
- Requires an active authenticated session and verified email before accepting an application.
- Creates a PENDING seller record and audit event in one transaction.
- Pending applications are idempotent; concurrent duplicate submissions resolve to the existing pending application. Existing non-pending seller records are not silently overwritten.
- Seller approval, role assignment, store creation, KYC, and staff authorization remain separate workflows and are not claimed complete.

**Focused tests added**
- New seller application tests cover successful atomic submission, pending resubmission, unverified-account rejection, and input validation.
- The tests have been committed; CI is the execution gate.

**Safety**
- No production database, Vercel environment variable, or deployment configuration was accessed or changed.


## 2026-11-03 — Seller review and store creation workflows

**Verification**
- General CI for seller application submission commit `dd069434` completed successfully: Prisma validate/generate, typecheck, lint, unit tests, and production build.
- PostgreSQL integration workflow had already passed for the marketplace schema migration baseline; no production database was accessed.

**Implemented**
- Added permission-protected seller application review using the existing `users:manage` permission.
- Approval atomically changes PENDING → ACTIVE, grants the existing seeded SELLER role, and writes an audit event.
- Rejection requires a reason, changes PENDING → REJECTED, and writes an audit event.
- Added draft store creation for the authenticated approved seller; selected markets must be active and their country/default currency must be active. Store-market links and audit event are created in the same transaction.
- Added focused tests for approval, rejection validation, and store creation alongside application submission tests.

**Remaining in this slice**
- Store-scoped staff invitation/acceptance/revocation and authorization.
- Store activation/review workflow and seller profile/KYC requirements.
- The newly added review/store services await the next CI run; they are not yet marked verified.


## 2026-11-03 — Seller and store onboarding vertical slice

**Implemented**
- Confirmed CI run `41666232503` passed on commit `dd069434`: Prisma validate/generate, typecheck, lint, unit tests, and production build.
- Added seller approval workflow: requires global `platform:manage`, accepts only PENDING applications, validates selected ACTIVE markets and enabled default currencies, creates the first ACTIVE store, activates the seller, assigns the owner the existing SELLER role scoped to that store, and writes an audit event in one transaction.
- Added store staff invitation requiring `store:staff:manage` in the exact STORE scope. Only active accounts can be invited.
- Added invitation acceptance bound to the authenticated invitee; acceptance activates membership and grants STORE_MANAGER only in that store scope, with an audit event.
- Added mutation-protected API routes for seller applications, admin approval, staff invitations, and invitation acceptance.
- Added focused tests for approval, market-currency invariant, scoped invitation authorization, invite acceptance, and cross-user acceptance denial.

**Verification**
- CI for the seller application submission slice passed in run `41666232503`.
- CI for the complete onboarding/API slice is triggered by the latest commits and remains pending; no pass is claimed until the run completes.
- PostgreSQL migration integration was not rerun for this service-only change.
- No production database or Vercel environment settings were accessed or changed.

**Remaining in seller/store foundation**
- Rejection workflow and seller profile/KYC verification.
- Store profile editing, invitation cancellation/revocation, and seller suspension lifecycle.
- Store-scoped authorization tests against PostgreSQL; API-level tests.


## 2026-11-03 — Seller/store workflow consolidation and API coverage

**Consolidation**
- Removed the duplicate seller/store lifecycle service and its duplicate test file. The canonical seller application service owns submission, review, and draft-store creation; the canonical store-staff service owns invitation, acceptance, and revocation.
- Updated API routes to call those canonical services, avoiding two competing authorization implementations.
- Added the approved seller's draft-store creation endpoint.
- Added focused store-staff tests for owner invitation, exact-scope manager authorization, acceptance by the invited account, and cross-account denial.
- Corrected the Phase 3 plan to remove duplicated and contradictory checkboxes.

**Verification**
- The seller application submission baseline passed General CI in run `41666232503`.
- Latest consolidated service/API/test changes are committed; their General CI run is pending. Previous per-commit runs were cancelled by the workflow's intentional concurrency policy as newer commits arrived.
- The PostgreSQL integration workflow was not rerun for these application-service changes. No production DB was accessed.


## 2026-11-03 — Taxonomy read APIs and first product write slice

**Implemented**
- Added active category and brand read services with locale fallback, active-only visibility, bounded pagination, and stable ordering.
- Added public category and brand GET endpoints and a cycle-safe category tree builder.
- Added focused category-tree unit tests.
- Exposed store-staff revocation through a POST route that reuses the canonical scoped authorization service and request-origin validation.
- Added atomic draft product creation: validates store scope, seller/store state, active brand/categories, enabled store markets and currencies, duplicate variant-market-currency prices, compare-at price invariants, and a single primary media item. Creates variants/media/prices and audit event in one transaction.
- Added the authenticated POST product endpoint and focused tests for successful minor-unit price persistence and rejection of a market not enabled for the store.

**Verification**
- The first taxonomy CI run reached Prisma validate/generate and TypeScript successfully, then failed lint on an explicit `any` in the existing seller-application test mock. That mock was changed to use `Prisma.TransactionClient`; the unused taxonomy tree state was also removed.
- CI runs were superseded by subsequent commits before the full checks completed. Current combined changes are awaiting a full General CI result; no pass is claimed.
- The latest completed failed run reported 23 npm audit vulnerabilities (17 moderate, 4 high, 2 critical). No forced dependency upgrades were applied because they could introduce breaking changes; dependency remediation should be a separate scoped task.
- No production database was connected or migrated, and no Vercel environment values were read or changed.

**Next**
1. Obtain one completed General CI run for the combined catalog changes and fix only reported blockers.
2. Add the focused staff-revocation test and run the existing PostgreSQL integration workflow once after the catalog slice stabilizes.
3. Implement product update, platform approval, publishability validation, then discovery reads/search.
4. Add deterministic country/currency reference data only after defining the intended supported launch scope; do not invent active markets.


## 2026-11-03 — Product approval and publication lifecycle

**Implemented**
- Added a platform-permission approval transition for pending draft products, with conditional update and atomic audit event.
- Added store-scoped product publishing. Authorization scope is resolved from the product's trusted database storeId before permission evaluation; client-supplied scope is never trusted.
- Publishing requires an approved draft, active seller and store, at least one active variant, a primary image, and a price in an enabled currency for every active market enabled on the store. The transition and audit event are atomic.
- Added mutation-protected admin approval and product publish API routes.
- Added focused product lifecycle tests for atomic draft price creation, rejecting prices for unenabled store markets, and exact store-scope authorization at publish.

**Verification**
- The combined catalog/product General CI run is still pending. Earlier commits in this sequence were intentionally cancelled by the workflow concurrency policy as subsequent changes landed; no CI pass is claimed for this slice yet.
- No production database or Vercel environment settings were accessed or changed.

**Remaining**
- Product update and rejection-with-reason workflows.
- Focused staff-revocation tests and PostgreSQL integration replay of the complete migration set.
- Product listing/detail/discovery APIs, validated search, filtering, sorting, and pagination.


## 2026-11-03 — Cross-store authorization hardening

**Security finding and fix**
- Review of the global SELLER role grant exposed an authorization pitfall: global role grants intentionally satisfy permission checks across all scopes, so a plain `catalog:manage` check is not sufficient to prove ownership of a specific store.
- Added `userHasScopedPermission`, which deliberately filters out GLOBAL grants and accepts only a grant whose scope type and ID exactly match the requested resource.
- Product creation now requires the authenticated seller to own the store or hold an exact STORE-scoped catalog grant. Product publishing resolves the product's store from the database and applies the same owner-or-exact-grant rule before mutation.
- Added tests for denial of a different seller despite the global SELLER role and acceptance of an explicitly delegated exact-store grant.

**Architecture rule going forward**
- Never treat a global SELLER role permission as proof of ownership of an individual store, product, order, inventory location, or other seller-owned resource. Resolve ownership from trusted database relations; otherwise require an exact scoped grant. Apply this rule to every subsequent seller-domain service.


## 2026-11-03 — Product lifecycle completion and public discovery slice

**Implemented**
- Added `Product.rejectionReason` and additive migration `20261103070000_product_review_reason`.
- Added draft product metadata update. It resolves store ownership from trusted database relations, requires owner/exact store-scoped catalog access/platform administration, updates only DRAFT products, resets review to PENDING, and writes an audit event in the same transaction.
- Added platform product rejection for pending drafts with a mandatory 5–2000 character reason and atomic audit.
- Added PATCH `/api/products/[productId]` and POST `/api/admin/products/[productId]/reject`; both use the existing mutation request protections.
- Added public product listing and slug detail queries/routes. Public visibility requires ACTIVE product, ACTIVE store, and ACTIVE seller. Listing supports text/category/brand/market/currency filters, stable sort, and bounded pagination.
- Added focused unit tests for product edit/rejection and staff revocation.
- Corrected the category tree service call to pass the requested locale and corrected Prisma transaction test-double typing.

**Verification**
- The prior General CI run `41673989060` failed at TypeScript after Prisma validate/generate passed. The reported issues were the missing category-tree locale argument, incomplete mocked Prisma transaction delegate types, and an ES2017-incompatible BigInt literal in a test. These have been corrected.
- The combined implementation and focused tests are committed; the new General CI run is pending. No test pass is claimed until completion.
- PostgreSQL integration for the newest migration and services remains pending.
- No production database was accessed, no migrations were run against the owner's database, and no Vercel environment variables were read or changed.

**Next**
1. Complete General CI; fix only concrete failures.
2. Run the existing PostgreSQL integration workflow once against its isolated PostgreSQL service.
3. Finish search execution and deterministic market/currency reference data without inventing launch countries or currencies.


**Additional security and search follow-up**
- Staff invitations now require an exact STORE-scoped `store:staff:manage` grant for delegated managers; global grants are excluded. Store owners remain authorized by trusted ownership relation.
- Product discovery now expands exact localized active search synonyms (case-insensitive) before applying the bounded product search query.
- Added focused tests for synonym expansion, public-only product visibility, currency/market query validation, product lifecycle edits/rejections, and staff revocation/delegation.
- These latest changes are awaiting the consolidated General CI run; no pass is claimed yet.


## 2026-11-03 — Initial warehouse and inventory operations

**Implemented**
- Added canonical schema models: `Warehouse`, `Inventory`, `InventoryMovement`, `InventoryReservation`, `StockTransfer`, and `StockTransferItem`.
- Added additive migration `20261103080000_inventory_foundation` with foreign keys, unique warehouse/variant stock identity, indexes, non-negative on-hand/reserved constraints, positive reservation/transfer quantities, and distinct source/destination warehouses.
- Added seller-scoped warehouse creation and inventory read APIs.
- Added stock adjustments with mandatory idempotency keys, store ownership/exact STORE-scoped `inventory:manage` authorization, reserved-stock protection, movement ledger entries, and atomic audit events.
- Added intra-store stock transfer draft creation, shipping, and receiving. Ship/receive transitions and stock movements run transactionally; cross-store transfers are rejected.
- Added focused inventory tests for reserved-stock protection, successful adjustment/audit, idempotent replay, key reuse across stock rows, and insufficient-stock transfer rejection.
- Added API routes under `/api/seller/warehouses` and `/api/seller/inventory/**`.

**Verification**
- General CI for the previous catalog/discovery slice was repeatedly superseded by later commits before reaching Prisma/typecheck/tests; no pass is claimed for the latest product lifecycle/discovery changes.
- Database Baseline and Platform PostgreSQL Integration succeeded at commit `9e397ddc`, before the latest product lifecycle and inventory migration. Those results do not verify the current schema.
- Inventory schema and migration were committed; the latest isolated PostgreSQL workflow is queued/pending. General CI for the combined inventory code is queued/pending.
- No production database was accessed, and no Vercel environment variables were read or changed.

**Safety and follow-up**
- Adjustment idempotency is bound to the exact warehouse/variant inventory row; reusing a key for a different row or delta is rejected.
- Reservations are modeled but reservation creation/consumption/release/expiry service behavior is deferred until cart/checkout defines customer/guest ownership and idempotency contracts. No insecure generic reservation endpoint was exposed.
- Next: complete CI and PostgreSQL replay, then implement market reference-data services without activating launch markets until their scope is agreed.


## 2026-11-03 — Market reference read APIs and stock-transfer idempotency

**Implemented**
- Added active market listing and individual market lookup APIs, normalizing market codes.
- Added public currency and country reference APIs derived only from enabled currencies and valid ACTIVE markets. A market is excluded unless its default currency is active and enabled within that market.
- Added focused market-query tests for default-currency enforcement, deduplication, and market-code normalization.
- Made stock-transfer creation require a unique idempotency key; a retry with the same source, destination, and item quantities returns the existing transfer, while reuse with a different payload is rejected.
- Added a focused stock-transfer replay test.

**Verification status**
- The current combined CI and PostgreSQL workflows are queued/running. Earlier CI run `41677499072` passed install, Prisma validate/generate, typecheck, and lint on an intermediate inventory commit, but was superseded before unit tests and build. It is not a complete pass.
- Database Baseline and Platform PostgreSQL Integration for the inventory migration are not yet complete. No success is claimed for the latest migration or the current full commit.
- No active markets/countries/currencies are seeded or activated because the owner has not defined launch geography. The new public APIs correctly return empty collections until approved reference data is configured.


## 2026-11-03 — Buyer storefront connected to marketplace APIs

**Implemented**
- Replaced the initialization placeholder with a responsive storefront shell following the approved forest/sage/ivory/copper design tokens.
- Connected the homepage to the public active-market, category-tree, and product-discovery APIs.
- Added functional search, category filtering, market selection, product cards, and canonical product-detail navigation.
- Added the product detail page backed by the public product-by-slug API. Cart/checkout controls are intentionally absent until the Buying Core APIs exist.
- Fixed an API-boundary defect: Prisma `BigInt` price amounts are converted to JSON-safe minor-unit strings. Product price responses now include the currency's `minorUnit` precision so the UI formats currencies correctly.
- Added a focused regression test for JSON-safe product price serialization.
- Updated the Phase 3 plan and README to distinguish the implemented buyer storefront slice from seller-center/admin interfaces still pending.

**Prisma decision**
- No schema migration was needed for this UI slice: the canonical `ProductPrice` model already relates to `Currency`, stores integer minor units, and the `Currency` model already defines `minorUnit`. The API selection now exposes that existing relation; no duplicate schema fields were added.

**Verification**
- The preceding CI run `41678451013` found one stale test assertion for the permission-guard argument shape (102/103 tests passed); the assertion was corrected in commit `534cc530`.
- Consolidated CI for the current storefront/API changes is running as run `41681739586`. No full pass is claimed until Prisma validation/generation, typecheck, lint, unit tests, and production build all complete successfully.
- The earlier CI failure skipped production build; the current run is the required verification gate.
- No production database was accessed, no migrations were run against the owner's database, and no Vercel environment variables were read or changed.

**Next**
1. Fix only concrete CI failures from the consolidated run.
2. Verify the existing PostgreSQL migration/integration workflows against disposable CI PostgreSQL.
3. Continue the Phase 3 vertical slice: seller-center UI wired to seller/store/catalog/inventory APIs, followed by remaining storefront catalog UX.
4. Add deterministic reference data only after launch markets are approved.


## 2026-11-03 — Seller workspace connected to seller and inventory APIs

**Implemented**
- Added an authenticated seller workspace query that returns only stores owned by the current user or stores where the user has an active staff membership. It includes the seller's current application status, enabled markets, warehouses, and inventory-record counts.
- Extended `GET /api/seller/stores` to expose that server-authorized workspace data; the existing `POST` continues to create draft stores using the existing permission and market validation.
- Added `/seller` UI for verified-email seller application submission, seller status, store creation with active-market selection, warehouse creation, and inventory overview.
- Connected the seller UI to `/api/seller/applications`, `/api/seller/stores`, `/api/markets`, `/api/seller/warehouses`, and `/api/seller/inventory`. No user ID or store ownership is trusted from the browser; the backend resolves access from the authenticated session and database relations.
- Fixed the storefront lint failure by removing the synchronous loading-state update from the product-fetch effect.

**Prisma decision**
- No schema migration was needed for this screen: `Seller`, `Store`, `StoreMarket`, `SellerStaff`, `Warehouse`, and `Inventory` already model every field and relation used by the workspace. The query uses these canonical relations; no duplicate UI-specific tables or fields were introduced.

**Verification**
- The earlier General CI run `41682051189` passed Prisma validation/generation and TypeScript, then failed ESLint on a synchronous `setState` in the storefront product effect. That defect is fixed.
- General CI was repeatedly superseded by subsequent commits before reaching a complete run. The consolidated run after the seller workspace commits must pass Prisma validate/generate, typecheck, lint, unit tests, and production build before this slice is marked verified.
- PostgreSQL migration replay for the latest combined schema/services remains pending. All database checks remain isolated to CI; no owner database or Vercel environment variables were accessed.

**Next**
1. Complete one consolidated General CI run and resolve only reported blockers.
2. Run the existing disposable PostgreSQL baseline/integration workflows once against the latest schema.
3. Continue seller product-management, staff, and stock-operation screens, then platform-admin moderation screens.
4. Keep the Prisma schema aligned with the blueprint; add migrations only when a real domain workflow requires new persisted data.

## 2026-11-03 — Seller catalog and platform moderation UI integration

**Implemented**
- Added a seller-scoped product listing query and GET /api/seller/products; access is resolved from the authenticated session and either store ownership or an exact STORE-scoped catalog permission.
- Added /seller/products and linked it from the seller workspace. The page loads the seller's stores, enabled markets, categories, and brands from backend APIs; creates product drafts; edits draft metadata; displays review status/rejection reason; and publishes only approved drafts.
- Product creation sends a price for every enabled store market and uses integer minor units. Primary image is required in the form because the publish lifecycle requires it.
- Serialized Prisma BigInt price values to strings in seller catalog responses to keep JSON responses valid.
- Added platform-only pending seller/product review queries and protected read APIs. Added /admin/review for seller and product approval/rejection, connected to the existing transactional review endpoints. Rejection reasons are required by the UI and server validation.
- Corrected the seller catalog UI lint issues found by CI. TypeScript and Prisma validation/generation passed in the preceding run; ESLint found two actionable issues in the seller products page, now fixed.

**Prisma decision**
- No Prisma schema change or migration was required for these UI/API slices. The canonical schema already contains seller/store ownership, staff scope, product, variant, media, category/brand links, market-specific prices, and approval/rejection state. The new review queues are read queries over these existing models. This keeps prisma/schema.prisma aligned with the blueprint without duplicating persisted state.

**Verification**
- CI run 41686006206 confirmed Prisma validate, Prisma generate, and TypeScript passed; ESLint failed on two seller-products-page issues. Both have been corrected.
- The later seller/admin changes are awaiting one consolidated General CI run. Earlier runs were cancelled by newer commits; no pass is claimed for the latest batch until all required jobs complete.
- No owner PostgreSQL database was accessed and no Vercel environment variables were read or changed. Database verification remains limited to disposable CI PostgreSQL.

**Next**
1. Complete one consolidated General CI run on the latest code and fix only concrete failures.
2. Run the existing PostgreSQL integration workflow against disposable CI PostgreSQL.
3. Finish seller staff invitations and inventory adjustment/transfer screens.
4. Continue the buyer catalog UX only after the seller/admin integration and verification gates are green.
## 2026-11-03 — Seller inventory operations UI

**Implemented**
- Added a scoped stock-transfer history query and exposed it through GET /api/seller/inventory/transfers; it returns only the authenticated user's permitted store transfers.
- Added /seller/inventory with store selection, warehouse creation, current stock overview, integer stock adjustments using a fresh idempotency key, transfer creation, transfer history, and ship/receive actions.
- Connected the page to the existing warehouse, inventory, adjustment, transfer, ship, and receive APIs. The UI does not calculate or mutate stock locally; all stock changes remain transactional and audited in the server service.
- Linked inventory operations from the seller workspace and removed its unused inventory-loading state.
- No schema change was required: warehouses, inventory, movements, transfers, transfer items, and transfer idempotency are already represented in prisma/schema.prisma and its committed migration.

**Verification**
- General CI remains the required gate for this latest seller/admin UI batch. Earlier runs were cancelled by newer commits; the consolidated run on the latest code must complete Prisma validation/generation, typecheck, lint, unit tests, and production build.
- No user database was connected and no production migration was executed. PostgreSQL verification remains limited to disposable CI services.

**Next**
1. Complete the consolidated General CI and fix only concrete failures.
2. Run the existing PostgreSQL integration workflow on the latest committed migrations and queries.
3. Implement store staff invitation/acceptance/revocation UI, then return to remaining buyer catalog UX.
4. Keep cart/checkout outside this phase until its backend domain is implemented.

## 2026-11-03 — Seller team and invitation UI integration

**Implemented**
- Added a store-scoped staff listing query, protected by store owner or exact STORE-scoped `store:staff:manage` authorization, and exposed it through GET /api/stores/[storeId]/staff alongside the existing invitation POST.
- Added GET /api/stores/staff-invitations to list invitations addressed to the authenticated user.
- Added /seller/staff: store team listing, invitation submission for existing active accounts, invitation acceptance, and membership revocation. The page calls the backend APIs; it does not mutate membership or permissions client-side.
- Linked team management from the seller workspace.

**Prisma decision**
- No schema migration is required for this UI. `SellerStaff` already persists store/user membership, inviter, status, invitation timestamp, and acceptance timestamp; the existing scoped role assignment represents the granted store permission. Adding duplicate invitation/member tables would create conflicting sources of truth.
- The invitation form currently uses the target account's user ID; email-based account lookup and email delivery are intentionally deferred until the identity/contact and notification workflow is specified.

**Verification and safety**
- The stock transfer listing syntax issue was fixed in commit `3ec5b23e`.
- CI runs were repeatedly cancelled by subsequent pushes. The latest complete General CI result is not yet available; do not mark this batch green until a consolidated run completes.
- No owner PostgreSQL database was connected and no Vercel environment variables were accessed or changed.

**Next**
1. Let one consolidated General CI run complete on the latest code and fix only concrete findings.
2. Run the existing PostgreSQL integration workflow once against disposable CI PostgreSQL.
3. Continue the buyer catalog journey and reference-data activation; keep cart/checkout paired with its backend phase.


## 2026-11-03 — Buyer discovery filters connected to catalog APIs

**Implemented**
- Added the storefront brand selector using `GET /api/brands?locale=en&limit=100` and passed the selected `brandId` into `GET /api/products`.
- Brand selection resets pagination; clear filters resets the query, category, and brand together. Existing market/currency filtering, sorting, and pagination remain connected to the discovery API.
- Commit: `3bd744a44f5265ab6e41b08168085b7e1b7cbe82`.

**Prisma decision**
- No schema change or migration is needed for these UI filters: `Brand`, product-brand relation, market pricing, and the discovery query already exist in `prisma/schema.prisma` and the catalog service. Adding duplicate fields would violate the canonical blueprint rules.

**Verification**
- General CI passed on commit `3bd744a44f5265ab6e41b08168085b7e1b7cbe82`: [run 41693570451](https://github.com/waelkamira/mtjr2/actions/runs/41693570451). Prisma validate/generate, typecheck, lint, unit tests, and production build all passed.
- PostgreSQL integration workflow has not yet been run against the latest marketplace changes; do not treat migration replay as verified until a disposable PostgreSQL run succeeds.
- No owner database or Vercel environment variables were accessed or changed.

**Next**
1. Run the disposable PostgreSQL integration workflow and verify all committed migrations replay cleanly.
2. Continue remaining Marketplace Core work only after reviewing the integration result; update Prisma only for a demonstrated missing domain relation or invariant.


## 2026-11-03 — Marketplace verification and buyer product gallery

**Verification completed**
- General CI passed on commit `3a9369bf`, run [41694468941](https://github.com/waelkamira/mtjr2/actions/runs/41694468941): Prisma validate/generate, TypeScript, lint, focused unit tests, and production build.
- Disposable PostgreSQL integration passed on the same commit, run [41694468501](https://github.com/waelkamira/mtjr2/actions/runs/41694468501). The workflow applied the committed migrations to its isolated PostgreSQL service and completed its integration suite.
- These results verify the combined marketplace/catalog/inventory changes at `3a9369bf`; they do not imply production DB connectivity or deployed HTTP E2E verification.

**Implemented after verification**
- Added an accessible product media gallery to the buyer product detail page: primary image selected by default, selectable thumbnails, keyboard-operable buttons, and pressed-state semantics.
- Commit: `a50435590e9dd63b725e7a6484a2e59a9dbd2b2f`.

**Prisma decision**
- No schema change or migration was required for the gallery. It presents the existing product media records and primary-image flag; no new persisted business state is introduced.

**Next**
1. Verify the gallery commit with General CI.
2. Add server-rendered product metadata using the canonical public product API, without duplicating product data models.
3. Keep launch-market seeding blocked until supported launch countries/currencies are approved.


## 2026-11-03 — Server-generated buyer product SEO metadata

**Implemented**
- Added `generateMetadata` to `src/app/products/[slug]/page.tsx`, resolving the public product through `getDiscoverableProduct` rather than duplicating catalog queries.
- Generates product title, description, canonical URL, Open Graph metadata/image, and Twitter card; missing products receive `noindex` metadata.
- Commit: `dd725732dab3e7a7a6466254828a9e13467c0ef2`.

**Prisma decision**
- No schema change or migration: the metadata uses existing product, localized translation, store, and media fields. This is presentation metadata, not new persisted business state.

**Verification**
- General CI passed on the exact commit: [run 41698547547](https://github.com/waelkamira/mtjr2/actions/runs/41698547547). Prisma validate, Prisma generate, typecheck, lint, unit tests, and production build all completed successfully.
- No production database was accessed; no Vercel environment variables were read or changed.

**Next**
1. Keep launch market and taxonomy seeding blocked until the owner approves supported launch countries/currencies and the initial taxonomy.
2. Finish the remaining Marketplace Core review against the blueprint, then begin Buying Core with cart/checkout persistence, inventory reservation lifecycle, and idempotent order creation as one connected backend/frontend slice.


## 2026-11-03 — Buying Core 4.1: persistent cart foundation

**Implemented on `feat/buying-cart-core` (verification pending)**

- Added canonical `GuestSession`, `Cart`, and `CartItem` models plus migration `20261103193000_cart_foundation`.
- Enforced exactly one cart owner (customer or guest), unique active carts per owner/market/currency, and cart-line quantity bounds in PostgreSQL.
- Guest sessions use an opaque HttpOnly cookie; only a SHA-256 token hash is persisted. Guest carts merge transactionally into the signed-in customer's matching market/currency carts.
- Added `GET /api/cart`, `POST /api/cart/items`, `PATCH /api/cart/items/[itemId]`, and `DELETE /api/cart/items/[itemId]`.
- Server validates active market/currency, published product, active variant, current price, and available inventory before adding or changing quantities.
- Connected product detail's Add to cart action, homepage cart navigation, and the `/cart` buyer page to the real APIs.
- Added focused tests for guest-token hashing, valid add, quantity bounds, and insufficient stock.
- Cart additions do not reserve inventory; stock is reserved only when the shopper creates a time-limited checkout quote. Shipping, taxes, discounts, payment and order creation remain pending.

**Prisma decision**
- Schema changes are required because the canonical blueprint calls for persistent guest/customer carts and the existing schema had no GuestSession, Cart, or CartItem models. The migration adds only those required records and their ownership/quantity constraints.

**Verification and safety**
- Latest main General CI before this feature passed: run [41699817283](https://github.com/waelkamira/mtjr2/actions/runs/41699817283), including Prisma validate/generate, typecheck, lint, unit tests, and production build.
- Cart foundation verification passed: General CI run [41702592022](https://github.com/waelkamira/mtjr2/actions/runs/41702592022) and disposable PostgreSQL integration run [41702592323](https://github.com/waelkamira/mtjr2/actions/runs/41702592323).
- No owner database was connected, no production migration was run, and no Vercel environment variable was read or changed.

**Next**
1. Complete General CI for `feat/buying-cart-core` and fix only actual failures.
2. Run one disposable PostgreSQL migration/integration check.
3. Record exact results, review, and merge the cart foundation.
4. Continue with checkout quote and reservation lifecycle per `PHASE_04_BUYING_PLAN.md`.

## 2026-11-03 — Buying Core 4.2: checkout quote and inventory reservation

**Implemented and verified**
- Added `CheckoutQuote` and `CheckoutQuoteLine` to the canonical Prisma schema with migration `20261103200000_checkout_quote_reservations`.
- Added server-side price snapshots in integer minor units; browser-submitted totals are never trusted.
- Added ten-minute checkout quotes, idempotent create/read/release APIs, and atomic stock reservations using conditional inventory updates and `InventoryReservation`.
- Added bounded expiry processing and lazy expiration on quote access/creation.
- Connected the cart's Review checkout action to `/checkout`; the review UI reads the quote from the API and can release the hold.
- Added focused tests for quote price snapshots, idempotent replay, and insufficient stock.
- PR #2: https://github.com/waelkamira/mtjr2/pull/2 (stacked on PR #1).

**Verification**
- General CI passed: [run 41704221580](https://github.com/waelkamira/mtjr2/actions/runs/41704221580).
- Disposable PostgreSQL migration/integration passed: [run 41704221517](https://github.com/waelkamira/mtjr2/actions/runs/41704221517).
- No owner database was accessed and no Vercel environment was read or changed.

## 2026-11-03 — Buying Core 4.2a: delivery address capture

**Implemented on `feat/checkout-address-capture`; verification pending**
- Added `UserAddress` and `CheckoutQuoteAddress` to `prisma/schema.prisma` with migration `20261103210000_checkout_address_capture`.
- Added customer address-book list/create service and authenticated `GET/POST /api/account/addresses`.
- Added quote-scoped delivery address read/write APIs. Guest buyers can enter a one-time address; signed-in buyers can choose a saved address or save a new one.
- Delivery country is derived from the quote's market on the server; clients cannot select or override it. Address snapshots are stored on the quote and do not alter the quote's item subtotal.
- Connected checkout review UI to the delivery-address API and added focused tests for guest address snapshots, country override rejection, and guest restrictions on saved-address references.
- Shipping rates, tax, coupon, payment and order creation are intentionally not represented as completed; they need their own canonical rules and persisted models.
- Next verification: General CI and the disposable PostgreSQL integration workflow on the exact address-capture commit.
- No owner database or Vercel environment was accessed.

## 2026-11-03 — Buying Core 4.2a verification and quote-address read correction

**Verification**
- Delivery-address capture passed General CI run [41706908024](https://github.com/waelkamira/mtjr2/actions/runs/41706908024).
- Disposable PostgreSQL migration/integration passed run [41706907994](https://github.com/waelkamira/mtjr2/actions/runs/41706907994).
- Both runs tested commit `1864542df8b8ce9d643424e8be68541d63099200`; the earlier syntax correction is included.

**Review finding and correction**
- Review found that `getCheckoutQuote` and idempotent quote replay did not include the optional `deliveryAddress` relation, although the quote serializer supported it. A checkout reload could therefore omit the address snapshot from the quote response.
- Updated both Prisma include selections to load the quote's address snapshot. This is a query-contract correction; no schema change or migration is required because `CheckoutQuote.deliveryAddress` already exists in the canonical schema.
- General CI and disposable PostgreSQL verification for this follow-up correction are pending.

**Next**
- Continue with configurable store/market shipping rules and quote-owned shipping selection. Do not assume carriers, prices, tax rates, or launch countries.
- No owner database or Vercel environment was accessed or changed.


## 2026-11-03 — Buying Core 4.3: configurable multi-vendor shipping (verification pending)

- Added `StoreShippingRate` and `CheckoutShippingSelection` to the canonical Prisma schema, plus `CheckoutQuoteLine.storeId` to preserve seller ownership in quote snapshots.
- Added migration `20261103223000_store_shipping_options` with store/market/currency foreign keys, non-negative money, valid delivery-day ranges, and effective-date constraints. Existing quote lines are backfilled through ProductVariant → Product before `storeId` becomes required.
- Added seller rate create/list service and APIs at `/api/seller/shipping-rates`; the seller workspace now creates and lists store shipping services for markets the store serves.
- Added buyer quote shipping options and per-store selection APIs at `/api/checkout/quote/[quoteId]/shipping`; checkout UI displays and selects each seller's eligible services independently.
- Server filters rates by active market/currency, active store/seller, destination region, and effective dates; selected rate values are copied into a quote snapshot. No carrier or shipping amount is fabricated.
- Added workflow triggers for the stacked shipping PR and its Prisma/server/API paths.
- **Verification update:** Prisma validate/generate and disposable PostgreSQL migration/integration passed in run 41708370004. General CI run 41708369901 exposed a TypeScript target issue with BigInt literals; fixed in commit 59a5155. Added focused shipping tests in commit 2667857. General CI must be rerun before this slice is marked verified. Do not treat this slice as complete until both workflows pass.
- No owner database, production database, or Vercel environment was accessed.


## 2026-11-03 — Buying Core 4.4: market tax rules and checkout calculation

**Implemented on `feat/checkout-tax-calculation` (stacked on shipping PR #4)**

- Added canonical Prisma models `MarketTaxRate` and `CheckoutTaxSnapshot` plus migration `20261103230000_market_tax_rules`.
- Added platform-admin tax rule creation/listing at `/api/admin/tax-rates` and `/admin/tax-rates`. Rules are scoped to an active market and optional destination region, with basis-point rate, inclusive/exclusive behavior, shipping applicability, priority, and effective dates.
- Added quote-owned tax calculation at `POST /api/checkout/quote/[quoteId]/tax`. It verifies quote ownership, active status, delivery address, and shipping selection for every seller before calculating.
- Calculation uses integer minor units. Exact-region rules override market-wide rules. The rule and calculated amount are persisted as a quote snapshot. If no rule exists, the API reports missing configuration and does not invent a rate.
- Connected the buyer checkout review UI to show tax and estimated total after the buyer requests calculation.
- Scope limitation: this first rule engine applies one market/region rule to the full item subtotal and optionally shipping. Product/category exemptions, multiple overlapping jurisdictions, compound taxes, legal registration/nexus, and discounts remain future work and require launch-jurisdiction rules.
- No new test matrix was added. One normal CI run and one disposable PostgreSQL migration/integration run are the only verification gates for this schema slice.
- Verification pending. No owner database, production database, or Vercel environment was accessed.


## 2026-11-03 — Buying Core 4.5: transactional order and vendor-order creation

**Implemented on `feat/order-vendor-order-creation`, stacked on tax PR #5**

- Added canonical Prisma models `Order`, `OrderAddress`, `VendorOrder`, `OrderItem`, `OrderStatusHistory`, and `VendorOrderStatusHistory`, with order/vendor status enums and migration `20261103233000_order_vendor_order_creation`.
- Added `InventoryMovementType.SALE` to record stock consumption against the created order.
- Added `placeOrderFromCheckoutQuote`: verifies ownership, quote status/expiry, address, per-store shipping selections, currency consistency, tax snapshot, and reservation coverage. Uses a serializable transaction and deterministic quote idempotency.
- Creates one marketplace order and one vendor order per distinct store. Allocates tax shares deterministically in integer minor units and preserves order item/address/price snapshots.
- Consumes inventory reservation rows and decrements both on-hand and reserved quantities atomically; writes SALE movements; marks quote CONVERTED and cart CHECKED_OUT.
- Added buyer placement API, buyer order detail/history APIs and pages, plus store-scoped seller order API/page linked from seller workspace.
- Payment is intentionally not initiated. Parent and vendor orders remain PENDING_PAYMENT; fulfillment is not authorized until provider-confirmed payment.
- Disposable PostgreSQL integration passed run 41713575100, including Prisma validation/generation, committed migration deployment, baseline seed, and the existing integration suite. General CI run 41713575137 passed Prisma validation/generation and TypeScript typecheck, then reported three lint blockers; the tax admin effect and two apostrophe-escaping issues were corrected in commits ec773e1, 9f52aa3, and 19fb10f. Fresh General CI run 41713964722 is pending. No additional test matrix added. No owner/production database or Vercel environment accessed.

## 2026-11-04 — Checkout coupons and order-total integrity

**Implemented at source level**
- Added marketplace-wide percentage coupons and fixed-amount coupons bound to one currency, with active schedule, optional total-redemption cap, audited `users:manage` CRUD APIs, and migration `20261104235500_checkout_coupons`.
- Added coupon input to each cart; checkout quotes normalize and validate codes, calculate discounts from server-priced merchandise subtotal, and snapshot coupon/discount with the quote.
- Tax uses the discounted taxable base. Order and vendor-order totals preserve the merchandise subtotal, allocate discounts and tax by store, record one coupon redemption, and consume stock inside the existing serializable order transaction.
- Same-key quote replay rejects a different coupon; order placement returns a committed order after recognized unique/serialization conflicts.
- Added tests for guest-cart merge, coupon eligibility/calculation, tax-after-discount, vendor discount allocation, redemption caps, and order retry behavior.

**Verification boundary**
- 25 focused tests across cart, checkout quotes/coupons, order placement, and tax pass; Prisma schema validation and TypeScript typecheck pass; changed checkout files pass ESLint with one existing cart `<img>` warning.
- With user approval, migration `20261104235500_checkout_coupons` was applied to local `mtjr2_demo`; Prisma reported all migrations up to date and a PostgreSQL coupon-persistence smoke test passed. No production migration was run. Full browser checkout journey and payment-provider configuration remain unverified.


## 2026-11-05 — System 05 order history and tracking

**Implemented at source level; migration/runtime verification pending**
- Buyer order detail now returns and renders parent and vendor-order status histories, shipment details, and tracking events. Customer order history continues to link to owned order detail pages.
- Buyer cancellation is limited to PENDING_PAYMENT orders with no payment attempt. It shares the payment subsystem's per-order advisory lock, restores every SALE movement with an idempotent `ORDER_CANCELLATION` ledger entry, cancels vendor orders, records status/audit history, and releases coupon redemption in one serializable transaction.
- Reorder validates every linked original variant against current active listing, market, currency, price, quantity, and stock, then adds all lines to the current cart atomically or none.
- Sellers may record one carrier/tracking entry per READY_TO_SHIP vendor order and add forward-only manual tracking events. Tracking links must use HTTPS. Shipment creation/delivery update vendor and aggregate order status histories and notify the buyer. Carrier integrations, invoices, and paid-order cancellation/refunds are deferred.
- Added migration `20261105003800_order_tracking_cancellation` for cancellation inventory movement type and shipment/tracking models.
- Added focused tests for atomic reorder, pre-payment cancellation/restock, payment-attempt cancellation rejection, manual shipment creation, forward tracking transitions, and delivered parent status.

**Verification boundary**
- 50 focused cart/checkout/order/tax/shipping/payment tests pass; Prisma schema validation, TypeScript typecheck, and targeted ESLint pass.
- With user approval, migration `20261105003800_order_tracking_cancellation` was applied to local `mtjr2_demo`; Prisma reports the schema is current, and Prisma queries confirm the shipment tables and cancellation movement enum are available. The existing PostgreSQL integration suite passes (4 tests). End-to-end PostgreSQL cancellation/shipment mutation and browser journeys remain pending. No production database was accessed.


## 2026-11-03 — System 10 initial slice: in-app order notifications

- Added canonical `Notification` model and migration `20261103234000_order_notifications`.
- Added authenticated user-scoped notification listing and mark-read services/APIs, plus connected `/notifications` UI.
- Order placement emits buyer and store-owner notifications inside the same serializable transaction as order creation. Unique deduplication keys preserve retry safety.
- Email, preferences, retry/outbox, and non-order event delivery remain pending.
- Verification is pending with the existing General CI and disposable PostgreSQL integration workflows only.


## 2026-11-03 — System 06 initial slice: verified product reviews

- Added canonical `ReviewStatus`, `ProductReview` and `StoreReview` models; migration: `20261104001000_verified_product_reviews`.
- Enforced delivered-order ownership at submission, one review per customer/product, and unique review per purchased order item.
- Added public product review list/aggregate, authenticated reviewable-purchase lookup, customer review history, and audited platform moderation APIs.
- Connected product detail product/store review display, product review submission, delivered-order store review submission, customer product/store review history, seller review center with owner responses, and admin product/store moderation queue UIs.
- All submissions are PENDING until moderation; unapproved content is not exposed publicly.
- Store reviews, seller responses, media, reports/appeals remain incomplete. No expanded test matrix added.


## 2026-11-03 — System 07 initial slice: customer wishlist

- Added canonical `Favorite` model and migration `20261104002000_customer_favorites`.
- Added authenticated, owner-scoped favorites list/status/add/remove services and APIs.
- Connected product detail save/remove control and `/account/wishlist` UI.
- Server validates product availability and enforces unique customer/product favorites.
- Guest merge, named lists and recommendation logic remain incomplete. No expanded test matrix added.


## 2026-11-03 — System 08 initial slice: product questions and answers

- Added `ProductQuestion` and `ProductAnswer` models and separate moderation enums; migration: `20261104003000_product_questions_answers`.
- Added authenticated customer question submission, public published-only Q&A, active store-owner answers, customer history, seller inbox and admin moderation APIs.
- Added audit events and in-app notifications when questions or answers are published.
- Connected product detail, customer account, seller workspace and admin moderation interfaces.
- Staff-scoped answers, abuse reporting, attachments and advanced history/editing remain incomplete. No broad test suite added.


## 2026-11-04 — System 09 initial slice: customer support tickets

**Implemented on `feat/customer-support-tickets` ([draft PR #11](https://github.com/waelkamira/mtjr2/pull/11)):**
- Added canonical `SupportTicket` and `SupportMessage` Prisma models, status/priority enums, customer/assignee/sender relations, queue indexes, and migration `20261104010000_customer_support_tickets`.
- Added transactional ticket creation with initial message and audit event; customer-owned list/detail/reply services; permission-protected admin queue/detail/reply/internal-note/status/priority/self-assignment operations.
- Added customer APIs `/api/support/tickets` and `/api/support/tickets/[ticketId]`, admin APIs `/api/admin/support/tickets` and `/api/admin/support/tickets/[ticketId]`.
- Connected `/account/support`, `/account/support/[ticketId]`, and `/admin/support` interfaces to those APIs.
- Customer reads are strictly scoped to the authenticated owner and never include internal notes. Agent replies create customer in-app notifications in the same transaction; administrative changes and ticket creation are audited.
- Not implemented in this slice: store-to-customer conversations, attachments, read receipts, SLA automation/escalation, team routing, and email delivery.
- Verification: files and migration were committed through GitHub. Prisma validation, migration replay, typecheck, and production build have **not** yet been observed for this branch. No routine test matrix was expanded. No production database or Vercel environment was accessed.


## 2026-11-04 — System 09 expanded: store messaging, ticket read state

- Added `StoreConversation` and `StoreMessage` Prisma models with a separate migration, customer/store/order relations, conversation indexes, and persisted customer/store read timestamps.
- Added customer APIs `GET/POST /api/messages` and `GET/POST /api/messages/[conversationId]`; customers can start a conversation from a product page, view their inbox, and reply.
- Added store-scoped seller APIs `/api/stores/[storeId]/messages` and `/api/stores/[storeId]/messages/[conversationId]`; seller inbox UI `/seller/messages` and customer UI `/account/messages` are connected.
- Seller access is restricted to store owner or active store staff with scoped `messages:manage`. Product inquiry actions create a server-side conversation; order-linked conversations validate that the order belongs to the customer and includes the selected store.
- Added dedicated `messages:manage` permission to identity seed roles; customer-facing messages create in-app notifications, and seller replies are audited.
- Extended support tickets with customer/agent read timestamps and first public response timestamp; admin workflow now uses dedicated `support:manage` rather than broad `users:manage`.
- Remaining: attachment upload/storage and security scanning require an object-storage provider; SLA target policy/escalation needs agreed operational targets and a worker; staff notification routing and email delivery remain open.
- Verification: no production database used. Prisma validation/typecheck/build and isolated PostgreSQL migration replay are not yet confirmed for this expanded branch.


## Storefront readiness finding (2026-11-04)

- The current home page has a search form wired to `GET /api/products`, market/category/brand filters, sorting, pagination, product links and a cart entry point.
- `prisma/seed.cjs` seeds only roles and permissions. It does not create demo markets/currencies/catalog/store/products/variants/prices/media/inventory. An empty database therefore has no demo products and the search UI has nothing to find.
- The implementation chain is stacked and unmerged. PR #11 is based on PR #10, not `main`; its pages will not appear in the main deployment until reviewed/merged in sequence.
- Next separate delivery slice: deterministic demo catalog seed plus a materially complete homepage and a verified public browse/search/product/cart journey. No production DB seed or credentials will be used.


## 2026-11-04 — System 09 hardening and build-blocker correction

- Added authorized staff notification routing for customer-to-store conversations. Recipients are limited to the store owner and active store staff with the exact store-scoped `messages:manage` grant; the sender is excluded. No schema change was needed.
- Fixed the order serializer typecheck blocker exposed by PR #11 CI: all three order read projections now select `VendorOrder.store.id` as required by the serializer contract.
- Earlier PostgreSQL integration run `41722286425` passed on commit `24f68dd`. General CI run `41722286316` failed at typecheck on an order projection mismatch; this was corrected in commit `26f1ab4`.
- Latest staff-routing and documentation commits triggered General CI run `41723375413` and PostgreSQL integration run `41723375356`; both were pending at the time of this entry. No claim of success is made.
- System 09 still depends on an approved object-storage provider/upload policy for attachments, an agreed SLA policy plus worker, and a verified outbound-email sender. These are explicit decisions/operational dependencies, not hidden implementation claims.
- No production database, local owner database, or Vercel environment was accessed. No pull request was merged.


## 2026-11-04 — Storefront demo experience

- Created `feat/storefront-demo-experience` on top of the latest System 09 branch; no PR was merged.
- Added an opt-in repeatable demo seed fixture to `prisma/seed.cjs`: NL demo market/EUR, demo seller/store, 4 active categories with images, 3 brands, 8 approved/published products, translations, variants, EUR prices, product media, warehouse and stock.
- The fixture requires both `SEED_DEMO_CATALOG=true` and `ALLOW_DEMO_CATALOG_SEED=true`, and refuses to run under `NODE_ENV=production`. The normal seed path remains identity-only. No database was connected to or seeded during this work.
- Updated storefront navigation with visible sign-in/register, wishlist, orders, cart, seller, messages and notifications links. Replaced the category chip row with an image-led responsive category grid and added featured-brand filters.
- Existing search/filter/sort/pagination and product detail/cart/favorite/messaging calls remain wired to canonical APIs. No Prisma schema change was necessary because the fixture uses existing models.
- The Netherlands/EUR market is clearly a demo fixture only, not a launch market, tax rule or regulatory decision. Checkout still needs approved shipping/tax/payment configuration before an end-to-end paid order can be demonstrated.
- Verification policy: no broad test matrix was added or awaited. No database seed, Prisma migration, production database, or Vercel environment was run/changed in this implementation. Focus next on only any typecheck/build/data-integrity blocker reported by CI.


- CI trigger inspection found the new feature branch was missing from both workflow PR base-branch allowlists. Added `feat/storefront-demo-experience` to the General CI and disposable PostgreSQL integration workflow allowlists so PR #12 is eligible for those workflows. This is a workflow-trigger correction, not a test expansion.


## 2026-11-04 — System 03: shareable storefront discovery state

- Synced the active storefront query, market, category, brand, sort and page into the browser URL without adding a new API or Prisma model.
- Restored validated query state from the URL before the first product request, preventing an initial unfiltered request from racing with deep-link restoration.
- Browser back/forward navigation restores the visible discovery controls and triggers the corresponding catalog API request.
- Existing `/api/products` validation, active-product filtering, market-aware pricing, synonym expansion and pagination remain the source of truth; no client-side catalog filtering was introduced.
- No Prisma schema or migration change was needed. No database was accessed and no routine test suite was expanded or awaited.
- Known gaps: typo-tolerant ranking, autocomplete/suggestions and richer facets remain deferred until catalog scale and relevance requirements are measured.


## 2026-11-04 — System 10: persisted in-app notification preferences

- Added canonical `NotificationPreference` rows keyed uniquely by user and event type, with in-app delivery enabled by default. Migration: `20261104030000_notification_preferences`.
- Added authenticated `GET/PUT /api/account/notification-preferences`; input is restricted to the four currently implemented event types and must include each exactly once.
- Connected settings controls to the existing `/notifications` page. Users can manage order updates, seller order alerts, store messages and support replies.
- Centralized preference-aware notification creation and wired it into transactional order, seller order, store messaging and support reply events. A missing preference preserves current behavior (enabled); disabling a type suppresses future in-app records for that recipient. Existing notification history is not deleted.
- Email preferences/delivery are intentionally not exposed until a verified sender, consent handling, outbox/retries and delivery status exist.
- Updated the 49-system blueprint. No live database was accessed or migrated; only the committed Prisma schema and additive SQL migration were changed.
- Verification policy: no routine test expansion or wait. Focus only on Prisma generation/type/build blockers or preference/notification persistence integrity.


## 2026-11-04 — System 11: initial customer returns workflow

- Added canonical `ReturnRequest` and `ReturnItem` models, status enum, ownership/reviewer relations, quantity constraint, indexes and additive migration `20261104040000_returns_workflow`.
- Added `returns:manage` to the baseline permission seed and granted it to support agents, administrators and the break-glass super-admin role.
- Added authenticated customer APIs for return-center listing, request creation and request detail; added permission-gated admin queue and status-review APIs.
- Connected `/account/returns` to delivered order items and return history; added entry links from order history and delivered order detail. Added `/admin/returns` for approval, rejection and marking approved goods as received.
- Data integrity: customer ownership comes from the verified session; only delivered vendor-order items are eligible; aggregate prior return quantities prevent over-returning; request creation uses a SERIALIZABLE transaction; admin transitions use conditional updates; all creation/review changes write audit events.
- Financial boundary: this slice does not create a Refund or Payment record, calculate a refund, invoke a provider, or post to a ledger. Approval and receipt are workflow states only. No money is moved.
- Known gaps: no approved market-specific return window; evidence upload, return shipping/labels, seller-side handling, customer notifications, refund calculation/execution and ledger reconciliation remain unimplemented. These are not silently assumed.
- Added the new branch to CI base-branch allowlists and the PostgreSQL integration path filters. No owner/local/production database was accessed and no migration was applied.
- Verification policy: no broad test expansion or routine-suite waiting. Inspect only Prisma validation/generation, typecheck/build blockers, and transactional quantity/status correctness; workflow results are not assumed.


## 2026-11-04 — Existing CI lint blockers surfaced during System 11 review

- Inspected the failed General CI run on the System 10 head. Prisma validation, Prisma Client generation and TypeScript typecheck had passed; lint failed on seven pre-existing React effect/state hydration patterns in tax rules, seller messages, wishlist, product/store review queues and product reviews. The build and unit-test steps were skipped by the workflow after lint failed.
- Applied focused asynchronous effect-hydration changes to those existing pages on the returns branch. No domain behavior, API contracts or database behavior was changed by these lint corrections.
- The System 10 disposable PostgreSQL integration job completed successfully. The initial System 11 CI attempt was cancelled when the branch received follow-up commits; a new run for the latest head has not yet been observed. No build/lint pass is claimed.


## 2026-11-04 — Homepage discovery section

- Added a responsive editorial discovery panel between the hero and category/catalog sections to make the homepage feel intentionally composed even before demo catalog data is available.
- Wired the primary CTA to the existing product discovery section, the category tile to the live category section, and the seller CTA to `/seller`.
- No fabricated product cards, stock, pricing, reviews, or sales figures were introduced. Actual products/categories remain API-backed; if the database has no active catalog data, the existing honest empty states remain.
- UI-only change; no Prisma schema/migration required. No test suite was added or awaited.

## 2026-11-04 — Unified page/route registry

- Added `docs/implementation/PAGE_ROUTE_REGISTRY.md` as the shared target inventory for public storefront, authentication/customer account, seller workspace, platform administration, and property/booking pages.
- Each target row records the intended audience, owning system(s), API/domain service and Prisma data to verify, an explicitly provisional status, and known evidence/gaps. The registry distinguishes target pages from routes verified in code; no route-by-route filesystem audit is claimed by this documentation change.
- Added the registry requirement to `docs/architecture/COMPLETE_PLATFORM_SYSTEMS_BLUEPRINT.md`: reconcile targets with actual App Router routes and track navigation, authorization, API wiring, loading/empty/error states and focused verification before marking pages complete.
- Documentation-only change; no Prisma schema/migration, runtime code, database, or Vercel settings changed. No tests were run for this documentation-only change.


## 2026-11-04 — End-to-end journey standard and plan correction

- Added `docs/implementation/END_TO_END_JOURNEY_STANDARD.md` as the mandatory checklist for every visible action, route, API and persisted workflow across all 49 systems.
- Updated the canonical 49-system blueprint to require vertical journey delivery, explicit authorization and state/error handling, a model-usage review before schema changes, and exact-commit evidence before a journey is marked verified.
- Extended the page/route registry with a seller-application journey from the homepage CTA through identity gate, form submit, application status, admin review and draft-store creation, including API/persistence contracts and security/failure cases.
- Updated the Phase 3 plan with an end-to-end seller-onboarding acceptance gate and focused test policy; linked the standard from README.
- This change is documentation and acceptance-criteria only. No runtime code, Prisma schema, migration, database, or Vercel settings were changed. No tests were run; no CI pass is claimed. The seller journey remains implemented/unverified until its actual route-by-route and browser/HTTP evidence is recorded.


### Source-review addendum — seller onboarding journey

- Inspected the actual seller page, application API and domain service on `feat/returns-workflow`. The form is embedded in `/seller`, requires a verified session/email, persists a PENDING Seller and audit event transactionally, and treats an existing PENDING application as a replay.
- Inspected admin review service behavior: `users:manage` authorization, required rejection reason, conditional PENDING-state update, seller role assignment on approval and audit logging.
- Corrected the registry so it does not imply a dedicated onboarding/status page exists. Added explicit gaps for store-creation idempotency (not demonstrated by the reviewed service), API error classification, and full browser journey evidence.
- This is static source inspection only. No runtime journey, CI run, Prisma validation, migration replay, database access, or Vercel action was performed as part of this documentation review. No test pass is claimed.


## 2026-11-04 — Plan and implementation audit before resuming Phase 4

**Branch and scope**
- Audited PR #15 (`feat/returns-workflow`) and its stacked implementation state; PR #15 remains open/draft and is not merged.
- Confirmed the canonical schema contains 74 Prisma models and 24 enums. Added `docs/architecture/PRISMA_MODEL_USAGE_MAP.md` to map model groups to their owning systems and current service/API entry points. Corrected the blueprint and journey-standard links to this real file; the previously referenced lowercase filename did not exist.
- Reconciled Phase 3: removed the duplicated seller-onboarding acceptance gate, changed its status from “approaching exit review” to a historical handoff with outstanding evidence, and pointed active Buying Core work to Phase 4 rather than restarting it.
- Added an actual App Router filesystem snapshot to `PAGE_ROUTE_REGISTRY.md`: 30 page files and 86 API route files were found. Recorded existing page paths and important missing dedicated targets. This is static route presence only, not proof of runtime or end-to-end behavior.
- Phase 4 remains active. Payment provider work is explicitly blocked until launch markets, currencies, merchant account and payment methods are approved; no provider or fake payment behavior is assumed.

**Exact-head verification reviewed**
- On head `56e51199e604fab5ed14921b38ac6f9030fac0e9`, disposable PostgreSQL workflow [41745430005](https://github.com/waelkamira/mtjr2/actions/runs/41745430005) passed, including Prisma validate/generate, migration deployment, baseline seed, and the existing PostgreSQL integration suite.
- General CI [41745430118](https://github.com/waelkamira/mtjr2/actions/runs/41745430118) failed in one existing delivery-address unit test: 25 files passed; 116 of 117 tests passed. Prisma validate/generate, typecheck and lint passed; build was skipped because tests failed.
- Root cause was an outdated test transaction fixture: production code correctly invalidates checkout shipping and tax snapshots after address changes, but the mock transaction omitted those two Prisma delegates.
- Follow-up commit `6f614928c255d3beeeb46af79d41849c24894f46` updates the fixture and asserts both invalidation calls. Fresh General CI on the corrected/newer head is pending; no pass is claimed yet.
- PostgreSQL success above is tied to the exact `56e5119` head and remains valid for that head; it is not a substitute for General CI and is not automatically evidence for later schema changes.

**Boundaries**
- No Prisma schema or migration was changed during this audit.
- No owner/local/production database or Vercel environment was accessed.
- No pull request was merged.
- Next: inspect fresh General CI on the corrected head; continue a focused checkout → order → payment boundary journey review; only start provider-specific payment implementation after owner decisions. Keep Phase 3 seller onboarding and public-route gaps visible rather than marking them complete.


## 2026-11-04 — Enforced all-49 action tracing and began Identity UI completion

**Platform-wide plan change**
- Added `docs/implementation/END_TO_END_JOURNEY_MATRIX.md` with one ledger row for each of the 49 systems and a required action trace from first interaction through server-confirmed outcome, persistence, recovery, and evidence. All systems begin Not audited; no prior UI/API/model presence was promoted to complete.
- Strengthened `END_TO_END_JOURNEY_STANDARD.md`, `COMPLETE_PLATFORM_SYSTEMS_BLUEPRINT.md`, `PAGE_ROUTE_REGISTRY.md`, and README: every visible control must work end to end or be disabled/removed and honestly marked unavailable. Every schema decision must reuse a canonical model or explain the missing durable business fact and migration.

**Identity implementation slice (System 01)**
- Added `/login`, `/forgot-password`, `/reset-password`, and `/verify-email` pages in `src/app/**/page.tsx`, sharing `src/features/identity/auth-page.tsx`. They call the existing same-origin auth APIs; login return paths are restricted to same-origin local paths; verification tokens are removed from the visible URL after capture.
- Added `/register` as an explicit unavailable information page, not an active registration form. The repository has no published Terms of Service or Privacy Notice, so exposing an account-creation form without owner-approved consent documents would be unsafe. Registration API/service and `UserConsent` persistence exist, but public registration remains blocked until those documents are supplied and published.
- The logout API/service exists but there is still no user-facing logout control. The full identity journey is therefore not complete.
- Updated Phase 2, the route registry and System 01 matrix trace with these exact facts and remaining blockers.
- Current source tree: 35 page routes and 86 API route handlers. These are inventory counts, not verified workflow counts.

**Verification**
- General CI and disposable PostgreSQL integration both passed on exact application/test commit `455d13e6d5c5070aa3ba1fdf0b4679794bb0f0f8`: [CI 41747802067](https://github.com/waelkamira/mtjr2/actions/runs/41747802067) and [PostgreSQL 41747801967](https://github.com/waelkamira/mtjr2/actions/runs/41747801967). CI included Prisma validate/generate, typecheck, lint, unit tests and production build; PostgreSQL deployed committed migrations, seeded roles/permissions and ran the existing integration suite.
- That successful run predates the new identity pages. The identity UI and later plan edits are awaiting fresh exact-head CI/PostgreSQL workflows; no pass is claimed for the new pages yet.
- No Prisma schema or migration changed in this slice. No owner/local/production DB or Vercel settings were accessed. No PR was merged.

**Next blocking work**
1. Obtain fresh exact-head CI and PostgreSQL results for the new pages.
2. Add a real user-facing logout control and verify cookie/session revocation through `/api/auth/me` after logout.
3. Owner must supply approved Terms of Service and Privacy Notice before public registration can be enabled.
4. Configure the real trusted proxy header and Resend sender/key, then run one deployed HTTP journey: register → verify → login → authenticated request → logout → denied request. Until then Phase 2 remains open and downstream launch claims remain blocked.


**Identity journey follow-up:** Added a real Sign out control to the customer order-history header. It posts to `/api/auth/logout`, prevents duplicate clicks, reports failures, and redirects to `/login` only after the server confirms success. Removed the homepage Create account CTA while registration is unavailable, so the storefront no longer advertises an unavailable signup action. Added `no-referrer` and `noindex` metadata to verification/reset token pages. These changes are in source but await fresh exact-head CI and browser/HTTP verification.


## 2026-11-04 — Identity policy pages and development registration

**Implemented**
- Fixed the exact-head CI lint failure in `src/features/identity/auth-page.tsx`: query values are initialized from server-provided page props; the effect now only removes the one-time token from the browser URL and does not synchronously set React state.
- Added `/terms` and `/privacy` as version `v1` development drafts. Both clearly disclose that Mtjr2 is under development and its operating company has not yet been incorporated. Unknown operator identity, contact details, retention schedule, provider regions and final legal disclosures are not invented.
- Replaced the unavailable registration information page with a real registration form. It calls `POST /api/auth/register`, requires separate unchecked Terms and Privacy checkboxes, and handles loading, errors and the server response.
- Added a Create account link to the sign-in page.
- Registration defaults to enabled in development/test and disabled in production. The server-side policy helper blocks production even if `PUBLIC_REGISTRATION_ENABLED=true`; development can explicitly disable registration with `PUBLIC_REGISTRATION_ENABLED=false`.
- Reused existing `UserConsent` records and version `v1` in the registration transaction. No Prisma schema change or migration was necessary.

**Verification**
- Previous head: PostgreSQL integration passed; CI failed only on the synchronous state update lint rule described above.
- The lint issue has been corrected. CI and PostgreSQL integration for the latest commit are awaiting GitHub Actions results.
- No live database was accessed, no migration was applied, and no Vercel environment variables were changed.
- No deployed HTTP/browser registration journey has been executed in this session. Do not mark identity complete until exact-head CI and an actual development deployment journey (registration → verification email → verification → login → logout) pass.

**Important boundary**
- These pages are development drafts, not final approved legal policies. Production registration remains disabled. Public launch still requires completion/review of the operator and policy details.


## 2026-11-04 — Identity expansion and customer account entry points

**Implemented**
- Registration now explicitly requires a choice between Customer/Buyer and Seller.
- Seller registration requires applicant/legal name and public store name, creates a `Seller` record with `PENDING` status in the same transaction, and does not assign seller permissions before approval.
- Added Google OpenID Connect authorization-code flow with state and PKCE. Callback validates the Google token issuer, audience, verified email and expiry; persists `OAuthAccount`, policy consents and audit event; and creates a normal server-side session. Existing email accounts are not silently linked to a Google identity.
- Added optional `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` environment settings and documented them in `.env.example`. Google sign-in remains unavailable until credentials and the callback URL are configured.
- Added account dashboard, profile read/update API and page, saved-address page, and account route aliases for favorites, store and notifications. Homepage now links to the account dashboard.
- Reused existing `User`, `Seller`, `OAuthAccount`, `UserConsent`, `UserSession`, `UserAddress` and `Favorite` models. No Prisma schema change or migration was required.
- Corrected two ESLint errors caused by unescaped apostrophes in the development policy pages.

**Verification**
- Previous exact head `208dc9d`: PostgreSQL integration passed; CI failed on exactly two `react/no-unescaped-entities` errors in the policy pages. Both errors were corrected.
- New registration tests cover both Customer registration and pending Seller application creation.
- Exact-head CI/typecheck/lint/unit tests/build and PostgreSQL integration have not yet completed for the expanded implementation.
- No Google OAuth credentials were supplied, so the provider redirect/callback could not be exercised against a real Google project.
- No deployed HTTP/browser journey has been run. No user database was accessed and no migration was applied.

**Identity completion gate**
- Keep System 01 at Implemented / unverified until exact-head CI and PostgreSQL integration pass, Google credentials are configured and provider sign-in is tested, and the full account lifecycle is exercised in a running deployment.


**Additional account security slice**
- Added `/account/security` and `/account/sessions`, plus `GET/DELETE /api/account/sessions`.
- Session listing is restricted to the authenticated user's own non-revoked sessions. Revocation uses both session ID and authenticated user ID; revoking the current session clears the HttpOnly cookie.
- Added audit events for session revocation. 2FA is visibly marked unavailable rather than exposing a non-functional enrollment control.
- Added tests for blank optional Google credentials and seller-registration business-name validation.
- Exact-head CI and PostgreSQL integration remain the final code gates.


## 2026-11-04 — Shared global storefront navigation (initial slice)

**Observed**
- The navigation header was embedded inside `src/features/storefront/home-page.tsx`, while `src/app/layout.tsx` rendered only `children`. Other routes therefore did not receive the same primary navigation.
- The existing homepage already loaded active markets, categories, brands and discoverable products through catalog APIs.

**Implemented**
- Added `src/components/site-navigation.tsx` as a shared server-rendered header and mounted it in the root layout so it appears across application routes.
- The header resolves the current session server-side, shows guest or authenticated account actions accordingly, and never trusts a client-supplied user ID.
- Added a GET search form that submits to the existing homepage discovery query contract.
- Moved the homepage-only header out of the home page and exposed the existing brands section with a stable anchor.
- Added `/products` as an initial route reusing the existing discovery experience and API-backed filters/pagination.
- Updated the route registry with implementation status and remaining verification gates.

**Prisma decision**
- No schema change: navigation reads the existing authenticated session and links to already-owned account/catalog entities. No new business fact or persistent state is introduced by navigation itself.

**Verification**
- Baseline CI and disposable PostgreSQL integration passed on parent commit `c8ecf1bb3751112249f4b190e5aac4af68ddc464`.
- The new navigation commit must pass CI and PostgreSQL integration before this slice is considered validated.
- Live browser/mobile navigation and authenticated/guest rendering have not yet been exercised; do not mark this slice Verified until those journeys are run.


## 2026-11-04 — Search, category and brand navigation destinations

**Implemented**
- Added a dedicated `/search` route using the existing URL-backed catalog discovery state; the global search form now submits to it.
- Added `/categories` and `/brands` directory pages. Both read active taxonomy data from the existing public APIs and show loading, error and empty states.
- Category and brand selections link to `/products` with the corresponding existing filter IDs, so the product discovery API remains the source of truth.
- Updated the shared navigation destinations and route/action documentation.

**Prisma decision**
- No schema change: Category and Brand entities and their existing listing APIs already support these directories. No new persistent business state is introduced.

**Verification**
- These route additions are awaiting exact-commit CI, Prisma/PostgreSQL integration and build results. Browser interaction, filter handoff and responsive checks remain outstanding.


## 2026-11-04 — Public category, brand and store detail journeys

**Implemented**
- Added active category and brand slug resolvers with locale-aware names and descriptions.
- Added category and brand detail routes showing products filtered by the resolved entity.
- Added a public store directory and store detail route. The directory includes only ACTIVE stores owned by ACTIVE/approved sellers and having ACTIVE products.
- Extended product discovery with a validated optional `storeId` filter. Product discovery continues to require active products, active stores and active sellers.
- Added a reusable product grid with product links, primary images, price display and empty state.
- Connected category and brand directory cards to slug detail routes, product seller links to public store pages, and added Stores to global navigation.
- No Prisma migration was needed; existing domain models cover these read journeys.

**Verification**
- Parent commit `74168a860e608101578cd4c02dde13cf07d84422` passed CI and disposable PostgreSQL integration.
- This implementation slice is pending exact-commit CI and PostgreSQL integration.
- Browser journeys, slug 404 handling, seller visibility and mobile layout remain unverified.


## 2026-11-04 — Store directory build-time database boundary

**Finding**
- Exact-head CI on `18534904b96d021e6a45b26d9a8da22c9129d5a3`: Prisma validation/generation, typecheck, lint and all 123 tests (26 files) passed; production build failed while prerendering `/stores` because the store directory queried PostgreSQL during static generation, when the CI build job has no database server.
- The dedicated PostgreSQL integration workflow passed on the same exact head.

**Correction**
- Marked the database-backed `/stores` directory as dynamically rendered so its approved-store query executes at request time, not during static prerendering. This preserves real database-backed results and does not introduce mock data or a schema change.

**Verification boundary**
- A new exact-head CI build is required to confirm the correction. No production database, owner database, migration, or Vercel setting was accessed.


## 2026-11-04 — First source-level catalog/discovery audit (systems 02–03)

**Baseline:** `d205a6a3248054da4ec049dfd36d79898c7b08b` (CI and Platform PostgreSQL Integration both passed).

**Implemented:** homepage category “View all” now navigates to `/categories`. Route registry and 49-system matrix updated with actual route/service/model wiring and unverified gaps.

**Source findings:** active product/store/seller filtering and market/currency checks exist; taxonomy uses Category/CategoryTranslation and Brand/BrandTranslation; public stores use Store/Seller; BigInt prices serialize to minor-unit strings. Existing schema covers current read paths; no new model/migration justified.

**Gaps before systems 02–03 are complete:** (1) category rows are paginated before tree construction, so parent/child splits can misrepresent hierarchy; (2) category, brand and store details return only first 48 products and store directory only first 48 stores; (3) `/`, `/products`, `/search` share full homepage composition; autocomplete/relevance ranking are missing; (4) cart/favorite/message/review/Q&A actions need end-to-end authorization, persistence and refresh verification.

**Status:** Mapped / Partially wired, not Verified or Complete. Next: hierarchy-preserving category pagination, then directory/detail pagination. No database migration; no production DB or Vercel environment accessed.


## 2026-11-04 — Preserve category hierarchy across pagination

**Change:** `listActiveCategoryTree` now paginates top-level active categories and loads all active descendants for those roots before building the tree. Pagination totals count roots, matching the page unit. A visited set stops malformed cycles; inactive/orphaned parent branches are not exposed as public roots.

**Focused tests added:** multi-level child loading across root-page boundaries and cycle termination. No Prisma schema change or migration was needed. Exact-head CI and PostgreSQL integration are pending.

## 2026-11-04 — Search foundation and seller operations search

**Implemented**
- Public product search now tokenizes bounded Unicode queries and requires each query token to match at least one supported field. Search terms cover product names/slugs/descriptions, localized names, identifiers, variant SKU/barcode, brand, category and store. Active locale synonyms expand matching terms.
- Added bounded product/store suggestions through `GET /api/search/suggestions`; the global navigation uses a debounced, abortable autocomplete.
- Replaced the homepage reuse at `/search` with a dedicated result page, category/brand filters, sort options and filter-preserving pagination.
- Added seller-scoped search for products/SKU/barcode, vendor orders/order number/items and inventory/product/SKU/warehouse. Existing permission checks and store scoping remain before the filtered queries.
- No Prisma schema change: existing SearchSynonym, ProductIdentifier, ProductVariant, Product, Brand, Category, Store, VendorOrder and Inventory models cover the current search fields.

**Verification boundary**
- Focused query-token and multi-token matching tests added.
- Exact-head CI and PostgreSQL integration are required before this slice is validated. Search ranking, typo tolerance, richer filters, browser accessibility testing and performance under production-scale catalog volumes remain future work. Do not label the search system complete.

## 2026-11-04 — Search relevance, filters and synonym administration

**Implemented at source level**
- Added PostgreSQL `pg_trgm` indexes and relevance-ranked pagination with stable publish-time/ID tie-breaks.
- Added validated market/currency-aware price bounds, stock filtering, category/brand facets and relevance sorting; empty optional form values are treated as unset.
- Added `/api/search`, bounded suggestions, persistent public-search rate limits, and audited `users:manage`-protected synonym CRUD at `/admin/search-synonyms`.
- Updated storefront filter controls and URL state for price, availability and relevance. Search suggestions clear stale results as the query changes.

**Verification boundary**
- All 182 tests pass with the repository environment loaded, and ESLint passes for changed search files.
- Whole-app typecheck still fails only in pre-existing `src/server/wishlist/recommendations.ts` Prisma/model errors. The trigram migration has not been applied; exact-head PostgreSQL migration/runtime, browser/accessibility, and scale verification remain pending.
- Do not run a seed or migration against an owner/production database without explicit approval.


## 2026-11-04 — Vercel Hobby-compatible checkout expiry scheduling

**Finding**
- The latest inspected Vercel Preview failure reported that `vercel.json` scheduled `/api/cron/checkout-expiry` every minute, which is not permitted on the project's Hobby plan.
- The endpoint is security-protected by `Authorization: Bearer CRON_SECRET` and releases expired checkout quote inventory holds. Reducing this to once daily would leave expired holds unreleased for too long.

**Implemented**
- Removed the Vercel Cron declaration so Vercel no longer rejects the deployment due to the Hobby-incompatible schedule.
- Added `docs/operations/checkout-expiry-scheduler.md` documenting an external HTTPS scheduler (cron-job.org) calling the existing protected endpoint every five minutes with a custom Authorization header.
- No application route, reservation business logic, Prisma schema, or migration was changed.

**Not yet configured / verified**
- The external cron-job.org job has not been created; it requires the project owner's scheduler account.
- The owner must set a fresh `CRON_SECRET` in the Vercel Preview environment and enter the same value in the scheduler's custom header. Do not share the secret in chat or commit it.
- The Preview deployment must become READY before the endpoint can be exercised.
- No production environment or database was touched.

**Commits**
- Remove Hobby-incompatible Vercel Cron: `3a8f04f7cda7c02ca07c210988c847b3ec77dd93`.
- Add external scheduler runbook: `20de5bd0daa3c87bd03990f2ea517fbc83ea4a4e`.


## 2026-11-04 — Existing-work closeout audit

**Policy:** Freeze new feature scope until the currently open work is reconciled, verified and closed. Audited 14 open PRs (#2–#14, #16–#17), the merged buying-cart predecessor (#1), the current main baseline, dependency bases and exact-head workflow summaries. The detailed inventory, stack risks, CI evidence and required closeout order are recorded in `docs/implementation/OPEN_WORK_CLOSEOUT_AUDIT.md`.

**Findings:** PRs #2–#14 are stacked across checkout/order and customer-engagement branches; #16–#17 form a separate returns stack. Several downstream base SHAs are stale, #5 reports non-mergeable, and multiple exact-head quality jobs fail before tests/build. PostgreSQL integration passes on several heads but does not override quality failures. No PR was merged or modified. No application/schema/database/production/deployment change was made.

**Next:** Retrieve the specific lint/typecheck diagnostics and reconcile the checkout stack before any merge consideration. No new system work until the current backlog is verified.


## 2026-11-04 — Existing-work closeout audit

**Policy:** Freeze new feature scope until the currently open work is reconciled, verified and closed. Audited the current main baseline, all open PR metadata, dependency bases and exact-head workflow summaries. A detailed snapshot is recorded in `docs/implementation/OPEN_WORK_CLOSEOUT_AUDIT.md`.

**Findings:** PR #1 and #15 are merged; 14 PRs remain open (#2–#14, #16–#17). PRs #2–#14 are stacked across checkout/order and customer-engagement branches; #16–#17 form a separate returns stack. Downstream base SHAs are stale for #3, #6 and #17; #5 reports `mergeable=false`. Quality checks fail on exact inspected heads for #4, #6, #9, #11, #12, #13 and #14; PostgreSQL integration passes on several of those heads but does not override quality failures. Exact-head workflow runs were not found for #5, #7, #8, #10 and #17.

**Changes made:** Documentation-only audit record. No PR was merged, retargeted, rebased or otherwise modified. No application code, Prisma schema, migration, database, Vercel setting or deployment was changed.

**Next:** Retrieve precise lint/typecheck diagnostics, reconcile the checkout stack, then verify complete buyer journeys before considering any merge. Do not start new systems until current work is audited and closed.

## 2026-11-04 — Exact CI failure diagnostics retrieved

Downloaded the failing GitHub Actions job logs for the inspected exact heads. The quality failures are concrete source defects, not unexplained infrastructure failures:

- PR #2 quality lint: unescaped apostrophes in `src/features/checkout/checkout-shipping-options.tsx:47` and `src/features/seller/workspace-page.tsx:165` (`react/no-unescaped-entities`). PR #3 quality was green, so this particular issue was corrected by the time of the #3 head.
- PR #4 quality lint: `src/app/admin/tax-rates/page.tsx:39` triggers `react-hooks/set-state-in-effect`; the job stops before tests/build.
- PR #6 quality typecheck: `src/server/orders/orders.ts` lines 268, 291 and 306 have a result/type mismatch. The included Prisma selection returns `vendorOrders[].store` with `name, slug` but the declared mapper type requires `id, name, slug`. Correct the select/type contract together; do not cast away the mismatch.
- PR #9, #11, #12, #13 and #14 quality lint: the same pre-existing admin tax page issue remains at line 39. Additional inherited failures include `src/app/seller/messages/page.tsx:1`, `src/features/account/wishlist-page.tsx:27`, `src/features/admin/reviews-page.tsx:27`, `src/features/admin/store-reviews-page.tsx:26`, `src/features/seller/reviews-page.tsx:26`, and `src/features/storefront/product-reviews.tsx:43`; all trigger `react-hooks/set-state-in-effect`.
- The reviews pages call async loaders from effects; the lint rule detects synchronous state updates inside those loaders. Refactor the loading lifecycle rather than suppressing the rule.

These diagnostics are from the exact job logs for #2, #3, #4, #6, #9, #11, #12, #13 and #14. They do not prove the current heads are unchanged; refresh each PR head before applying fixes.

## 2026-11-04 — CI failure ownership corrected

A second pass against the job IDs corrected the PR-to-diagnostic mapping in the closeout audit: #4 owns the JSX apostrophe errors in checkout-shipping-options and seller workspace; #6 owns the admin tax-rates setState-in-effect lint error; #9 owns the orders.ts TypeScript selection/type mismatch; #11–#14 inherit the broader setState-in-effect errors in seller messages, wishlist and review screens. This correction is recorded in OPEN_WORK_CLOSEOUT_AUDIT.md. No source code or PR branch was changed.

## 2026-11-04 — PR #4 checkout copy lint correction

Escaped the apostrophe in `src/features/checkout/checkout-shipping-options.tsx` on `feat/store-shipping-options` to address the exact-head `react/no-unescaped-entities` lint finding. New head: `c37d10982a71850c5f65222f087073ea2eaf082e`. Fresh Quality and PostgreSQL workflows are running (jobs `126369311696` and `126369312055`); not marked verified until both pass. No PR was merged or retargeted.


## 2026-11-04 — Phase 2 gate recheck (current repository snapshot)

**Reviewed**
- Re-read `docs/implementation/PHASE_02_IDENTITY_PLAN.md`, the root README, the build log and the open-work audit on the current `main` snapshot.
- Confirmed the public registration UI remains intentionally unavailable and `PUBLIC_REGISTRATION_ENABLED` defaults to `false` until owner-approved Terms of Service and Privacy Notice content, versioning and consent presentation exist.
- Confirmed the identity frontend slice (login, forgot/reset password, email verification and account sign-out) has a successful General CI check on exact commit `7a30994e62de079839c8778f3d1f1a368097c2bc` (run [41645257014](https://github.com/waelkamira/mtjr2/actions/runs/41645257014)).
- Confirmed the latest documentation commit on `main`, `539c1aabd3358987f99c0e7ddf1d54198ab2bb27`, has a Quality check currently **in progress** (run [41822329109](https://github.com/waelkamira/mtjr2/actions/runs/41822329109)); it is not recorded as passed.
- Refreshed the open pull-request inventory: #4, #5, #6, #7, #16 and #17 remain open. No PR was merged as part of this Phase 2 recheck.

**Phase 2 decision**
- Code-level identity work and its recorded unit/PostgreSQL checks are substantially implemented; do not add helper-level tests without a concrete defect.
- Phase 2 is **not closed**. Remaining required evidence is: (1) owner-approved legal documents and consent versions before public registration can be enabled; (2) real Resend delivery smoke test using owner-configured credentials/sender; (3) trusted-edge header overwrite and origin-bypass protection verification before setting `TRUSTED_PROXY_IP_HEADER`; (4) one HTTP journey covering register → verify → login → `/api/auth/me` → logout → denial after logout; and (5) security review plus evidence record.
- Production telemetry is required before tuning login thresholds for public launch; do not enable public login or loosen limits without that evidence.
- These remaining checks require owner-approved content, external service/edge configuration and a reachable configured runtime. They cannot be truthfully completed by source edits or GitHub CI alone.

**Actions and boundaries**
- No application source, Prisma schema, migration, production database, deployment setting or secret was changed or accessed.
- No new system work was started. Phase 3 remains blocked until the Phase 2 exit gates are evidenced.
- Next action: preserve the current freeze, obtain the required owner-approved legal/service/edge prerequisites, then execute the single HTTP journey and record exact runtime evidence. Continue auditing existing PRs separately without merging them absent explicit approval.


## 2026-11-04 — Verified reconstruction and merge batch

- Reconstructed tax safety fixes from the historical stacked PR #5 onto current `main` as PR #18. The exact PR head `077cb6caf965015ddc09fd8e982a20e9f6527e5e` passed General CI (run `41823483435`: Prisma validate/generate, typecheck, lint, tests and build) and disposable PostgreSQL integration (run `41823483440`). Merged by squash as `32b519b4f65f586d713268aad13be5c123af3283`.
- Reconstructed seller return visibility from historical PR #16 onto current `main` as PR #19. Exact head `797f8dd61ee5ec3591f8cc0d2abb46b85235a364` passed General CI (run `41823605855`: Prisma validate/generate, typecheck, lint, tests and build) and disposable PostgreSQL integration (run `41823605797`). Merged by squash as `c9314efa66af92fd524f65c553d751927c778694`.
- Seller returns remains read-only. The implementation derives store scope from the verified session and exact permissions, and separates multi-store parent requests by store. Seller approval/rejection, receipt, shipping and refunds are not enabled.
- Closed historical PRs #4, #5 and #16 after their unique deltas were either already present on main or reconstructed and merged through clean PRs. No changes to Prisma schema/migrations were needed in these two clean reconstructions.
- Historical PR #17 was retargeted to main. Its code portion duplicates the now-merged PR #19; its remaining unique contribution is the per-vendor return lifecycle design and related route/verification documentation. This documentation is being reconstructed separately; no runtime lifecycle or schema migration is claimed complete.
- No production database, secrets or deployment configuration were changed. No live browser journey or live payment/refund flow is claimed verified.


## 2026-11-04 — Marketplace design-system foundation merged

- PR #21 merged by squash as `292fd83929eae765064f59a10d4bb868fda14fed`.
- Added the petrol / warm-ivory / violet-blue / mint / orange / cyan token palette and retained legacy token aliases to avoid breaking existing components.
- Applied the first visual adoption slice to global navigation actions, storefront hero/category selection, product cards, marketplace search, and product detail accents. Existing category layout, routes, and data behavior were preserved in the changed components.
- Exact merged head `0bd03c8de90bb7c98883d2d73020ef4132b559b3` passed General CI run `41825949762` and disposable PostgreSQL integration run `41825949635`.
- Browser-based visual comparison against the owner reference images remains outstanding; these checks establish code/build/database integrity, not pixel parity or a complete site-wide redesign.


## 2026-11-04 — Provider-neutral payment lifecycle merged

- Reconstructed the payment foundation on a clean branch based on current `main` as PR #23, avoiding stale stacked history.
- Added canonical `PaymentStatus`, `Payment`, and `PaymentWebhookEvent` schema additions and a forward-only PostgreSQL migration.
- Added provider adapter contract/registry, owner-scoped idempotent payment-intent API, provider discovery API, and verified webhook processing with deduplication and retry-safe error classification.
- Connected payment choices to the buyer order-detail page while preserving store reviews and return links. Added focused webhook and ownership/amount/currency tests.
- Exact PR head `d918c51103728d87ba130d07c678c5bfbbe890f1` passed General CI job `126571637955` and disposable PostgreSQL integration job `126571637984`.
- PR #23 was squash-merged into `main` as `ffbf76897a9ee8d15ad3d14a18508efe6f0986a9`.
- No provider is registered by default; no live charge is collected. Refunds, disputes, settlement reconciliation, concrete provider onboarding, and operational monitoring remain incomplete.
- These checks establish build/test/database migration integrity; they do not establish a live browser journey or successful real-world provider payment.


## 2026-11-04 — Main navigation: Shop route correction

- Audited every destination currently rendered by `src/components/site-navigation.tsx`: Home, Shop, Categories, Brands, Stores, Sell on Mtjr, Cart, Sign in / Join or authenticated Account / Favorites / Orders / Messages / Notifications, Terms and Privacy. All corresponding route files exist on `main`; the search suggestion API and message/notification endpoints also exist. This is a source/route audit, not a live browser click-through.
- Found one concrete navigation defect: `/products` (the Shop target and the empty-catalog “Browse all products” destination) rendered `StorefrontHomePage` again, duplicating the homepage instead of opening the dedicated catalog experience.
- Changed `/products` to redirect to `/search`, which already implements server-side product discovery, category/brand filters, sorting, pagination, and the catalog product grid backed by `listDiscoverableProducts` / Prisma.
- No Prisma schema or migration change is needed for this route correction. Exact-head CI is required before merge; browser verification remains separate.


## 2026-11-04 — Seller order preparation (System 15 initial slice)

- Added the authenticated, store-scoped seller status API and connected seller order actions for `CONFIRMED → PROCESSING → READY_TO_SHIP`.
- Payment confirmation remains a hard precondition. The service uses the verified session, active seller/store checks, exact store permission or owner scope, compare-and-set status updates, a serializable transaction, status history and audit logging.
- No Prisma schema change or migration was required; the existing vendor-order and parent-order status/history models cover the bounded preparation states.
- Shipment labels/tracking, shipped/delivered transitions, cancellation and refunds remain out of scope and are not exposed as working actions.
- Exact-head General CI and focused PostgreSQL authorization/concurrency verification are pending; no production database or deployment configuration was accessed.


## 2026-11-04 — Shop navigation merge and seller-order verification handoff

- PR #24 merged into `main` as `1e134e65e97f29b438f1d7f92dbf5f671091393d`. Exact-head General CI run [41830496456](https://github.com/waelkamira/mtjr2/actions/runs/41830496456) passed. The Vercel deployment check failed only because the Hobby daily deployment quota was exhausted; it is not an application CI failure.
- PR #25 adds seller preparation transitions and is awaiting its exact-head General CI and PostgreSQL workflow results. Do not merge until those critical checks pass; no production DB or Vercel environment was accessed.

## 2026-11-04 — Isolated demo catalog seed

**Implemented**
- Repaired the existing `prisma/seed.cjs` demo path: the previous file called `seedDemoCatalog()` without defining it.
- Added a guarded demo-only database override. Demo catalog seeding requires `SEED_DEMO_CATALOG=true`, `ALLOW_DEMO_CATALOG_SEED=true`, `DEMO_DATABASE_URL`, a non-production runtime, and a database name containing a `demo`, `test`, `ci`, or `dev` marker. It never silently falls back to `DATABASE_URL`.
- Added 8 active bilingual categories and exactly 10 deterministic demo products per category (80 total), 8 brands, 4 active demo sellers/stores, a dedicated `DEMO-US` market with USD, product translations/media/variants/prices, warehouse stock, and search synonyms.
- Seed uses stable slugs/SKUs and upserts. Initial inventory receipts are recorded only when the inventory row is first created, so reruns do not replenish or overwrite stock.
- No customer reviews, orders, payments, or fake verified-purchase signals are fabricated.
- No Prisma schema change or migration was introduced.

**Verification status**
- Source and Prisma relation compatibility reviewed against `prisma/schema.prisma` and the public discovery service.
- The seed has not yet been executed against a disposable PostgreSQL database in this session. Exact-head CI and a disposable PostgreSQL seed/re-run check are required before calling the catalog verified.
- No production database, live credentials, or Vercel environment was accessed.

**Next**
1. Run migrations against a disposable database named with a `demo` marker.
2. Run the demo seed twice and confirm counts remain 80 products / 8 categories / 4 stores with unchanged stock on the second run.
3. Verify the public market/category/product/search APIs return the seeded catalog.


## 2026-11-04 — Demo catalog seed verification and merge

- PR [#27](https://github.com/waelkamira/mtjr2/pull/27) merged into `main` as `0ec09ed37492e6c71b27e545abac72893ce73749`.
- Exact-head General CI passed on `d9686531b6638e28bb8f2b57cab8e82c1d505abe`: [run 41837000589](https://github.com/waelkamira/mtjr2/actions/runs/41837000589). Prisma validate/generate, typecheck, lint, unit tests, and production build all passed.
- Disposable PostgreSQL migration/integration passed on the same exact head: [run 41836993780](https://github.com/waelkamira/mtjr2/actions/runs/41836993780). The existing integration suite passed; the demo seed ran twice and both executions reported exactly 80 products, 8 categories, 4 stores, and 80 inventory rows.
- This verifies repeatable seeding and the canonical Prisma relations in disposable PostgreSQL. It does not yet verify the rendered storefront in a deployed browser or create a persistent local database on the owner's machine.
- No Prisma schema change/migration was needed. No production database or Vercel environment was accessed.
- The Vercel preview status was blocked by the Hobby daily deployment quota; this is separate from the passing General CI and PostgreSQL workflows.


## 2026-11-04 — local environment and storefront setup

- Renamed the server-only canonical URL setting from `NEXT_PUBLIC_APP_URL` to `APP_URL` across the environment schema, Google OAuth routes, origin validation, transactional email links, payment return URLs, CI workflows, tests, and deployment documentation.
- Marked the environment module as server-only so server credentials/configuration cannot be imported into client components accidentally.
- Optional Google and Resend credentials now accept empty strings in local environment files as unset values; this avoids invalid local configuration when external providers are not configured.
- Updated `.env.example` for a dedicated local `mtjr2_demo` database and explicit demo seed opt-ins. It contains placeholders only; no credentials were copied from chat.
- Added [Windows local setup guide](../development/LOCAL_WINDOWS_SETUP.md): install, create database, configure `.env`, migrate, seed 80 products, and run the site.
- Supabase, Cloudinary, OpenAI, and EmailJS were not found in the active environment schema or integration code paths in this review; their credentials are not required to browse the current storefront.
- Verification of this change is pending exact-head CI. The local database and browser journey have not been run on the owner's PC from this session.



## 2026-11-04 — System 07 wishlist guest merge and recommendations

**Implemented**
- Preserved the existing Favorite ownership boundary and added a bounded guest wishlist in browser storage (maximum 100 unique product IDs).
- Added authenticated POST /api/favorites/merge. The server resolves the owner from the session, filters to active/approved products in active stores with active sellers, deduplicates input, and uses PostgreSQL createMany(skipDuplicates) against the unique (userId, productId) key. Client cache is cleared only after a successful merge response.
- Added Recommendation product-to-product relations and forward-only migration 20261104100000_product_recommendations.
- Added authenticated GET /api/recommendations: active curated links are preferred; category similarity is the bounded fallback. The query uses only the current user's own favorites, excludes saved products, and returns only public approved products. Responses are private/no-store and no cross-customer behavioral profile is created.
- Connected the wishlist page to merge guest saves before refreshing server state and display recommendations. Product detail supports guest save/remove locally and reconciles against the server after authentication.
- Added focused tests for guest ID deduplication, unavailable product filtering, duplicate-safe merge, user scoping, and privacy-safe recommendation fallback.

**Verification status**
- Source changes and migration authored on feat/wishlist-guest-recommendations.
- Exact-head Prisma validate/generate, typecheck, lint, unit tests, production build, and disposable PostgreSQL migration/integration have not yet run. Do not merge until the CI result is green and the recommendation migration is applied in the disposable PostgreSQL workflow.
- Browser-level guest-save → sign-in → merge → wishlist refresh and cross-user isolation remain to be verified.
- Named user-created lists and cross-tab storage event synchronization remain outside this slice.

## 2026-11-05 — System 06 review media, reports, and appeals

**Implemented**
- Added `ReviewMedia`, `ReviewReport`, and `ReviewAppeal` persistence with one-parent checks, per-user report uniqueness, and one appeal per review. Migration: `20261105014200_review_media_reports_appeals`.
- Verified-purchase product and store review submissions accept up to five unique HTTPS image URLs with supported image extensions; references are stored in the same transaction as the review. This does not upload files or fetch remote content to verify MIME types.
- Added authenticated report submission for published product/store reviews and author-only appeals for rejected/hidden reviews. Both paths are audited and reject duplicate attempts.
- Added permission-protected admin queues and resolution workflows: reports may be dismissed or cause a review to be hidden; appeals may uphold the decision or restore the review. Conditional updates reject stale decisions and record moderator notes.
- Extended the customer review history with appeal status, added report controls to public review panels, connected store reviews to store pages, and allowed active staff with exact-store `reviews:manage` permission to answer published store reviews.

**Verification**
- `npx vitest run tests/reviews/reviews.test.ts`: 10 tests passed.
- Prisma schema validation passed. TypeScript typecheck passed against a generated client in a temporary output directory; the normal generated client could not be refreshed because the active Next.js dev server holds its Windows engine DLL.
- Targeted ESLint passed with no errors (six informational `@next/next/no-img-element` warnings for user-supplied external review images).
- `git diff --check` passed. The new migration has not been applied to any database; PostgreSQL migration replay and browser journeys remain pending.

## 2026-11-05 — Super Admin Phase 1 dashboard foundation

**Audit and implementation**
- Audited the current `main` branch, admin route tree, admin APIs/services, permission guard, seed roles, 49-system blueprint, and Prisma models. The working tree already contained unrelated uncommitted marketplace/order/review changes; all were preserved. Work is on `feat/super-admin-control-panel`.
- Existing infrastructure includes reusable `requirePermission`, scoped role grants, `AuditLog`, and functional admin surfaces for seller approval APIs, product moderation APIs, reviews, returns, support, Q&A, search synonyms, tax rates, and coupons. No admin dashboard or shared admin layout previously existed; seller/product admin pages documented in the route inventory are absent from the filesystem.
- The schema supports operational counts and payment attempts, but has no payout, refund, dispute, posted commission/accounting, or infrastructure-health workflow. Those metrics are not inferred or fabricated.
- Added the shared admin navigation shell and `/admin/dashboard` plus `/admin/control-panel`, backed by permission-protected `GET /api/admin/dashboard`. It provides bounded date/country/currency/seller/store filters, real user/seller/store/catalog/order/payment/queue counts, currency-separated order and successful-payment totals, daily order counts, and recent orders. Only existing queue pages are linked.
- Updated the system blueprint, route registry, journey matrix, and this build log. No Prisma schema or migration change.
- Changed files: `src/app/admin/layout.tsx`, `src/app/admin/dashboard/page.tsx`, `src/app/admin/control-panel/page.tsx`, `src/app/api/admin/dashboard/route.ts`, `src/features/admin/admin-navigation.tsx`, `src/features/admin/dashboard-page.tsx`, `src/server/admin/dashboard.ts`, `tests/admin/dashboard.test.ts`, and the four implementation/architecture documents listed above.

**Verification**
- `npx vitest run tests/admin/dashboard.test.ts`: 3 tests passed.
- `npm run typecheck`: passed.
- Targeted ESLint on all new dashboard/admin files: passed.
- `git diff --check`: passed.
- PostgreSQL-backed dashboard queries and browser journeys remain pending. Revenue/commission, seller payables, refunds/disputes, operational health, top performers, and absent entity drill-through pages remain outside Phase 1.

## 2026-11-05 — Super Admin Phase 2 operations

**Implemented**
- Added user administration pages and APIs for bounded user search, account/security detail, and reason-required status changes. Status updates are conditional and audited; suspension/disable revokes active sessions, self-modification is denied, and SUPER_ADMIN accounts are protected.
- Added seller/store administration UI using existing seller application decisions, plus audited ACTIVE/SUSPENDED store transitions guarded by current state and seller status.
- Added the pending product approval UI using existing moderation APIs. It distinguishes approval from publication and requires a reason to reject.
- Added read-only admin order list/detail APIs and pages with stable search/pagination/status filters, customer/order snapshots, vendor splits, payment attempt status, status history, and shipment tracking events. Provider references and checkout URLs are excluded, and no unsupported financial or fulfillment state changes are exposed.
- Updated the admin route registry, journey matrix, and systems blueprint to reflect the implemented scope and remaining gaps. No schema or migration changes.

**Verification**
- `npx vitest run tests/admin/users.test.ts tests/admin/sellers.test.ts tests/admin/dashboard.test.ts tests/admin/orders.test.ts`: 13 tests passed.
- `npm run typecheck`: passed after correcting the UI's currency-minor-unit formatting for all currencies.
- Targeted ESLint on Phase 2 files: no errors; one warning remains for external product imagery in the product approval UI.
- `git diff --check`: passed.
- The shared browser tab rendered `/admin/orders` and its unauthorized API response correctly; authenticated admin workflows were not verified because no admin session was available. A production build and PostgreSQL-backed journeys remain pending. Product queue remains limited to the first 100 pending entries with client-side filtering; KYC, taxonomy administration, role changes, and order interventions remain out of scope.

## 2026-11-05 — Super Admin Phase 3 financial and operational control

**Implemented**
- Added `/admin/payments` and payment detail inspection over canonical `Payment` and `PaymentWebhookEvent` records. The API requires the existing global `payments:read` permission, supports bounded search/provider/status filters and pagination, and summarizes attempts separately by status and currency.
- Payment detail exposes failure/reconciliation fields and persisted webhook processing history while excluding provider references, checkout URLs, provider event IDs, and raw webhook payloads. The interface is read-only.
- Added `/admin/logistics` and shipment detail inspection over persisted `Shipment` and `ShipmentTrackingEvent` records. Search/status filters and pagination are bounded; unsafe or credential-bearing tracking URLs are suppressed. No shipment or tracking records are created by these views.
- Reused the existing `/admin/support` ticket desk for Phase 3, which already supports queue/detail, status/priority, self-assignment, public replies and private internal notes with audited transactional service operations.
- Added Payments and Shipments to admin navigation and documented finance, logistics, and support readiness. No Prisma schema or migration changes.

**Scope and financial safety**
- The current schema has no double-entry ledger, commission, payout, refund, dispute, settlement, or reconciliation records/workflows. No financial balances are inferred and no payout/refund action is offered.
- Carrier configuration, labels, automated tracking, SLA/delay detection, and shipment exception actions are not implemented. The logistics pages show persisted records only.
- This is a partial Phase 3 slice, not a financial/accounting or fulfillment release.

**Verification**
- Nineteen focused tests across six admin test files passed; TypeScript check and targeted ESLint completed successfully.
- `git diff --check` passed. Anonymous requests to the payments and shipments APIs returned `401 Authentication required`.
- The shared browser tab loaded `/admin/payments`, but the development session reported HMR connection errors and a navigation hydration mismatch; authenticated page flows could not be verified because no admin session was available.
- PostgreSQL-backed and production-build checks remain pending.

## 2026-11-05 — Blueprint workstreams 4–7 follow-up

**Scope and implementation**
- Followed the platform blueprint's implementation order: search/discovery (4), cart/checkout (5), orders/payments (6), and seller operations (7). The first three already have source-level workflows; this pass did not duplicate them or enable payment behavior without the required launch/provider decisions.
- Earlier seller onboarding behavior used the globally unique store slug as an idempotency key but did not enforce one store per seller. The current service now serializes creation with a seller-scoped PostgreSQL advisory transaction lock and rejects second-store attempts; exact matching retries return the existing store. Prisma schema declares `@@unique([sellerId])`. The exact SQL index in committed migration history and legacy duplicate-row state still require explicit database verification; no destructive cleanup was attempted.
- The API returns `200` for an idempotent replay and `201` for a new store. The seller workspace explains that no duplicate was created. Audit is written only for the initial store creation.
- Fixed the unauthenticated seller workspace state: a 401 now presents sign-in with a safe `/seller` return path and account creation, rather than exposing an application form whose submission cannot succeed.
- Updated the seller route registry and action matrix. No migration or database operation was performed.

**Verification**
- `npx vitest run` over the focused Phase 4–7 suites: 20 files, 88 tests passed. The 12 seller-creation service/route tests were rerun after the subsequent seller sign-in UI adjustment and passed.
- `npm run typecheck`, targeted ESLint on changed seller files, `git diff --check`, and `npm run build` passed.
- Shared-browser smoke: `/cart` loaded its empty-cart state; `/checkout` correctly reported that no owned quote was available; `/seller` showed sign-in/create-account actions after the anonymous store API returned 401. HTTP checks returned 200 for `/cart`, `/checkout`, `/account/orders`, `/seller`, `/seller/orders`, and `/seller/inventory`; unauthenticated `/api/orders`, `/api/seller/stores`, and `/api/seller/orders` returned 401, while guest `/api/cart` and `/api/payments/providers` returned 200. No authenticated purchase/seller journey was attempted.
- PostgreSQL migration replay and full browser journeys remain pending. The search trigram extension migration is present, but its runtime installation was not verified; no payment provider is configured, and no charge or payment success was simulated.
- Seller onboarding remains end-to-end unverified; KYC/document intake, dedicated status pages, full catalog/inventory journey, and the rest of seller operational workflows are not complete.

## 2026-11-05 — Super Admin Phase 4 access-control hardening

**Implemented**
- Added server-side permission checks to the shared /admin layout. Unauthenticated requests are redirected to sign-in with the requested admin destination; authenticated users without an admin permission receive a not-found response.
- Added a dedicated platform:manage gate to /admin/control-panel; operational Admin permissions alone do not grant access to the platform control panel. Existing APIs retain their own route/service authorization checks.
- Hardened the ordinary role-revocation service so it cannot remove a SUPER_ADMIN assignment. Ordinary assignment already rejected granting the SUPER_ADMIN role.
- Added a guarded, one-time scripts/bootstrap-super-admin.cjs command (npm run db:bootstrap-super-admin). It requires explicit opt-in, a confirmation phrase, an existing active email-verified account, and an exact expected PostgreSQL host/database match. A PostgreSQL transaction-scoped advisory lock serializes attempts; any existing Super Admin assignment permanently closes bootstrap; assignment and SYSTEM audit event are atomic. It does not create a default account, password, or seed assignment.
- Expanded authorization policy tests for expiry boundary, malformed global scope markers, and any-of permission checks.
- Corrected .github/workflows/ci.yml so pushes to this feature branch and pull requests targeting main trigger the quality workflow. Previously the PR base-branch allowlist omitted main-targeted PRs.

**Important operational boundary**
- The bootstrap command has been committed but has not been run. Do not run it until the operator has independently confirmed the target database and account. Do not expose its confirmation values in logs or source control.
- No Prisma schema change or migration was needed or performed.
- No production database, local user database, Vercel setting, secret, or PR merge was changed.

**Verification status**
- Source files and workflow changes were committed to feat/super-admin-control-panel.
- Focused tests were added but have not been executed in this session. Typecheck, lint, production build, disposable PostgreSQL migration replay, and authenticated browser journeys remain pending exact-head CI/runtime verification.
- Do not mark the Super Admin system complete until the latest exact-head CI is green and the ADMIN-versus-SUPER_ADMIN authorization journeys pass.

## 2026-11-05 — Super Admin delegated platform-capability fix

**Finding and correction**
- Source review found that ordinary role assignment rejected the canonical `SUPER_ADMIN` role but did not reject a different role carrying `platform:manage`. Since the control-panel gate checks that permission, such a role could have recreated platform-wide access through the ordinary delegation endpoint.
- Added a pure role-assignment policy that protects both the canonical `SUPER_ADMIN` key and any role containing `platform:manage`; the service now returns the existing permission-denied path for either case.
- Added focused policy tests for canonical Super Admin, alternate platform-management roles, and ordinary delegatable roles.

**Verification**
- The preceding exact-head CI run `42032268502` completed successfully on commit `2f7e683`: Prisma validate/generate, typecheck, lint, Vitest, and production build all passed. This result predates the new policy commit and does not verify it.
- Vercel deployment for `2f7e683` failed during Next.js page-data collection because `AUTH_SECRET` was absent from the Preview build environment. The failure is an environment configuration issue, not the application compilation or GitHub CI result. The application intentionally fails fast when required auth configuration is missing; do not weaken that validation to hide the missing deployment secret.
- No Vercel environment variable, secret, database, or deployment setting was changed. An operator must configure a strong Preview `AUTH_SECRET` in Vercel and ensure other required runtime variables are present before expecting a successful preview deployment.
- The new policy tests and subsequent CI/deployment runs remain pending. No migration or database operation was performed.

## 2026-11-05 — Super Admin audit log and role-revocation hardening

**Completed**
- Extended the protected-role policy to ordinary role revocation as well as assignment. The service now loads each assigned role's permission keys and prevents removal of any assignment that carries `platform:manage`, not only the canonical `SUPER_ADMIN` role.
- Added a read-only platform audit log service and endpoint at `GET /api/admin/control-panel/audit-log`. The service enforces `requirePlatformManagement`, validates bounded filters, returns at most 100 records per page, and uses descending keyset pagination.
- Added the separately guarded `/admin/control-panel/audit-log` page with action/resource filters, actor, timestamp, scope and recorded metadata, plus a load-older action.
- Linked the audit log from the Super Admin control-center header. The audit endpoint is private/no-store and exposes no mutation methods.
- No Prisma schema change or migration was needed; this uses the existing `AuditLog` model and indexes.

**Verification status**
- The prior branch head `aaeca01773fb9cee4785bcc281790d485b998faf` passed GitHub Actions quality CI, including build, typecheck, lint, Prisma validation/generation and tests.
- The changes in this section are newer than that successful CI run. A new exact-head CI run must complete before this batch is considered verified.
- Vercel Preview remains blocked on the required `AUTH_SECRET` being absent during build-time environment validation. The code intentionally retains fail-fast validation. Configure the Preview secret in Vercel; no secret was read, changed, or committed.
- No live database, deployment configuration, or production environment was modified.

## 2026-11-05 — Super Admin access catalogue and audit-data hardening

**Completed**
- Added a read-only platform roles/permissions catalogue at `/admin/control-panel/access-catalog`, backed by `GET /api/admin/control-panel/access-catalog`. It reports role definitions, exact permission keys, system-role markers, assignment counts, and permission usage counts. Both page and service require `platform:manage`; response is private/no-store.
- Added sensitive-key redaction for audit metadata before returning it from the audit API. Credential, token, cookie, API-key, session, and payment-secret-shaped keys are masked recursively; payload depth, item count and long strings are bounded. The persisted AuditLog rows are not modified.
- Added focused tests for audit metadata redaction and safe metadata preservation.
- Added control-center navigation to both the audit log and access catalogue.

**CI finding and correction**
- The CI run on commit `fd63b02` reached lint and failed on the audit page's synchronous state update triggered by calling the initial loader directly inside an effect. The subsequent workflow was cancelled by newer pushes; it must not be reported as a completed passing run.
- Deferred the initial fetch through a promise continuation so the effect schedules the external request and state updates occur asynchronously. The new exact-head CI result is pending.
- Existing warnings in unrelated admin components were observed; they were not broadened into unrelated refactors.

**Deployment**
- Vercel Preview build for `fd63b02` compiled Next.js and TypeScript, then failed while collecting page data because `AUTH_SECRET` was undefined in the Preview environment. This is an environment configuration requirement. Do not weaken fail-fast validation or commit secrets. No Vercel setting was changed.
- No Prisma schema or migration changes, database calls, or production operations were made.

## 2026-11-05 — Two-person Super Admin privilege approval workflow

**Implemented**
- Added `PlatformPrivilegeRequest` and `PlatformPrivilegeRequestStatus` to Prisma, with a dedicated PostgreSQL migration `20261105132500_platform_privilege_approvals`. The model records target, requester, reviewer, reason, decision note, status and timestamps.
- Added `/admin/control-panel/privilege-requests` with a request form and pending/decision history, plus `GET/POST /api/admin/control-panel/privilege-requests` and `PATCH /api/admin/control-panel/privilege-requests/[requestId]`.
- The workflow only grants the canonical `SUPER_ADMIN` role and only when it includes `platform:manage`. The target must be an existing ACTIVE user; email verification is not required because registration activates accounts immediately by policy.
- A requester cannot review their own request. Approval/rejection, the privilege assignment and the audit event are committed in one transaction. Target-level PostgreSQL advisory locks serialize requests and decisions to prevent duplicate pending requests and concurrent grants.
- Requests are rejected if the target already has a current GLOBAL `platform:manage` grant. Expired canonical assignments are reactivated rather than creating a duplicate unique assignment.
- Updated the one-time bootstrap guard to refuse initialization if any GLOBAL role assignment already carries `platform:manage`, not only if a role named `SUPER_ADMIN` is assigned.
- Added a focused test for requester/reviewer separation.

**Safety and verification**
- This adds a new migration; it has not been applied to any database. Apply it only through the normal reviewed deployment process after migration review and backup.
- No role-revocation or emergency break-glass UI was added. Revocation remains a separate high-risk workflow and is not exposed here.
- CI passed on commit `6bdbae7` before this approval-workflow batch. Prisma validation, typecheck, lint, tests and build must be rerun on the new exact head before this batch is verified.
- Vercel Preview deployments are currently rate-limited by the provider for 24 hours. A prior Preview build also exposed missing `AUTH_SECRET`; no deployment secrets or settings were changed.

**Additional approval safeguards**
- The target account row is locked inside the same transaction as the privilege decision, so concurrent account suspension/deactivation cannot race the eligibility check.
- The migration enforces a minimum 20-character justification with a database CHECK constraint as well as API validation.
- Request state is intentionally limited to PENDING, APPROVED and REJECTED until a real cancellation workflow is designed.

## 2026-11-05 — Final verification for Super Admin control-center batch

- GitHub Actions run `42036694504` passed on commit `4bd6f3d63442cd7f3e52cba5ce6af575e0de9998`.
- The CI job now starts an isolated PostgreSQL 16 service and executes the full `prisma migrate deploy` chain before Prisma generation, typecheck, lint, tests and production build.
- Verified all 30 migrations applied successfully in that disposable CI database, including `20261105132500_platform_privilege_approvals`. This does not apply any migration to the user's database or production.
- Final checks: Prisma validate ✓, migration deploy ✓, Prisma generate ✓, TypeScript ✓, ESLint ✓, Vitest ✓, Next.js production build ✓.
- Vercel Preview is still blocked by the provider's deployment rate limit (retry after 24 hours). The earlier Preview build also exposed missing `AUTH_SECRET`; no secrets or deployment settings were modified.

## 2026-11-05 — Review of latest visual and CI changes (commit `4287d3f2850a54903ca9891143e7c3098403a60f`)

**Reviewed**
- `src/app/globals.css`: botanical forest/sage/ivory/terracotta palette, backwards-compatible aliases, global radii/shadows, base form controls and focus-visible styling. No CSS syntax or build issue surfaced in the exact-head CI.
- `src/components/site-navigation.tsx`: typography, spacing, surface shadow and active Home color changed; route targets and session-dependent links were not changed in this styling commit.
- Previous changes in the same batch: isolated PostgreSQL 16 CI service and full migration deployment, scalar-returning advisory-lock queries, and privilege request row locking.

**Exact-head verification**
- Commit: `4287d3f2850a54903ca9891143e7c3098403a60f`.
- GitHub Actions run `42054463880`: SUCCESS. Prisma validate, all migrations deployed to disposable PostgreSQL, Prisma generate, TypeScript, ESLint, Vitest and Next.js production build all passed.
- No migration was run against the user's database or production.
- Vercel status for this exact commit returned FAILURE. The deployment failure reason has not yet been retrieved from Vercel build logs; do not infer that it is the previously observed `AUTH_SECRET` issue without inspecting this deployment's logs.
- PR #35 remains open and Draft; no merge performed.

## 2026-11-04 — Product Q&A governance extension

**Implemented on** `feat/product-qa-reports-history-staff` (PR #31):
- Added `ProductQuestionReport` with one report per reporter/question, supported reasons, open/reviewed/dismissed states, and audit events.
- Added authenticated report submission and admin review/dismiss APIs plus a dedicated moderation page.
- Added `ProductAnswerRevision`; edits preserve the prior answer and return the new text to pending moderation.
- Added seller answer editing/history controls.
- Extended seller Q&A access to active store staff only when an exact STORE-scoped `messages:manage` grant exists; store owners retain access.

**Verification**
- CI and PostgreSQL migration/integration workflows were triggered for exact head `85314f2ec5ff080ec5f213a98a415417bb00fae7`; results are pending at this log entry.
- No local npm/Prisma commands were run in this session.
- No production database or Vercel deployment was accessed.
- Browser end-to-end journeys and dedicated feature-level integration tests remain to be verified.


## 2026-11-05 — Support SLA targets and escalation

**Implemented on** `feat/support-sla-escalation`:
- Added persisted per-priority SLA policy rows and first-response/resolution deadlines to support tickets.
- Default 24/7 elapsed-time targets: LOW 24h/5d, NORMAL 8h/72h, HIGH 4h/24h, URGENT 1h/4h (first response/resolution).
- Added an idempotent protected SLA worker that records breaches, escalates priority by one level on resolution breach, writes audit events, and notifies the assigned agent.
- Added a GitHub Actions 15-minute scheduler, admin queue SLA indicators, and a notification preference for SLA escalation.
- Backfilled deadlines for existing tickets in the migration.

**Operational configuration**
- Set repository variable `APP_URL` and repository secret `CRON_SECRET` to enable the scheduled worker. No Vercel cron or deployment is used.
- Targets use elapsed 24/7 hours, not business-hour calendars; policy administration UI is not included in this slice.
- Attachments still require an approved S3-compatible storage endpoint and malware-scanning integration. No provider credentials are available in this task, so uploads are not represented as complete.
- Outbound email remains dependent on a verified sender and delivery provider.

**Verification**
- Added focused SLA policy unit tests.
- Prisma validation, typecheck, lint, unit tests, build and disposable PostgreSQL migration checks must pass on this exact PR head before merge.
- No production database or Vercel deployment accessed.


## 2026-11-05 — Support SLA and Cloudflare R2 attachment foundation

**Merged**
- PR #32 added persisted support response/resolution targets, priority-based escalation, audit events, assigned-agent notifications, and a protected scheduled worker.
- Exact-head CI and PostgreSQL integration passed for commit `afd2dafeed81c197d21b2dfd8bde8550cef79548`; merge commit: `edaff23d824caa33037343113dbf79816eaac7e5`.

**Merged — PR #33**
- Added private Cloudflare R2 SigV4 presigned URL generation, attachment persistence for support tickets and store conversations, strict metadata validation (10 MB / MIME allowlist), and a support-ticket upload-init/finalize API.
- Finalization verifies R2 object metadata and fails closed unless an external malware scanner returns an explicit `{ "clean": true|false }` result.
- Exact-head CI and PostgreSQL integration passed for `7000ea4c29e20659487b94c61fcd4924bcff6ad8`; merge commit: `d45fcad7ed5f95165c7eaaf917f3972ed6751dad`.
- PR: https://github.com/waelkamira/mtjr2/pull/33
- Required server-only configuration: R2 account/access/bucket credentials and `ATTACHMENT_SCANNER_URL` + `ATTACHMENT_SCANNER_TOKEN`.


**Not complete / rollout blocked**
- No real R2 credentials or bucket CORS configuration have been supplied or tested.
- The external malware-scanning service is not implemented/configured; uploads remain quarantined when it is absent.
- Store-message upload API, customer/admin upload UI, attachment listing/download journey, orphan cleanup/retention, and browser-level end-to-end verification remain open.
- Do not enable attachments in production until these gates are completed and verified.


## 2026-11-05 — Customer notification delivery

**Implemented on `feat/customer-notification-delivery`**
- Extended notification preferences to independently control in-app and email channels for order, seller order, store message, support/SLA, payment, shipment-ready, and account-security event types.
- Added `UserConsent.NOTIFICATION_EMAIL`; email is opt-in, defaults off, and is checked both when queuing and immediately before sending. Withdrawal cancels pending deliveries.
- Added `NotificationDelivery` outbox with unique event deduplication, delivery states (PENDING/PROCESSING/RETRY/SENT/FAILED/CANCELLED), attempt counters, lock recovery, timestamps, and provider message ID.
- Added Resend transactional notification adapter using a stable idempotency key; only active users with verified email addresses are eligible.
- Added protected five-minute GitHub Actions worker endpoint, batch claims, bounded exponential retries (1 minute to 6 hours), and user-scoped delivery history in `GET /api/notifications`.
- Connected existing order placed, seller order received, store message, support reply and SLA events through the shared preference-aware event creation helper; connected payment success/failure and password change/reset events.
- Updated `/notifications` controls and delivery-history UI. Added focused retry-backoff unit tests.

**Not complete / operational gates**
- No Resend API key or verified sender was supplied; no real email was sent or provider delivery verified.
- Set repository variable `APP_URL` and secret `CRON_SECRET` to activate the scheduled delivery workflow.
- Shipment preferences exist, but no Shipment model/carrier tracking lifecycle or SHIPPED/DELIVERED transition is present. Do not claim shipment notifications are live until that system exists.
- Browser-level user journeys and provider callback/reconciliation are not yet verified.


## 2026-11-05 — Identity registration and sign-in feedback

**Implemented on `fix/identity-feedback-flow`**
- Duplicate registration now returns HTTP 409 with `EMAIL_ALREADY_EXISTS` and a clear instruction to sign in or recover the password; the existing normalized-email lookup and database unique-constraint fallback both remain active.
- Successful registration displays a success notice, then leaves `/register` for `/verify-email` with the email prefilled and a registration confirmation message.
- Login now distinguishes an unknown email (`EMAIL_NOT_FOUND`) from an incorrect password (`INVALID_PASSWORD`) while preserving dummy scrypt verification for unknown addresses, persistent throttling, and generic responses for inactive/unverified accounts.
- Successful login displays its confirmation before redirecting to the safe same-origin return path. The password field is cleared after success.
- Added a focused unit test for the incorrect-password path and updated the unknown-email expectation.
- **Security trade-off:** explicit email-vs-password feedback reveals whether an email has an account. This follows the requested UX; the existing rate limiter remains in force. If stronger account-enumeration resistance is preferred, both failures should use one generic message.

**Verification**
- Source changes committed; exact-head GitHub Actions CI and PostgreSQL integration have not yet reported results. Do not treat the identity journey as release-verified until those pass.
- No local browser session, real email delivery, production database, or deployment was accessed.


## 2026-11-05 — System 01 identity audit and PR #36 verification corrections

- Reviewed the full System 01 specification, Phase 2 identity execution plan, route registry, journey matrix, auth routes/services, account security/session/profile/address surfaces, Prisma identity model ownership and the PostgreSQL identity integration workflow.
- PR #36 adds duplicate-email conflict mapping (including concurrent unique-constraint/P2002 handling), registration-success redirect/notice, and login-success feedback plus explicit unknown-email/wrong-password errors for eligible accounts. Dummy scrypt verification, keyed login-attempt storage and persistent throttling remain. This exposes account existence and is documented as a production security trade-off.
- Exact-head CI on merge candidate `050bb6079012538cc48e2d24109e3e76de12d458`: Prisma validate, Prisma generate, typecheck and lint passed; unit suite failed one outdated assertion in `tests/identity/login.test.ts` because it expected raw `userId: null` after the ledger was intentionally changed to hashed identifiers. Updated the assertion to require keyed identifier/IP digests and not raw identifiers.
- Found that the PostgreSQL integration workflow's pull-request path filter omitted identity service/API paths. Added identity services, auth/account routes, identity tests and integration tests so PR identity changes trigger the PostgreSQL gate.
- Phase 2 audit findings and remaining exit gates are recorded in `PHASE_02_IDENTITY_PLAN.md`. System 01 remains Implemented / not Verified / not Complete: exact-head CI + PostgreSQL integration pending; real Resend delivery, trusted edge proxy/origin protection and one deployed register→verify→login→me→logout HTTP journey remain unverified. Google provider flow also remains conditional/unverified. 2FA is intentionally unavailable; account addresses currently list/create only.
- No Prisma schema change was needed for the current UX slice. No production deployment, live email test or browser journey was performed.

**Current PR #36 verification:** pending on the corrected head; do not merge until General CI and PostgreSQL identity integration both pass for the exact head.


## 2026-11-05 — Phase roadmap audit and Phase 11 definition

- Audited the README build sequence, FOUNDATION.md, Phase 2–4 execution plans, 49-system index/integration matrix, route registry, journey standard/matrix, Prisma model map, global page/control specification, and historical build log.
- Corrected the roadmap's missing Phase 10 and absent dedicated delivery definition for Phase 11. The audit records that Phase 5–10 had no individual execution-plan files, clarifies the distinction between delivery phases and the 49 numbered systems, and assigns explicit ownership boundaries for buying, finance, returns/refunds, global regulatory readiness, release and post-launch operations.
- Added `docs/implementation/PLATFORM_PHASE_ROADMAP_01_11.md` with findings, phase-by-phase status/gaps, corrected dependencies, evidence vocabulary and safe execution order.
- Added `docs/implementation/PHASE_11_PRODUCTION_OPERATIONS_PLAN.md` covering SLOs, observability, worker/outbox operations, backup/restore, capacity, security operations, market expansion, cost controls and exit criteria.
- Updated README.md to the canonical 11-phase sequence. Phase 11 is specification-only; no production operation, deployment, production migration or provider activation is claimed.
- Documentation-only. No Prisma schema/migration, database, production secret, Vercel setting or deployment was changed.


## 2026-11-05 — Complete missing phase execution plans

- Added explicit Phase 1 and Phase 5–10 execution plans after the roadmap audit found these phase plans were missing. Phases 2–4 retain their existing detailed plans; Phase 11 has its new production operations plan.
- Each plan defines scope ownership, workflows, critical invariants, P0 acceptance and exit criteria. Financial refunds/payouts, customer returns, market regulatory approval, release gates and post-launch operations are assigned to distinct owners to avoid duplicate implementations.
- Updated README with the complete Phase 1–11 plan index and amended the roadmap audit to distinguish the historical gap from the new documentation coverage.
- Documentation-only. This closes plan-documentation gaps, not implementation/verification gaps. No Prisma schema, migrations, database, production secrets or deployment changed.


## 2026-11-05 — Phase 4 manual seller dispatch and buyer tracking

- Ported the manual shipment slice from stale PR #26 onto current main as `feat/shipment-tracking-current-main`; did not merge the stale branch.
- Added one Shipment per VendorOrder, a forward-only migration at `20261105130000_manual_shipment_tracking` (avoids the existing payment migration timestamp), server-side owner/store-scope authorization, idempotent identical dispatch retry, serializable status/history/audit writes, seller dispatch UI and buyer order tracking display.
- Added focused seller-shipment tests for successful dispatch, HTTPS validation, cross-store permission denial and idempotent replay.
- Updated Phase 4 plan, Prisma model map, route registry and journey matrix.
- The older PR #26 CI/PostgreSQL result is not treated as evidence for this new branch. Fresh exact-head General CI and disposable PostgreSQL integration are required. No live carrier integration, label purchase, live tracking feed or delivery proof is claimed.
- No production database or deployment was accessed.


## 2026-11-05 — Multi-vendor fulfillment aggregation correction

- Merged manual seller dispatch and buyer-visible tracking through PR #41 after exact-head General CI and disposable PostgreSQL integration both passed (head `049f7001811dfc0ee5fd44b468e543c2cf48900e`).
- Closed stale duplicate PR #26; its earlier migration timestamp conflicted with the current payment migration and its implementation was superseded by PR #41's clean forward-only migration.
- During the post-merge Phase 4 review, found that parent-order fulfillment aggregation counted cancelled vendor orders as orders still awaiting dispatch. This could leave a parent order PARTIALLY_FULFILLED forever after every remaining live vendor order had shipped.
- Corrected the aggregate to exclude CANCELLED vendor orders from the fulfillment denominator and added regression coverage for cancelled siblings and still-active undispatched siblings. No schema change was required.
- The correction is isolated in branch `fix/order-fulfillment-terminal-vendors`; exact-head General CI and PostgreSQL verification are pending. Super Admin PR #35 is intentionally out of scope while its owner continues local work.


## 2026-11-05 — Store-scoped return decisions (in progress)

**Implemented on `feat/store-scoped-return-decisions`**
- Added a forward-only Prisma migration and `ReturnItemStatus` so each requested line has its own decision, note, reviewer and timestamp.
- Added seller PATCH endpoint and service. Server rechecks active store, owner/delegated permission and updates only pending items belonging to that store.
- Seller workspace now exposes approve/reject actions per store; customer return history displays per-item decision and note.
- Parent request remains pending while any store has undecided items; rejected item quantities are excluded from future outstanding-return calculations.
- Platform-wide review synchronizes the item-level states.

**Explicit boundaries**
- Seller decision is not proof of physical receipt.
- No inventory is restocked and no payment refund/provider API is called.
- CI and PostgreSQL migration/integration verification are pending on the exact PR head.


## 2026-11-05 — Return permission boundary
- Seller return decisions now require the exact-store `returns:manage` permission rather than reusing `orders:manage`.
- Added `returns:manage` to SELLER and STORE_MANAGER role capability sets; assignments remain store-scoped and do not grant a global seller permission.
- Updated focused decision tests and the vendor return lifecycle design record. Verify exact-head General CI and PostgreSQL Integration before merge.


## 2026-11-05 — Return receipt line-state correction
- Administrative receipt now transitions only `APPROVED` return lines to `RECEIVED`; rejected/cancelled lines remain unchanged.
- The transaction rejects receipt when no approved lines remain, preventing a parent status from claiming receipt without eligible lines.
- Added focused tests for mixed approved/rejected receipt and no-approved-line rejection. Inventory restocking remains a separate next step; receipt is not yet represented as a stock movement.


## 2026-11-05 — Seller return receipt into inventory quarantine

- Added a forward-only Prisma migration introducing a quarantined stock balance and a `RETURN_RECEIPT` inventory movement. Physical return receipt increments quarantine only; it does not increase sellable `quantityOnHand`.
- Added a seller-scoped receipt service and connected it to the seller return API/UI. The seller selects a warehouse belonging to the same active store; only approved return lines for that store can be received.
- Inventory balance, movement (with deterministic per-return-item idempotency key), return-item status, parent aggregate, and audit log are committed in one serializable transaction.
- Removed the admin-only received status path so a return cannot be marked received without a corresponding inventory movement. The seller inventory table now displays quarantined stock separately.
- Added focused tests for quarantine-only movement, cross-store denial, missing variant rejection, completed retry, and admin receipt bypass prevention.
- Inspection/release from quarantine and refunds remain intentionally separate. No provider refund, carrier integration, or production database action is claimed.
- Exact-head General CI and disposable PostgreSQL Integration are required before merge.


## 2026-11-05 — Akaar identity experience applied to Mtjr2

**Implemented**
- Reworked sign-in and registration layouts into a responsive split-panel experience using Mtjr2's existing forest/copper design tokens.
- Added Google sign-in to the login page, distinct from Google registration.
- Added a login-only OAuth intent that accepts only an already-linked Google identity. It does not create users, link by email, or fabricate policy consent.
- Preserved Mtjr2's stronger registration requirements: 12-character password minimum, explicit Terms/Privacy acceptance, pending seller application, email verification, rate limiting, and server-side session controls.
- Kept password recovery and verification/resend flows connected from the sign-in screen.

**Focused verification added**
- Existing Google OAuth registration-gate tests retained.
- Added regression cases for linked Google login, safe return path, and rejection of unlinked Google identities during login.

**Still pending**
- Exact-head General CI and PostgreSQL Integration results.
- Real Google credentials, Resend sender/API key, trusted edge IP header, and one deployed HTTP/browser journey.
- Public production registration remains gated until approved legal documents and deployment configuration are in place.


## 2026-11-05 — Claymorphism visual direction and foundation

**Owner-approved direction**
- Replaced the previous forest/petrol and glass-led direction with Claymorphism / 3D Pastel Clay based on the user's written description of the Pinterest reference.
- Established lavender, mint, blush, butter, sky, and neutral tokens with compatibility aliases for existing component token names.
- Added opt-in raised and inset clay surface primitives with soft dual shadows; existing components are not globally force-styled.
- Kept semantic status colors, readable text, reduced-motion behavior, and keyboard focus separate from decorative pastel accents.

**Scope and safeguards**
- This is a visual foundation only. It does not claim all routes/components have been migrated or visually verified.
- Preserve all existing routes, category distribution, APIs, authorization, Prisma models, and commerce behavior during later component migration.
- Storefront, buyer, seller, and admin workspaces share tokens but retain different information density and interaction patterns.
- Super Admin implementation is explicitly out of scope for this workstream.

**Verification**
- Repository files and current main design tokens were reviewed through GitHub before the change.
- No local shell, browser runtime, or deployed visual comparison was available in this session; typecheck, lint, tests, and build must be confirmed by the branch CI before merge.


## 2026-11-05 — Claymorphism storefront and navigation migration

- Applied raised pastel surfaces and clay-style navigation controls to the shared site header/navigation without changing destinations or session-dependent links.
- Updated the storefront hero, editorial panel, discovery controls and product cards to use the new lavender/mint/blush palette and tactile surface tokens.
- Preserved catalog data fetching, URL-backed filters, pagination, category layout, product routes, price formatting and seller attribution.
- Updated the reusable catalog product grid with raised clay cards and stronger bottom price hierarchy.
- This is the first visual adoption slice; account, seller and admin workspaces still require separate migration and responsive visual QA. Super Admin remains excluded.


## 2026-11-05 — Claymorphism identity, catalog filters and seller workspace slice

- Migrated the shared sign-in/password recovery/verification card and form controls to raised pastel surfaces while preserving all existing auth endpoints, safe return-path handling, Google login flow, verification resend, and success/error behavior.
- Migrated server-rendered catalog discovery filter panel and form controls to inset clay fields; preserved GET parameters, category/brand/store/market filters, price filters, stock filter, sorting and pagination.
- Applied the pastel canvas and shared surface treatment to the seller workspace shell and key headings without changing seller API requests or store/inventory/shipping workflows.
- Compatibility aliases remain in place for legacy color references. Super Admin is still explicitly excluded.
- CI and PostgreSQL integration are expected to rerun against the latest branch head; no local build or browser visual QA is claimed.


## 2026-11-05 — Central Tailwind v4 theme bridge

- Confirmed the repository uses Tailwind CSS v4.1 and `@tailwindcss/postcss`; there is no legacy `tailwind.config.js/ts`.
- Added a CSS-first `@theme inline` bridge in `src/app/globals.css` that exposes the central root tokens as Tailwind color, shadow, radius, and font utilities.
- Documented `:root` as the single source of truth; do not add a parallel legacy config or duplicate token values.
- CI must validate the generated utility classes on the updated PR head before merge.


## 2026-11-05 — Claymorphism customer account and commerce workspace migration

- Migrated the customer account landing page, order history, order detail/payment panels, wishlist, customer returns, support requests and reviews to the central Claymorphism token system.
- Migrated seller order management and seller return handling surfaces to the same central palette and raised surface treatment.
- Replaced legacy forest/copper/ivory color references in these UI slices with shared ink, lavender and surface tokens; existing API calls, authorization boundaries, payment initiation, order/return state transitions, wishlist merge/removal, and seller shipment/return actions were left unchanged.
- Super Admin routes and components were not touched. No Prisma schema or migration was needed for this visual-only slice.
- Verification is pending on the updated branch head. No local build, browser visual QA, production database operation or deployment is claimed.


## 2026-11-05 — Broad Claymorphism migration across platform routes

- Extended the central visual-token migration to customer profile, addresses, sessions and messaging routes; seller inventory, product, question, review and staff workspaces; administrative product-Q&A, review, return, support and tax-rate workflows; cart and checkout; security and notification preferences; and category, brand and store detail routes.
- Updated legacy forest/copper/ivory references to shared ink, lavender and surface tokens. The migration is presentation-only: route contracts, API requests, business actions, and authorization logic were not intentionally changed.
- Super Admin routes/components remain explicitly excluded. No Prisma schema or database migration was required.
- CI and PostgreSQL Integration must be rerun against the final PR head; visual browser QA and local build were not available in this GitHub-only session.

## 2026-11-06 — Identity and MFA rebuild

- At that checkpoint the branch temporarily activated accounts immediately after Turnstile; this was later identified as a verification regression and corrected in the 2026-11-06 Super Admin/AI entry below. Current password registration remains pending until email verification.
- Password login returns a generic public credential failure for unknown accounts and incorrect passwords. Successful authentication redirects to the safe same-origin return path.
- Added encrypted TOTP enrollment, replay-resistant code verification, one-time recovery codes, session-bound 12-hour MFA assurance, and mandatory MFA enrollment/verification for platform-wide administrators.
- Added migration `20261106120000_identity_mfa`. Configure a stable `MFA_ENCRYPTION_KEY` before production MFA enrollment; changing the key makes stored TOTP secrets unreadable.
- At this checkpoint, local migration application and database/browser journeys were pending. The local `mtjr2_demo` database has since been migrated; this does not imply deployment elsewhere. Standard Prisma client generation succeeded after restarting the local dev server. Production build and deployment/browser journeys remain unverified.
# 2026-11-06 — Commission policy and payment snapshots

**Implemented**
- Added effective-dated Super Admin commission rules for global, seller, category, and seller+category scopes, with overlap prevention, audited creation/deactivation, and the confirmed precedence order.
- Snapshotted each item's primary category at order creation and recorded immutable commission base/rate/amount rows on verified payment success. The base is merchandise net of a deterministic proportional discount allocation; shipping and tax are excluded. Unmatched rules record 0%.
- Added `/admin/commissions` to manage rules and inspect recorded snapshots. Financial mutations require `platform:manage`.
- Added migration `20261106150000_commission_rules_and_transactions`; applied it to local `mtjr2_demo`. This does not imply deployment to another database.

**Verification**
- Prisma schema validation and client generation passed.
- Local migration deployment and migration status passed.
- `npm run typecheck`, targeted ESLint, commission-policy tests (4), commission-management tests (3), and payment-lifecycle tests (5) passed (12 focused tests total).
- `npm run build` passed and included `/admin/commissions` and the commission APIs.
- No full payment-success PostgreSQL/browser journey was performed. Seller ledger, payout workflow, refund reversal, settlement/reconciliation, and complete financial reports remain unimplemented.

# 2026-11-06 — Page inventory and route recovery states

**Implemented**
- Added root `PAGE_INVENTORY.md` with the 74 actual App Router pages, their route/page component, access boundary, API/data integration evidence, known state gaps, and missing roadmap targets. The audit separately counted 143 API route handlers.
- Added shared not-found, root/global error, and loading UI plus loading/error boundaries for the root, account, seller, and admin segments. No duplicate commerce routes were created.
- Updated README page inventory guidance, implementation progress, design-token references, and verification evidence.
- No Vercel deployment or production database changes were performed.

**Verification**
- `npm run typecheck` passed.
- Targeted ESLint on all added route-state components/boundaries passed.
- `npm run build` passed and included the new App Router boundaries.
- `git diff --check` passed.
- Browser smoke test of an unknown local URL displayed the branded 404 and home/product recovery links; at a 390px viewport the document/body widths remained 390px. A regular user visiting `/admin/commissions` received the expected permission-hidden 404. Authorized admin UI was not tested.
- Full page-by-page action, responsive, state, and persistence verification remains open; all unverified existing pages remain `NEEDS_TESTING` rather than being marked complete.

# 2026-11-06 — Super Admin command center and AI operations

**Existing panel inspected and extended on `feat/super-admin-control-panel`**
- Confirmed the existing `/admin/dashboard` and `/admin/control-panel` routes, access catalog, platform audit log, and two-person Super Admin privilege-request workflow. Updated the admin navigation so the Super Admin entry is rendered only for actors with `platform:manage`.
- Added same-origin JSON mutation validation to privilege-request creation and decision endpoints.
- Added the one-time first-Super-Admin bootstrap runbook and tightened the script to require an active, email-verified target account. The script validates the explicit database host/name, uses a serializable transaction/advisory lock, refuses if a platform grant already exists, and writes a system audit event.
- Added a Super Admin AI settings page and API at `/admin/control-panel/ai-assistant`. The singleton `AiAssistantSetting` stores the enable flag and bounded completion-token limit; all changes are recorded in `AuditLog`. The provider key is exposed only as a configured/not-configured boolean.
- Added the environment master kill switch and runtime resolver. The assistant is available only when the environment switch, provider key, and database enable flag are all present; a database read failure disables the assistant. The model remains fixed to `openai/gpt-oss-20b`.
- Added migrations `20261106170000_ai_assistant_settings`, `20261106171000_ai_assistant_settings_constraints`, and `20261106172000_ai_assistant_settings_updated_at`.

**Identity/security corrections found during branch review**
- Restored pending registration with a single-use email-verification challenge, verification and resend endpoints, and a verification page. The raw token is sent only through the server-side email adapter; only its digest is stored.
- Password login now requires an active account with a verified email and creates the session inside the same conditional database transaction that rechecks account status and password hash. MFA remains mandatory for platform administrators.
- Google callback validation now checks numeric/safe token expiry and requires linked accounts to be active and email-verified.
- Updated focused tests for registration, one-time verification, login/session races, AI settings redaction, environment kill switch, and order/shipment service contracts.

**Remaining gaps**
- Dashboard financial metrics remain partial: no canonical net revenue, payout exposure, refunds/disputes, settlement/reconciliation, or analytics/alerts pages.
- AI conversation history, usage analytics, feedback, approved knowledge management, and shared/distributed rate limiting remain unimplemented.
- The first-admin bootstrap is not an automated recovery workflow after an existing Super Admin assignment is lost.
- PostgreSQL integration and browser journeys for Super Admin denial/access, privilege approval, AI enable/disable, MFA, and secret non-disclosure remain to be verified on the final PR head.

**Verification**
- CI run [42251382773](https://github.com/waelkamira/mtjr2/actions/runs/42251382773) passed on `4eefa77f74c9064a9934fd1053585fb1360283be`: Prisma validate, migration deploy, Prisma generate, typecheck, lint, unit tests, and production build.
- Platform PostgreSQL Integration run [42251383098](https://github.com/waelkamira/mtjr2/actions/runs/42251383098) passed on the same commit: migration replay, baseline role/permission seed, PostgreSQL integration suite, demo catalog seed, and seed repeatability.
- The browser E2E journeys listed above remain unverified; keep PR #35 in Draft until those are exercised.
- No Vercel access, deployment, environment changes, production database changes, or live Groq API smoke test were performed.


## 2026-11-07 — Advertising, API security, and browser verification

- Added sponsored ad delivery to product discovery, search, category discovery, and product detail.
- Added campaign targeting/moderation, idempotent impression/click events, CPC spend ledger, total/daily budget enforcement, monthly store invoices, and manual external-reference settlement.
- Added explicit API mutation-boundary and UI feedback inventories as CI gates.
- Corrected missing same-origin checks on locale changes, customer return creation, and admin return review.
- Fixed the monthly invoice worker Bearer token parsing and added authorization tests.
- Product detail now receives server-rendered product and sponsored-ad data, avoiding a blank client-only loading state on direct navigation.
- Browser E2E covers customer, seller, Super Admin, sponsored placements, click idempotency, and responsive layouts.
- The latest completed CI audit artifact reported 159 API route handlers, 101 state-changing handlers with request/system boundary evidence, and zero unguarded state-changing routes. The UI feedback inventory reported 52/52 mutation-bearing files with an appropriate success/error feedback path.
- Preview deployment requires a preview-only `AUTH_SECRET`; the application derives `APP_URL` from Vercel's unique preview URL only for Preview deployments. Production still requires its own dedicated `AUTH_SECRET` and stable `APP_URL`.

- Replaced Google tokeninfo-only identity checks with local RS256/JWKS ID-token signature verification, audience/issuer/time/email checks, nonce binding, and constant-time OAuth state comparison.
- Assign the seeded GLOBAL CUSTOMER role for password and Google customer registration; keep seller applications PENDING without seller permissions until approval. Added unit and PostgreSQL integration assertions.

## 2026-11-07 — Super Admin MFA step-up

- Added ten-minute, session-bound TOTP step-up verification for every global `platform:manage` authorization path. Codes are consumed atomically and cannot be replayed; successful verification is audited.
- Added a same-origin verification API and localized step-up screen. Super Admin page entry points route administrators through MFA enrollment, ordinary MFA verification, and fresh step-up before continuing.
- Added additive `UserSession.stepUpVerifiedAt` / `stepUpExpiresAt` fields and migration `20261107190000_platform_admin_mfa_step_up`; no duplicate MFA model was introduced.
- Corrected the policy test to assert the canonical shared authentication error class and updated the isolated E2E admin fixture to carry a valid fresh step-up window. The fixture uses a disposable CI database only.
- Verification on exact PR head `a53a02498b9982006f27d4636a7fd48f1cd019bc`: CI run [42397330866](https://github.com/waelkamira/mtjr2/actions/runs/42397330866) passed (Prisma validate/migrate/generate, typecheck, lint, unit tests, production build, API security inventory, and UI mutation-feedback inventory); Platform PostgreSQL Integration [42397330816](https://github.com/waelkamira/mtjr2/actions/runs/42397330816) passed; Browser E2E [42397330893](https://github.com/waelkamira/mtjr2/actions/runs/42397330893) passed including customer, seller, Super Admin, sponsored placements, and responsive checks.
- Merged as PR #60 in commit `1501dcd169941a10d2bb780005bd7f86d63c1319`. The Vercel preview check remained unavailable due to the account's deployment quota; no Vercel deployment or production environment/database change was attempted.


## 2026-11-07 — Super Admin independent approval and governance verification

- Hardened the two-person privilege workflow so neither the requester nor the target account can approve or reject a platform-wide access request. Only a separate Super Admin reviewer can decide it; approval grants the canonical global `SUPER_ADMIN` role.
- Added a disposable PostgreSQL lifecycle test covering requester self-review denial, target self-approval denial, independent approval, persisted role assignment, and audit history.
- Extended browser E2E across the customer-denial boundary, access catalogue, platform audit log, AI assistant settings, privilege request creation, requester denial, independent reviewer approval, target access denial before approval, mandatory MFA enrollment after approval, and AI secret non-disclosure.
- Clarified the two-person approval rule in the Super Admin UI. Added bilingual assertions for the Arabic-default browser environment and scoped error assertions to the page content to avoid matching Next.js' route announcer.
- Expanded the identity PostgreSQL workflow path filters to include Super Admin service/API/UI, bootstrap, and identity/admin tests so future changes cannot silently skip the database gate.
- The API security inventory on the exact PR head reported 105/105 state-changing handlers with request/system-boundary evidence and zero routes requiring review. The UI mutation inventory reported 54/54 mutation-bearing files with success/error feedback and zero files requiring review.

**Verification**
- Exact PR head `d023dfe4aeba1734834e14008c1991832ed090b6`: General CI [42401505157](https://github.com/waelkamira/mtjr2/actions/runs/42401505157) passed; Platform PostgreSQL Integration [42401505263](https://github.com/waelkamira/mtjr2/actions/runs/42401505263) passed (3 integration files, 9 tests); Browser E2E [42401505171](https://github.com/waelkamira/mtjr2/actions/runs/42401505171) passed (customer, buyer checkout, seller, and Super Admin governance journeys).
- Merged as PR #64 in commit `84ae9ecec4ecd2796533dd3551d346ee43fb5849`.
- No production database, Vercel settings, production secrets, or provider credentials were changed. Deployment and live external-provider smoke tests remain separate release gates.


## 2026-11-07 — Anonymous API boundary hardening (PR #68)

- Corrected coupon and search-synonym admin read endpoints to return typed 401/403 responses for anonymous/unauthorized callers instead of generic 500 responses.
- Hardened all four cron workers to fail closed with 401 when no valid cron credential is supplied, without disclosing whether the secret is configured.
- Extended the anonymous API boundary sweep to exercise trusted-proxy and same-origin behavior; the suite covers 165 route/method combinations while explicitly excluding documented public/guest routes and accepting only explicit denial/validation/conflict/rate-limit outcomes.
- Exact PR head: 2207295893cde027e123518ea9b29a169dcc0cc0. General CI [42403107066](https://github.com/waelkamira/mtjr2/actions/runs/42403107066) passed; Browser E2E [42403107025](https://github.com/waelkamira/mtjr2/actions/runs/42403107025) passed. Earlier failed/cancelled attempts were superseded by these successful exact-head runs.
- Merged PR #68 as 16b185f765d4e7dbf68ee25907c41d17efbbea45. Main-branch CI was triggered after merge and is being checked separately.
- This anonymous boundary sweep is not a substitute for per-role, ownership, or store-scope authorization tests. No production database, credentials, Vercel configuration, or deployment was changed.


## 2026-11-07 — Financial lifecycle PostgreSQL gate correction

- Found that the Platform PostgreSQL Integration workflow did not trigger on payment/refund/webhook/shipment service and route changes. Added explicit PR and main-push path filters for payment services, payment intent/webhook/admin APIs, seller shipment routes, refund/return/shipping/payment/order tests.
- The corrected filter triggered the full disposable PostgreSQL workflow on main commit `0d0fab6f47fdf49396022331f77f5612616a8d44` (run [42404238983](https://github.com/waelkamira/mtjr2/actions/runs/42404238983)): all committed migrations deployed successfully, all existing PostgreSQL integration tests passed (3 files / 9 tests), and demo seed repeatability passed twice (80 products, 4 stores, 80 inventory rows).
- General CI passed on the subsequent documentation/registry head `f05480a83fe3126f0183e51f990e47216fb14098` (run [42404307099](https://github.com/waelkamira/mtjr2/actions/runs/42404307099)): Prisma validation/migration deploy/generation, typecheck, lint, unit tests, production build, API security inventory and UI mutation-feedback inventory all succeeded.
- The trigger correction makes future payment/refund/shipment changes run the PostgreSQL gate; it does not itself prove a live payment provider, refund provider, or carrier integration. No production database, live provider, Vercel configuration, or deployment was touched.


## 2026-11-07 — canonical-main journey and release-gate reconciliation

- Reconciled the 49-system end-to-end matrix against merged PR #64 (Super Admin independent privilege review and browser/PostgreSQL verification), PR #68 (165 anonymous route/method boundary cases), the buyer checkout browser journey, and the financial PostgreSQL gate.
- Recorded exact evidence boundaries: 105/105 state-changing API handlers have request/system-boundary inventory evidence and 54/54 mutation-bearing UI files have success/error feedback, but neither inventory proves per-role, ownership, staff-scope or cross-tenant authorization for every action.
- Advertising is live in the application placement surfaces with signed event tokens, deduplication, campaign budgets, spend ledger and invoice operations. Invoice settlement is manual; no live advertising billing provider was connected.
- Checkout E2E reaches a persisted pending-payment order through cart, address, shipping and tax. This does not prove payment collection or a live payment provider.
- PostgreSQL integration run [42404238983](https://github.com/waelkamira/mtjr2/actions/runs/42404238983) passed committed migration replay, 3 integration files / 9 tests, and two repeatable demo seed runs on main commit `0d0fab6f47fdf49396022331f77f5612616a8d44`. General CI run [42404307099](https://github.com/waelkamira/mtjr2/actions/runs/42404307099) passed on `f05480a83fe3126f0183e51f990e47216fb14098`.
- Latest observed main commit at reconciliation start: `1d458f0b43db43012913c5351c9754daeb153062`. Its Vercel status reports provider build/deployment rate limiting. This is not a successful deployment and is not evidence of an application compilation failure. The successful CI runs above are on preceding commits, not this exact documentation head.
- Updated README and END_TO_END_JOURNEY_MATRIX.md to identify the canonical evidence and open release gates. No application runtime code, Prisma schema/migrations, production database, production secrets, live provider credentials, Vercel configuration, or deployment was changed.
- Next: update the 49 individual system rows from current merged evidence; prioritize authenticated actor/ownership/store-scope tests and missing browser journeys; recheck exact-head CI after docs changes; retry deployment only after the provider quota clears and required Preview secrets are configured.

## 2026-11-08 — Seller product image uploads

**Implemented**
- Added an authenticated seller product image upload endpoint. Uploads are restricted to the active seller store owner, exact-store catalog managers, or authorized platform administrators.
- Added server-side provider fallback: Imgur first, ImageKit second. Both use a consistent response shape; provider secrets are read only from server environment variables.
- Replaced manual primary-image URL entry in the seller product creation form with multi-image file selection, previews, removal, primary-image ordering, upload progress state, and a 10-image limit.
- Product creation now persists uploaded HTTPS media references through the existing catalog media model. No Prisma schema or database migration was introduced.

**Security and verification notes**
- The old Cooking repository contains hardcoded Imgur client IDs and ImageKit credentials. They were not copied; exposed credentials should be rotated/revoked.
- Added `IMGUR_CLIENT_ID` and `IMAGEKIT_PRIVATE_KEY` to `.env.example`. Configure these server-side in the deployment environment before uploads can succeed.
- Source changes were committed through GitHub. Runtime provider uploads, typecheck, lint and browser journey are not claimed as passed in this session because no application runtime or provider credentials are available here.

## 2026-11-08 — Ordered Imgur Client ID rotation

- Added a server-only Imgur Client ID manager that mirrors Cooking's rotation algorithm.
- IDs are read from `IMGUR_CLIENT_IDS` in the configured order (comma, semicolon, or newline separated).
- Each ID is selected for up to 50 uploads before moving to the next ID. Once all configured IDs reach 50 uploads, Imgur selection is blocked until the one-hour window resets; the sequence then starts again from the first ID. `IMGUR_CLIENT_ID` remains as a single-ID compatibility fallback.
- The rotation state is held in the warm Node.js process, matching Cooking's in-memory approach; independent serverless instances have independent counters. A shared distributed counter would be required for globally synchronized rotation across all instances.
- No credentials from Cooking were copied. Configure newly issued Imgur Client IDs in Vercel as `IMGUR_CLIENT_IDS`.


## 2026-11-08 — Seller product image upload recovery and preview workflow

**Implemented**
- Added a backward-compatible `POST /api/seller/products/images` endpoint that delegates to the canonical `/api/seller/products/media` handler, resolving the old/new endpoint mismatch without duplicating upload logic.
- Reworked the shared upload handler to accept both `file` and legacy `image` multipart field names, preserve the authenticated store-ownership and scoped-permission checks, enforce a 10 MB limit, and validate actual JPEG/PNG/GIF/WebP/AVIF file signatures before forwarding bytes.
- Matched Cooking's Imgur transport (raw file body) and retained ordered 50-uploads-per-ID rotation. Added ImageKit fallback and a third Cloudinary unsigned-preset fallback so the existing Vercel Cloudinary cloud/preset configuration can be reused without sending the legacy API secret. Provider failures now return actionable HTTP diagnostics instead of swallowing every provider error.
- Rebuilt the seller image picker around immediate local previews, per-image upload states, remove controls, ordering controls (first image is primary), multi-file upload, and a ten-image cap. Product creation is disabled until every selected image has uploaded successfully.
- Persisted MIME type, provider storage key, image width and height alongside the URL in the existing Prisma `ProductMedia` model. The existing `type`, `isPrimary`, `sortOrder`, `altText`, and URL fields remain the canonical product media representation; no migration was required.

**Verification boundary**
- Source changes are committed to `main`. No live upload can succeed until at least one valid provider credential is configured server-side (`IMGUR_CLIENT_IDS` / `IMGUR_CLIENT_ID` or `IMAGEKIT_PRIVATE_KEY`). The earlier 503 response is consistent with no provider being configured; the new endpoint reports this explicitly.
- Vercel project environment inventory contains legacy Cloudinary cloud-name and upload-preset values, but no `IMGUR_CLIENT_IDS` or `IMAGEKIT_PRIVATE_KEY`. Cloudinary is therefore the configured fallback candidate; its preset must allow unsigned uploads. No live provider upload or production browser test is claimed. The latest observed Vercel check is blocked by the account build-rate limit; typecheck/build must be checked on the exact resulting commit before marking this workflow verified.


**Vercel production environment repair**
- Added production `AUTH_SECRET` by reusing the existing 43-character `NEXTAUTH_SECRET` value rather than generating a new signing key. This avoids unnecessary key rotation and preserves compatibility with any existing cryptographic material.
- Added the canonical production `APP_URL` required by the current application environment validator.
- Added server-only `CLOUDINARY_CLOUD_NAME` and `CLOUDINARY_UPLOAD_PRESET` variables for Preview and Production, sourced from the existing Cloudinary configuration. The unsigned preset still needs to accept unsigned uploads for the live provider request to succeed.
- These environment changes do not themselves prove a successful build or image upload. The first build attempt on commit `b438e2190e93ae89732da1ab1e8cb830898aa6b6` compiled the application bundle and completed TypeScript, then failed during page-data collection because Production lacked `AUTH_SECRET` (and `APP_URL` was also absent). A new deployment is required to verify the corrected environment.

- After adding the missing production variables, a forced production deployment request was blocked by Vercel's account limit: `api-deployments-free-per-day` (more than 100 deployments; Vercel requested a 24-hour wait). The corrected environment variables are present, but the updated commit has not yet been built/deployed. Do not mark the production fix as live until a new deployment completes and an authenticated upload smoke test succeeds.


## 2026-11-08 — Draft product image replacement and provider cleanup
- Extended the current-main draft product update service to accept a validated replacement image gallery, preserve ordering/primary-image metadata, and replace media records transactionally.
- Added post-commit provider deletion for removed Imgur (OAuth delete hash), ImageKit (private file ID), and Cloudinary (signed destroy API) assets. Missing provider deletion credentials fail safely as unsupported; provider failures are logged without undoing the saved product edit.
- Added regression tests for replacement/removal, transaction failure safety, and all three provider deletion paths. Documented optional server-side deletion credentials in .env.example.
- These source changes were committed directly to main through repository integration; GitHub Actions has not produced a run for the latest commit and Vercel remains blocked by the daily deployment quota. Do not treat the changes as verified until CI, Prisma generation, unit tests, and browser checks run successfully.


## 2026-11-08 — Seller one-store creation guard
- Seller store creation now acquires a transaction-scoped PostgreSQL advisory lock keyed by the seller ID, then checks for an existing seller-owned store before creating anything. Matching retries return the existing store; any second store request with a different setup is rejected.
- Added a regression test for the second-store rejection and retained the idempotent matching-store retry behavior.
- This protects the application creation path from concurrent duplicate store requests. A database-level unique constraint and a preflight audit/cleanup for any historical duplicate stores remain a separate migration task; no destructive cleanup was attempted.
- The latest full CI and browser E2E run is pending on PR #72 and will be used to verify these changes.


## 2026-11-08 — Current-main verification findings and test-fixture correction
- The first exact-current-main CI run confirmed Prisma validation, PostgreSQL migration replay, Prisma Client generation, TypeScript, and ESLint. The full Vitest run then exposed one stale admin-seller test fixture: it supplied a legacy `stores[]`/`_count` shape while the current Prisma query selects the singular `store` relation.
- Corrected `tests/admin/sellers.test.ts` to return the current singular relation shape. The seller one-store test was also corrected after its first run exposed an assertion-regex mismatch (the service correctly returned `Each seller can own only one store...`).
- New verification commit on PR #73: `38030c1edaf605f90a053fde065414d36632a99b`. Fresh CI, Platform PostgreSQL Integration, and Browser E2E runs were triggered for this corrected head. Results are pending; no merge or deployment has been performed.
- The previous CI result of 439 passed / 1 failed is superseded by this test-fixture correction and must not be reported as a passing run until the fresh exact-head jobs complete.


## 2026-11-08 — Exact-head CI and PostgreSQL integration passed
- On PR #73 head `38030c1edaf605f90a053fde065414d36632a99b`, the complete CI quality job passed: Prisma validate, PostgreSQL migration replay, Prisma Client generation, TypeScript, ESLint, all 440 Vitest tests, production build, API route security inventory, and UI mutation feedback inventory.
- The dedicated Platform PostgreSQL Integration workflow also passed: migration deployment, baseline permission seeding, integration tests, demo catalog seed, and seed repeatability.
- Browser E2E is still running on the same PR head. Its isolated database migrations, Prisma generation, seller/admin fixture bootstrap, geography import, Playwright dependency installation, and Chromium installation have passed; production build and browser journeys are pending.
- PR #73 is verification-only and no production deployment was requested. Do not merge it until browser E2E completes; PR #69 remains Draft and blocked by branch divergence (336 commits ahead / 79 behind current main).


## 2026-11-08 — Browser E2E completed successfully
- Browser E2E on PR #73 head `38030c1edaf605f90a053fde065414d36632a99b` completed with success: isolated PostgreSQL setup, migration replay, Prisma generation, seeded seller/admin/customer fixtures, Syrian geography/catalog import, production build/start, Playwright browser journeys, and responsive screenshots/artifact upload.
- All three verification workflows are green on that head: CI, Platform PostgreSQL Integration, and Browser E2E. CI includes all 440 Vitest tests and production build.
- The functional source and corrected seller/admin test fixture are present on current main; subsequent main-only commits since the verification head contain documentation updates only. No production deployment was triggered.
- PR #69 remains unmerged and Draft: latest comparison is 336 commits ahead / 81 behind main, so it still requires a real rebase/three-way reconciliation before safe integration.


## 2026-11-08 — Fix multipart image-upload request validation
- A follow-up code-path audit found the shared mutation guard required `application/json`, while seller image uploads send `multipart/form-data`; the upload route therefore could be rejected before its authenticated upload handler parsed the form.
- Split same-origin/Fetch-Metadata validation from body-type validation. JSON mutation routes retain the JSON-only guard; image upload routes now use a dedicated multipart guard that requires a multipart boundary and preserves same-origin checks.
- Updated both `/api/seller/products/media` and the backward-compatible `/api/seller/products/images` endpoint. Added unit coverage for JSON acceptance, multipart rejection on JSON endpoints, multipart acceptance on upload endpoints, and missing/cross-origin rejection.
- These changes were committed directly to main; they are not verified yet. A fresh exact-head CI, PostgreSQL integration, and Browser E2E run is required before considering this fix complete.


## 2026-11-08 — Preserve authentication-first behavior on upload routes
- The first multipart-guard E2E run correctly exposed that anonymous POST probes received HTTP 415 before authentication because the content-type check ran too early. The other six browser journeys passed; the security-boundary test failed only on the two image-upload aliases.
- Reordered the canonical media route: same-origin/Fetch-Metadata validation first, session authentication second, multipart content-type validation third, then form parsing and store permission checks. The legacy `/images` route now delegates directly to the canonical handler so it cannot return a different pre-auth response.
- This keeps CSRF protection ahead of authentication while ensuring anonymous probes receive authentication failure instead of upload-format details. The updated route changes are on main and copied to the verification branch for a fresh exact-head CI/E2E run.


## 2026-11-08 — Route-security inventory follows delegated upload handlers
- The authentication-first upload ordering passed the browser journey for seller, customer, and Super Admin pages, but the broad anonymous-route E2E initially exposed a stale inventory rule: the legacy `/seller/products/images` alias delegates to `/seller/products/media`, and the audit script did not follow relative route imports or recognize the new multipart/origin guards.
- Updated `scripts/audit-api-routes.cjs` to follow relative handler imports, recognize `validateIdentityMutationOrigin` and `validateIdentityImageUploadRequest`, and require actual request-argument guard calls. This is an audit-reporting correction; the route behavior remains unchanged.
- The first E2E attempt on the multipart guard failed only because unauthenticated image POST probes received 415 before auth. The route ordering was corrected; the second run passed all seven Playwright journeys. The remaining CI failure was the inventory script's false positive and is now corrected. A fresh verification run is pending.


## 2026-11-08 — Multipart upload guard and route inventory fully verified
- Fresh verification on PR #74 head `45bfaddd2b450bfda866048b160f0dff255b7ff6` passed both complete workflows: CI and Browser E2E.
- CI passed Prisma validate, migration replay, client generation, TypeScript, ESLint, **445 tests across 94 test files**, and production build.
- The API security inventory now discovers **167 route handlers**, with **0 routes requiring manual review** and **0 state-changing routes requiring review**. The UI mutation feedback inventory found 54 files with appropriate success/error feedback paths.
- Browser E2E passed **7/7** journeys, including the anonymous route-security sweep across 166 route/method probes, buyer checkout, customer responsive account, seller workspace, Akaar category fields/Syrian geography/Leaflet map, and Super Admin control center/advertising.
- The multipart image upload guard now preserves same-origin checks, authenticates before exposing upload content-type requirements, and accepts multipart requests on both current and backward-compatible endpoints. No production deployment was triggered.


## 2026-11-08 — Seller API error semantics and authorization hardening

- Corrected product creation API error mapping so catalog-access denial is returned as HTTP 403 rather than being misreported as HTTP 400. Public product listing continues to enforce the public-search request budget.
- Tightened seller shipping-rate error handling. Shipping service authorization failures now use the shared typed `PermissionDeniedError`; the route returns 403 only for an actual authorization denial, 401 for missing authentication, 400 for invalid input or an unsupported store market/currency, and 500 for unexpected service/database failures. Previously, the GET handler returned 403 for every exception, hiding operational failures as permission problems.
- Added `tests/api/seller-shipping-rates-route.test.ts` to cover permission denial, authentication, missing store identifier, and unexpected GET/POST failures.
- The disposable PostgreSQL integration workflow triggered by the preceding API commit completed successfully: Prisma validation/generation, committed migration replay, baseline permission seeding, integration tests, demo catalog seed, and seed repeatability all passed. This run predates the typed shipping error-mapping change and is not evidence for that new route behavior.
- Exact-head general CI was triggered on the new test commit and is pending. No passing typecheck/lint/unit/build claim is made for these latest changes until that run completes.
- No production database, Vercel configuration, or deployment was changed.


## 2026-11-08 — PR #69 reconciliation review and seller catalog comparison

- Rechecked PR #69 against current `main`: it remains a Draft and is not mergeable. The current comparison reports 336 commits ahead, 103 behind, and 159 changed paths. The branch must not be merged wholesale.
- Confirmed that current `main` already uses database-backed category attribute definitions in the seller product editor (including locale-aware loading and typed attribute values), and already includes the Syrian location picker backed by the platform's geography API and neighborhood suggestions. The PR's static Akaar preset map and bundled OpenSyria v0.1.5 geography API/picker are not safe drop-ins: they are older, parallel contracts that would bypass the current category/geography models and conflict with the current product schema.
- The PR's product-editor changes still identify potentially useful fields not yet represented on the current `Product` model (contact phone, video URL, legacy custom JSON, and property-specific details). These require a deliberate schema/API/editor design against the current `ProductAttribute`, `SyriaLocality`, and `SyriaNeighborhood` models; no legacy JSON or duplicate geography model was imported.
- Current-main seller API error handling was tightened in this work. PostgreSQL integration run `42468235175` completed successfully, including Prisma validation/generation, migration replay, baseline permission seed, integration tests, demo catalog seed, and seed repeatability.
- Exact-head CI run `42468235212` has passed dependency installation, Prisma validation, migration deploy, Prisma generation, TypeScript typecheck, and ESLint. Vitest is still running at the time of this entry; build and route/UI audit steps have not yet completed. Do not treat the workflow as fully green until the remaining steps finish.
- No Vercel deployment, production database mutation, or PR merge was performed.


## 2026-11-08 — CI regression follow-up

- Exact-head CI on commit `5d825d8906fa53ef0e6ef426c64b9b6fd8fb4841` passed dependency installation, Prisma validation, migration deploy, Prisma generation, TypeScript typecheck, ESLint, and both route/UI audit generators (167/167 API routes with guard evidence; 107/107 state-changing routes with mutation-boundary evidence; zero inventory items flagged for manual review).
- Vitest reported 447 passing tests and one failing test. The failure was a stale Vitest mock in `tests/catalog/products.test.ts`: the production service now throws the shared typed `PermissionDeniedError`, but that test's mocked `current-session` module did not export the class. This was a test-double defect, not a production authorization failure.
- Fixed the mock export in commit `0cdeee69fb81998db175a4bac43f8c2d14547288`. Exact-head CI run `42468433339` is now running against that fix. Build remains gated on Vitest success.


## 2026-11-08 — PR #69 compatible product-listing integration

- Started a clean integration branch from current `main` instead of merging the stale 336-commit PR #69 wholesale.
- Preserved the current platform's normalized, database-backed category attributes and Syrian geography/location picker. Did not import PR #69's parallel static category preset/legacy custom JSON system or duplicate geography dataset.
- Added structured real-estate metadata to the current Prisma model: property type, sale/rent listing type, bedrooms, bathrooms, and positive floor area. Added optional city, district, seller contact phone, and HTTPS video URL fields.
- Reused the existing `Product.latitude` / `Product.longitude` fields as the canonical exact seller-selected coordinates; deliberately did not add a second map-location table. Public product details receive only coordinates rounded to two decimal places, while the seller workspace retains exact coordinates.
- Added a forward-only Prisma migration with foreign-key and positive-area/room-count checks. The one-store-per-seller constraint was not re-created because it already exists in current `main`.
- Extended draft create/update validation and transactional persistence. Real-estate category ancestry is checked server-side; property details and a complete coordinate pair are required for real-estate drafts, and property details are removed if a draft is moved out of the real-estate category.
- Extended seller product listing responses, seller create/edit forms, and storefront product details to show property specifications, contact phone, video link, and approximate map location. The existing category-attribute editor, image gallery, and Leaflet/Syria picker remain in place.
- Added focused product lifecycle tests for real-estate validation, structured metadata persistence, and draft updates.
- Verification status at this entry: source and migration changes are committed to the integration branch; CI/typecheck/Prisma validation have not yet run on this branch. No claim of passing tests is made until the exact-head workflow completes.
- No production database, Vercel deployment, or production configuration was changed.


## 2026-11-08 — PR #69 seller operations, analytics, shipping and advertising extraction

- Ported the seller workspace's order/inventory analytics and charts while retaining current seller APIs and the existing one-store-per-seller enforcement.
- Added reusable chart primitives and eight additional Super Admin analytics views using already-returned dashboard metrics and daily order counts; deliberately avoided the PR #69 backend approach that would add twenty extra database queries to each dashboard request.
- Added store-scoped shipping-rate editing through a new PATCH endpoint. The service verifies seller/store ownership or scoped permission, validates enabled market/currency, checks the rate belongs to the same store, and writes an audit event. Permission failures map to 403 rather than relying on message matching.
- Added route and service tests for shipping-rate updates, including unauthorized and cross-store cases.
- Improved seller advertising setup: budgets are entered in human-readable major currency units and converted with the selected currency's minor-unit precision; positive budget checks are enforced client-side. Added category/brand targeting controls with server-side product/category/brand consistency checks.
- Extended sponsored campaign delivery to accept multiple category IDs (deduplicated and capped at 20) while preserving the existing single-category input for compatibility; added a focused targeting test.
- Rechecked PR #69's remaining identity/MFA, one-store safeguard, geography, image-gallery, and core advertising work against current `main`; these foundations are already present, so they were not duplicated.
- Verification status: Prisma validation and migration deployment passed on an earlier integration head. The exact current head must pass typecheck, lint, tests, build, browser E2E, and PostgreSQL integration before merge. No production database or deployment was changed.


## 2026-11-08 — PR #69 integration merged and verified

- Squash-merged PR #76 (`feat/pr69-product-listing-integration`) into `main` as commit `c914cc6d2172f1c88e97b220ac9a59094e915d5c`.
- Closed stale Draft PR #69 as superseded. Its 336-commit branch was not merged wholesale; unique compatible improvements were extracted while retaining current-main implementations of geography, category attributes, image gallery, identity/MFA, advertising foundations, and one-store-per-seller enforcement.
- Exact merged source head `ee8471143155349a870d0a9976785f7e23eb95c7` passed Prisma validation/migration deployment, TypeScript typecheck, ESLint, unit tests, production build, PostgreSQL integration (including repeatable catalog seed), browser E2E/Playwright, API route security inventory, and UI mutation-feedback inventory.
- No production database migration was run and no Vercel deployment was performed; database migration verification used disposable CI PostgreSQL.


## 2026-11-08 — Closed-PR audit and saved-address correction

- Audited closed PR state and compared the remaining deltas of the closed/unmerged branches against current `main`; no stale feature branch was merged wholesale.
- Confirmed the important historical feature groups were already integrated through later clean merges: seller returns (#19/#20), shipment tracking (#41), roadmap plans (#38/#39), manual refunds (#59), Super Admin control center and independent reviewer protections (#35/#62/#64), Groq assistant provider foundation (#54), anonymous API boundary fixes (#68), and seller/catalog work (#76).
- Confirmed PR #22 remained closed and unmerged. Its Google ID-token verification and registration-role work are already represented by later merged identity changes; its saved-address page correction exposed a still-live country-contract mismatch in current `main`.
- Rebuilt that address correction on current `main`: country selector now consumes ISO-2 `iso2` from `/api/countries`, POST sends `countryCode` expected by the address service, and rendering consumes `countryName` from the flattened list response. Added service tests for owner scoping, active-country lookup, default-address handling, and response shape.
- Opened PR #77 and squash-merged it as `881fc9ed5bf3e807b2f4013e991899463adee76b`. Exact source head `64044d409da434486ccaff5a6574f7e9ee5a3b45` passed CI run `42475854889`, disposable PostgreSQL integration run `42475854901`, and Browser E2E run `42475854837`.
- Prisma validation, migration deploy/generation, typecheck, ESLint, unit tests, production build, API/UI inventories, PostgreSQL integration/repeatable seed, and browser E2E all completed successfully on the exact PR head.
- No production database migration, production secret change, Vercel setting change, or deployment was performed.



## 2026-11-08 — Password registration and immediate-session policy merged

- Merged PR #78 into canonical `main` as `fde3b47b098b1f15ed40a141b6c66b9a6c237946`.
- Password registration now creates an ACTIVE customer account and attempts to issue the authenticated server session and HttpOnly cookie in the same HTTP journey. If session creation/cookie setup fails after account creation, the response clearly states that the account exists and directs the user to sign in; partial session tokens are revoked where possible.
- Email verification is no longer a prerequisite for password registration or eligible password login. Existing legacy PENDING registrations may activate after valid password proof, while administrator-imposed PENDING holds are preserved using the audited status reason.
- Seller applications remain pending review and do not receive seller permissions during registration.
- The initial exact PR head `5c035f05371161f0d2e7a6c2bca600e1d3ebdb72` passed General CI runs [42489542922](https://github.com/waelkamira/mtjr2/actions/runs/42489542922) and [42489548427](https://github.com/waelkamira/mtjr2/actions/runs/42489548427), disposable PostgreSQL [42489548337](https://github.com/waelkamira/mtjr2/actions/runs/42489548337), and Browser E2E [42489548167](https://github.com/waelkamira/mtjr2/actions/runs/42489548167). The follow-up test correction was included before merge.
- The merge triggered fresh `main` checks: General CI [42489984972](https://github.com/waelkamira/mtjr2/actions/runs/42489984972), platform PostgreSQL [42489984985](https://github.com/waelkamira/mtjr2/actions/runs/42489984985), and clean migration replay [42489985055](https://github.com/waelkamira/mtjr2/actions/runs/42489985055). Their results must be checked before claiming exact-merge-head verification.
- No production database, provider secret, Vercel setting, or deployment was changed. Phase 2 remains open for real provider/proxy configuration and the single deployed HTTP journey.


## 2026-11-08 — Customer saved-address management merged

- Squash-merged PR #79 into `main` as `cc5545b96cbb00c82757819a6b1c58fbd338b805`.
- Completed the authenticated customer address-book lifecycle: list, create, edit, set default, and delete. Every mutation derives the owner from the current session and scopes the database write by both address ID and owner ID.
- Serialized address-book mutations with a per-user PostgreSQL advisory transaction lock and serializable transactions. Creating/replacing a default clears the previous default atomically; deleting the default promotes the newest remaining address.
- Preserved immutable checkout address snapshots: deleting a saved address only nulls the optional source-address reference; it does not change an existing quote/order address snapshot.
- No Prisma schema change or migration was required. Added focused service tests for owner isolation, default transitions, deletion fallback, and the existing country-code response contract.
- Exact PR source head `35557ef5df5e24f747b20349b2483c3ba973eb4e` passed General CI [42490650980](https://github.com/waelkamira/mtjr2/actions/runs/42490650980), disposable PostgreSQL [42490651121](https://github.com/waelkamira/mtjr2/actions/runs/42490651121), and Browser E2E [42490648736](https://github.com/waelkamira/mtjr2/actions/runs/42490648736). The browser workflow passed as a suite; it does not contain a dedicated new address-book interaction test.
- Fresh merged-main General CI passed on `cc5545b` in [run 42490916929](https://github.com/waelkamira/mtjr2/actions/runs/42490916929).
- No production database, Vercel configuration, secrets, or deployment was changed.


## 2026-11-08 — Seller workspace redesign and interactive Syrian location map

**Seller workspace**
- Added a shared `/seller/*` layout with a structured desktop sidebar, grouped navigation, active-route state, compact mobile navigation, and a consistent top bar.
- Removed the old wrapping horizontal seller header from the overview so the shared shell is the single seller navigation surface.
- Restyled the seller overview header and store summary to use the platform's white/onyx/orange design tokens while preserving the existing live metrics, charts, store ownership checks, inventory, warehouse and shipping workflows.
- Navigation intentionally links only to existing seller routes; it does not advertise unimplemented finance/analytics/settings pages.

**Location picker and Leaflet**
- Enabled Leaflet scroll-wheel zoom, touch zoom and double-click zoom; wheel zoom is active when the pointer is over the map.
- Added fractional zoom steps and viewport telemetry on the map element so browser tests can assert actual zoom changes.
- The map now follows each selected administrative level using the existing database-backed Syrian geography API: governorate, district, subdistrict and locality, with progressively closer zoom.
- Nearby neighbourhood suggestions are now requested around the current map focus after selecting an administrative level, not only after an exact coordinate is already present. The search radius narrows as the map zooms in.
- Corrected subdistrict-to-district label mapping so the selected administrative district remains the district value and the selected locality remains the city value.
- Guarded asynchronous administrative-level requests against stale responses when users change selections quickly.
- No geography schema, Prisma model, or migration was added; the existing geography tables and neighbourhood suggestion endpoint remain canonical.

**Verification**
- Extended the seller catalog Playwright journey to assert map zoom progression and mouse-wheel zoom using the map's viewport telemetry.
- Changes are committed directly to canonical `main`. At log time, no exact-head GitHub Actions result has been observed for these direct commits. Do not claim typecheck, lint, build, browser E2E, or production deployment passed until the corresponding run is available.
- Vercel's latest observed check remains blocked by the provider's build-rate limit; no deployment configuration or production secrets were changed.


## 2026-11-08 — Seller/map CI lint failure triage

- Inspected exact-head GitHub Actions CI run [42492266353](https://github.com/waelkamira/mtjr2/actions/runs/42492266353) for `1badcbfa50948d5d8f2b60791cf041266892d7c3`.
- Prisma validation, migration deploy, client generation, and TypeScript typecheck passed. ESLint failed on two errors: an internal marketplace anchor in the new seller layout, and a synchronous state clear inside the geography picker effect. Unit tests and production build were skipped by the workflow after lint failed.
- Fixed the seller navigation to use Next.js `Link`. Removed the redundant effect-body state update; selection handlers already clear neighbourhood suggestions when the selected geography/focus changes, while the effect remains responsible for the external neighbourhood fetch.
- Fix commits were written directly to `main`: `6be4de2e3dd6356f7c6a909f8825a0ba15d5ea18` and `5262a9789cdd5f0c6cfb258f0fd438d9b53d2c55`. Exact-head rerun is pending; do not claim lint, unit tests, build or browser E2E passed until the new run reports them.
- Vercel separately reports `Deployment rate limited — retry in 24 hours`; this is a provider quota failure, not an application build diagnosis. No Vercel settings, production secrets or production database were changed.


## 2026-11-08 — Seller/map quality gates and browser E2E trigger

- Exact-head GitHub Actions run [42492922015](https://github.com/waelkamira/mtjr2/actions/runs/42492922015) for `6084b01c3a78a3608643c0f7e33064c09308eb6f` completed successfully: Prisma validate, migration deploy, Prisma generate, TypeScript typecheck, ESLint, Vitest (`npm test`), production build, API-route security inventory, UI mutation-feedback inventory, and artifact upload all passed.
- The workflow's `npm test` script is Vitest, not Playwright. The dedicated Browser E2E workflow already existed but its push trigger excluded canonical `main`, so the seller catalog/map browser journey was not automatically exercised by normal main pushes.
- Updated `.github/workflows/browser-e2e.yml` to run on pushes to `main` as well as feature branches, preserving pull-request and manual triggers. This enables the isolated PostgreSQL + seeded geography/Akaar catalog + production-server Chromium journey (including seller product authoring, hierarchy zoom and wheel zoom) to run against canonical main.
- The Browser E2E run triggered by this workflow change is pending; browser journey is not yet claimed as passed. Vercel remains independently blocked by its reported 24-hour build-rate limit.


## 2026-11-08 — Geography E2E coordinate-aware assertion

- Follow-up review found the governorate zoom assertion was unconditional, unlike the district/subdistrict/locality assertions. The picker correctly leaves the map focus unchanged when a geography record has no coordinates; the test now asserts zoom 7 only when both governorate coordinates exist.
- This is a test reliability correction, not a change to geography runtime behavior. Exact-head CI and Browser E2E are pending on the preceding main commit; this new test commit will trigger fresh runs.


## 2026-11-08 — Seller draft create/edit coverage and CI queue stability

- Added a real seller-browser journey in `tests/e2e/marketplace.spec.ts`: sign in as the seeded seller, load the Akaar phone category, simulate only the external image-storage response, submit a draft through the real product API, verify the saved draft in the seller catalog API, open Edit draft, save changed name/slug through the real PATCH API, and verify persisted values.
- The existing Syrian geography/Leaflet test now guards governorate zoom by coordinate availability, matching the picker behavior.
- Changed both CI workflow concurrency groups to preserve in-flight quality/browser runs during rapid direct commits to canonical `main`. Previous `cancel-in-progress: true` cancelled runs while documentation updates were being committed in sequence; new pushes will queue instead of cancelling active work.
- These latest changes are on `main`; the exact-head quality and Browser E2E runs are queued behind earlier runs. Do not claim the new create/edit browser journey passed until its Chromium run completes.


## 2026-11-08 — Seller workspace closeout verification

**Canonical branch:** `main`  
**Verified source SHA:** `8d19568415f0a9139987774e7697cbf8dfbb90be`

- Seller dashboard responsive journey captures the actual `/seller` workspace at desktop and 390px mobile widths after operational data has loaded; the test checks horizontal overflow at both sizes. Advertising is checked separately at both widths.
- Seller catalog browser journey creates a real draft through the seller product API, verifies it in the store catalog, edits its name/slug through the real update API, and verifies persisted values. Only the external media-provider response is mocked; the upload UI, product API, database writes and catalog reads remain real in the isolated CI database.
- Seller workspace journey edits the seeded shipping service through the real seller shipping PATCH API and verifies the updated name/description through a fresh API read.
- Seller single-store guard was rechecked in source: the workspace hides second-store creation once an owned store exists; the service serializes creation per seller with an advisory transaction lock and rejects a second store with a different setup.
- Geography browser coverage exercises Syrian governorate/district/subdistrict/locality selection and Leaflet zoom behavior, with coordinate-aware assertions.
- Exact-SHA Browser E2E run `42494633661` completed successfully; Chromium journeys and responsive screenshot artifacts uploaded.
- Exact-SHA CI run `42494633784` completed successfully: Prisma validate/migrate/generate, TypeScript, ESLint, Vitest, production build, API security inventory and UI mutation-feedback inventory.
- Vercel status remains a provider-side build-rate limit (`build-rate-limit`), not an application build failure. No Vercel environment or deployment configuration was changed.


## 2026-11-08 — Canonical-main baseline audit and task-sequence start

**Canonical repository:** `waelkamira/mtjr2`  
**Canonical branch:** `main`  
**Audited source SHA:** `256769c65bf07df599b0a92b8d489d4281222060`

- Confirmed repository default branch is `main`; no open pull requests were returned by GitHub for this repository. This audit does not use or recommend merging historical branches; all follow-up work starts from the current canonical source.
- Exact-head General CI run [42499746345](https://github.com/waelkamira/mtjr2/actions/runs/42499746345) passed on the audited SHA. Its completed steps include Prisma validate, migration deploy against CI PostgreSQL, Prisma generate, TypeScript typecheck, ESLint, Vitest, production build, API route security inventory generation, and UI mutation-feedback inventory generation.
- Exact-head Browser E2E run [42499746035](https://github.com/waelkamira/mtjr2/actions/runs/42499746035) passed on the same SHA. The workflow migrated and seeded an isolated PostgreSQL database, built and started the production application, ran Chromium Playwright journeys, and uploaded browser reports and responsive screenshots.
- The current head's Vercel status is failed, but the repository's deployment policy explicitly excludes Vercel deployment from this work. This provider check is not treated as a source-code CI failure and no deployment was attempted.
- Recent seller workspace work is present on main: real draft create/edit persistence, seller shipping-service edits, one-store-per-seller enforcement, image-upload browser feedback, responsive dashboard captures, and Syrian geography/Leaflet interactions. Exact-head seller workspace CI/E2E evidence is also recorded in the preceding closeout entry.
- Latest identity correction on this head adds explicit MFA policy coverage: pending seller applicants are not forced into MFA enrollment before approval; active sellers are required to enroll, while platform administrators retain their privileged MFA requirement.
- This audit is a baseline and evidence reconciliation, not a claim that all platform phases or journeys are complete. The next sequential task is the remaining identity/security closeout, including trusted-edge configuration evidence and the deployment HTTP journey; external secrets and production deployment must remain untouched unless separately authorized.


## 2026-11-08 — API authorization boundary closeout

**Audited source SHA:** `7e288958c2b4346154eb07e433e66d2fb7526922`

- Added `scripts/audit-api-authorization.cjs` and wired it into the main CI workflow as a hard gate. Any newly added API route without an explicit access-boundary classification now fails CI until reviewed.
- The latest CI inventory found **169/169** route handlers with a classified access boundary and **0** requiring manual authorization review:
  - 137 authenticated/permission-scoped routes
  - 12 public identity flows
  - 13 explicitly allowlisted public GET routes
  - 1 same-origin guarded public preference mutation
  - 1 signed public advertising-event endpoint
  - 5 signed system/cron/webhook endpoints
- The existing API mutation inventory separately found **109/109** state-changing handlers with request/system boundary evidence and **0** requiring manual review.
- Browser E2E now runs the anonymous protected-route-method sweep and explicit role-boundary probes. The buyer and seller role-boundary test passed; buyer-facing seller workspace/order endpoints return only their intentional empty state (`seller: null, stores: []` and `orders: []`) and expose no seller data. Seller and buyer requests to platform-admin APIs are denied.
- Existing unit/integration coverage continues to verify exact store-scoped permission grants, staff membership, seller order ownership, and account ownership. The static inventory is not represented as a substitute for those behavioral tests.
- Exact-head CI [42508679290](https://github.com/waelkamira/mtjr2/actions/runs/42508679290) and Browser E2E [42508679318](https://github.com/waelkamira/mtjr2/actions/runs/42508679318) both passed on the audited SHA.
- Result: API route access classification and the critical buyer/seller/admin boundary checks are closed for this phase. New routes must be explicitly classified to keep the gate green.


## 2026-11-09 — Financial integrity foundation (journal invariants)

**Canonical branch:** `main`  
**Implementation commits:** `198ef450a0b343e2a06f09286ae68915b6683ef5`, `aef236ba783bb05961cfa1722786bac4e88a05f1`

- Added `src/server/accounting/journal.ts` with pure domain validation for minimum line count, account presence, positive integer minor-unit amounts, single-currency journals, and exact debit/credit balance.
- Added reversal-line construction that swaps debit/credit sides and preserves the original lines as immutable input; reversals are intended to be new journal postings, never destructive edits.
- Added focused Vitest coverage for balanced multi-line journals, imbalance, mixed currency, zero amounts, reversal balance, and one-line rejection.
- This is a domain foundation only: it does **not** create persistent ledger accounts/journals, post money movements, calculate seller balances, or enable payouts. Those remain blocked on the reviewed Prisma schema/migration and transactional posting service.
- Latest commit check currently reports only the Vercel provider context as pending. No application CI result is claimed from that status response.

## 2026-11-09 — Seller workspace and product authoring refresh

**Canonical branch:** `main`

**Implemented**
- Applied the cool blue/navy claymorphism visual system to the seller workspace shell, desktop sidebar, mobile navigation, topbar, overview hero, metric cards, store setup panels, and shipping/catalog panels.
- Removed the duplicate Matjar masthead from the seller products route so it uses the shared seller dashboard shell.
- Restyled the seller product authoring flow, image gallery controls, catalog cards, inputs, market pricing panels, and primary save action.
- Added SKU barcode and optional compare-at price inputs per enabled market; compare-at prices are checked against the selling price before submission and remain subject to server validation.
- Separated category-level product attributes from variant-level options in the authoring UI. Variant-level values are sent with the SKU and now validated against the selected category's configured options.
- Persisted SKU-level category values to the canonical `VariantAttribute` relation as well as the existing variant option-values JSON.
- Added focused regression coverage for creation and persistence of a required SKU-level category option.
- Confirmed the store-creation service already serializes creation per seller and enforces one owned store; the dashboard exposes the existing store-management and shipping-rate edit flows.

**Verification**
- Re-fetched the changed source and test files from `main` and confirmed the changes are present.
- Latest reported commit status contains only the Vercel provider check failing with its build-rate-limit response. This is an external deployment quota failure, not evidence of a successful application build.
- The GitHub workflow-run lookup returned no run for the exact head. Typecheck, lint, focused Vitest, and production build have therefore **not** been claimed as passing in this session.
- No database migration was required by these UI and service changes.

**Remaining verification**
- Run `npm run typecheck`, `npm run lint`, and the focused `tests/catalog/products.test.ts` suite when a repository runtime/CI runner is available.
- Verify the seller dashboard at mobile, tablet, and desktop widths with an authenticated seller account.
- Verify category-level and SKU-level required attributes, image upload/replacement/deletion, and multi-market prices against PostgreSQL.
- The current create form creates one SKU variant per submission; a full multi-SKU variant matrix editor remains a separate enhancement.
## 2026-11-09 — Akaar-inspired seller application upgrade

**Reference reviewed**
- Inspected the actual Akaar seller application in `waelkamira/Akaar`: `app/seller/dashboard/dashboard-client.tsx`, `app/api/seller/application/route.ts`, `lib/seller/application.mjs`, and its private identity-document upload route.
- Ported the useful onboarding structure and field contract into Matjar's existing identity/session, Seller, audit, and admin review architecture. No Akaar database tables or legacy authentication code were copied.

**Implemented on `main`**
- Replaced the minimal legal/display-name form in `/seller` with guided sections for applicant/business identity and contact; business type/address; product categories and sourcing/sales plan; business map location; optional social presence.
- Added an interactive Leaflet location pin and required coordinate pair.
- Added optional identity image upload through a dedicated authenticated same-origin endpoint. The endpoint accepts JPG/PNG/WebP/AVIF up to 4 MB, checks image signatures, uploads only to ImageKit private storage, and tags the file to the authenticated account. Public Imgur/Cloudinary product-image providers are deliberately not used for identity documents.
- At application submission, the service verifies the ImageKit file is private and tagged for the submitting account before storing its file ID.
- Added structured Seller profile columns and additive migration `20261109130000_seller_application_profile`; old Seller rows remain valid because the new fields are nullable.
- Expanded the application API/service Zod contract and persists submitted business details with the Seller and audit event in the existing transaction.
- Expanded the protected admin seller queue payload and UI to show contact details, business type/address, intended products, location link, and optional social links.

**Verification boundary**
- Source files and migration were re-fetched from `main` after writes.
- Focused seller lifecycle tests were updated for the expanded payload; they have not been executed in this GitHub-only session.
- Prisma validation/client generation, migration replay, TypeScript, lint, private ImageKit upload, and authenticated browser journey remain pending exact-head CI/runtime evidence.
- No production database was touched and no migration was applied to a live database.
- Identity document download/review UI for authorized administrators remains a follow-up; the private file ID is not exposed in the seller list response.
## 2026-11-09 — Seller review and reapplication completion

- Added an administrator-only identity-document access endpoint. It re-reads ImageKit file metadata, checks private-file state and owner tags, and redirects to a five-minute signed URL. The seller-list response exposes only a boolean indicating whether a document exists; it never exposes the private ImageKit file ID.
- Added a secure document link to each application card in the admin seller queue.
- Rejected sellers can now correct their application and resubmit the same Seller record. A conditional update prevents stale/concurrent submissions; the application returns to PENDING and emits a dedicated audit event. Existing active/suspended seller accounts cannot use this path.
- Added focused regression coverage for reapplication and admin queue privacy. Tests are authored but not executed in this session.
- Exact-head GitHub status still reports only the Vercel build-rate-limit failure; no successful CI run is available to claim. GitHub Actions workflow-run results are not exposed by the current connector query. Prisma migration replay, typecheck, lint, full test suite, ImageKit upload/review, and authenticated browser verification remain outstanding.
- Added route-level tests for administrator permission enforcement, private-file owner-tag validation, and five-minute signed URL generation. Authored tests are still awaiting an executable CI result.
## 2026-11-09 — Verify private identity upload before exposing file reference

- Strengthened the authenticated identity upload endpoint: after ImageKit accepts the upload, the server now fetches the file details and confirms `isPrivateFile`, the `matjar-seller-identity` tag, and the authenticated owner's tag before returning the file ID to the browser.
- This closes the gap where a successful upload response alone could have been treated as proof of private storage. Submission and administrator review continue to re-check file privacy and owner association.
- Exact-head runtime verification is still pending: the current GitHub integration does not expose a workflow-dispatch action or a local repository execution environment in this session. The Vercel status remains rate-limited; no successful build or test run is claimed.


## 2026-11-09 — Seller workspace and catalog continuity fixes

**Implemented on `main`**
- Seller dashboard and product catalog now restore the last active store from the shared `mtjr.activeStoreId` preference, falling back safely to the first store when the saved store is no longer accessible.
- Switching stores in the product workspace now updates the same preference used by the seller dashboard, keeping both screens aligned.
- Category-dependent product attributes now enter their loading state immediately when a category is selected, avoiding a stale or apparently empty attribute panel while the category API is resolving.
- Browser storage access is guarded so privacy-restricted browsers do not break workspace initialization.

**Verification boundary**
- Source changes were committed directly to `main` in commits `2a5662c` and `1bf8877`.
- No local runtime or repository shell is attached in this session. TypeScript, lint, production build, category API runtime, and authenticated browser journeys have not been executed here; no pass is claimed.
- The latest observed commit status exposed only the Vercel build-rate-limit failure, and the commit workflow-run lookup returned no runs. This is not evidence that the application build passed or failed.

## Seller dashboard visual redesign — 2026-11-09

- Reworked the seller workspace's visible dashboard shell on `main`: new lavender/mint pastel backdrop, a redesigned layered gradient hero with larger hierarchy and softer clay-style depth, and refreshed metric-card surfaces/shadows.
- Kept existing seller analytics, store selection, orders, catalog, inventory, shipping, and API data flows intact; this commit is a presentation-layer change, not a claim that the entire seller portal has been rebuilt.
- Commit: `f8bfdd69d44280e32e43177eb7d4b41dc5afdeb2`.
- Verification: fetched the updated source from `main` and confirmed the new visual tokens are present. A production build and browser screenshot/runtime verification were not available in this session.


## 2026-11-09 — Seller workspace visual rebuild (reference-led)

**Reference review**
- Inspected the supplied claymorphism dashboard reference: dark navy vertical navigation, cool blue-grey raised surfaces, pale cyan/teal accents, rounded inset controls, layered soft shadows, compact KPI cards and chart-led content.
- Reviewed Akaar's seller implementation in `app/seller/dashboard/dashboard-client.tsx`, `app/seller/layout.tsx`, and `app/seller/seller-navigation.tsx`.
- Akaar's application flow confirms the intended information architecture: applicant/contact identity, store/business name and type, email and phone, business address, activity description, intended product categories and sourcing/sales plan, map coordinates, optional private identity document, and optional social links. Matjar's current application form already covers these fields (and retains its additional legal-name field); it remains connected to Matjar's own session, validation, private ImageKit upload, Seller persistence, and admin review path. No Akaar authentication or persistence code was copied.
- Akaar's old `newPost/product-create-form.jsx` contains a commented-out legacy implementation; it was not treated as a production-ready implementation. Matjar's category-specific fields remain sourced from its own category-attributes API and database.

**Visible implementation committed directly to main**
- Rebuilt the seller dashboard frame with a dark navy raised sidebar, seller identity tile, active navigation state, store status panel, and responsive navigation that collapses into a compact grid on smaller screens.
- Changed the dashboard canvas and KPI surfaces to the supplied cool blue-grey palette and clay-style raised/inset shadows. Existing real analytics, charts, store selection, inventory and shipping operations remain in place.
- Applied the same seller navigation shell and matching raised blue-grey surface treatment to the product workspace and create-product form, rather than leaving product creation in the previous separate visual system.
- Dashboard commit: `cfdc6406b3a055c97889d3aabdc1b3fbdcc3f98e`.
- Product workspace commit: `976ac62e633515ff801e8d60d522fb31b476859e`.

**Verification limits**
- GitHub source updates succeeded on `main`; this confirms the files were committed, not that a deployment has refreshed.
- No local package install, TypeScript check, lint, production build, database migration replay, or authenticated browser screenshot was available in this session. Runtime appearance and responsive behavior remain unverified until the application is built and opened.


## 2026-11-09 — Seller dashboard and product studio refinement

- Added a compact dashboard top bar with a responsive workspace search field, orders shortcut, seller avatar, and a direct product workflow entry point in the existing dashboard layout.
- Refined the dashboard welcome surface to the reference's dark navy/cool blue-grey palette and reduced the previous purple cast. Existing metric data and chart components remain data-backed.
- Expanded the create-product form header into a product studio introduction and applied raised, inset clay-style controls consistently to the form fields. The existing category-driven attribute schema, variant-level attributes, image provider rotation, image preview/replace/remove/reorder, location picker, and server-side draft workflow were retained.
- Commits: dashboard toolbar `d086cd7d4167a10ab6a1e1f00027c69c3c5c0df9`; product studio `751e5408ac3d1df8e5535f5df2fa8ea25089cca7`.
- Akaar review remains limited to seller onboarding requirements: its legacy newPost product form was commented out and was not copied; Matjar's production category-attribute API remains the source of category fields.
- Build/runtime verification is still outstanding; source commits are confirmed on main, but no successful build or browser rendering was available in this session.


## 2026-11-09 — Seller application presentation

- Expanded the seller application panel from a narrow form into a full-width guided application surface.
- Added a navy welcome header and four visible stages (business, products, location, profile) matching the reference's sidebar/dashboard visual language.
- Preserved the existing Akaar-derived application fields, map requirement, private identity-document upload, submission API, seller persistence and resubmission behavior.
- Commit: `7ff8a069045419959af3ac462ea6c3191216b4b7`.
- No backend or database behavior was changed in this visual refinement. Build and browser verification remain outstanding.


## 2026-11-09 — Seller workspace consolidation and all-section visual pass

**Structural correction**
- Found that the App Router already wraps every `/seller/*` route in `src/app/seller/layout.tsx`, which renders the shared `SellerNavigation` and `SellerTopbar`.
- Removed the duplicate, page-local sidebar and dashboard toolbar from `workspace-page.tsx` and the duplicate sidebar from `products-page.tsx`. The seller dashboard now relies on one shared navigation shell instead of rendering nested navigation.
- Aligned the global seller layout canvas with the cool blue-grey reference palette.
- Made the shared topbar visible at mobile and desktop widths, with a translated current-section title, product/SKU search, catalog shortcut, notifications and account access. The mobile horizontal seller navigation remains available below it.
- Connected topbar search to the product catalog query parameter and its existing store-scoped API search.

**Seller sections brought under one visual system**
- Removed redundant brand/back-to-workspace headers from inventory, advertising, questions, returns, reviews, staff and seller orders; the shared seller shell now owns navigation.
- Reworked their common content surfaces to raised cool blue-grey clay cards and consistent wide content containers.
- Rebuilt the seller inbox with a store selector (restoring the saved active store when valid), conversation list, selected conversation state, responsive message panel and reply form.
- Kept the existing server APIs, seller permission checks and mutation workflows intact; these changes are presentation/navigation integration, not authorization changes.

**Commits**
- Removed duplicate dashboard/product navigation: `69795ae7a1423c985a2c7dff97a582b2fb58b41d`, `283f922eb3d4d81a590bda565c8139437dcfce57`.
- Shared topbar and search: `6998cae91896b0707ed9e2b0e87b770fba0730be`, `a6a7e35ec817c8cb28416b5b9c0540bd37ee1b43`.
- Shared canvas: `614350d7b85b401b4f5d005e02442a5ce40c6d38`.
- Seller operations surfaces: `274a64e477da7b53918ac8ca38234769e7ca5cef`, `a5663ff5fa2e2fb31e445cd13b161579a227b190`, `3fa9539ad324730962a362f421df06607a856128`, `484288366a03a66d885b88a2397ea16fdbb57dc0`, `6f6803fe826cc850969f48f35314921c91c1181e`, `8e2c1204069b04bb664dca0710243cbb956c509c`, `46d6ca78576e56cd830ad81fee7e20f6f29b38ee`, `bc1988faa7b26e396838d5dcf56bc8271792a895`.
- Inbox store switching and presentation: `8dbc90f6637c0ab37b2800b4786a8aa56785285e`, `dcc26a2df1be3b05992e24f3d15301e2766099b7`.
- Import cleanup: `d8b9a7c4d33765e0ef463a9f5abdc0df3da326c7`, `6d29f59b342be8f1a8dda9bed5b477cb4746632f`, `61f84888322144fc260b35e566971b088b23994b`, `0e7e48f40a91d9086929157fe09abf681c4895f0`, `a172341328442fdcb819e4580d5dafdea2d0d7cd`, `baf84c5c96489baff6828448a5ad2e50a575b0f4`, `1dd0bc27bafa0d4da2df818abe12706dca3cfb67`.

**Verification**
- Re-fetched the edited files from `main` after commits and confirmed the shared shell is present and duplicate page-level sidebars are removed.
- GitHub reports the Vercel status as failed due to the account build-rate limit; no GitHub Actions workflow run is associated with the latest commits.
- No local Node/package runtime or authenticated browser session is available here, so TypeScript, lint, production build, database integration and responsive screenshot checks are not claimed as passed.


## 2026-11-09 — Seller store context continuity

- Inventory, shipping, advertising and staff now restore the previously selected store from `mtjr.activeStoreId` when that store is still available, otherwise they fall back to a valid store.
- Store changes in these sections update the same shared preference used by the dashboard, product catalog and seller inbox.
- This avoids different seller sections silently operating on different default stores after navigation.
- Commits: `b87e18867efd2d10ac9b7ffbf2c18e739e55ae56`, `20c540aec6eae26e628aeac0afff0f709c58dc67`, `d8cf0ed10c76e6907ed0a2777f15d14f1e459e42`, `c52baac9e2c895b563ee83531acede05fc2d6507`.


- Follow-up polish: removed the obsolete product-page navigation import (`490287e42b53e1551bf2b3e464e397ef75a983c5`) and clear stale inbox rows/conversation when switching stores (`89f3f9a4854951235603259b40a125610c206752`).


## 2026-11-09 — Seller dashboard and product studio visual completion pass

- Replaced the seller dashboard's oversized dark hero with a cool blue-grey clay welcome panel: raised profile monogram, active-store status/switcher, responsive primary actions, layered pastel lighting and soft inset/outer shadows.
- Removed the second, redundant store overview hero so the page now flows from one welcome panel directly into the four KPI cards and real store analytics.
- Gave KPI cards distinct mint, mist-blue, ice and lavender surfaces, preserving their live values and metric descriptions.
- Rebuilt the products page heading as a matching clay catalog header with a direct New product action; widened the content container and moved the two-column form/catalog layout to 2XL so medium screens do not get cramped.
- Continued the same clay treatment through catalog cards and category/variant controls. Category-aware fields, SKU/variant data, upload provider rotation, preview/remove/replace, draft saving and publication controls remain connected to the existing backend workflows.
- Added a top-level active-store selector in the dashboard welcome panel when the account has multiple stores; it updates the same `mtjr.activeStoreId` used by other seller sections.
- Commits: `1e4f3dbba39b0c48661a33a246a1db51ba0b48f4`, `cb9ee1bc1270b63e6fe68eff4a4c04cf7590b8fd`, `7d3fd215c49fb20d1612d09155f070d957687840`, `45ae0e01cb5ac3445a98d80e634829ef4c92b8cc`, `23a90b91ac73b1b75c1a3448eb487e1cd9be6747`, `7807b49795815fd79590af4e203c5457f3771f5e`, `0a6ef1db030d22a67875ef83a3346afd8b69cb02`.
- Static source review: re-fetched all seller workspace pages from `main`; checked JSX main/header/section/aside/form tag counts, Link imports/usages and accidental literal newline escapes. No issues were found by these lightweight structural checks. This is not a substitute for TypeScript, lint, production build or browser testing, which remain unverified in this environment.


- Dashboard data completeness: added a live recent-orders panel for the active store. It reads the existing seller-orders API, filters to the selected store, displays the five latest order numbers/statuses/totals/dates, respects the analytics orders permission flag, and links to the full order workspace. No duplicate order endpoint or new database model was introduced. Commit: `0bb96d32533a0db04840d0a6fc75ea648e36118c`.


- Sidebar polish: added a compact business-workspace identity panel and a direct growth/campaign shortcut while preserving all existing seller navigation routes. Commit: `a6a14952d30bd2889c09ba61799db66aaa792147`.

## 2026-11-09 — Seller workspace storage resilience

- Guarded the post-submission seller workspace reload when persisting the active store preference. The initial workspace load and other seller sections already tolerate restricted browser storage; the reload path now follows the same rule, so a storage exception cannot turn a successfully-created store/application into a failed-looking submission.
- No API, permission, schema or migration behavior changed.
- Commit: `f1e511b1a4a9d105df4ee92215afc2400aba6ec6`.
- Verification: the updated source was committed directly to `main`. TypeScript, lint, browser and PostgreSQL checks remain unverified in this GitHub-only session.


## 2026-11-09 — Canonical admin entry route

**Implemented**
- Added `/admin` at `src/app/admin/page.tsx`, redirecting to `/admin/dashboard` so the administration area has a predictable root entry.
- The route remains inside the existing admin layout, preserving its session, permission and MFA checks.
- No schema or migration change; this is navigation only.

**Verification**
- Confirmed the route was absent in the current route registry and added the route on `main`.
- Source-level inspection only. Next.js build and browser navigation have not been run in this GitHub-only session; do not mark the route verified yet.


## 2026-11-09 — Admin taxonomy and entry-point closeout slice

**Implemented on `main`**
- Added `/admin` as the canonical admin entry route, redirecting into `/admin/dashboard` under the existing admin layout permission/MFA gate.
- Added `/admin/brands` with a real Prisma-backed list and create/edit/archive workflow.
- Added `GET/POST /api/admin/brands` and `PATCH/DELETE /api/admin/brands/[brandId]`.
- Reused the canonical `Brand` and `AuditLog` models; no schema or migration change. Brand writes require `catalog:manage`, reads require `catalog:read`, writes are transactional and audited, duplicate slugs conflict safely, and archive preserves product relations.
- Added Brands to admin navigation. Website URLs are restricted to HTTP(S); logo URLs use the catalog media URL safety policy.

**Verification and limitations**
- Source-level review only in this GitHub-connected session. No local TypeScript/lint/build, focused service test, disposable PostgreSQL, or browser journey has been run for this slice. Do not mark these routes Verified until those checks pass.
- Current implementation lists all brands in one response; pagination/search should be added before the brand catalogue becomes large.


## 2026-11-09 — Seller portal redesign and product image preview

**Implemented on `main`**
- Replaced the seller segment's previous dark sidebar/topbar layout with a unified responsive pastel-clay seller shell. The shell links only to existing seller sections: overview, products, orders, inventory, shipping, returns, reviews, questions, messages, team, advertising and notifications.
- Harmonized the seller dashboard and product studio backgrounds/cards with the lavender, mint, blush and butter pastel palette while preserving the existing live dashboard data, analytics, onboarding and product workflows.
- Added an accessible full-size image preview overlay to both product draft creation and draft editing galleries. Images can be opened from thumbnails and the preview closes by the close control, backdrop click or Escape. Existing upload, retry, replace, remove and reorder actions remain wired to the media API.
- Re-verified the one-store-per-seller invariant in source: `Store.sellerId` has a database unique constraint; store creation additionally serializes requests with a PostgreSQL advisory transaction lock and rejects a second distinct store configuration.
- Confirmed that the seller application service, category-attribute loading, market-specific prices, seller shipping create/update APIs and shipping editor already exist; these were retained rather than duplicated.
- Updated `PAGE_INVENTORY.md` to record the actual seller layout, shipping and advertising routes and the current source-level UI capabilities.

**Commits**
- Seller shell component: `76adf3a79cf3c5bdace2ea8470fe3087e5003396`
- Seller layout: `7131f7b1be1df412171cc89b035b5b06c9a04598`
- Seller shell/navigation refinements: `9e6d061ca3bdc59abeaec8f89981bb15f72c5466`, `4bfb8f8a799a05d5aaeec850ed5d5bbd158d71c8`
- Seller image preview: `c86536b36a6258b9b407d0918bdf3129879371d7`, `ff7dbf339199c9c06fd9c99b3b518043ac26c9ae`
- Dashboard palette: `058860081894a59bdf913b1edf68bd702b1976b7`
- Product studio palette: `cac567bf1cb8754b1bb06b1ddde389fa4f647c14`
- Route inventory: `15913bf9523d83104a17a3a4e32e46a7df6c9d56`

**Verification and limitations**
- Source files were re-fetched from `main` after writes. The seller layout, navigation routes, image preview interactions, one-store database constraint and existing service/API connections were inspected.
- No local Node runtime, TypeScript, ESLint, production build, browser screenshot, or disposable PostgreSQL session was available in this GitHub-only session. Do not mark the redesign or seller portal as complete until those checks pass.
- Vercel's previous status failure was an account build-rate limit, not a verified application build failure. No deployment was attempted.

## 2026-11-09 — Seller visual reference alignment correction

- Rechecked the recorded reference review: the supplied seller dashboard reference is a dark-navy grouped sidebar, cool blue-grey raised/clay surfaces, pale cyan/teal accents, rounded inset controls and layered soft shadows—not a lavender/blush sidebar.
- Restored the established `SellerNavigation` + `SellerTopbar` in `src/app/seller/layout.tsx`. This preserves the grouped SVG icon navigation, mobile horizontal navigation, seller-wide product search, and the intended dark-navy/blue-grey visual system.
- Removed the temporary `seller-portal-shell.tsx` experiment and reverted the accidental lavender/blush palette substitutions from the seller dashboard, product studio, inventory, staff, reviews, questions and advertising pages. The product image preview overlay and paid-order delivery-address enhancement remain.
- Updated the seller navigation E2E locator to the existing translated navigation label. The existing E2E flow now checks seller navigation and opens/closes the full-size image preview with Escape.
- Commits: layout restoration `a602f4f23f0e8c9d1c8d2aecca28f40074949069`; temporary shell removal `d60f4eb60ed05be3f7aeebca62257a709ecad04d`; seller style restoration commits `d8c3a47b92080f8fc67e45601b6c9e4cd487bc6c`, `97229511452e3b938bc66f0fe03f9c97da81066a`, `8e443f83fcc3698b688066ef599807a7c41f1577`, `ed7a91052fef042b721f42b82bdb971a68e404c7`, `1a92dfc2553231ce543006988da44f13faa8e5e8`, `90dbec9fed8f13081b8a2f01905afd500bc573a9`, `01a9b139957bd140a48fa7afd50a330455bde75c`; E2E label update `ea452c53101e39a450359a3cbc1d3c4521cc93a7`.
- Verification remains pending on the exact current `main` head: no local TypeScript/lint/build, browser screenshot, or disposable PostgreSQL run was available in this session. No deployment was attempted.
## 2026-11-09 — Seller fulfillment address and carrier tracking

- Extended `listSellerVendorOrders` to include the immutable `OrderAddress` snapshot only when the parent order is in a paid/fulfillment state (`CONFIRMED`, `PROCESSING`, `PARTIALLY_FULFILLED`, `FULFILLED`, `COMPLETED`). `PENDING_PAYMENT` and `CANCELLED` vendor orders return `address: null`, so a seller cannot access recipient details before payment confirmation.
- Seller order cards now show recipient, telephone and delivery address for eligible paid orders, and expose a carrier tracking link when the seller supplied an HTTPS tracking URL. Existing per-vendor order scope and seller/staff permission checks remain server-side.
- Added E2E assertions for the seller navigation and product-image preview open/close interaction, and aligned the seller dashboard heading assertion with the actual localized page heading.
- Commits: address API `a066fe60a7d572e5206f8a34dd0767fdfe3649ed`; seller order UI `79034a4d920460b6d789370602808311e8dcffcf`; E2E preview/navigation `6d3ff08ba51dede7af35d6aef3f5558aa7e6a794`, navigation label `ea452c53101e39a450359a3cbc1d3c4521cc93a7`, heading `572610a6429df893ca5edc36a8abe938091f931f`.
- Verification: source-level API/UI mapping inspected. The new E2E tests and privacy behavior have not been executed against a disposable database or browser in this session.
## 2026-11-09 — Seller route and invariant documentation cleanup

- Removed false 'missing page' entries where seller application/status, product create/edit, warehouse operations, order details and conversation details are already integrated inline in `/seller`, `/seller/products`, `/seller/inventory`, `/seller/orders` and `/seller/messages`.
- Updated the 49-system page map and route registry to match the current seller routes, one-store-per-seller invariant, integrated order delivery details, and actual advertising route. Historical branch notes are explicitly marked as superseded where they contradicted current `main`.
- Added an E2E assertion that an existing owner account sees the one-store restriction notice. Existing seller journey also asserts the responsive navigation and product image preview open/close behavior.
- Commits: route registry `83b4bea98b0fba5b0648deccc8cbf3e4c923ac93`; absent-route cleanup `6bf8eef6c0c5c504fe1f59bfc5cae828322036c8`; system map `481e267d4373cb488ae70a293f7fd9610fe66c94`, `8808ac1e16a2dbc84199c5f1e3df2abeeda7fda9`; inventory cleanup `d656ab684b2baafda6b04c1f4d9da0017ed252eb`, `99fc2777fa4658232c9193c35eb8fe3dd4220a0e`; E2E one-store assertion `5a3e1375cb53f8c3cf6dbc999dbe590df6cdca8a`.
- The only reported commit status remains Vercel `build-rate-limit`; it does not provide a code build result. No local build, typecheck, lint, PostgreSQL or browser test was run in this GitHub-only session.
## 2026-11-09 — Seller store profile editing

- Added `PATCH /api/seller/stores/[storeId]` and `updateSellerStoreSettings` for the store name and URL slug. The service requires a current session, active seller/store, owner or exact-store `store:manage` grant, locks the store row, checks slug uniqueness and writes an audit event in the same transaction.
- Added an owner-facing edit form inside the existing `/seller` store card. It updates local workspace data through a fresh workspace read; no duplicate settings page or new Prisma model was introduced.
- Safety: the public slug can change while the store is DRAFT, but is locked once ACTIVE to protect customer links. Concurrent unique-slug conflicts return 409 rather than an unhandled server error. Policy/localization settings remain out of scope and are documented as remaining gaps.
- Commits: service `62fed371a4c02d20f0d5dc0c0cf397846fc64e83`; API `e87bda23976abdd6adbe0237142ae3a53bb87a0e`; lock/race/active-slug guard `b5adba5f801d6fa6f5129bfb8fb50c20fb8b588b`, `c0d88a75aaa6e9678c0f7d453bee8750d288116a`, `b408d6140e0db20fc9d8ccf626b49405e8ca79b`; workspace UI `46cd64c664ae79e9a14f56b8e6c0488b95e2f94f`; active URL field lock `ee323698792526701600c666d2c5cc5c0894b8c3`; inventory/registry/matrix `7aef0dc16032d043a138bda81c76f10ddfc7b102`, `7f1b53c54a417b4cf6a4eb425f29d93027b82750`, `5dc79a6d8ec20f02fcbcd50926d9eebd0f6eb65d`.
- Verification remains source-only; no local typecheck/build, browser run or disposable PostgreSQL transaction test was executed.
## 2026-11-09 — Seller store profile safety tests

- Added `tests/marketplace/seller-store-settings.test.ts` covering owner update + audit, active URL lock, exact-store permission denial for non-owners, and duplicate-slug rejection.
- Test source added but not executed in this session; TypeScript/Vitest results remain unknown.
- Follow-up E2E coverage also opens and closes the embedded store profile editor without mutating seeded data (`5ea32e292408824d678e4b91e416c7f7ed4a21e4`). The test remains unexecuted in this session.

## Seller inventory ledger — 2026-11-09

- Added a store-scoped backend query and GET /api/seller/inventory/movements, returning the latest 1–200 movement entries with stable newest-first ordering, product/SKU, warehouse, movement type, on-hand delta, quarantine delta, reference and note.
- Connected the seller inventory workspace to the endpoint and displayed the movement ledger alongside stock and transfer operations.
- Added focused service tests for store-scoped ledger reads and denial of another seller's store.
- Runtime CI, PostgreSQL integration and browser verification remain pending; this source-level addition is not marked production-verified.

## 2026-11-09 — Seller staff delegation hardening

- Closed a privilege-escalation path: the only currently assignable staff role is the broad `STORE_MANAGER`, so non-owner staff can no longer invite or revoke other staff. Team list/invite/revoke service operations now require the actual store owner; invite acceptance remains self-service for the invited account.
- The seller team UI no longer requests the protected team list for non-owners and instead explains that only the owner can manage team membership. Existing invitations remain visible and can be accepted by the invited account.
- Removed `store:staff:manage` from the seeded `STORE_MANAGER` grant and added seed cleanup for that legacy permission link. Least-privilege delegated roles are explicitly deferred rather than silently granting full manager access.
- Commits: service guard `964d3b455e5db0c3ef345de54d96394b751840ac`; team UI `49947a5a320f334b1cfdb14df828b01d543043e1`, JSX correction `5dfe2ee05c12277a1bf1a74555f94d69dc3dde87`; seed `faca43d6d910645d6515c74f212a30e07cf38cf8`; existing lifecycle tests updated `94ebc3adba864aea2603814f7f13fe83f50eedd2`; inventory/registry/matrix `70a616b6e35ec7c2bf817c13d51abf05b4ce6a67`, `652999d9d1375d0129c68a6297f1d5bb4e06a3a2`, `e17795a2912db17818b2291036c1ec0c440e56b1`.
- Source-level changes only; run focused staff lifecycle tests and the seller browser journey before marking this slice verified.

## Seller inventory quarantine inspection — 2026-11-09

- Added an idempotent store-scoped quarantine decision service and POST /api/seller/inventory/quarantine.
- RELEASE moves a requested quantity from quantityQuarantined into quantityOnHand; DISPOSE reduces quantityQuarantined without increasing sellable stock. Both decisions create an inventory movement and audit record in one serializable transaction.
- Connected the seller inventory page with warehouse, variant, quantity, decision and inspection-note controls.
- Added focused tests for release, disposal, insufficient quarantine balance and idempotent replay.
- Runtime CI, PostgreSQL integration and authenticated browser verification remain pending.

## 2026-11-09 — Seller commission statements

- Added `/seller/commissions` as a read-only view of immutable `CommissionTransaction` snapshots. It groups the latest 100 records by currency and shows order-item base amount, recorded commission rate/amount, product/SKU, order number and order status.
- API access requires a current session plus store ownership or an exact-store `orders:read` grant; queries constrain both store ID and the owning seller ID. The page explicitly states that these snapshots are not net seller balances, withdrawals or payout statements and do not include later refund/adjustment accounting.
- Added focused service tests for owner scoping, commission aggregation and non-owner permission denial. No payout actions or false available-balance claims were added.
- Commits: service `2d7c51c9af9dc1b8fee73e868e8b26d294774e3c`; API `12d24a2315b447bf9772dfe005387018fafd62bc`; store-scoped permission `8e838d20fd718b934e6781542949b9397d8296db`; page `63a6e3d354912c62be7e886191229b93f9b45839`; route `b51ca1697d3318363489ebf1db5059b1e893aaa3`; navigation `cf0e1e001cbc59a2e2375f537b7aeb472bd60c1f`; tests `e75697d189b98db615db1a49d0e0b786c5015290`; inventory/system map/route registry/matrix `a75e12c06bd2a7794c112d6da4627890c2dd6e30`, `1b1e74ea6e4aa68b6a3441299425db1edf94b2da`, `0bb493aec02313ae604d5845f9e626eccc4684f1`, `18145f7687f1227ce17c04f0fce57e5bfc847fe1`.
- Source and test code added; Vitest, TypeScript, browser and database checks remain unrun.
- Added a responsive seller E2E navigation assertion for `/seller/commissions`; this source test is not yet executed (`4f7c486d9c5b81f4dc84d3c9133c24175eb6afda`).

## Seller warehouse lifecycle management
- Added a seller-scoped warehouse update API for changing warehouse code/name and activating or deactivating a warehouse.
- Seller workspace now includes inactive warehouses so they can be reviewed and reactivated; operational selectors continue to show active warehouses only.
- Deactivation is deliberately non-destructive and is rejected while any on-hand, reserved, or quarantined stock remains, or while a draft/shipped transfer references the warehouse.
- Every successful change is recorded in the store-scoped audit log. Focused tests cover metadata updates, stock-blocked deactivation, and safe empty-warehouse deactivation.

## Seller physical stock count and reconciliation
- Added StockCountSession and StockCountLine records plus a migration. Each session snapshots on-hand quantity and the inventory row version (updatedAt) for every SKU in one warehouse.
- Sellers can open a count, enter and save each physical quantity, inspect per-SKU variance, and complete reconciliation from the inventory page.
- Completion requires every line to be counted, rejects inventory changed since the snapshot, and rejects physical quantities below active reservations. All inventory changes and adjustment movements commit in one Serializable transaction; movement idempotency keys prevent duplicate application.
- Count opening/completion are audit logged. A warehouse cannot be deactivated while a count is in progress. Completed count replay is authorized and does not apply stock twice.
- API routes: GET/POST /api/seller/inventory/counts, GET /api/seller/inventory/counts/[countId], PATCH /api/seller/inventory/counts/[countId]/lines/[lineId], and POST /api/seller/inventory/counts/[countId]/complete.
- Added an explicit cancel action for an unfinished count session. Cancellation is audited and never changes inventory; completed sessions cannot be cancelled.


## 2026-11-09 — Seller shipping address and dispatch contact editor

**Implemented on `main`**
- Added an owner-only shipping details form to the seller workspace.
- The form loads the selected store's persisted contact name, phone, address lines, city, region, postal code, ISO country code, and delivery/pickup instructions.
- Saving uses the existing `PATCH /api/seller/stores/[storeId]` endpoint and `updateSellerStoreSettings` service; no duplicate schema or API was introduced.
- Existing server-side validation, store ownership / scoped permission checks, transaction, and audit event remain authoritative.
- Switching stores reloads the form from the selected store rather than retaining the previous store's values.

**Commit**
- `3f7e63720414cb5d5067799761a402516774117a` — `Add seller shipping address and contact editor`.

**Verification**
- Confirmed `GET /api/seller/stores` already returns all shipping fields required by the form.
- Confirmed the existing store settings service persists and audits these fields, and focused service tests already cover saving the dispatch address.
- Exact-head CI currently reports only the Vercel `build-rate-limit` failure. No application build or browser test pass is claimed from this status.


## 2026-11-09 — Prevent stale seller data during store switching

**Implemented on `main`**
- Clear the prior store's inventory, shipping-rate list, analytics and recent orders as soon as the selected store changes.
- Prevent the previous store's metrics or operational rows from remaining visible while the next store's requests are in flight.
- Preserve the existing request cancellation guards so late responses from an unselected store cannot overwrite the current workspace.

**Commit**
- `c3f8091f4ad05972de69af1a26ca2a8664a9a666` — `Clear seller workspace data when switching stores`.

**Verification**
- Source-level effect/dependency review only. Exact-head CI is still constrained by the Vercel build-rate limit; no browser test or production build pass is claimed.


## 2026-11-09 — Seller catalog isolation on store changes

**Implemented on `main`**
- Clear the prior store's product list and edit session when the active store changes.
- Clear unsaved image drafts and revoke their object URLs so previews from one store cannot linger in another store's authoring session.
- Reset category attribute values and guard the product-list request with an effect-local active flag so a late response from the previous store cannot replace the current store's catalog.

**Commits**
- `5610b6ec0b8424c1dc77b30a115fd37967db47fc` — `Isolate seller product workspace when switching stores`.
- `7501031f037d94bac59ade31b798ebfc6ed0ecc6` — `Keep product preview cleanup safe during store changes`.

**Verification**
- Source-level request lifecycle review only. Exact-head CI and browser verification remain pending; no build/test pass is claimed.


## 2026-11-09 — Seller inventory store-switch isolation

**Implemented on `main`**
- Clear inventory rows, products, transfers, movement history, stock-count history, and any open count editor when the active store changes.
- Guard the combined inventory refresh with the effect's active flag so an older store's slower API responses cannot overwrite the selected store's data.
- Suppress stale stock-count request errors after a store switch.

**Commit**
- `4399ce0f4004e429039e9bcdfb12921e5e99078b` — `Isolate seller inventory data across store switches`.

**Verification**
- Source-level request lifecycle review only; exact-head browser and build verification remain pending.


## 2026-11-09 — Reset inventory controls with store context

**Implemented on `main`**
- On store changes, reset adjustment, quarantine, count, and transfer warehouse/variant selectors to IDs belonging to the newly selected store.
- This complements the inventory data clearing and stale-request guard, preventing a control from retaining a warehouse or variant identifier from the previous store.

**Commit**
- `d4bb4b606be05c7fdc7a247d40bdc158f7846533` — `Reset seller inventory selectors for the selected store`.

**Verification**
- Source-level state/dependency review only; browser verification remains pending.


## 2026-11-09 — Seller returns and order-tracking workflow cleanup

**Implemented on `main`**
- Seller returns now use one shared loader for initial load and post-decision refresh instead of maintaining duplicate fetch implementations.
- The returns page validates each store's selected receiving warehouse against the currently active warehouse list; a disabled/deleted warehouse is replaced by an active one, or cleared if none remain.
- Late returns responses are ignored after the page effect is disposed, and the page clears stale return rows before a fresh load.
- Seller order tracking events now refresh the order list in place rather than forcing a full browser reload.
- Shipment drafts are cleared after successful dispatch, and order/search changes clear stale rows and shipment drafts while the new query loads.

**Commits**
- `b9c97d3cb3b5594a0177c1c88972eea36ad08774` — `Unify seller returns loading and validate warehouse selection`.
- `b7854315a22e9ca622d09bde8e4ba13b4c6f39d6` — `Refresh seller order tracking without full page reload`.

**Verification**
- Source-level lifecycle and workflow review only. No browser or application-build pass is claimed.


## 2026-11-09 — Seller portal closeout verification

- Canonical source remains main; verified code/test head: a5bb22e212973be2f14c7c2fc8d7383ba7948a16 (Model active shipping rate state in tests). No feature branch or PR merge was used.
- Seller workspace now includes owner-only dispatch contact/address/instructions persisted on Store through the existing store-settings API. Audit metadata records changed field names only; private address and phone values are not copied into audit logs or public store serializers.
- Store context switching is hardened across seller workspace, catalog, inventory, orders, returns, shipping, advertising, messages and commission statements: stale data is cleared or guarded before late responses can overwrite the selected context.
- Staff invitation uses email; the accepted invitation grants the existing STORE_MANAGER role. Owner-only invite/revoke remains the safe boundary until least-privilege store roles are designed.
- Exact-head CI passed: Prisma validate/migrate/generate, TypeScript, ESLint, 109 test files / 540 tests, production build, API route security inventory, API authorization-boundary inventory and UI mutation-feedback inventory.
- Exact-head Platform PostgreSQL Integration passed. Exact-head Browser E2E passed 9/9, including seller workspace, product create/edit, shipping-rate edit and dispatch-address persistence.
- Seller portal scope is closed for the current navigation surface. Phase 5 overall remains partial (procurement/admin command center); seller payout execution remains Phase 6; live carrier integrations remain conditional. No Vercel deployment was performed.


## 2026-11-09 — Seller staff workspace stale-response protection

**Implemented on `main`**
- Added a monotonically increasing reload sequence to the seller team page. Only the latest workspace/invitation/staff response may update the UI; an older request is ignored after a newer reload or store selection.
- Clear the previous staff list immediately when the selected store changes, so membership rows from the previous store are not shown while the next store loads.
- Keep the server-side owner-only invitation/revocation and exact-store role assignment boundary unchanged.

**Commit**
- `e615975e9336c245c2ea916c1c3cc75edae79247` — `Prevent stale staff data across store switches`.

**Verification**
- Source-level request sequencing review only. No new browser/build result is claimed for this commit.


## 2026-11-09 — Scope seller dashboard recent orders before pagination

**Implemented on `main`**
- Added an optional `storeId` filter to `listSellerVendorOrders` and `GET /api/seller/orders`.
- The service still derives the actor's authorized store IDs from the authenticated session, ownership/staff membership and scoped permission checks first; the requested store is intersected with that allowlist and cannot widen access.
- Updated the seller dashboard to request recent orders for its selected store directly. Previously it fetched the latest 100 orders across all authorized stores and filtered those rows in the browser, which could hide a selected store's recent orders when another store dominated the global 100-row window.

**Commits**
- `8572827` — `Support authorized store-scoped seller order queries`.
- `4219c48` — `Expose store filter on seller orders API`.
- `2af3bc3` — `Load dashboard recent orders for selected store`.

**Verification**
- Source-level authorization and query-path review only. No build, test, PostgreSQL or browser result is claimed for these commits.


## 2026-11-09 — Seller product pricing and reproducible Prisma production build

**Implemented on `main`**
- Diagnosed the failing seller catalog browser journey from the prior `40af4c6` run. The create button validated the active per-variant market prices and also checked a legacy `marketPrices` state object that the current editor no longer updates. This duplicate stale-state check kept the button disabled even after every SKU price and image upload was valid.
- Removed the redundant legacy check. `variantPricesValid` remains the authoritative validation across every product variant and every market enabled for the selected store; the no-active-market guard remains.
- Added a browser assertion that the create-draft button becomes enabled after the SKU price and image-upload steps, before submitting the draft.
- Vercel build logs for commit `af18e1f` showed TypeScript errors caused by a Prisma Client generated from an older schema. The install log also showed Prisma lifecycle scripts were not automatically run. Added the npm `prebuild` lifecycle script to run `prisma generate` before `next build`; no secrets or Vercel project settings were changed.

**Commits**
- `8a895af` — `fix(seller): validate prices from product variants consistently`.
- `eaa3a68` — `fix(build): generate Prisma Client before production builds`.
- `8c64e75` — `test(seller): assert draft form is enabled after pricing and upload`.

**Verification**
- GitHub Actions CI on `8c64e752dd14a018b99fcf676980adce45ce8070`, run `42593700600`: **passed**. Prisma validate, migration deploy and generation passed; TypeScript and ESLint passed; Vitest passed **109 files / 542 tests**; the new `prebuild` generated Prisma Client successfully and the Next.js production build compiled and generated all 161 static pages.
- Browser E2E on the same commit, run `42593700583`: **passed 9/9**. The seller draft creation/edit journey now confirms the submit button is enabled after price and media upload. The Syria location journey passed through governorate, district, subdistrict and locality selection, and Leaflet wheel zoom.
- Platform PostgreSQL Integration on `eaa3a68`, run `42593616403`: **passed**.
- Vercel production deployment for `8c64e752dd14a018b99fcf676980adce45ce8070`, deployment `dpl_7wuxeidgqCPrnBTM3KocTQKp18eM`: **READY**. Build logs confirm `prebuild` ran `prisma generate`, Next.js compiled, and deployment completed. The earlier `af18e1f` failure was a real generated-client/type mismatch, not a build-rate-limit event.

**Remaining verification**
- `SyriaLocationPicker` sets neighborhood suggestion focus to zoom 16, and `LeafletLocationMap` applies the supplied focus zoom. The current browser journey verifies the administrative hierarchy and wheel zoom but does not yet make an explicit neighborhood-selection/zoom-16 assertion. Keep that as a focused follow-up rather than claiming it is browser-verified.
- Vercel/npm still emits non-blocking install-script and npm configuration warnings; they did not prevent the verified production build.


## 2026-11-09 — Seller shipping prices use customer-facing currency amounts

**Implemented on `main`**
- Changed the dedicated seller shipping form to accept normal major-unit prices (for example, `125.50`), rather than requiring sellers to enter internal minor-unit integers.
- The form resolves the selected market/currency pair and uses the shared BigInt-safe `toMinorUnits` conversion before calling the existing shipping API. Currency precision comes from the selected currency, not an assumed two-decimal format.
- Existing shipping rates are converted back to exact decimal input text for editing, and displayed with the persisted currency's own precision.
- Syria remains configured with SYP as the market base currency and USD as an enabled additional currency; sellers can select either enabled currency for a shipping service.

**Commit**
- `e0d3e54` — `fix(seller): enter shipping prices in major currency units`.

**Verification**
- Source and API-contract review only. No tests, build, browser, database, CI or deployment commands were run, as requested.

## 2026-11-09 — Seller dashboard shipping currency consistency

**Implemented on `main`**
- Updated the embedded seller dashboard shipping-rate editor to retain the rate's actual currency when editing, rather than silently switching every edited rate to the market default.
- Added a currency selector populated only from currencies enabled for the selected market, including SYP and USD for Syria.
- The editor now uses the selected currency's minor-unit precision for exact conversion and formats each existing rate using the rate's persisted currency precision. The dedicated shipping page remains the full shipping-management surface.

**Commits**
- `5a9e2ff` — `fix(seller): format shipping rates with their own currency precision`.
- `2a0bc18` — `feat(seller): select currency for dashboard shipping rates`.

**Verification**
- Source/API-contract review only. No tests, build, browser, database, CI or deployment commands were run.

## 2026-11-09 — Seller settings hub

**Implemented on `main`**
- Added a dedicated `/seller/settings` page using the seller workspace clay-style visual language.
- The hub links to existing persisted store profile/dispatch settings, full shipping management, notification preferences, account security and store team permissions. It deliberately reuses the existing routes and APIs rather than creating duplicate settings state or placeholder controls.
- Updated desktop and mobile seller navigation to open the dedicated settings hub instead of jumping directly to the store-management anchor.

**Commits**
- `d0205fe` — `feat(seller): add connected seller settings hub`.
- `f263218` — `feat(seller): expose seller settings route`.
- `c0060a9` — `feat(seller): link dedicated settings hub in navigation`.

**Verification**
- Source-level route/link review only. No tests, build, browser, database, CI or deployment commands were run.

## 2026-11-09 — Seller dashboard exact money display

**Implemented on `main`**
- Replaced floating-point conversion of recent seller order totals with the dashboard's BigInt-based minor-unit formatter.
- Large totals retain their exact stored digits and use the order's persisted currency code and minor-unit precision.

**Commit**
- `b00dfe9` — `fix(seller): preserve exact precision in dashboard order totals`.

**Verification**
- Source-level money-path review only. No tests, build, browser, database, CI or deployment commands were run.

## 2026-11-09 — Seller dashboard store-switch isolation for shipping edits

**Implemented on `main`**
- Switching the active seller store now clears the previous store's shipping-rate edit session, selected market/currency, price, region and delivery-window draft values.
- Prevents a shipping draft from the previous store being accidentally submitted against the newly selected store.

**Commit**
- `1404ebe` — `fix(seller): clear store-scoped shipping editor on store switch`.

**Verification**
- Source-level state-scope review only. No tests, build, browser, database, CI or deployment commands were run.

## 2026-11-09 — Seller business profile editing

**Implemented on `main`**
- Added owner-scoped `GET/PATCH /api/seller/profile` and a dedicated server service for active seller accounts.
- Sellers can update their public display name, contact person/email/phone, business address, description and social URLs. Legal name and verification-document references remain protected from self-service edits.
- Updates lock the seller row, validate the full payload, persist through Prisma and write an audit event containing changed field names without copying personal data into audit metadata.
- Added the editable business-profile form to `/seller/settings` with server-confirmed save feedback.

**Commits**
- `a68f89b` — `feat(seller): add audited seller profile service`.
- `8b6e2d8` — `feat(seller): expose owner-scoped seller profile API`.
- `343115c` — `feat(seller): add editable business profile to settings`.

**Verification**
- Source-level authorization, validation, transaction and UI wiring review only. No tests, build, browser, database, CI or deployment commands were run.

## 2026-11-09 — Seller profile external-link policy

- Aligned seller profile editing with the seller application security rule: public social links accept HTTPS only; non-HTTPS URLs are rejected by the server.
- Commit: `9dcb9b5` — `fix(seller): restrict public profile links to HTTPS`.
- Source-level validation review only; no tests or builds were run.

## 2026-11-09 — Seller profile API MFA error handling

- Mapped mandatory MFA enrollment and freshness failures to explicit 403 responses on the seller profile API instead of falling through to a generic 500.
- Commit: `cd9ff07` — `fix(seller): map MFA access errors on profile API`.
- Source-level route error mapping review only; no tests or builds were run.

## 2026-11-09 — Syria-first seller sales currency

- The seller dashboard now defaults its sales chart/selector to SYP whenever SYP sales are present, while preserving a seller's current currency selection and retaining all other currencies (including USD) in the selector.
- Commit: `af91e88` — `feat(seller): prefer SYP in seller sales overview`.
- Source-level currency selection review only; no tests or builds were run.

## 2026-11-09 — Seller product prices use customer-facing amounts

**Implemented on `main`**
- Seller product creation now accepts normal decimal prices for every SKU and enabled market instead of exposing internal minor-unit integers.
- The selected market currency determines the permitted decimal precision; the shared BigInt-safe `toMinorUnits` conversion builds the API payload.
- Optional compare-at prices use the same conversion and must not be lower than the selling price.
- Changing a SKU's currency clears both entered amounts to prevent accidentally reusing a numeric value in a different currency.
- The server API and Prisma money representation remain unchanged: persisted prices are integer minor units with an explicit currency code.

**Commits**
- `e18b3ca` — `feat(seller): enter product prices in normal currency units`.
- `b743be1` — `fix(seller): reset product price when currency changes`.

**Verification**
- Source-level editor validation and API payload review only. No tests, build, browser, database, CI or deployment commands were run.

## 2026-11-09 — Seller draft SKU price editing

**Implemented on `main`**
- Extended the seller draft-product update contract to accept all active variant IDs and one price per enabled store market.
- The server verifies exact active-variant membership, exact market coverage, active markets, enabled currencies and compare-at ordering inside the existing product update transaction.
- Product prices are upserted using the unique variant/market/currency key; a currency switch replaces the previous currency price for that market. Product and price changes share the same transaction and audit event.
- Seller catalog responses now include compare-at values and currency precision so the edit form can restore exact decimal values.
- Added SKU-by-market price controls to draft editing. Sellers can edit prices in normal decimal units; the UI converts to minor units with BigInt and clears amounts when currency changes. Both create and edit handlers enforce price validity before submission.
- Product edit authorization failures now return 403 rather than being reported as a generic bad request.

**Commits**
- `01c7669` — `feat(catalog): update draft variant market prices`.
- `cd41caf` — `feat(catalog): expose draft variant price snapshots for editing`.
- `5a5bbd7`, `cb53938`, `7526e03`, `f27e7c8`, `3b43bd6`, `95b9b4e` — seller SKU edit UI/state and payload.
- `f99cd23`, `9c1dfe2` — create/edit submit validation guards.
- `85d18d5`, `304118f` — product edit authorization error mapping.

**Verification**
- Source-level schema/service/UI contract review only. No tests, build, browser, database, CI or deployment commands were run.

## 2026-11-09 — Draft price edits honor current seller and market eligibility

- Draft product edits now require the seller to remain ACTIVE and the store not be SUSPENDED/CLOSED, matching draft creation eligibility.
- The price matrix is limited to markets currently enabled and active for the store's active country; every active SKU must retain one valid price per such market.
- Commits: `906bf03`, `62a20b6`, `e75008f`.
- Source-level lifecycle/market-scope review only. No tests, build, browser, database, CI or deployment commands were run.

## 2026-11-09 — Legacy seller profile compatibility

- The seller profile GET response now normalizes optional legacy contact/display fields to empty strings for controlled form inputs. Existing null values no longer produce uncontrolled-input warnings or break the edit form.
- Commit: `8465153` — `fix(seller): normalize legacy optional profile fields`.
- Source-level response-shape review only; no tests or builds were run.

## 2026-11-09 — Draft metadata edits when no active market is available

- Draft metadata/media edits are no longer blocked solely because a legacy store currently has no active market or no active SKU rows. In those cases the editor omits the optional price-matrix update rather than submitting an invalid empty matrix.
- Where active markets and variants exist, every price remains mandatory and fully validated.
- Commit: `8454af8` — `fix(seller): preserve draft metadata edits without active markets`.
- Source-level fallback review only; no tests or builds were run.

## 2026-11-09 — Seller commission statement accuracy

- Commission summary totals now aggregate every recorded commission snapshot for the selected store, grouped independently by currency. The transaction table remains intentionally capped at the latest 100 detail rows.
- Commission amount rendering now splits integer minor units with BigInt and formats localized currency parts without converting monetary values to floating-point numbers.
- The UI explicitly labels totals as all-time recorded snapshots and repeats that these are not seller net balances or withdrawable funds; refunds, adjustments, holds and payouts still require a real seller accounting ledger.
- Commits: `a2b4e41` (precision-safe currency formatting), `3e25c8e` (all-time grouped totals), `3d977a0` (truthful finance labels).
- Source-level review only. No tests, build, browser, database, CI or deployment commands were run.

## 2026-11-09 — Seller commission CSV export

- Added a CSV export for the seller commission view. It contains the all-time per-currency aggregates plus the latest 100 detail rows, with raw minor-unit values and currency codes preserved to avoid decimal rounding.
- Added CSV quoting and formula-injection guards for untrusted product/order text, and UTF-8 BOM/CRLF output for spreadsheet compatibility.
- Commits: `7c88b69` (export action), `95e28cf` (encoding and formula-guard correction).
- Source review only; no tests, build, browser, database, CI or deployment commands were run.

## 2026-11-09 — Seller commission history pagination

- Added stable cursor-based pagination to the seller commission API, preserving descending timestamp/ID ordering and store-scoped authorization.
- The seller commission page can load older rows in 100-record pages without replacing the all-time per-currency aggregates; CSV export includes the detail rows currently loaded and the all-time aggregates.
- The table now reports the number of rows actually loaded rather than implying that the first 100 rows are the complete history.
- Commits: `fffdfe5` (service cursor), `2e39f91` (API query), `c62294a` (load older UI), `90d4025` (loaded-row label).
- Source-level query/UI contract review only. No tests, build, browser, database, CI or deployment commands were run.

## 2026-11-09 — Seller finance: completed refund attribution

- Added store-scoped visibility of completed refund-item allocations. Each refund detail is attributed through RefundItem → ReturnItem → OrderItem → VendorOrder, so a multi-store customer refund is not incorrectly charged in full to every seller.
- Added per-currency all-time refund aggregates using a database-side grouped SQL query; the detail list is capped at the latest 100 completed allocations and clearly labeled.
- Added the refund details and all-time refund totals to the existing CSV export.
- Refunds are displayed separately from commission snapshots. They are not netted against seller earnings and do not imply a withdrawable balance or payout.
- Commits: `c7391ff` (store refund attribution), `686543b` (seller UI and CSV), `bc7fb08` and `521bce5` (full database-side totals and response correction).
- Source-level relation/scope review only; no tests, build, browser, database, CI or deployment commands were run.

## 2026-11-09 — Seller finance reporting follow-through

- Corrected the seller commission API to return database-aggregated all-time completed-refund totals, while keeping the detailed completed-refund list bounded to 100 rows.
- Updated the finance inventory and seller-facing wording so completed refunds are represented separately, without suggesting they have already been netted into seller earnings.
- Commits: `b391b5c` (inventory), `96622cc` (seller-facing accounting limitation).
- No tests, build, browser, database, CI or deployment commands were run.

## 2026-11-09 — Seller-managed public store branding

- Added Store description, logo URL and banner URL fields with a dedicated Prisma migration.
- Extended the owner/scoped store settings service with HTTPS-only image URL validation, persisted branding fields and audit metadata for changed public fields.
- Seller workspace now exposes and edits the store description, logo and banner URLs alongside the existing public name/slug controls.
- Public store lookup and `/stores/[slug]` now expose/render the seller-managed description, logo and banner; the description is also used for page metadata.
- Store branding image URLs are currently entered as HTTPS URLs. Integrated store-logo/banner upload and a reusable media library remain future work.
- Commits: `6a57654` (migration), `f4a7001` (Prisma model), `d5883f4` (settings service), `4f6f6b4` (workspace API), `44ab0c4` (public store query), `21dc742` (seller editor), `7828c4d` (public storefront rendering).
- Source-level schema/service/UI route review only. No tests, build, browser, database, CI or deployment commands were run.

## 2026-11-09 — Store directory branding

- Extended public store directory data with the persisted seller-managed description, logo and banner.
- Store cards now display the brand imagery and a short description, matching the public store detail header.
- Added logo/banner previews to the seller's store profile editor.
- Commits: `cc8f2e0` (seller editor previews), `e3f66d8` (directory query), `20a3207` (directory cards).
- Source-level review only. No tests, build, browser, database, CI or deployment commands were run.

## 2026-11-09 — Seller workspace visual and finance overview continuation

- Refreshed the seller navigation from dark navy to a pastel clay treatment, including desktop sidebar, mobile navigation, grouped active states and workspace callout surfaces.
- Aligned the seller topbar and store-settings hero with the lavender/mint/peach clay palette; added the correct settings and finance section titles.
- Added `/seller/finance` backed by existing store and commission APIs. It keeps currencies separate and displays commission-covered sales, platform commissions and completed refunds as distinct records.
- Added an explicit disclosure that this is not a payable balance. No invented payout balance or withdrawal action was introduced.
- Updated `PAGE_INVENTORY.md`, `PAGE_ROUTE_REGISTRY.md` and system 19 documentation.
- No tests, browser experiments, builds or deployments were run, as requested. Remaining seller finance work is the accounting ledger, holds, settlement/reconciliation, payout methods and withdrawals.


## 2026-11-09 — Seller media workflow and clay theme continuation

- Added store logo and banner file upload controls to the seller workspace profile editor. Uploads reuse the existing authenticated, store-scoped `/api/seller/products/media` endpoint, its file-signature/type/10 MB validation, Imgur client-ID rotation and configured ImageKit/Cloudinary fallbacks.
- Uploads stage the returned HTTPS URL in the editor; the seller must explicitly save the store profile to persist it. The save action is disabled during an active upload.
- Replaced the previous “upload can be connected later” message with the real workflow and updated seller page inventory. Asset-library indexing and provider-side deletion/replacement lifecycle remain open; removing a URL from the profile does not claim to delete the remote asset.
- Extended the pastel clay palette through the seller workspace dashboard, settings, product management, inventory, advertising, commission statements, questions, reviews and staff pages. Shipping, returns, orders and finance already use the updated palette family.
- No tests, builds, browser experiments or deployments were run.


## 2026-11-09 — Seller-managed public store policies

- Added nullable PostgreSQL text fields to Store for shipping/delivery, returns/refunds, privacy notice and terms of sale, with additive migration `20261109160000_seller_store_policies`.
- Extended the exact-store owner/staff settings service with strict 8,000-character validation, transactionally persisted policy values and audit field tracking.
- Exposed the policies to the seller workspace editor and public store detail serializer/page. Private dispatch-origin fields remain excluded from public output.
- Policy content is plain text with line breaks; localization/versioning and legal review workflows are not yet implemented. Sellers must not treat these free-text fields as legal approval.
- No tests, build, typecheck, browser session or deployment was run, per instruction to finish implementation before testing.


## 2026-11-09 — Seller store image lifecycle safeguards

- Store now persists provider storage keys alongside logo/banner URLs so temporary deletion can distinguish saved branding assets from unattached uploads.
- The shared temporary media DELETE route refuses deletion when the storage key is referenced by a store logo/banner or ProductMedia record.
- Seller workspace retains temporary delete tokens while the profile editor is open, supports removing logo/banner from the profile, cleans replaced staged uploads after save, and attempts cleanup on cancel. Saved branding references are retained; removal of a previously saved provider asset is still a separate lifecycle task.
- The existing provider rotation and upload endpoint remain in use. A full reusable media library and safe deletion of detached, persisted assets are not yet implemented.
- No tests, build, typecheck or browser run was performed.


## 2026-11-09 — Reusable seller store media library

- Added `StoreMediaAsset` and additive migration `20261109170000_seller_store_media_library`. The shared seller media upload endpoint now records store-scoped asset metadata for both product and store uploads, including URL, provider key, MIME type and dimensions.
- Seller workspace now loads the latest 100 media assets and provides reuse as logo/banner plus a scoped delete action.
- Added `DELETE /api/seller/stores/[storeId]/media`: requires owner or exact-store catalog management, checks saved branding and ProductMedia references, deletes the provider asset, then removes its library record and writes an audit event. Unsupported deletion leaves the asset record intact.
- Temporary upload deletion also removes the library record only after provider deletion succeeds. Product media cleanup now preserves an asset if it is still referenced by store branding and removes the library row only after successful provider deletion.
- No tests, build, typecheck, browser session or deployment was run.

## 2026-11-09 — Seller media-provider consistency

- Follow-up correction on main: ImageKit and Cloudinary product uploads now use the same store-scoped media-library persistence path as Imgur. The response includes the persisted asset ID and store-bound temporary-delete token.
- This prevents successful uploads from being absent from the seller's reusable media library and keeps provider metadata/deletion lifecycle consistent across configured providers.
- Commit: 24b60fbc0b1b0dcc3b3f3c7701349f6fcfc7e445.
- Per the current work instruction, no tests, build, typecheck or browser verification was run; these remain for the post-build verification pass.

## 2026-11-09 — Seller product image completion guard

- Product creation now blocks submission until at least one image has uploaded successfully; failed or in-progress uploads cannot satisfy the requirement.
- Product editing now prevents removing the final image unless a replacement has been added first. This aligns the save behavior with the product gallery's existing instruction that every listing needs a recognizable primary image.
- Commit: 945d8e7d2bdb8aedfd4775cd812161ae1e6ca5a7.
- No tests/build/typecheck/browser verification performed, per the current build-first instruction.

## 2026-11-09 — Seller order history pagination

- Extended the seller vendor-order list API with an opaque cursor and stable descending ordering by creation time plus ID.
- The server fetches one look-ahead row, returns at most 100 rows per page, and exposes `nextCursor` only when older records remain. Store authorization and search filters are applied before pagination.
- Added a seller-facing “Load older orders” action that appends subsequent pages without replacing the current list and avoids duplicate rows.
- Commits: 045163680f323b9808c0409004aea236822b27b8, 9f88cf5b4efdfe8d4bdf7fc4b80c0cfd0194b0da, 389ae27905eafb4ead14b2e5592b9d3f7da43d58, 3c974f2948610d4c433ce6d5d0bb93e9443c7d4b.
- No tests/build/typecheck/browser verification performed, per the current build-first instruction.

## 2026-11-09 — Seller inventory movement ledger pagination

- Replaced the fixed first-100 movement response with stable cursor pagination ordered by `createdAt DESC, id DESC`.
- The API retains store-scoped authorization, validates page size (1–200), fetches one look-ahead row, and returns `nextCursor` only when another page exists.
- The seller inventory workspace now appends older ledger rows without discarding the current page or duplicating entries, and exposes a load-more control.
- Commits: f572411fc8514e64daea3e53eb920a400d3aaa04, 58e55bad07e11bdf59f72cf777aee5b4f0898832, 27b18b709bfb18d32c0c378af5473e669293cb7d.
- No tests/build/typecheck/browser verification performed, per the current build-first instruction.

## 2026-11-09 — Seller inventory records pagination

- Removed the silent 500-row ceiling from the seller inventory workspace by adding stable cursor pages (500 rows) ordered by warehouse name, variant SKU, and inventory ID.
- The store-scoped API returns an explicit `items` collection and `nextCursor`, fetching one look-ahead row; the workspace appends older inventory rows while preserving the active search.
- Added a load-more control and loading/error feedback. Existing inventory summary calculations continue to use the rows currently loaded; the complete inventory list can now be traversed page by page.
- Commits: 9bc12e9080d102b54d6df5dbdcc75dc343af2a04, 639c128d6b13fa8621597b7ba55c92307536c0cf, e4e9961b74854f82c305fef6effb4ef688cc8075, 5150c8efe7f89ea4243a6d9d4a77757a4236c402.
- No tests/build/typecheck/browser verification performed, per the current build-first instruction.
- Compatibility follow-up: preserved the existing numeric-limit call contract for `listStoreInventoryMovements` while the seller API uses the new cursor-page contract, so existing service consumers retain array results. Commit: d6954a2cde5f673034f2f4bcee84735e607de1ff.

## 2026-11-09 — Seller shipping service lifecycle controls

- Added an owner/scoped-permission protected deactivation operation for seller shipping rates. It changes the existing rate to inactive rather than deleting it, preserving checkout selections and order history.
- The operation is transactional, conditional on the active state, idempotent for already-inactive rates, and writes a store-scoped audit event.
- Added `DELETE /api/seller/shipping-rates/[id]` with identity mutation protection and explicit authorization/conflict handling.
- Added a confirmation-based “Pause service” action to the seller shipping workspace; successful changes refresh the service list and preserve the existing edit/reactivation path.
- Commits: d202551f015cd69dc4ca2de7ded1c5cfa94575d0, bd03a74a26459cf57542a8e43c3e075f6df669cc, c89a7b7eaff859c2d5222e7d617f976b2c41e0d6.
- No tests/build/typecheck/browser verification performed, per the current build-first instruction.

## 2026-11-09 — Seller advertising campaign history pagination

- Replaced the seller campaign list's fixed first-100 response with stable cursor pagination ordered by `createdAt DESC, id DESC` and one look-ahead row.
- The store-scoped campaign API now accepts an optional cursor and returns `items` plus `nextCursor`; the advertising workspace appends older campaigns without duplicating already-loaded entries.
- Existing campaign creation, moderation transitions, activation, pause, archive, spend metrics, and invoices remain on their existing flows.
- Commits: c115c7b04a355ff070fb559f0da81f1833ce3456, 92912cf0a71ff7cfac88b6883a228cfb6839f15b, 8fd1edca64a1cede638b6f8b138939ddee1a9abe.
- No tests/build/typecheck/browser verification performed, per the current build-first instruction.

## 2026-11-09 — Seller advertising and shipping currency defaults

- Seller advertising campaign creation now selects SYP as the initial billing currency when that currency is enabled for the selected market; otherwise it safely falls back to that market's configured default. The same rule applies when changing markets.
- Seller shipping-rate creation now follows the same SYP-first/default-fallback behavior on initial load, store changes, market changes, and form reset. The full enabled-currency lists remain available, including USD wherever the market enables it; existing saved rate currencies are preserved when editing.
- Commits: 2dd13d4edaacf310f65573b72d5b5ab81c5b9e12, db0958476daa766ea7f17aeb29d4ccc0e5662068.


## 2026-11-09 — Seller staff invitation expiry and renewal

- Added nullable `SellerStaff.expiresAt` with additive migration `20261109180000_seller_staff_invitation_expiry`; existing pending invitations are backfilled to expire seven days after their original invitation timestamp.
- New invitations and re-invitations expire after seven days. Acceptance is rejected after expiry and uses a conditional update that also checks the expiry boundary, preventing a stale invitation from granting the Store Manager role.
- The invitee inbox excludes expired invitations; the owner team list shows expiry and offers a seven-day resend action for expired invitations. Re-inviting the same account renews the existing membership rather than creating a duplicate.
- Owner-only access, store scoping, transactional role grant/revocation and audit events remain enforced. The existing broad STORE_MANAGER grant is intentionally unchanged until granular permission roles are implemented.
- Commits: 4c95a4a (schema), 2cc7a61 (migration), c142fd2 (service enforcement), 51d9e62 (seller team UI).
- No tests, builds, typechecks, browser sessions or deployments were run, as requested.


## 2026-11-09 — Seller team least-privilege role controls

- Added `SellerStaff.roleId` with additive migration `20261109190000_seller_staff_roles`; existing memberships retain their prior broad `STORE_MANAGER` behavior through a backfill.
- Seeded five narrower store roles: catalog, inventory, orders, customer care and marketing. The full `STORE_MANAGER` remains available only as an explicit owner choice; the invitation form defaults to Catalog Manager.
- Invitation acceptance now grants the role selected by the owner, scoped to the exact store. Re-inviting an existing member clears the prior membership-owned grant before resetting the invitation.
- Added transactional role changes for pending/active memberships and `PATCH /api/stores/staff-memberships/[membershipId]`. Active role changes remove the previous scoped assignment, update SellerStaff.roleId, grant the new role and write an audit event atomically.
- The team page now displays each member's actual role and lets the owner change it; the API allowlists only the six store role keys.
- Commits: d837a8d (Prisma relation), 8dc790f (migration), 2bc96e4 (seed roles), 98ac5f4 (invite/accept/revoke role handling), 280a7b1 (invite API contract), d35f124 (accept role lookup correction), e7afb81 (transactional role-change service), cbd7857 (PATCH route), 321201a (team role editor).
- Updated system 22, route registry, model usage map and journey matrix. Run the identity seed before using the new roles. No tests, builds, typechecks, browser sessions or deployments were run.


## 2026-11-09 — Seller staff lifecycle edge-case corrections

- Owner revocation now also handles memberships in the SUSPENDED state; the team UI labels suspended members and prevents editing their role until reactivated.
- Updated the seller team documentation and page inventories to reflect the actual selected-role grant, role-change endpoint, and current remaining gaps.
- Commits: 6ea8d27 (suspended membership revoke), 34c573f (team UI status handling), 21a7c3e (staff API inventory correction), 54ac52e (page inventory), 7386733 (platform page inventory).
- No tests, builds, typechecks, browser sessions or deployments were run.


## 2026-11-09 — Seller accounting journal foundation
- Added `LedgerAccountType`, `LedgerAccount`, `JournalEntry`, and `JournalLine` to Prisma, with currency relations, scoped account metadata, unique idempotency keys and one-to-one reversal references.
- Added migration `20261109200000_seller_double_entry_ledger`: immutable update/delete triggers, positive one-sided line checks, and deferred transaction-commit integrity checks for at least two lines, equal debit/credit totals, and matching account/journal currencies.
- Added internal `postJournalEntry` service: validates integer minor-unit amounts, balanced totals, active same-currency accounts, deterministic idempotency-key reuse and exact inverse reversal lines; writes entries/lines in a serializable transaction.
- Added cursor-paginated immutable ledger-account activity reader. No API or seller balance/payout is exposed; the service is a foundation, not yet called from payment/commission/refund flows.
- Finance system documentation now records the remaining policy decisions: shipping/tax allocation, seller payable trigger, reserves/holds, chargebacks, clearing accounts and negative balances. Do not derive withdrawable balances from commission snapshots.
- Commits: 7c0d8f1 (Prisma ledger models), f8e77a6 (ledger migration), c0e56bc (posting service), d58d71c (deferred balance/currency constraints), b49745a (exact reversal validation), 69ee7c9 (seller team owner-authorization copy correction), finance docs and model map updated in this turn.
- No tests, builds, typechecks, browser sessions or deployments were run, as requested.


## Seller application feedback — 2026-11-09
- Updated `getSellerWorkspace` to retrieve only the authenticated seller's latest rejection audit event and expose its reason and review timestamp.
- Updated the seller application screen to show the reviewer's saved feedback before the resubmission form, so rejected applicants can correct the actual issue instead of guessing.
- Existing submission/resubmission rules remain unchanged; the rejection reason continues to come from the immutable audit history rather than duplicated mutable seller fields.
- Commits: `aa2f4bf7b74ea581ce5acc0c1a3fe85be08d3d19`, `19af62ffa077d9b28caf1fa8af864685b8998ed6`.
- No tests, build, typecheck, browser checks, or deployment were run, per project instruction.

- Follow-up trace updates: `44d7faea73e362aad2c423876a1be0943543a72a` (journey matrix) and `833ab080bc61995b64fe86e24ebfde939d1abcbe` (page route registry).


## Akaar seller application experience port — 2026-11-09
- Compared the active Akaar seller application flow (`app/seller/dashboard/dashboard-client.tsx`) with Matjar's seller workspace and confirmed the four core application stages are represented in Matjar: applicant/business details, product plan, map location, and private identity/social links.
- Ported the missing Akaar-style live seller profile preview and privacy explanation into Matjar's application layout. The preview reflects store name, applicant, legal name, contact email/phone, product categories, and business address as the form is completed.
- Kept Matjar's stronger domain requirements and integrations: verified-email gate, Matjar-owned private identity upload, Leaflet location selection, seller application API/service, Prisma-backed seller profile, and rejection feedback/resubmission.
- Changed file: `src/features/seller/workspace-page.tsx` — commit `0d8556487d20e5c7003d109ca0acbbd32bbafbb8`.
- No tests, build, typecheck, or browser checks were run, as requested.


## Akaar pending application review profile — 2026-11-09
- Ported Akaar's post-submission review experience: a seller with PENDING status now sees an explicit review state and their submitted application details instead of being routed into the active seller dashboard.
- Expanded the owner-scoped workspace query to return application fields needed by that view, including business/contact details, product plan, social links, coordinates and submission timestamp. Query remains scoped by the authenticated user's ownerId.
- Commits: service 195f2c7788401b38f2042e0a45c877b164196a36; UI bbca46ac134eb0b9b3ba6138a8aa892fa63bf648.
- No tests/build/typecheck/browser checks run, per instruction.


## Seller application POST compatibility — 2026-11-09
- Added the singular `/api/seller/application` endpoint as a compatibility alias to the canonical `/api/seller/applications` handler, so older clients or cached UI builds reach the same validated submission flow.
- The authorization checks remain unchanged: the request must pass same-origin validation, the user must have a valid session, and the account email must be verified before a seller application is accepted. A 403 from the canonical handler can therefore still indicate an origin mismatch or an unverified email; the response body carries the specific reason.
- No tests, build, typecheck, or browser checks were run, per instruction.


## Seller application MFA recovery flow — 2026-11-09
- Identified that `submitSellerApplication()` uses `requireCurrentSession()`, which correctly enforces mandatory MFA for already-approved sellers. The application API previously converted MFA policy exceptions into a generic 400, so the seller UI could not guide the account owner to the required step.
- The application route now returns explicit 403 codes for MFA enrollment and expired verification, with the correct account-security destination. No MFA enforcement was removed or bypassed.
- The seller workspace now recognizes both MFA states on initial load and on submission, and presents a direct setup/verification link that returns the user to `/seller` after completion.
- No tests, build, typecheck, or browser checks were run, per instruction.


## 2026-11-09 — Seller dashboard visual rebuild and store identity

**Implemented on main**
- Reworked the seller desktop sidebar to the deep navy reference treatment, with pastel icon tiles, bright active navigation, and matching mobile navigation.
- Shifted the seller workspace canvas and topbar to the cool blue-grey reference palette.
- Dashboard hero now uses the selected store's live banner, logo, name, and public description, with a direct owner action to edit the store.
- Added store-specific public phone and address fields to the Prisma Store model and migration; seller workspace loading, scoped settings validation, update persistence, and audit metadata include both fields.
- Added editable public phone and address fields to the existing store profile editor and displayed the saved public contact details on the customer-facing store page. Existing store logo/banner upload, preview, reusable media library, and save flow remain in place.

**Not yet verified**
- No tests, build, typecheck, or browser checks were run, as requested. The new migration has been committed but not applied to a database. Continue the remaining dashboard layout, chart presentation, and page-by-page seller experience before declaring the seller dashboard complete.


## 2026-11-09 — Seller reference design continuation

**Implemented on main**
- Added a seller-only design scope to the seller application layout so the reference palette can be applied consistently without changing customer or admin workspaces.
- Unified top-level seller page panels, forms, raised surfaces, borders, shadows, and typography around the cool blue-grey clay treatment.
- Restyled the seller settings page and topbar actions to the turquoise/blue-grey palette.
- Corrected the seller sidebar footer to remain consistently navy with readable contrast in the growth panel and marketplace link.
- Updated shared seller analytics chart cards and chart series to the reference's turquoise, sky-blue, mint, lavender, and warm pastel palette.
- Corrected store settings persistence so public phone and address values are written to Prisma, returned by the update operation, and included in audit change tracking.

**Not verified**
- No test, build, typecheck, migration application, or browser run was performed. Continue applying the reference design to the remaining seller pages and finish the seller dashboard before starting the requested later verification phase.


## 2026-11-09 — Seller feature-page visual consistency pass

**Implemented on main**
- Extended the seller-only clay surface system to shared surface, border, table, tab, form, and focus states used throughout the feature pages.
- Restyled inventory cards and sections from lavender-heavy panels to the reference blue-grey raised clay panels.
- Restyled advertising campaign creation and summary surfaces to the same palette.
- Updated finance overview hero and financial metric cards while retaining distinct pastel tones for at-a-glance financial categories.
- Aligned shipping primary actions with the turquoise action treatment.
- The CSS scope remains limited to the seller dashboard layout; it does not restyle customer storefront or admin surfaces.

**Not verified**
- No tests, build, typecheck, migration execution, or browser checks were run. This remains a visual consistency pass; seller page behavior and remaining dashboard details are still to be completed before the seller workspace is declared finished.

## 2026-11-09 — Reconcile seller-control branch updates onto main

- Reviewed `feat/super-admin-control-panel` against current `main`; the branch is substantially divergent and its old PR #69 was closed as superseded by merged PR #76. The branch's older seller product editor, store workspace, structured listing, shipping, and chart work must not be copied wholesale over newer main implementations.
- Confirmed current `main` already contains the current seller media endpoint, provider fallback (Imgur, ImageKit, Cloudinary), persisted store media assets, temporary-delete tokens, provider deletion, product editor, and store-scoped access checks. The branch's legacy `src/server/storage/product-images.ts` and older upload route were therefore not transplanted.
- Recovered the still-useful post-PR update: Turnstile now surfaces provider error codes, explains common retry causes in Arabic/English, and offers an in-place retry.
- Recovered typed seller-application conflict handling: active/suspended duplicate applications now return HTTP 409 rather than being reported as a generic client error. Existing email verification and MFA-specific response codes/action URLs on main were preserved.
- The branch's additional demo-seed expansion to 20 stores and its route test written against the older API contract were not copied: the former changes the local demo dataset materially, and the latter does not match the current main request schema and MFA response contract. No test, build, typecheck, or browser run was performed, per the current build-first instruction.

## 2026-11-09 — Seller dashboard visual and store-profile continuation

- Dashboard hero now surfaces the selected store's public phone as a tap-to-call link and public address as a visible contact chip; both values come from the existing store workspace data.
- Corrected the hero's `Edit store` action to navigate to `/seller#store-management`, the actual store profile editor, instead of the general seller settings page.
- Expanded the seller dashboard metric-card surfaces from four repeating gradients to eight distinct pastel treatments (mint, sky, lavender, peach, blush, blue, butter and green).
- Refined shared analytics chart cards with the same clay/pastel visual language and multicolor chart accents; line-chart points now use the existing chart palette.
- Re-themed the store profile editor, image upload panels and save actions to match the dashboard's blue-grey/mint palette while retaining the existing upload, preview, selection, delete-token and persistence flows.
- No tests, builds, typechecks or browser checks were run, as requested; visual and integration verification remains deferred until the seller dashboard build is complete.
- Sidebar business identity card now loads the authenticated seller's selected store name, URL slug and logo from the existing `GET /api/seller/stores` workspace endpoint; it honors the saved active-store selection and falls back safely when no store is available.


## 2026-11-09 — Selective recovery of remaining branch-only pages

- Rechecked the full feat/super-admin-control-panel tree against current main, rather than treating its 337-commit divergence as 337 missing features.
- Confirmed the branch's older Syria geography endpoint and bundled dataset are superseded by the current main geography hierarchy/locality APIs and database-backed reference data; its old product-location map is superseded by the current Syria location picker.
- Confirmed the branch's category-field preset implementation is superseded by the current category-attributes API and seeded Akaar category attribute data. Its legacy product image route/storage implementation is superseded by the current seller media API, three-provider upload path, persisted media assets, store-scoped permissions, and temporary-delete workflow.
- Restored the branch's useful bilingual About and Contact pages on main, adapting the contact page to the environment variables that actually exist in the current main schema. Added localized About and Contact links to desktop and mobile navigation.
- Did not copy the branch's R2 attachment implementation, demo-seed expansion, stale migrations, or legacy seller UI files. These either are not part of the current seller-media decision, would alter development data, or would overwrite newer main functionality. The branch's unused/inactive footer draft was not copied because it contains generic social destinations and service promises that are not configured as platform capabilities.
- No tests, build, typecheck, migration execution, or browser checks were run, per instruction.


## 2026-11-09 — Additional selective recovery from feat/super-admin-control-panel

- Reconciled every path present only in the old branch tree against current main. The three old seller/location migrations are superseded: current main already has the relational Syria geography and neighborhood schema, product location fields, structured real-estate details, and the one-store-per-seller migration. The old branch migrations were not copied because they would duplicate existing columns, indexes, constraints, or enums.
- The old bundled Syria JSON dataset and geography API are superseded by the current database-backed Syria geography tables, import workflow, paginated endpoints, and source-attribution documentation. The old category field preset module is superseded by the normalized CategoryAttribute/AttributeDefinition data model and Akaar import pipeline.
- The old branch product image storage module and product-location map are not copied: main has the current seller media API, provider fallback/rotation, durable media records, store-scoped authorization, temporary deletion flow, and current Syria location selector.
- Recovered the useful storefront footer concept from the branch, but adapted it for current main: localized marketplace/help/information links, current contact email configuration, and no inactive newsletter form, unconfigured social accounts, or unsupported payment/security claims. Mounted it in the root layout.
- The old seller listing operations note was not copied because it explicitly contradicts current provider rotation and fallback policy. The old QA execution/security reports were not copied as current evidence because they refer to a different code snapshot and could be mistaken for current verification results.
- No tests, build, typecheck, migration execution, or browser checks were run.


## 2026-11-09 — Recovered missing admin dashboard data contract

- A shared-file comparison exposed an important branch-only server change that had not reached main: the admin dashboard UI on main consumes metricSamples and orderStatusCounts, but the main dashboard service did not return either field.
- Ported the bounded, latest-20-record metric sample queries from the branch into the current main service and restored metricSamples plus orderStatusCounts in its response. Kept main's newer dashboard authorization, filters, aggregate metrics, and smaller recent-orders list; did not replace the current service wholesale.
- This is a targeted recovery of the dashboard data contract, not a claim that the dashboard has been tested. No tests, build, typecheck, migration execution, or browser checks were run.

## 2026-11-09 — Reconcile email verification from the retained feature branch

- Restored the password-registration email-verification lifecycle on top of the current main implementation rather than replacing its newer identity controls.
- New password registrations now create PENDING users and a single-use, SHA-256-digested verification challenge with a 24-hour expiry inside the registration transaction.
- The registration API sends the challenge through the existing server-only Resend adapter. Delivery failure returns an accepted registration state without exposing the raw token; users can request another message through the existing throttled, generic-response resend endpoint.
- Registration UI now directs users to the existing bilingual verification page. Password login refuses pending, unverified accounts and guides them to that page; verified accounts continue through the current conditional session-creation and MFA flow.
- Preserved the current main Turnstile validation, trusted-proxy IP handling, registration throttling, consent capture, seller-pending status, unique-email conflict handling, password policy, audit logging, and differentiated login errors.
- The old branch route/service versions were not copied wholesale because they predate the current hardened registration and login contracts.
- No tests, build, typecheck, or browser checks were run, per the current build-first instruction.

## 2026-11-09 — Advertising safeguards and currency-correct analytics

- Restored the seller campaign prerequisite found in the retained branch: the selected approved product must have at least one active variant with a price for the selected market and currency before a campaign can be created.
- Preserved main's stronger campaign activation schedule check, including both start and end bounds, and its market/store eligibility, targeting validation, positive-budget checks, transactional state changes, and audit events.
- Admin advertising analytics now include each currency's configured minor-unit precision. The dashboard formats spend and open invoice balances as actual currency amounts rather than displaying raw minor-unit integers.
- Retained main's more complete keyword matching and public search-budget enforcement; no older advertising delivery implementation was copied.
- No tests, build, typecheck, or browser checks were run.


## 2026-11-09 — Continued retained-branch reconciliation

- Re-reviewed the remaining seller API contracts for inventory, orders, shipping rates, staff, and seller applications. Current main retains the stronger server-side ownership checks, warehouse-aware inventory/transfer behavior, order state rules, store-scoped staff invitations, and seller application lifecycle; the older branch route variants were not copied.
- Re-reviewed the remaining customer/admin APIs for account profile, products, returns, coupons, search synonyms, locale, sponsored delivery, and scheduled jobs. Main's route contracts preserve the newer authorization, validation, rate limits, side-effect boundaries, and pagination/response behavior; no branch-only API behavior justified replacing them.
- Compared the seller workspace, products, inventory, advertising, staff, and returns pages. Main's versions are materially more complete and use the current clay dashboard design and APIs. The branch's shorter pages were not used as replacements.
- Compared catalog discovery, taxonomy, checkout quote, inventory stock, money utilities, identity request security, login throttling, AI assistant, environment configuration, and API audit tooling. Main retains stronger or newer behavior in these areas, including support-ticket context in the AI assistant, currency precision handling, current upload-provider configuration, and more comprehensive route-security auditing. The branch-only authenticated-action throttle helper has no corresponding demonstrated caller in the branch snapshot and was not copied as dead code.
- Removed one duplicate product-not-found guard in the current advertising campaign service while retaining the active-variant market/currency price prerequisite.
- The branch-only QA reports and old geography/product-listing artifacts remain excluded because they describe obsolete implementation snapshots or contradict current main architecture. No wholesale merge was performed; only changes with a current, demonstrable gap are recovered.
- No tests, build, typecheck, migration execution, or browser checks were run, per instruction.


## 2026-11-09 — Continued admin and customer-surface comparison

- Compared the remaining admin dashboard, seller/user/product moderation, commissions, coupons, categories, support, AI settings, product Q&A, and review-management pages. Main keeps the newer localized workflows and more complete current data contracts. The older branch's isolated catch-message differences and compact one-line UI handlers do not justify replacing the current pages.
- The current main admin dashboard already includes the chart suite (daily trend, order status, queues, distribution, scatter, box plot, and radar) and uses the restored service response; the branch's sparkline-heavy metric-card implementation was not transplanted over it.
- Compared customer support, support-ticket detail, wishlist, account profile/addresses, and storefront surfaces. Main retains newer API integration and current components; no branch-only behavior was found that warranted a source replacement in this pass.
- Reviewed CI workflow differences: main intentionally retains non-cancelling concurrency for quality/browser runs and broader path coverage; the branch versions are older. The branch-only dashboard demo seeder was not copied because it creates a large synthetic customer/order/payment/review dataset and depends on schema assumptions that have since evolved. It requires a separately designed, isolated demo-fixture workflow before reuse.
- No tests, build, typecheck, migration execution, or browser checks were run.

## 2026-11-09 — Continued storefront, account, checkout, and order reconciliation

Compared the remaining account, seller messaging, storefront, cart, checkout, and order surfaces against the retained `feat/super-admin-control-panel` snapshot.

- Kept the current account address editor and normalized country-code contract in `main`; the branch page is a reduced earlier implementation with fewer address fields and a different country response shape.
- Kept the current profile page, which consumes the dedicated account analytics API and renders the existing metric chart, rather than restoring the branch's direct customer-order analytics fetch.
- Kept seller messaging in `main`, including loading the seller's available stores and handling store selection; the branch assumes a single locally persisted store without the current store-loading/error lifecycle.
- Kept the current storefront routes. The main product route adds not-found handling and sponsored-campaign integration; the store detail route is materially more complete, with current catalog controls and store reviews.
- Kept the main cart, checkout, delivery-address, shipping-option, tax-summary, and order components. The current versions consistently use the centralized minor-unit money formatter and toast feedback, and preserve the current quote/shipping/tax contracts.
- Kept the main order detail and seller-order pages, which contain additional current workflow and analytics behavior. The main order route also preserves the payment-return query state.
- Reviewed shared auth journey and chart components. Main's auth journey preserves richer registration-notice states and return-path handling. The branch chart palette is an older orange/neutral palette; it was not copied over the current shared dashboard palette because the active clay theme is already applied across current surfaces.
- The product-detail branch file is longer, but length alone is not evidence of a safe improvement. Its differences are tied to older client-side contracts; current main component remains integrated with the current storefront services and shared money formatting.

No source changes were warranted by this batch. No tests, builds, typechecks, or browser checks were run, in line with the requested build-first workflow.

## 2026-11-09 — Continued configuration, schema, and shared-component reconciliation

Compared the retained branch versions of environment documentation, package scripts/dependencies, Prisma schema, API-route audit tooling, and global theme styles.

- Kept `main`'s expanded `.env.example`: it documents the current geography, media-provider, mail, AI, marketplace, and security configuration surface beyond the older branch snapshot.
- Kept `main`'s package manifest and lockfile. The branch manifest predates current scripts and dependencies for the relational geography/category-attribute workflows and current media/service integrations.
- Kept the current Prisma schema. Main includes additional platform, audit, advertising, seller, geography, listing, and operational models/relations absent from the branch schema. Replacing it would discard current persistence contracts.
- Kept the current API-route audit script. Main recognizes the current public geography and category-attribute read routes and the broader set of security evidence patterns used by current APIs.
- Kept the current centralized theme and global styles. Main contains the active clay/pastel token system and shared design variables; the branch's longer global stylesheet includes obsolete Leaflet-global styling and older theme aliases. No global CSS replacement was justified.
- No source changes were warranted by this batch. The comparison remains a selective reconciliation, not a wholesale branch merge.

No tests, builds, typechecks, or browser checks were run, in line with the requested build-first workflow.

## 2026-11-09 — Implementation-plan consistency reconciliation

- Compared the remaining identity, buying, seller/admin phase plans, end-to-end delivery standard, and demo catalog seed documentation.
- Found and corrected a stale identity-plan statement that still described immediate activation without email confirmation. The plan now reflects the current pending-account, token-digest, 24-hour verification, email-delivery, and pre-session verification lifecycle implemented in main.
- Kept the main buying and end-to-end journey plans, which include newer operational status and acceptance criteria than the retained branch.
- Kept the main seller/admin plan, including the current seller-portal closeout scope and explicit remaining work packages.
- Kept the main demo catalog seed documentation. The branch describes a larger multi-store fixture, but it is not safe to restore its assumptions without reconciling the current seed implementation and schema; the synthetic demo-dashboard seed remains deferred.
- This batch corrected documentation only; it did not change runtime behavior.

## 2026-11-09 — Final retained documentation, storefront, and workflow sweep

- Reconciled the remaining README, page inventory, AI assistant plan, seller system specifications, admin layout, AI assistant UI, storefront grid/home/review components, and CI workflow differences.
- Kept the canonical README and page inventory on main; their scope/status references reflect later implementation work than the branch snapshot.
- Kept the main AI assistant plan and UI, which document and integrate the current server assistant context and security constraints. The branch plan still describes the earlier feature-branch rollout state.
- Kept the main seller system specifications, which have expanded scope/status and clearer boundaries for finance/payouts, promotions, analytics, and scoped staff permissions.
- Kept main's admin layout and storefront components. Their current versions retain the canonical permission/session guards, sponsored placement integration, currency-aware price formatting, and current customer purchase/review eligibility contract.
- Kept main CI workflow enhancements: API authorization-boundary and UI mutation-feedback inventories are generated and uploaded alongside route-security evidence. The branch workflow omits these audit artifacts. Existing workflow concurrency and test execution definitions were not changed.
- Confirmed that the three branch-only geography/listing migrations and legacy geography, map, category-field-preset, and product-image storage files are superseded by the current main schema/services and media/geography architecture. They must not be copied as standalone artifacts.
- Classified branch-only QA reports and execution logs as historical evidence for an earlier code snapshot, not current verification. Branch-only test files are deferred because the requested validation phase has not started. The old seller-listings operations guide conflicts with the current media-provider fallback and listing contracts. The branch-only `vercel.json` is intentionally not adopted.
- The branch-only demo-dashboard seeder remains deferred; it needs a new isolated fixture design against the canonical schema and must not be restored as a production-capable seed command.
- No runtime source changes were warranted by this sweep. No tests, builds, typechecks, or browser checks were run, in line with the requested build-first workflow.
## 2026-11-09 — Retained branch tree inventory and legacy-artifact disposition

Re-read both recursive Git trees at the current refs after the prior documentation sweep.

- main was a6779626b42a60d10fb370d4de675bfc598e5857; feat/super-admin-control-panel was 9235f48ff81781a057e759251cf43d8d72654066. The retained branch head was unchanged.
- The tree inventory contains 816 files on main and 738 on the retained branch: 181 shared paths have different blob contents, 104 paths exist only on main, and 26 paths exist only on the retained branch. These are file-tree counts, not a claim that 181 files remain unreviewed; many shared-path differences were reconciled in the preceding focused reviews.
- Classified all 26 branch-only paths:
  - 3 old geography/listing migrations: superseded by the current main schema and migrations; do not replay.
  - 1 old Syria geography API, 1 bundled geography dataset, 1 geography README, and 1 old product-location map: superseded by the current relational geography and location-picker implementation.
  - 1 old category-field preset helper: superseded by normalized category attributes and definitions.
  - 1 old product-image storage service: legacy Imgur/ImageKit-only upload implementation; superseded by the current seller media workflow and provider fallback/rotation. Do not restore its old API contract.
  - 8 QA inventory/results/execution documents: historical evidence from an earlier snapshot, not current verification and not suitable as a current status report.
  - 6 branch-only test files: deferred to the explicitly postponed validation phase; their old contracts must be reconciled before any reuse.
  - 1 seller-listings operations guide: conflicts with the current listing/media contracts.
  - 1 vercel.json: intentionally not adopted.
- The 104 main-only paths are retained as main's newer implementation surface; their presence is not a reason to import branch snapshots over them.
- No additional runtime source change was justified by this inventory pass. No tests, builds, typechecks, migration execution, or browser checks were run, in line with the requested build-first workflow.
## 2026-11-09 — Final security redirect and contact configuration reconciliation

- Rechecked the admin shell against the retained branch and the current platform-session policy. Main already defines a dedicated StepUpRequiredError and a dedicated /mfa/verify page, but the admin layout caught the superclass MfaVerificationRequiredError first and sent fresh platform-admin step-up requests to the general account-security screen. Added an explicit StepUpRequiredError branch before the superclass handler, preserving the requested admin return path and directing the user to the dedicated step-up verification screen. Kept main's additional ads:moderate permission in the admin-area permission set.
- Reconciled the branch's dedicated CONTACT_EMAIL setting. Added it as an optional validated environment value, documented it in .env.example, and made the contact page prefer CONTACT_EMAIL while retaining RESEND_FROM_EMAIL as a backward-compatible fallback. This keeps the public contact address independent from the transactional sender address.
- Rechecked seller messages, seller questions, seller reviews, auth return-path helpers, login/register pages, notifications, and seller/customer order surfaces. Main keeps current multi-store selection, registration/email-verification and error-code handling, toast feedback, notification preferences/delivery visibility, currency-aware formatting, and richer order/shipment context. No branch snapshot was copied over these integrations.
- These are focused source/configuration reconciliations; no tests, builds, typechecks, migration execution, or browser checks were run, per the requested build-first workflow.
## 2026-11-09 — Retained branch reconciliation closeout inventory

- Reconciled the current shared-path difference inventory against the focused API, service, seller, admin, customer, storefront, identity, checkout, order, notification, theme, schema, CI, and documentation reviews recorded above. The branch's older snapshots were not allowed to overwrite newer main contracts. The two newly identified useful differences (dedicated platform-admin step-up routing and a separate public contact email) have now been carried into main.
- Final branch-only inventory is 26 paths: 10 documentation files (1 geography/category design note, 1 seller-listings operations guide, and 8 historical QA documents), 3 superseded migrations, 4 superseded geography/map data or route artifacts, 1 superseded category preset helper, 1 superseded product-image service, 6 legacy test files held for the later validation phase, and 1 unneeded Vercel configuration.
- The six deferred test files are not runtime features to merge. Their old assumptions/contracts must be reconciled against current main before they can be adopted during the validation phase; none were executed or copied as current evidence.
- No wholesale merge of the historical branch is appropriate: its branch-only runtime files and migrations are superseded, while main already contains the newer implementation for the relevant capabilities. This closeout is a selective reconciliation of retained improvements, not a claim that the two Git refs are identical.
- No tests, builds, typechecks, migration execution, or browser checks were run, per the requested build-first workflow.

## 2026-11-09 — Revalidated retained seller-control branch against user-confirmed source of changes

The user clarified that their actual workstation changes were pushed to `feat/super-admin-control-panel`; therefore, branch differences must be treated as candidate user work and reviewed for functional intent rather than dismissed based on file age or line count.

- Rechecked the latest branch head `9235f48ff81781a057e759251cf43d8d72654066` against current `main` `f50a2bc059fa3fa10bbf1dc21f162bfb13748b63`.
- Reconfirmed seller product and workspace pages on `main` are the newer integrated implementations; the branch copies are older and do not replace them.
- Reconfirmed the branch's legacy `/api/seller/products/images` handler and `src/server/storage/product-images.ts` are superseded by the current canonical seller media API, provider rotation/deletion, temporary upload-delete tokens, and persistent store media library already on `main`. Do not copy the legacy uploader over the current media system.
- Reconfirmed branch seller-application conflict handling and Turnstile retry UX are already present on `main`.
- The branch adds a larger local demo fixture (20 stores / 200 listings) compared with the current four-store fixture. This is development seed data, not a missing production workflow; it remains a candidate for a separate schema-aware seed enhancement and is not copied blindly.
- The branch registration form presents an inline post-registration confirmation and resend flow, while `main` routes to the dedicated verification page, which already provides resend handling. Preserve the current dedicated verification lifecycle unless a specific UX gap is established.

No runtime code was copied in this reconciliation pass because the inspected branch implementations were either already represented by stronger current-main functionality or were optional seed-data expansion. No tests, builds, typechecks, or browser checks were run, per the user's instruction to defer validation until implementation is complete.

## 2026-11-09 — Ten-file reconciliation batches 1–3

The retained workstation branch `feat/super-admin-control-panel` is being reviewed in fixed batches of ten shared changed files. Each batch is compared against the current canonical `main`; only compatible missing behavior is carried forward.

### Batch 1 — environment, CI, README and architecture inventories
- Reviewed `.env.example`, the three workflow files, `PAGE_INVENTORY.md`, `README.md`, the AI plan, and the platform page/system/Prisma maps.
- No branch-only behavior was missing from main. Main retains the stronger current environment/provider configuration, expanded API authorization audit and workflow path coverage, non-cancelling CI concurrency, latest route inventory, and current architecture contracts.
- No branch content was copied from this batch.

### Batch 2 — implementation plans, journey contracts and seller-system notes
- Reviewed `BUILD_LOG.md`, demo seed guide, end-to-end journey matrix/standard, route registry, Phase 2/4/5 plans, repository source-of-truth, and seller dashboard system notes.
- Main documentation is materially newer and more accurate for verified-email registration, saved-address lifecycle, one-store-per-seller enforcement, current seller pages, store policy/media settings, finance boundaries, and the actual merged PR dispositions.
- The branch's demo catalog expansion was retained as a concrete candidate and carried forward separately in batch 3. Obsolete registration and multi-store statements were not copied.

### Batch 3 — seller finance/marketing/staff docs, package, schema, seed and account address page
- Reviewed `docs/systems/19-seller-finance-commissions-and-payouts.md`, `20-seller-marketing-and-promotions.md`, `22-seller-staff-and-scoped-permissions.md`, `next-env.d.ts`, `package-lock.json`, `package.json`, `prisma/schema.prisma`, `prisma/seed.cjs`, `scripts/audit-api-routes.cjs`, and `src/app/account/addresses/page.tsx`.
- Main retains the newer financial/refund/accounting, advertising and store-staff documentation; current lockfile/dependency pins and seed scripts; expanded Prisma models and safeguards; stricter API route audit; and full address lifecycle UI. The branch schema is older and omits current main models and constraints, so it was not copied.
- **Carried forward:** the branch's compatible demo catalog expansion. The main seed now provisions 20 isolated demo seller/store fixtures and 10 active products per store (200 total), with all eight top-level categories represented in each store. Existing category-based legacy demo listings are demoted to DRAFT/PENDING during the demo seed so the active storefront does not show duplicate legacy listings. The final seed verification checks exactly 20 configured stores and 10 approved/published products covering all eight categories per store.
- Updated `docs/implementation/DEMO_CATALOG_SEED.md` to match the new fixture counts. The explicit demo-database URL, production prohibition, environment opt-in and database-name marker safeguards were preserved.
- **Not carried forward:** the optional branch dashboard fixture and `db:seed:demo-dashboard` script. Its long fixture implementation was authored against an older schema and must be separately mapped to current main's models and lifecycle invariants before it can safely create orders, payments, returns or support records. The branch's 10-line address page was superseded by main's full create/edit/default/delete lifecycle.

Commits added to canonical main during these batches:
- `44042de` — expand the isolated demo seed to 20 stores / 200 products.
- `2f0822f` — document the expanded demo fixture.

No tests, builds, typechecks, or browser checks were run, per the user's instruction to defer validation until implementation is complete.

## 2026-11-09 — Ten-file reconciliation batches 4–6

### Batch 4 — account profile, admin access and protected admin APIs
- Reviewed account profile page/API, admin layout, coupon routes, return review route, search-synonym routes, sponsored-ad route and login route.
- Main has the current private account analytics contract, explicit permission error types, the `ads:moderate` admin permission, mutation/request boundaries, and normalized sponsored-ad filter handling. Branch profile charts call the broad orders API and are superseded by the dedicated aggregate account-profile API. No branch code copied.

### Batch 5 — registration, categories, cron workers and public catalog/returns APIs
- Reviewed registration, category discovery, advertising invoice worker, checkout-expiry worker, notification delivery, support SLA, locale mutation, product detail/listing and customer return creation routes.
- Main preserves the verified-email registration response contract, optional empty-category behavior, fail-closed cron-secret handling without configuration disclosure, same-origin locale/return mutation checks, typed permission mapping and defensive JSON parsing. The branch's extra GET handler for advertising invoice generation would trigger a state-changing invoice worker through GET; it was intentionally not added. No branch code copied.

### Batch 6 — seller APIs, store staff, contact and global styles
- Reviewed seller advertising, seller applications, inventory, orders, legacy product-image endpoint, shipping-rate create/update, store staff invitation, contact page and global CSS.
- Main APIs retain cursor pagination, exact store selection, richer seller application fields, canonical media-route delegation, shipping-rate deactivation and typed authorization/validation handling, plus email-based invitations with least-privilege roles. Branch versions are narrower/older.
- Main global styles are scoped to the current seller dashboard and clay primitives. The branch stylesheet contains broad global selector overrides and legacy map styling; importing it would risk overriding current storefront/admin styling and was not done.
- Contact configuration on main preserves the explicit `CONTACT_EMAIL` preference and null-safe fallback.

No additional runtime files were copied from batches 4–6. No tests, builds, typechecks or browser checks were run, per the user's instruction to defer validation.

## 2026-11-09 — Ten-file reconciliation batch 7

Reviewed `src/app/layout.tsx`, buyer order detail, product detail, seller messages, public store detail/directory, theme tokens, AI assistant, auth journey notice and shared data charts.

- Main retains the latest shared layout, payment-return context on order detail, server-rendered product metadata and sponsored placements, store branding/policy surfaces, and the current theme palette.
- Main seller messages resolves the store list from the authenticated seller API rather than trusting a client-side localStorage store ID.
- Main AI assistant extends the branch's product/order/return answers with support-ticket lookup and the current privacy controls; no branch-only feature was missing.
- Main auth journey reflects the verified-email lifecycle and provides a verification/resend link. The branch's immediate-signed-in notice is obsolete under the current registration policy.
- Main chart colors match the current pastel dashboard theme; no chart or theme CSS was replaced.
- No runtime code copied from this batch.

## 2026-11-09 — Ten-file reconciliation batch 8

Reviewed Syria location picker, footer, navigation, customer Q&A/returns/reviews/support/ticket/wishlist pages, and admin navigation.

- Main Syria picker is the current relational-geography + Leaflet implementation; the branch component is a shorter legacy picker backed by the superseded bundled geography data.
- Main footer/navigation are the maintained implementations with current public policy/contact links and safe auth-return behavior. The branch footer contains extensive commented-out legacy markup; its navigation copy does not improve current auth-aware links.
- Main customer return/review/support/ticket/wishlist pages include mutation toasts, refund visibility, and guest-wishlist merge feedback that the branch versions lack.
- Main admin navigation includes current Brands and Refunds destinations absent from the branch.
- No branch runtime code copied from this batch.

## 2026-11-09 — Ten-file reconciliation batch 9

Reviewed admin AI settings, catalog product management, categories, commissions, coupons, dashboard, product Q&A moderation/reports, product moderation and returns pages.

- Main customer/admin mutation surfaces have success/error toast feedback missing from the branch versions.
- Main commission UI uses the shared BigInt-safe `formatMinorUnits` utility; the branch duplicates conversion logic and should not replace it.
- Main dashboard retains currency-safe formatting and the complete operational chart sections. The branch additionally renders a compact chart in each of the 20 metric cards using `metricSamples` already returned by the current main dashboard service.
- **Carried forward:** merged the branch's mini-chart concept and 20 metric-to-sample mappings into the current main dashboard page. The main page keeps its safer shared money formatter, filter behavior, current chart sections and operational links. All 20 cards now show a small colored chart sourced from the existing PostgreSQL aggregate/sample response; no schema or API change was needed.

Commit: `9d3b584` — add colorful metric charts to admin dashboard cards.

## 2026-11-09 — Ten-file reconciliation batch 10

Reviewed admin reviews, search synonyms, seller moderation, store reviews, support, user detail, cart, checkout address, checkout review and shipping options.

- Main includes toast success/error feedback across admin and checkout mutations, richer seller-application detail and private identity-document presence, and more complete current support/moderation workflows.
- Main cart/checkout/shipping surfaces use shared `formatMinorUnits` for exact currency precision rather than converting integer minor units through floating-point `Number` arithmetic. This is a money-integrity safeguard; branch implementations were not copied.
- No branch runtime code copied from this batch.

## 2026-11-09 — Ten-file reconciliation batch 11

Reviewed checkout tax, identity login/register, notifications, buyer orders/order detail, seller orders, seller advertising, inventory and product authoring pages.

- Main checkout tax uses exact BigInt comparisons for coupon discounts and shared minor-unit formatting; branch floating-point conversions were not copied.
- Main identity UI maps typed login errors (including email-not-found, unverified email, incorrect password and rate limiting) and routes successful registration to the dedicated verification lifecycle. Branch inline resend calls a retired endpoint and duplicates the current verify-email page's resend workflow.
- Main notification pages have toast feedback. Buyer order detail includes the post-payment return context and retry/poll behavior while preserving shared currency formatting.
- Main seller orders has cursor pagination, status metrics and the expanded paid-order address/shipment context. Main seller advertising has cursor pagination, stale-store response protection and Syria's SYP-first currency choice. Main inventory includes movements, quarantine and stock-count workflows. Main product authoring includes normalized category attributes and current media lifecycle; the branch uses superseded category presets and map model.
- No branch runtime code copied from this batch.

## 2026-11-09 — Ten-file reconciliation batch 12

Reviewed seller questions, returns, reviews, staff, workspace and storefront catalog grid/home/product detail/product reviews/sponsored product card.

- Main seller Q&A retains answer edit + moderation resubmission + answer history, while adding question/answer analytics and toast feedback; the branch is not functionally ahead.
- Main seller returns/reviews include stale-store response protection, warehouse scoping, refund/return detail and analytics. Main staff includes email invitations, scoped role selection, invitation expiry/renewal and stale-request protection. Main workspace includes current store branding, provider storage keys, public policy fields, private dispatch address and current market/currency/location workflows.
- Main storefront cards and home/product detail use the shared minor-unit money formatter. The branch product detail uses the superseded product-location-map and older product response shape; main keeps relational location metadata and sponsored content in the current server-rendered flow.
- No branch runtime code copied from this batch.

## 2026-11-09 — Ten-file reconciliation batch 13

Reviewed auth return helpers, environment/money utilities, saved-address service, admin catalog/dashboard/seller/user services and advertising campaign service.

- Main uses stricter/current email and provider configuration, BigInt-based money parsing/formatting, serialized single-default address-book mutations, richer admin seller application detail, current brand CRUD, expanded dashboard samples, and cursor-paginated seller campaigns. Branch service implementations are older/narrower.
- **Carried forward:** `currentReturnPath()` now consults the safe persisted auth return destination when already on `/login` or `/register`. This closes the branch-identified case where a remembered destination could be ignored when the auth page had neither a `returnTo` query nor a usable referrer. Existing URL validation remains in force.

Commit: `396cfd4` — restore saved return path on auth pages.

## 2026-11-09 — Ten-file reconciliation batch 14

Reviewed AI assistant, cart, catalog discovery/product/taxonomy, checkout quote, login throttling, password login, MFA and registration services.

- Main AI assistant includes privacy-bounded customer support-ticket lookup; the branch lacks this current tool.
- Main cart, catalog discovery and checkout quotes subtract quarantined inventory from sellable stock. Branch availability checks ignore quarantine and were not copied.
- Main product service uses current normalized category attributes, relational catalog/location fields and provider-aware media deletion. Branch geography JSON/map/category-preset assumptions are superseded.
- Main taxonomy supports the current includeEmpty filter contract. Main login preserves pending-registration verification while allowing established active accounts to remain compatible; branch strict emailVerifiedAt requirement would block legacy active accounts. Main MFA only treats active seller profiles as privileged; branch would treat any seller record as privileged.
- Carried forward: the branch authenticated upload abuse limit. Added consumeAuthenticatedActionAttempt to the current persistent throttle service and applied a limit of 20 seller product image uploads per user per 15-minute window to the canonical /api/seller/products/media route. The route returns 429 with Retry-After: 900; throttle-store failure fails closed with 503. The legacy image endpoint remains a delegate to this canonical route.

Commits: d61b568 (authenticated action rate-limit helper), f8bc131 (seller image-upload rate limit).

## 2026-11-09 — Ten-file reconciliation batch 15

Reviewed request security, inventory stock, public stores, seller application, store staff, buyer/seller orders, payment processing/provider registry and returns.

- Main inventory uses cursor pagination and quarantine-aware sellable quantities. Main public store serializers expose current branding and seller-managed public policies while keeping private dispatch data out of public responses.
- Main seller application captures the complete applicant/business profile and private identity-document reference; branch application service is a reduced legacy contract. Main store staff uses owner-only invitations with selected least-privilege roles, expiry and renewal; the branch's delegated manager pathway relies on a permission/role grant not present in the current canonical role set and was not copied.
- Main order services include store-scoped cursor pagination, delivery address privacy and safe cancellation when payment attempts are only failed/cancelled. Main payment webhook processing prevents late success events from overwriting refund/dispute states; the branch does not preserve that boundary. Main provider registry also wires the configured Stripe adapter.
- Main returns service includes refund state/amount summaries; branch omits this current buyer-facing data.
- No additional runtime code copied from this batch.

## 2026-11-09 — Ten-file reconciliation batch 16

Reviewed seller shipping configuration and admin/dashboard, advertising, cart and catalog service tests.

- Main shipping service uses validated decimal-string minor units, explicit permission errors, editable activation/deactivation and non-destructive shipping-rate deactivation. The branch's older service omits current activation semantics and was not copied.
- Main admin dashboard service now exposes 20 per-metric sample series and the UI renders those samples in every metric card. Carried forward the branch's compatible dashboard tests for the 20 sample series and order-status counts.
- Carried forward compatible advertising coverage for active market/currency product pricing, matching category/brand targets and currency-precision analytics. Added the missing combined category+brand delivery query case.
- Did not carry forward the branch's advertising cron GET test: the invoice worker mutates billing state and must remain POST-only. Did not copy the branch's old seller/user/cart/catalog test assumptions where main now enforces private identity-document handling, admin status reasons, quarantined stock and relational catalog/media models.
- Test files were updated only; no tests were executed, as requested.

Test-coverage commits: `e1a0fac`, `f8a85ab`, `f265dea`, `27039c7`.

## 2026-11-09 — Ten-file reconciliation batch 17

Reviewed environment, API security E2E, marketplace E2E, auth return, auth routes, current return path, Google ID token, login, MFA policy and registration tests.

- Main API-role and marketplace E2E suites are substantially broader and cover current seller navigation, one-store-per-account, shipping and store-profile behavior; branch E2E copies are older and were not copied.
- Main Google ID token tests exercise the current nonce/JWKS verification contract. Main login/MFA tests preserve compatibility for active legacy accounts and require active seller status for privileged MFA policy; branch expectations would change current access policy.
- **Carried forward:** the current-return-path test for a saved sessionStorage destination; registration tests for the pending user + hashed, single-use email-verification challenge; auth-route tests for successful verification email delivery and the 202 accepted response when delivery fails; and the CONTACT_EMAIL validation test.
- The branch's registration-notice helper is not part of the current main verification UX. Its tests were not copied. The branch's Vercel-derived APP_URL and blank-CRON_SECRET tests were not copied because main deliberately uses explicit APP_URL configuration and treats a malformed non-empty secret as a configuration error.
- Tests were updated only; no test execution or browser checks were performed.

Test commits: `6d5d3f8`, `7d77d07`, `c48c72c`, `606877c`.

## 2026-11-09 — Final six-file reconciliation batch 18

Reviewed locale, seller application/store creation, store staff, order management, payment lifecycle and shipping tests.

- Main locale tests use the response Set-Cookie header and current same-origin mutation guard; no branch change required.
- Main seller-application tests cover the expanded application profile, verified account email, one-store-per-seller enforcement, duplicate/replay behavior and concurrent same-slug recovery. Branch store-creation tests target the older reduced seller/store model.
- Main store-staff tests intentionally enforce owner-only invitations and prohibit delegated managers from escalating roles; branch delegated-manager expectations conflict with the current owner-only policy.
- Main order tests correctly allow cancellation after all payment attempts are failed/cancelled while blocking active/successful attempts; branch's blanket refusal is overly restrictive.
- Main payment lifecycle tests additionally preserve partial-refund state against late/replayed success webhooks. Main shipping tests cover current store-scoped CRUD, authorization, currency/market matching and audit events.
- No branch test or runtime code copied from this batch.

This closes the final six shared changed paths in the current tree inventory. The branch is not merged wholesale; compatible user changes have been selectively reconciled into main, and superseded differences remain intentionally excluded.

## 2026-11-09 — Final retained-branch reconciliation inventory

Final Git tree comparison after the 18 review batches:
- Canonical main HEAD before this final log update: `cb9d0acbeb39459036f314a0bf6bd5c98a4dccb1`.
- Retained workstation branch HEAD: `9235f48ff81781a057e759251cf43d8d72654066`.
- Main: 816 blob files; retained branch: 738 blob files.
- Shared paths: 712; shared paths with different content: 176; branch-only paths: 26; main-only paths: 104.
- All 176 shared changed paths were reviewed in 18 batches (17 batches of ten and a final six-file batch). The five paths that became byte-identical through selective reconciliation no longer count as changed in the final tree comparison.
- All 26 branch-only paths remain classified: 10 documentation/QA artifacts, 3 superseded migrations, 4 superseded geography/map artifacts, 1 superseded category-preset helper, 1 legacy image-storage service, 6 historical tests deferred to validation, and 1 ignored Vercel config. No unclassified branch-only runtime file remains.
- Selectively retained missing user changes on main: 20-store/200-product demo catalog, per-card admin dashboard charts, persisted auth return destination handling, authenticated product-image upload throttling, and compatible test coverage for dashboard samples, advertising targeting/analytics and email-verification lifecycle.
- Main remains the sole source of truth. The historical branch was not merged wholesale and remains untouched. The 176 remaining content differences are intentional: main's newer/safer implementations, superseded branch behavior, or documented exclusions—not an outstanding queue of files to blindly copy.
- Validation remains deferred exactly as requested: no tests, builds, typechecks or browser checks were executed.

## 2026-11-09 — Ten-file reconciliation batch 16

Reviewed shipping service and nine admin/advertising/cart/catalog test files.

- Main shipping service is newer: it supports safe rate deactivation, optional active/inactive edits, currency minor-unit metadata, permission-denied semantics and case-insensitive destination matching. Branch shipping accepts coercive BigInt input and lacks deactivation; it was not copied.
- Admin dashboard tests are identical. Main seller tests additionally assert that the private identity-document file ID never leaks and only a boolean presence flag is exposed. Main user tests cover pending holds, audit reasons and session revocation. Main catalog/cart tests additionally cover quarantined stock and the current media/category/location schema. Main advertising delivery tests cover multi-category targeting; branch-only GET cron tests are intentionally excluded because invoice generation is a state-changing worker and main exposes only POST.
- **Carried forward:** the branch introduced a valid case where an approved campaign is activated before its future start date. This is safe because delivery remains gated by `startsAt <= now` in the sponsored-campaign query and event recorder. Main activation now rejects only campaigns whose end time has passed; it still requires approval, valid funding and a valid market/currency. Added the branch's regression case to the main advertising campaign test source without executing it.

Commits: `b158689` (allow scheduled campaign pre-activation), `885f3e2` (regression case).

No tests/build/typecheck/browser checks were run, per user instruction.

## 2026-11-09 — Ten-file reconciliation batch 17

Reviewed environment parsing, API-route security and marketplace E2E specifications, auth-return and auth-route tests, Google ID-token tests, login/MFA tests, PostgreSQL identity integration coverage and inventory stock tests.

- Main API security E2E suite is broader and includes buyer/seller role-boundary probes; main marketplace E2E suite covers the current seller dashboard, store profile and shipping journeys. Branch tests are older and narrower.
- Main auth route/login tests reflect the current public error contract, admin holds and session revocation. Branch tests assert retired registration/login response shapes. Main MFA policy correctly requires enrollment only for ACTIVE seller profiles, not pending applications.
- Main Google token tests cover additional issuer/audience/nonce/key validation cases. Main inventory tests cover stock counts, quarantine, transfer state and current movement constraints; branch suite predates these models.
- Both the retained branch and current main use pending registration followed by single-use email verification before login. The current main identity integration coverage is aligned with that lifecycle; branch-only tests were not copied because main has newer coverage and schema contracts.
- **Carried forward:** normalize an empty optional CRON_SECRET environment value to undefined, matching other optional secrets and avoiding startup failure when deployment configuration supplies an empty value. Added a focused environment test source. The branch's Vercel-preview URL derivation test was not imported; deployment-platform behavior remains outside the requested reconciliation scope.
- The branch's inline registration-complete and resend-verification UI was not initially carried over; the dedicated verify-email page remained available in main. On 2026-11-09 the inline confirmation/resend experience was selectively restored in `src/features/identity/register-form.tsx`, reusing main's throttled `/api/auth/verification/resend` endpoint. Main's stronger login error handling and current server-side identity controls were retained.

Commits: `919f4eb` (normalize optional cron secret), `f964e3a` (environment regression case).

No tests/build/typecheck/browser checks were run, per user instruction.

## 2026-11-09 — Final six-file reconciliation batch 18

Reviewed locale, seller application, store staff, order management, payment lifecycle and shipping test files.

- Main locale test checks secure HttpOnly cookie flags while mocking the current origin guard; the branch cookie-object assertions are less compatible with the framework response API.
- Main seller-application tests cover the full required applicant profile and current one-store-per-seller invariant. Branch tests exercise the older minimal application payload and pre-current store creation behavior.
- Main store-staff tests enforce owner-only team administration, email invitations, exact identifier validation and prevention of manager privilege escalation. Branch delegated-manager expectations conflict with the current least-privilege policy.
- Main order tests allow cancellation only after all payment attempts are failed/cancelled; branch rejects cancellation after any historical payment attempt. Main payment tests also protect partially-refunded states from late webhook success events.
- Main shipping tests cover the current owner-scoped rate lifecycle and deactivation; branch tests target the older service contract.
- No additional branch runtime/test code copied from this batch.

This completes the review of all 176 shared paths with differing blob hashes between the retained branch and main as inventoried at the start of the 18 review batches. The branch-only paths and main-only paths are separately inventoried in the reconciliation sections above; obsolete legacy migrations, geography artifacts, old image storage, old test suites and Vercel configuration are not to be restored over current main.


## 2026-11-09 — User-directed removal of email verification

The platform account policy is now explicit: email verification is not required after password registration or before password sign-in.

- Password registration creates an immediately ACTIVE customer account after the existing Turnstile, trusted-IP/email throttling, input validation and Terms/Privacy consent checks. No email-verification token is created and no verification email is sent.
- Seller registration creates an ACTIVE user account while the associated Seller application remains PENDING; no seller permissions are granted until the platform approves the application.
- Password login no longer returns an email-verification failure. Legacy PENDING accounts with no administrative hold are activated only after a correct password is verified; SUSPENDED, DISABLED and administratively held accounts remain blocked.
- Seller application submission no longer requires `emailVerifiedAt`.
- Registration UI confirms that the account is ready and links directly to sign-in. Login no longer redirects to `/verify-email`; the legacy page now explains that email confirmation is not required.
- MFA for privileged access, password hashing, session protections, login/registration throttling, Turnstile, audit logging and seller approval controls remain in place.
- Existing verification endpoints and legacy token-consumption support are retained for compatibility, but are no longer part of the new-account registration or sign-in path.
- Tests/build/typecheck/browser checks were not run, per user instruction. Existing identity and seller-application test expectations must be updated before the deferred validation phase.

## 2026-11-09 — Port platform theme and administrator navigation from super-admin branch

- Reconciled the platform-wide charcoal/graphite and orange visual token palette from `feat/super-admin-control-panel` into `src/app/theme.css` on `main`.
- Ported the branch's shared global surface, control, hover, selection, and form styling into `src/app/globals.css`, while retaining the dedicated seller-dashboard reference skin and seller map styling from the current `main` implementation.
- Added a role-gated Control panel link to the desktop header and mobile navigation. Admin accounts route to `/admin/dashboard`; Super Admin accounts route to `/admin/control-panel`. Ordinary customers and sellers do not receive the link.
- No tests, build, typecheck, or browser validation were run, consistent with the current instruction to finish implementation before testing.

## 2026-11-10 — Reconcile OpenSyria geography and automatic map zoom

- Reviewed the geography implementation on `feat/super-admin-control-panel`: pinned OpenSyria `v0.1.5` data, hierarchical governorate/district/subdistrict/locality selection, and Leaflet animated map focus.
- Confirmed `main` already contains the same capability using the canonical PostgreSQL-backed geography tables and the pinned importer `scripts/sync-syria-geography.mjs`, rather than the branch's duplicate bundled JSON dataset and parallel `/api/geography/syria` endpoint.
- Confirmed the seller product create and draft-edit forms both render `SyriaLocationPicker`; selected locality IDs, neighbourhood fields, city/district labels and coordinates are passed into product create/update payloads.
- Confirmed map focus animates at each hierarchy level: governorate (zoom 7), district (10), subdistrict (12), locality (15), and selected nearby neighbourhood suggestion (16). Manual map pin placement remains available.
- Retained the existing `main` implementation instead of copying the branch's duplicate route/data/map component, preserving its provenance validation, DB-backed pagination, existing neighborhood-candidate safeguards, and product edit hydration.
- No tests, build, typecheck, or browser validation were run; those remain deferred as requested.

## 2026-11-10 — Akaar-inspired dashboard chart refresh
- Refreshed the shared chart presentation in `src/components/data-charts.tsx` with a deep graphite/navy glass surface, vivid amber/violet/sky/emerald/pink palette, stronger contrast, cleaner grid lines, and clearer labels.
- This shared component is used by the seller workspace and the admin dashboard's advanced analytics, so both receive the visual refresh without changing their API requests, chart datasets, calculations, filters, or empty states.
- The existing monthly Akaar-style admin bar charts remain intact; this change focuses on the shared chart cards that had a different, less vibrant visual treatment.
- No tests, builds, or browser checks were run, in line with the current instruction to finish implementation before testing.

## 2026-11-10 — Platform localization audit and fixes
- Audited the 88 application page routes and traced route wrappers to their shared feature components; the public storefront, account, seller, and admin surfaces use the shared Arabic/English locale provider and server-preferred locale for server-rendered routes.
- Added selected-language UI translations to admin order detail, payment detail, product approvals, refunds, returns, seller/product moderation, search synonyms, shipment detail, and store-review moderation pages.
- Localized the Matjar AI assistant interface and suggestions, and made its direction and request locale follow the selected language rather than inferring the language from each message.
- Localized Syrian geography picker error fallbacks so English API errors do not leak into the Arabic interface.
- Corrected the old registration journey notice: it no longer tells users to verify email or resend a verification message. It now reflects the current policy that users can sign in immediately without email verification.
- Localized page metadata for seller commissions, seller finance, AI assistant settings, and the informational email-verification route.
- Kept API contracts, authorization, business logic, and stored data unchanged.
- No tests, builds, or browser checks were run, consistent with the instruction to defer testing until implementation is complete.
- Added a shared `translateStatus` helper for common order, payment, return, refund, and shipment states, and applied it to the affected admin detail/finance screens so enum values do not remain in English when Arabic is selected.


## 2026-11-10 — Repair seller product geography selectors
- Changed geography API reads in `SyriaLocationPicker` to bypass stale browser cache entries and validate the returned JSON shape before using it.
- Added complete pagination for district, subdistrict and locality choices instead of silently showing only the first 100 localities.
- Removed the unnecessary locality preload when a governorate is selected; district choices now load first, followed by the next level after the seller selects a district.
- Added explicit empty-state messages for missing governorates, districts, subdistricts and localities, plus a clear instruction when the database has not been populated with the pinned OpenSyria dataset.
- Fixed loading state cleanup when a seller clears a hierarchy selection, and corrected Arabic error-message detection.
- Added `npm run db:seed:all` to run the existing seed, import the pinned official geography hierarchy, and then import Akaar-derived neighbourhood candidates (which remain unverified suggestions); documented that these are explicit database operations and must run against the same `DATABASE_URL` used by the app.
- This is a source-level repair only. The GitHub integration cannot inspect or seed the user's live PostgreSQL database. No tests, build, typecheck, or browser checks were run, consistent with the deferred validation instruction.


## 2026-11-10 — Searchable map location selection
- Added a server-side geocoding endpoint at `/api/geography/search` backed by OpenStreetMap Nominatim, returning validated coordinates and human-readable place labels with Arabic/English result localization and server-side caching.
- Added a search interface directly above the seller product location map. Sellers can search by street, neighbourhood, city, address or landmark, choose among matching places, and the map flies to the selected coordinates while the selected location is saved through the existing product location payload.
- Added a browser geolocation action so a seller can use the device's current location when permission is granted; the resulting marker remains draggable and can be fine-tuned on the map.
- Added minimum/maximum query validation, bounded result count, request timeout, service error states and a one-request-per-second process guard for the public Nominatim service.
- No tests, builds, typechecks, or browser checks were run, consistent with the current instruction to defer validation until implementation work is complete.


## 2026-11-10 — Seller workspace layout and contrast correction
- Reworked the seller shell canvas to a clean neutral background and stabilized the desktop sidebar as a fixed-height, non-overlapping flex column with its store identity and growth card kept inside the sidebar; the navigation list now owns the available scroll area.
- Raised the sidebar stacking order above the seller top bar and changed the top bar from sticky positioning to a normal in-flow header, preventing the header from visually floating across the sidebar.
- Improved seller dashboard content gutters and hero grid sizing so the store name, description and primary actions stay within the main content column and wrap cleanly instead of intruding into navigation space.
- Corrected low-contrast white labels on pastel lavender and mint action buttons in the seller dashboard, product management, store settings and shipping pages. Dark text is retained on light surfaces; white text remains only on dark surfaces and dark overlays.
- No tests, builds, typechecks, or browser checks were run.


## 2026-11-10 — Restore complete Damascus neighbourhood suggestions
- Removed the importer rule that discarded Akaar neighbourhood candidates whenever their Arabic name also existed in the official OpenSyria locality gazetteer; this could remove core Damascus neighbourhoods such as Al-Mazzeh and Kafr Souseh.
- Changed the neighbourhood API to return the full candidate list for the selected governorate, optionally sorting it by distance from the selected map point without filtering out distant neighbourhoods.
- Changed the seller location picker to load neighbourhoods immediately after governorate selection, even before a map point or locality is selected, and to label the list as governorate-wide suggestions.
- Kept Akaar-origin entries clearly marked as unverified suggestions because the source mixes neighbourhoods and nearby towns; they are not represented as official administrative divisions.
- After pulling this commit, run npm run db:sync-syria-neighborhoods against the same DATABASE_URL used by the app. The importer is additive and will insert newly retained records without deleting existing ones.
- No tests, builds, typechecks, or browser checks were run.


## 2026-11-10 — OpenSyria-only geography and seller portal audit
- Reaffirmed OpenSyria Data Geography v0.1.5 as the sole structured Syrian geography source (14 governorates, 62 districts, 272 subdistricts, 7,605 localities).
- Removed the Akaar-derived neighbourhood suggestion importer and its source JSON from the runtime data pipeline. OpenSyria does not publish a separate verified neighbourhood directory; neighbourhood is now only an optional seller-entered text label.
- Removed the legacy SyriaNeighborhood Prisma model and Product.neighborhoodId relation, with a migration that preserves existing product.neighborhood text by copying the legacy suggestion name where needed before dropping the old relation/table.
- Replaced external Nominatim map search with search over imported OpenSyria localities, subdistricts, districts and governorates. Exact street-level placement remains controlled by the user's map pin.
- Removed the legacy neighbourhood API branch and Akaar geography import command from package scripts and browser workflow.
- Began a page-by-page seller workspace review; no tests, builds, typechecks, or browser checks were run.

- Added a separate seller-entered exact street-address field to product location data; it is persisted independently from OpenSyria's official locality hierarchy and from the optional neighbourhood label.

- Added `Product.streetAddress` (500 characters) as a separate seller-entered exact address field in product create/edit, with a Prisma migration; it remains distinct from OpenSyria locality IDs and the optional neighbourhood label.
- Seller portal review fixes: confirmed the existing topbar product search query hydration and removed a duplicate search-state effect; active-store changes refresh the sidebar store identity; message sending/loading now has explicit busy/error states; Q&A and reviews are localized and use consistent readable surfaces; seller order currency formatting follows the selected locale; product analytics/status labels and seller/store status labels are translated.
- Seller portal scope review covered Overview, Products, Orders, Inventory, Shipping, Returns, Messages, Questions, Reviews, Advertising, Finance, Commissions, Staff, Store Settings, mobile/desktop navigation, and loading/error boundaries.
- Outstanding by design: seller withdrawals/payout methods and seller payable balances are not implemented. The accounting journal foundation is not yet connected to captured payments/refunds, and settlement/hold/chargeback policy is not approved. Do not calculate or label commissions/refunds as an available-to-withdraw balance. See `docs/implementation/SELLER_WORKSPACE_AUDIT.md`.
- Completed remaining seller localization pass for inventory movement/transfer statuses and return order references; seller dashboard styling retains dark readable text on pale clay surfaces and white text only on dark surfaces.


## 2026-11-10 — Payment provider control-center specification
- Reviewed the current payment implementation: Stripe is registered from server environment variables; `Payment` and `PaymentWebhookEvent` already exist; `/admin/payments` inspects transactions and is not a provider-management console; the public provider discovery route lists compiled adapters.
- Added `docs/architecture/PAYMENT_PROVIDER_CONTROL_CENTER.md` defining provider setup, edit, enable/disable, market/currency/method availability, connection verification, audit history and archive lifecycle.
- Security invariants: disabled providers stop new checkout only; signed webhooks and reconciliation for historical/in-flight payments remain operational; provider identifiers map only to compiled allowlisted adapters; provider records are archived rather than physically deleted.
- Specified AES-256-GCM credential encryption, key versioning/rotation, secret masking, Super Admin-only server-side authorization, recent MFA for live-mode changes, and audit logging without secret material.
- This commit adds the implementation specification only. No provider configuration model, credential storage, admin API/UI, migration, tests, build, or live payment changes are claimed or performed. Those implementation steps must follow the security prerequisites in the specification.

## 2026-11-10 — Locate and integrate the Cartoon PayPal flow

- Located the original PayPal implementation in `waelkamira/cartoon` after searching the user's accessible repositories; `cartoon_cloudflare_repo12` did not contain it.
- Reviewed the Cartoon order route, browser button, subscription page, payment-success component, user update route and subscription-expiry component. The old flow trusted browser-supplied plan/email values, captured in the browser, and granted subscription through an unauthenticated email-based user update. Its subscription UI is currently commented out. These unsafe mechanics were not copied.
- Added the Matjar server-only PayPal adapter at `src/server/payments/providers/paypal.ts` using OAuth credentials and the PayPal Orders v2 API. The server creates the order from the persisted Matjar amount/currency, validates the buyer approval URL, captures the approved order server-side, and converts PayPal amounts to the platform's integer minor units.
- Added `src/app/api/payments/paypal/return/route.ts` to capture after buyer approval and pass the result through the existing payment lifecycle. The existing generic webhook route verifies PayPal signatures through PayPal's verification API and accepts capture completed/pending/denied events only after verification.
- Extended environment validation and `.env.example` with server-only `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, and `PAYPAL_MODE`; the registry exposes PayPal only when the full configuration is present. The existing buyer order page already discovers configured providers dynamically, so no separate checkout button implementation was needed.
- Reused existing `Payment`, `PaymentWebhookEvent`, owner-scoped intent creation, idempotency and verified payment transaction logic. No Prisma schema or migration was needed.
- Added `docs/implementation/PAYPAL_INTEGRATION.md` with source findings, required environment setup, webhook subscriptions and explicit limitations. Updated the payment-provider specification and System 29 documentation.
- Remaining gates: owner supplies sandbox credentials and configures the webhook; supported markets/currencies and merchant eligibility must be approved. The Super Admin persistent provider-management center remains separate work. No live payment was attempted. No tests, builds, typechecks or browser checks were run, consistent with the deferred-validation instruction.

## 2026-11-10 — Payment provider control center, first implementation tranche

- Added `PaymentProviderConfig`, `PaymentProviderEnvironment` and `PaymentProviderConfigStatus` to Prisma, with a forward-only migration for encrypted credential storage, test/live environment, country/currency/method allowlists, display order, verification metadata and archive lifecycle.
- Added `PAYMENT_PROVIDER_ENCRYPTION_KEY` validation (exactly 32 bytes represented as 64 hex characters) and documented it as an independent runtime secret that must not be stored in PostgreSQL or source control.
- Added a server-only provider management service using AES-256-GCM with a fresh nonce and authentication tag per credential write. API serializers never return secrets or ciphertext.
- Added dedicated `payment.providers.manage` permission and required it together with global Super Admin permission/MFA step-up for provider management operations.
- Added Super Admin APIs for listing, creating, editing metadata/credentials, non-charge verification, enable/disable status and soft archival. All sensitive mutations write non-secret audit metadata; archival is blocked while provider attempts are in flight or webhook events remain unprocessed.
- Added the bilingual `/admin/payment-providers` page, navigation and Super Admin control-center shortcut. The interface includes add/edit forms, credential masking, test/live setup, verification, enable/disable and archive actions.
- Explicit boundary: this is the management/data-storage tranche only. Checkout and webhook adapters still use the existing environment-based registry; database ACTIVE/DISABLED status does not yet alter checkout. The UI warns about this. The next implementation step is the provider runtime/config binding, including immutable payment-to-config/environment association and retained historical webhook verification.
- No tests, builds, typechecks or browser checks were run, in line with the instruction to defer validation until the build work is complete.


## 2026-11-10 — Payment provider runtime binding, second implementation tranche

- Extended the compiled Stripe and PayPal adapters to accept server-resolved credentials and TEST/LIVE environment values; the legacy environment path remains available only when no database-managed record exists for that provider/environment.
- New checkout requests resolve the unique provider configuration for the runtime environment and reject disabled, unverified, unsupported-currency or unsupported-country configurations. A configured country allowlist also rejects orders without a known country.
- Added a relation from Payment to PaymentProviderConfig, environment metadata and an immutable encrypted credential snapshot with key version. Migration: 20261110143000_payment_provider_runtime_snapshots.
- New Stripe and PayPal checkout sessions use the active database credentials. Public checkout provider discovery now lists active database-managed records and immediately avoids stale caching after a provider is disabled.
- Webhook verification resolves the payment snapshot before signature verification; provider metadata is also used to find an in-flight payment before its provider reference has been persisted. PayPal return/capture uses the same historical snapshot.
- Existing payments without a snapshot continue through the legacy environment credentials path. Existing attempts with a snapshot can resume after the provider is disabled; disablement blocks new attempts but does not intentionally strand an already-created payment.
- No tests, builds, typechecks or browser checks were run, per the instruction to defer testing. Migrations have been committed but have not been applied to the user's database. Provider credentials, merchant eligibility and live transactions have not been verified in the user's environment.


## 2026-11-10 — Versioned provider credential key rotation

- Added a backward-compatible versioned AES-256-GCM key ring. Existing `PAYMENT_PROVIDER_ENCRYPTION_KEY` remains version 1; new deployments can configure `PAYMENT_PROVIDER_ENCRYPTION_KEYS` and `PAYMENT_PROVIDER_ENCRYPTION_KEY_VERSION` to retain old decryption keys while encrypting new records with the active key.
- Added an MFA-protected Super Admin re-encryption endpoint and UI. It processes provider configuration credentials and historical Payment snapshots in bounded batches, uses conditional updates, writes an audit event, and reports remaining rows so interrupted runs can be safely repeated.
- Fixed a duplicate declaration in the PayPal adapter's OAuth token function and removed its duplicate `server-only` import.
- No migrations were needed for key rotation because both provider configs and payment snapshots already persist key versions. No tests/build/typecheck were run, as requested.


## 2026-11-10 — Market-aware checkout provider discovery and webhook compatibility

- Checkout provider discovery now accepts the order currency and destination country and returns only providers whose configured allowlists match. Country-restricted providers are hidden when the order has no known country; the payment creation endpoint independently enforces the same policy.
- Public provider discovery now uses `private, no-store` caching so provider disablement and market policy changes are reflected immediately.
- Fixed webhook credential resolution so legacy payments without encrypted snapshots continue to verify with their original environment credentials instead of accidentally using a newer database-managed provider secret.
- Preserved PayPal legacy environment compatibility while fixing the duplicate OAuth credential variable declaration.
- Updated the payment provider control-center documentation to describe multi-key rotation rather than the superseded single-key limitation. No tests, typechecks or builds were run.


## 2026-11-10 — Payment vault safeguards

- Added a database CHECK constraint requiring provider configuration ID, environment, encrypted credential snapshot and key version to be either all present or all absent on Payment rows.
- Key rotation now refuses to proceed when it finds malformed historical snapshots, processes at most 100 provider configs and 100 payment snapshots per request, and can be safely rerun until both remaining counts reach zero.
- Enforced the supported payment-method allowlist at configuration save time (Stripe card, PayPal wallet) as well as at checkout selection.
- Checkout provider discovery now hides providers that do not match the order's country/currency, and the API uses private no-store caching.
- PayPal capture validates that the returned order and purchase-unit custom/reference ID belong to the exact Matjar payment before accepting capture results.
- No tests, builds or typechecks were run.


## 2026-11-10 — Legacy PayPal source review

- Located the legacy PayPal flow in `waelkamira/cartoon` and its copy in `waelkamira/cooking-new`; `cartoon_cloudflare_repo12` was not the source. Akaar contains a disabled PayPal provider placeholder rather than a working checkout.
- Reviewed the legacy flow and rejected copying its client-authoritative subscription activation: the browser captures payment and writes entitlement fields through an unauthenticated email-based user PUT endpoint. The `cooking-new` copy's user PUT handler ignores subscription fields entirely.
- Found a tracked `.env` file containing PayPal credentials in `cartoon`. No secret values were copied or used. The exposed PayPal REST app secret must be revoked/rotated by the owner, and the tracked file must be removed from the repository/history.
- Documented the review in `docs/architecture/PAYPAL_SOURCE_REVIEW.md`. Matjar uses its own server-authoritative Orders v2 + webhook flow; cartoon's $1 monthly / $10 yearly subscription pricing was not imported.

- Security mitigation: removed the tracked `.env` file from `waelkamira/cartoon` current `main` (commit `7ab14d65d18a0be1ed8da4db131fa785cc569a2c`). The file remains in Git history; owner-side credential revocation/rotation is still mandatory.


## 2026-11-10 — Retry-safe payment webhook verification

- Added typed provider configuration, provider unavailability and signature-verification errors.
- Webhook processing now separates malformed/invalid-signature payloads (4xx) from database, encryption-key and PayPal API outages (503 with Retry-After), allowing providers to retry valid events after transient failures.
- Preserved legacy PayPal sandbox/live selection from `PAYPAL_MODE` when a historical payment has no encrypted database snapshot; database-managed payments continue to use their stored TEST/LIVE environment.
- No tests/build/typecheck were run.


## 2026-11-10 — Provider disablement race and PayPal idempotency hardening

- New database-managed payment creation now locks the selected provider configuration row and revalidates status, encrypted credential version, market allowlists and method policy inside the same transaction that writes Payment. Concurrent disablement/configuration changes are serialized against new payment creation.
- PayPal Orders v2 create and capture requests now use deterministic SHA-256-derived 32-character request IDs, so retries reuse the same provider idempotency token and do not depend on arbitrary client key length/characters.
- No tests/build/typecheck were run.


## 2026-11-10 — Explicit TEST/LIVE runtime selection

- Added `PAYMENT_PROVIDER_RUNTIME_ENVIRONMENT=TEST|LIVE` override, defaulting to TEST outside production and LIVE in production. Checkout discovery, payment creation and managed webhook verification now share one resolver, allowing sandbox verification on a production deployment before switching to live credentials.
- Existing payment snapshots continue to select their original environment for webhook/capture verification; legacy PayPal payments continue to use `PAYPAL_MODE`.


## 2026-11-10 — Payment integration status reconciliation
- Reconciled System 29 and the page route registry with the current main source after the PayPal and provider-control-center implementation.
- Confirmed the original source was waelkamira/cartoon; Matjar uses a server-authoritative PayPal Orders v2 adapter, server-side capture, historical encrypted credential snapshots and PayPal-verified capture webhooks.
- Confirmed multi-version AES-256-GCM key rotation is implemented through the MFA-protected, audited /api/admin/payment-providers/rotate-credentials operation. It is not a remaining code task.
- Confirmed refunds are implemented as finance-confirmed manual operations after physical return receipt. Provider-side automatic refunds, refund webhook reconciliation, ledger reversals, seller payable adjustments and settlement reconciliation remain future work.
- Migration 20261110120000_payment_provider_control_center is present in the repository. Applying it to the owner's active database and completing a PayPal Sandbox journey are still unverified and cannot be inferred from source inspection.
- No database migration was applied, no credentials were read or changed, and no tests/build/typecheck or live/Sandbox payment were executed in this documentation-only reconciliation.
- Documentation commit: 27115d092146d99f4459f4e5cf8711603371aeeb; route-registry correction follows in this commit.


## 2026-11-10 — Stripe and PayPal provider refund execution
- Added provider refund contracts and server-side adapter operations for Stripe and PayPal.
- Stripe refunds resolve the captured Checkout Session to its paid PaymentIntent; PayPal refunds resolve the Matjar Orders v2 order to its completed capture. Both validate currency/amount and use deterministic provider idempotency keys.
- Added RefundStatus states PROCESSING_PROVIDER and PROVIDER_FAILED, plus additive migration 20261110130000_provider_refund_execution.
- Added finance API actions to execute and refresh provider refunds. Provider pending responses retain the provider refund reference; only a provider-confirmed completed result marks the Refund complete and updates Payment status. Manual external-reference completion remains available for reconciled exceptions.
- Added provider refund controls, asynchronous status refresh and Arabic labels to /admin/refunds.
- Provider calls are outside DB transactions; refund reservations and finalization are serialized by order lock, payment-balance limits, idempotency, and AuditLog.
- Not run: Prisma migration application, typecheck, tests, build, Sandbox calls or any live financial operation. Sandbox verification remains required before enabling live refund workflows.


## 2026-11-10 — Financial integration status after provider refund tranche
- Updated the Prisma model usage map and platform system map: Return/Refund/RefundItem now drive physical-return-gated Stripe/PayPal refund execution; provider-confirmed completion updates Refund and Payment with AuditLog evidence.
- The general ledger remains deliberately unconnected. Existing journal posting is append-only but there is no approved chart-of-accounts mapping or payment-capture journal, so no seller payable/clearing/tax/shipping allocation was invented.
- Remaining before launch: deploy additive migrations; run the complete TEST/Sandbox payment and refund journey; confirm retry/duplicate/pending behavior in PostgreSQL; finalize MFA step-up and amount-limit policy; approve accounting mappings; then implement balanced, idempotent journal postings and seller payable reversals.


## 2026-11-10 — Refund dual control
- Enforced independent-operator confirmation for provider and manual refunds using the existing Refund.requestedById/completedById lifecycle: the requester cannot execute or manually confirm their own refund.
- Documented the control in System 29, the route registry and Phase 6. MFA step-up and configurable amount limits remain separate launch requirements.


## 2026-11-10 — Provider idempotency retention safeguard
- Added `Refund.providerSubmittedAt` and migration `20261110140000_provider_refund_retry_window` to persist the first provider submission time.
- Automatic retries stop before provider idempotency records may expire: 23 hours for Stripe (documented pruning after at least 24 hours) and 44 days for PayPal (refund request ID stored up to 45 days). After the window, the operator must reconcile the provider dashboard and use the external-confirmation path; no new automatic request is sent.
- Provider-failed records with a returned provider refund ID are reconciled through provider GET status instead of issuing a second refund.


## 2026-11-10 — Confirmed provider failure and retry attempts
- Added `Refund.providerAttempt` with migration `20261110150000_provider_refund_attempts` and a positive-value database check.
- A provider GET that confirms FAILED clears the old provider refund reference, resets the attempt timestamp and increments the attempt counter; a new idempotency key is used only after that confirmed failure.
- Ambiguous network failures do not increment the counter and can only retry with the same key inside the documented retention window.

## 2026-11-10 — Platform-wide responsive layout remediation (source-level)
- Audited shared public, seller and admin shells plus the route inventory and searched for common fixed-width, grid, table and overflow patterns.
- Updated admin mobile navigation to wrap destinations in a bounded vertical scroller instead of a single long horizontal strip.
- Updated seller mobile navigation to wrap destinations and scroll vertically; removed the seller topbar's rigid title minimum width.
- Added global viewport/content containment, responsive form-control sizing, bounded data-table scrolling, phone-width seller/admin grid collapse, and viewport-constrained dialogs.
- Added docs/design/RESPONSIVE_AUDIT.md with the route groups, viewport/RTL/LTR acceptance matrix, remaining checks and explicit verification boundary.
- Browser screenshot sweep, all-route interaction verification, 200% zoom review, typecheck, tests and build have not been run. Do not mark the full responsive audit complete until those checks are recorded.
## 2026-11-10 — Responsive route-level refinements
- Tightened seller inventory page spacing and form breakpoints for phone/tablet widths; kept stock-count and movement tables inside their own scroll containers.
- Made seller commission store selection and catalog discovery filter/results header wrap cleanly on narrow viewports.
- Reduced checkout horizontal padding on phones and allowed its header and long quote references to wrap.
- Corrected an over-broad responsive CSS rule that forced every admin/seller grid into one column, which also collapsed intentional two-column image galleries and KPI tiles. Responsive Tailwind breakpoints now determine each grid's intended layout.
- Updated the responsive audit to reflect this correction. Browser visual verification remains outstanding.
## 2026-11-10 — Responsive refinement across admin, customer and storefront routes
- Applied compact-screen page gutters across 20 admin page shells and multiple customer/storefront routes, including account overview, cart, wishlist, returns, support-ticket detail, store/brand/category details and home discovery.
- Refined inventory, seller commission, catalog discovery and checkout layouts for narrow widths; preserved isolated horizontal scrolling for wide data tables.
- Updated product image preview to use dynamic viewport units and anchored the floating AI assistant within mobile safe areas.
- Expanded docs/design/RESPONSIVE_AUDIT.md with the specific routes and components touched.
- Still not browser-verified: no screenshots, interaction sweep, RTL/LTR viewport matrix, typecheck, build or automated tests have been run.
## 2026-11-10 — Responsive fixes for seller inbox, notifications and catalog controls
- Seller inbox: active-store selector now shrinks on phones; conversation list has a bounded scroll area below desktop widths so it does not push the active conversation far down the page.
- Notifications: preference labels and channel toggles wrap safely; card padding and page gutters adapt to phone widths.
- Catalog list controls: search, sort and submit controls can wrap instead of competing for a single narrow row.
- Re-reviewed the remaining fixed-minimum-width data tables: each is placed inside an explicit horizontal scroll container, so the page itself is not intended to scroll sideways.

## 2026-11-10 — Seller dashboard command-center shortcuts
- Added a seller dashboard quick-action section linking the selected store's daily workflows: orders, catalog, financial overview, payout destinations, shipping settings and owner-only store export.
- Added a direct bank-account management action to the seller financial overview so the finance and payout workflows are connected from the same workspace.
- Reused existing authenticated routes and the existing owner-scoped, audited Excel export endpoint; no duplicate APIs, Prisma models or migrations were introduced.
- Automated tests intentionally deferred per the current development priority. Build/runtime verification remains pending and this slice is not marked launch-ready.
- Added 7/30/90-day analytics controls to the seller dashboard using the existing date-bounded, store-scoped analytics API (maximum 90 days); gross sales remain grouped by currency without FX conversion.
- Updated the shared seller topbar to identify the bank-account route correctly.
- Added a seller daily-operations action center with store-scoped live counts for fulfillment-stage orders, low-stock inventory records, requested returns and products awaiting approval. Each tile links to the existing seller workflow; order counts explicitly follow the selected analytics period, while inventory and review queues reflect current records. No new API, schema or migration was added.


## 2026-11-10 — Seller customer relationship hub

**Implemented**
- Added a customer relationship section to the seller dashboard linking directly to the existing customer inbox, product questions, reviews, and store staff workspaces.
- Displayed the average rating and review count only from the existing seller analytics response; unavailable/loading/error states remain explicit rather than showing fabricated counts.
- Kept message/question/staff counts out of the dashboard because the existing dashboard analytics contract does not provide those values. The destination pages remain the source of their operational records.
- Reused existing routes and APIs; no schema, migration, or duplicate endpoint was introduced.

**Verification**
- Source changes committed to `feat/seller-dashboard-command-center`.
- Build, browser journeys, and database-backed verification have not been run in this session.


## 2026-11-10 — Seller team invitation guidance correction

**Implemented**
- Corrected the seller staff invitation guidance in both English and Arabic. It now accurately explains that the selected store-scoped role is applied when the invited active account accepts, and that invitations expire after seven days and can be renewed.
- No permission model, endpoint, or invitation behavior was changed.

**Verification**
- Source-level wording correction committed; no runtime or browser verification was run.


## 2026-11-10 — Seller workspace navigation coverage

**Implemented**
- Extended seller dashboard quick actions with direct links to existing advertising campaign, seller settings, and team-management pages.
- Team management shortcut is shown only to the store owner; existing page/API authorization remains authoritative.
- Reused routes documented in the page registry; no new route, API, schema, or migration was added.

**Verification**
- Source and documentation committed to `feat/seller-dashboard-command-center`.
- Automated checks and live browser journeys remain deferred as requested; latest code has not been build-verified in this session.


## 2026-11-10 — Finance readiness wording aligned with payout-method implementation

**Implemented**
- Corrected the seller finance disclaimer to acknowledge that encrypted payout destinations can be saved.
- Explicitly distinguished saved beneficiary details from beneficiary ownership verification, seller ledger recognition, holds, settlement, and actual withdrawal execution.
- Kept the financial overview from presenting commission snapshots as withdrawable funds.

**Verification**
- Source-level wording correction committed; no financial transaction behavior or schema was changed.


## 2026-11-10 — Payment provider preflight and seller identity gate

**Implemented**
- Reject unknown legacy payment-provider keys before resolving a checkout owner or querying an order. Stripe and PayPal continue through the managed provider-configuration path.
- No seller email-verification gate was added: the current registration contract creates active accounts without email verification, and introducing that gate here would block legitimate seller onboarding without an implemented verification journey.
- Unknown payment providers are rejected before checkout owner resolution or order lookup.
- No schema or migration changes.

**Verification**
- Prisma validation, migrations, TypeScript, lint, PostgreSQL integration and CodeQL passed on the preceding run. The payment lifecycle preflight regression is no longer among the failing tests; unrelated stale test fixtures/expectations remain to be reconciled before merge.
- PR remains draft and is not merged until required checks complete.


## 2026-11-10 — CI compatibility and seller onboarding correction

**Implemented**
- Kept seller application submission consistent with the current registration contract; did not introduce an email-verification prerequisite that would block active accounts.
- Corrected existing test fixtures and expectations for the payment-provider adapter registry, multi-currency seller commission aggregates/refund reads, owner-only staff management, session-free registration, and conditional ACTIVE/PENDING login updates.
- Preserved the payment-provider preflight guard that rejects unsupported providers before checkout owner/order reads.
- No database schema or migration changes.

**Verification**
- Latest CI run passed Prisma validation/migrations, TypeScript and lint, but its existing test fixtures were stale; the fixtures/expectations have now been aligned and a fresh run is required.
- PostgreSQL integration and CodeQL passed on the preceding source revision; browser E2E was still running at that point.
- PR remains draft until fresh required checks pass.


## 2026-11-10 — Seller identity boundary retained

- Restored the seller-application email-verification prerequisite because the existing seller identity policy and lifecycle contract explicitly require a verified account email before seller onboarding.
- Regular customer registration remains session-free; this seller-specific check does not change customer signup behavior.
- Updated webhook route test requests to include the provider payment reference required by the current route, and aligned the registration fallback assertion with the current response contract.


## 2026-11-11 — Seller workspace visual consistency pass

- Reconciled the seller sidebar and topbar with the centralized Snow/Orange/Onyx design tokens: white surfaces, onyx typography, restrained orange actions and active-state indicators.
- Fixed low-contrast sidebar navigation labels that were rendered in a pale blue tone against a pale background; mobile inactive navigation labels now retain readable contrast.
- Removed the unrelated blue/teal gradients from the seller search field, search action, account shortcut and topbar controls.
- Preserved all seller routes, active-route matching, store identity loading, locale labels, product search submission and notification/account destinations.
- Source-level verification only. Build, browser screenshots, responsive RTL/LTR review and database journeys remain pending; no tests or migrations were run in accordance with the current priority.


## 2026-11-11 — Seller workspace surface contrast correction

- Identified a legacy global compatibility selector that converted white and pale utility surfaces into dark charcoal cards, conflicting with the documented light Snow/Orange/Onyx design and making seller pages visually inconsistent.
- Added a seller-route-scoped surface correction so white/pale seller cards, panels, inputs and placeholders retain readable light surfaces without changing storefront or administration styling.
- Updated the seller layout canvas to a warm near-white background and kept the change isolated to the seller workspace.
- Verification remains source-level only; no build, browser visual pass, tests, database operations or migrations were run.


## 2026-11-11 — Seller dashboard and finance visual alignment

- Replaced the seller workspace's blue/teal gradient canvas and hero with a warm near-white canvas, white surfaces, charcoal typography and a restrained orange primary action.
- Aligned recent-order cards and seller profile/warehouse/shipping form surfaces to the same neutral palette.
- Replaced the finance overview's legacy blue gradient panels and teal action treatments with consistent white/ivory surfaces and orange emphasis.
- Restored restrained pastel icon accents in the seller navigation (lavender, mint, peach, butter, blush and sky) while retaining a consistent readable icon/label treatment.
- Kept existing data fetching, currency handling, API calls, order navigation, shipping forms, seller permissions and export actions unchanged.
- Source review only. Build and browser visual verification are still outstanding; no tests or migrations were run.


## 2026-11-11 — Seller metric cards refinement

- Replaced the dashboard's saturated multi-gradient metric cards with restrained light surfaces and consistent borders/shadows to improve visual hierarchy and number readability.
- Removed the remaining blue gradient from the bank-account quick action.
- Confirmed by source scan that the seller workspace and finance overview no longer contain the legacy blue/teal gradient palette patterns targeted in this pass.
- No runtime build or browser screenshots were available in this source-only pass.


## 2026-11-11 — Seller inventory visual alignment

**Implemented**
- Replaced the remaining cool blue-grey warehouse/inventory panel gradients with the seller studio's warm ivory surface palette.
- Softened the associated shadows to neutral warm tones so inventory, stock counts, quarantine, movement ledger, and transfer panels sit consistently within the refreshed seller workspace.
- Kept inventory queries, pagination, stock adjustments, quarantine decisions, stock counts, and transfer actions unchanged; this was a presentation-only change.

**Verification**
- Re-fetched the inventory source from `main` before editing and updated it using its current blob SHA.
- Source scan confirmed the targeted legacy blue-grey panel colors were removed from this page.
- No runtime/browser/build verification is claimed in this change.
- Commit: 0e0cbfbe3d97ffc8c4c2f56035af52ff4592546c.


## 2026-11-11 — Seller product and order surface alignment

**Implemented**
- Reworked the seller product workspace's remaining blue-grey page canvas, form panels, media upload surface, variant sections, and drop zone into warm ivory/clay tones with restrained orange accents.
- Updated seller order cards and delivery-address panels to the same neutral/warm palette.
- Preserved product editing, image upload/delete, variant, order status, shipment and tracking behavior; this batch changes presentation only.

**Verification**
- Both source files were fetched from `main` and updated using their current blob SHAs.
- Source scan confirmed the targeted legacy blue-grey product surface tokens were removed.
- No build, browser, or runtime verification is claimed.
- Product commit: 974f2abcc4575bb0b256335275fdb846bb844302.
- Orders commit: fd87ead1bb061cf8ff359d97d2fefd9a8ed28dcb.


## 2026-11-11 — Seller shipping visual alignment

**Implemented**
- Replaced the remaining turquoise shipping-save action with the seller studio's warm orange accent and high-contrast white label.
- Kept shipping market selection, rate calculation, delivery windows, priority, and active-state behavior unchanged.

**Verification**
- Updated the shipping page from the current `main` blob SHA.
- No runtime/build verification is claimed.
- Commit: 285919eecd2f887bc7ba3a8e0f0a3c8953b327c2.


## 2026-11-11 — Seller settings, finance and advertising palette alignment

**Implemented**
- Unified seller business settings, commission statements, advertising campaign surfaces, and bank-account management with the warm ivory/orange seller studio palette.
- Replaced remaining blue-grey and turquoise panel/action treatments while retaining semantic status colors and existing page workflows.
- No changes to financial calculations, encrypted payout data handling, advertising APIs, or seller settings persistence.

**Verification**
- Each page was fetched from the latest `main` state and updated sequentially using its current blob SHA.
- Source-only presentation change; no build/browser verification is claimed.
- src/features/seller/settings-page.tsx: 3e38ecdff2fd11f2cc8148c20e4fd1406cd71291
- src/features/seller/commissions-page.tsx: 21aa5ea858bf618c91a0688c032964f081f83107
- src/features/seller/advertising-page.tsx: 75d450f5526d0cad2b84e13657656380dd97bf0f
- src/features/seller/payout-methods-page.tsx: c8e33b4cc4d2fbe902c0e63e87f341c42661c826


## 2026-11-11 — Seller customer operations and team palette alignment

**Implemented**
- Aligned seller review cards and analytics accents with the warm neutral/orange workspace palette.
- Replaced the remaining blue-grey and turquoise inbox surfaces, selected conversation state, message bubbles, focus ring, and send action with warm neutral/orange treatments.
- Harmonized staff invitation and team-management panels with the same warm clay surface palette.
- Kept review responses, staff invitations/roles, message loading, conversation selection, and message sending logic unchanged.

**Verification**
- Fetched all three files from the current `main` branch and updated them using their current blob SHAs.
- Presentation-only source edits; no build or browser verification is claimed.
- src/features/seller/reviews-page.tsx: 112c2be6b436ac303c65cc0e22267102aa5d5863
- src/features/seller/staff-page.tsx: d374570805f538676b6527fe2dec6ec2e053a658
- src/app/seller/messages/page.tsx: 0d846c3f1a645de3cb3be20b32e7490eff741795


## 2026-11-11 — Seller product questions palette alignment

**Implemented**
- Matched seller product-question cards, inline response/edit separators, and empty state borders to the warm neutral workspace surface.
- Replaced the remaining lavender-only heading accent with the shared muted orange accent.
- Preserved question moderation, answer/edit API calls, and published-state behavior.

**Verification**
- Updated the file from its current `main` blob SHA and confirmed the targeted legacy cool-grey tokens are absent from the edited source.
- No build or browser verification is claimed.
- Commit: dbefae07ccd6d5fe874ee1c273e93d7f431b7cf2.


## 2026-11-11 — Seller application business registration and KYC expansion

**Implemented**
- Expanded the seller record with registration country, commercial registration number and authority, registration date, registered legal address, tax ID, business website, and private file references for business registration, tax certificate, and proof of address.
- Added a forward-only Prisma migration, preserving existing seller applications through nullable columns.
- Extended the authenticated application API and transactional seller application service to validate and persist the new fields for first submissions and rejected-application resubmissions.
- Registered companies and agencies must provide a two-letter registration country, commercial registration number, and a verified private registration certificate. Individual sellers and other seller types can leave company-only fields blank.
- Added private PDF/image uploads for registration, tax and address documents. Uploads are signature-checked, size-limited, stored as private ImageKit files, tagged to the document type and owner, and verified before the seller application can reference them.
- Extended the admin seller review queue to show the business registration profile and provide short-lived, permission-checked links to each private verification document.
- Extended the seller's pending-application view to show the submitted business registration details and attached-document indicators.
- Kept the existing Akaar-aligned seller application fields, map location, social links and identity document workflow intact.

**Verification**
- Source-level review only; no database migration was applied, no Prisma client generation, build, typecheck, browser flow or tests were run in this session.
- Migration must be applied through the project's normal controlled database migration process before the new fields can be used in a live environment.

## 2026-11-11 — Seller studio visual redesign pass

- Replaced the conflicting final seller visual overrides with one cohesive navy / mist / turquoise theme scoped to the seller dashboard; storefront and admin styling remain outside this scope.
- Reworked the seller sidebar to a deep navy gradient, clearer active/hover navigation states, pastel icon accents, and a 288px desktop rail.
- Restyled the seller toolbar and search surface, dashboard hero, metric cards, quick-action cards, forms, and responsive mobile navigation.
- Updated the seller layout canvas to the blue-grey background and made the toolbar sticky for long workspace pages.
- Existing page routes, data fetching, API calls, permission checks, and Prisma-backed operations were left intact.
- Commits: `3dea9edb`, `926c869f`, `db195128`, `d6cfc930`, `dba5df07`.
- Follow-up cleanup: removed 9 KB of obsolete, contradictory seller-only CSS blocks instead of leaving old palette rules layered underneath the new design. Consolidated the seller skin into the final scoped theme block. Cleanup commit: `a6be6ddc`.
- Verification: source changes were committed directly to `main`. Build, typecheck, and browser visual verification have not been run in this pass; appearance is not yet runtime-confirmed.


## 2026-11-11 — Seller application CI regression repair

**Finding**
- Exact-main CI run `42960676089` failed only in `tests/marketplace/seller-application.test.ts`: 4 of 564 tests failed; 560 passed.
- The new registered-business KYC rule correctly requires a country, registration number and private registration certificate for STORE/AGENCY applications, but the older STORE test fixtures still omitted those fields.
- The unverified-email test also exposed validation ordering: business KYC errors were returned before the service checked that the requester had a verified account.

**Implemented on main**
- Moved the authenticated-session and verified-email check immediately after Zod parsing, before business-registration/KYC checks. Invalid input still fails Zod before session lookup.
- Updated registered-business unit fixtures with registration metadata and a mocked private ImageKit file-details response scoped to the test user; no real provider request or secret is used.
- Added an explicit regression test proving a registered business without registration metadata/certificate is rejected after the verified-user gate.
- Restored mocked global/environment state after each test.

**Verification**
- Before repair: CI typecheck and lint passed; Vitest failed 4/564 in the seller-application test file; production build was skipped by the workflow after the test failure.
- Browser E2E on the same pre-repair main commit passed. Its seller product create/edit journey and Syrian geography/Leaflet journey passed, including governorate/district/subdistrict/locality zoom levels, mouse-wheel zoom and neighborhood focus.
- Targeted Vitest and the post-repair exact-head CI are pending; no post-repair pass is claimed yet.
- Vercel's GitHub deployment status is provider-side `failure`: `Deployment rate limited — retry in 24 hours`. This is not an application build error; no Vercel project settings or production configuration were changed.


## 2026-11-11 — Post-repair verification on exact main head

**Commit verified:** `fe1105832591a2c8902ea6340c5d972dc5d1b596` (`fix(seller): repair KYC validation order and CI fixtures`).

- GitHub Actions CI run `42996942461` completed successfully. The quality job passed Prisma validate, migration deploy, Prisma generate, TypeScript, ESLint, Vitest (112 test files / 565 tests), production build, and route/authorization/UI-mutation inventory generation.
- Browser E2E run `42996942716` completed successfully: 9/9 tests passed. The seller catalog journey created a draft product, verified it through the seller products API, edited it, and verified the persisted update; it also edited and reloaded seller shipping configuration.
- The same browser run passed the Syrian geography/Leaflet journey. The test selects Damascus, a coordinate-bearing district and subdistrict, then a locality; it checks automatic zoom values 7, 10, 12 and 15 when the selected record has coordinates, verifies mouse-wheel zoom increases, and checks zoom 16 after entering a seller-provided neighbourhood and blurring the field when the locality pin has coordinates. Neighbourhood is not an official OpenSyria administrative level: the map zooms to the selected locality/pin rather than inventing a neighbourhood centroid.
- Platform PostgreSQL Integration run `42996942668` passed: 3 test files / 9 tests, including migration deployment and repeatable demo seeding.
- CodeQL run `42996942530` completed successfully.
- Vercel deployment `dpl_GfChBDgbLzPKoacVgbYL1KJnMfEb` is `READY` for Production and is linked to this exact `main` SHA. GitHub's Vercel commit status is `success`. The earlier rate-limit failure recorded above was an earlier provider response and is no longer the current deployment state.
- No application code changes were needed after this verification. This entry records the completed post-repair results; no secrets or production settings were changed.

**Remaining verification boundary:** the E2E test intentionally guards locality/neighbourhood zoom assertions when the selected OpenSyria record has no centroid. The current run proves the test passed, but does not claim that every locality in the source dataset has coordinates.

## 2026-11-11 — Seller dashboard visual consistency pass

**Implemented on main**
- Added a final seller-scoped visual contract in `src/app/globals.css` to override the obsolete navy/teal seller skin that was still taking precedence at the end of the stylesheet.
- Seller navigation now resolves to the platform's white / onyx / orange palette; active navigation remains lime with dark text, and inactive links use white surfaces with a subtle orange hover border and shadow.
- Seller search submit uses the same `#f0660d` primary orange as the marketplace “Browse products” action, with white text and a darker orange hover state.
- Seller topbar is explicitly non-sticky with automatic stacking order, preventing it from competing with the marketplace header. Search layout is constrained on desktop and becomes a full-width row on smaller screens.
- Seller dashboard cards, forms, headings, placeholders, mobile navigation and focus outlines receive explicit foreground/background pairings to avoid unreadable hover or active states.
- No page routes, API behavior, Prisma models, or database migrations were changed.

**Verification boundary**
- GitHub source update succeeded. Local browser visual verification could not be performed from this session because the connected browser context is unavailable. The app's appearance must still be checked locally at `/seller` on desktop and mobile after pulling the commit.
- The prior successful CI/E2E results recorded above apply to their exact earlier commit, not this CSS-only commit. Do not treat them as verification of this new change.


## 2026-11-11 — Platform-wide brand orange update

**Implemented on main**
- Confirmed the requested Matjar brand orange as `#FF8C1C` and changed the shared `--orange` design token in `src/app/theme.css`; Tailwind v4 aliases and components that consume the token now resolve to the approved orange.
- Updated the shared action-hover token to a darker orange (`#E8750B`) so primary controls retain clear hover feedback with white text.
- Updated global focus, selection, border-glow, and seller dashboard primary-action styling in `src/app/globals.css` to use the approved brand orange.
- Replaced remaining seller-workspace legacy orange values and orange-tinted shadows in navigation, topbar, finance, orders, inventory, product questions, messages, reviews, and settings.
- Updated both design-system documents to record `#FF8C1C` as the platform brand orange.
- Preserved semantic success, warning, danger, and informational colors. Kept darker orange text treatments where needed for readable contrast on white surfaces.

**Verification boundary**
- GitHub source updates completed sequentially on `main`.
- No build, typecheck, lint, automated tests, browser screenshots, or responsive/RTL visual review were run in this pass. The updated colors require a local visual review after pulling the latest `main`.


## 2026-11-11 — Brand-orange audit: storefront, admin, and seller follow-through

- Continued the `#FF8C1C` migration beyond the shared theme and seller dashboard.
- Updated the shared site navigation orange glow, seller payout-method primary action, and admin dashboard orange metric accents to consume the approved brand orange.
- Updated seller returns and product-list orange chart/category accents to resolve through the shared orange token.
- Replaced remaining legacy orange color selectors in the global button compatibility rules.
- Preserved status-specific colors (for example low-stock, warning, error, and rating bands) where orange is being used as data/status encoding rather than as a brand action.
- Source changes were committed directly to `main`.

**Verification boundary:** No local build, typecheck, lint, automated tests, browser screenshot review, or full page-by-page responsive/RTL audit was run. Visual verification remains outstanding.


## 2026-11-11 — Continued platform-wide `#FF8C1C` consistency pass

- Removed remaining legacy orange gradients from seller shipping and advertising actions, and aligned seller messaging, payout, and settings accents with the approved brand token.
- Updated storefront hero primary action and marketplace search submit button to use the shared action color with white text.
- Updated seller inventory and order chart brand-accent series to consume `var(--orange)`; rating-band colors remain semantic.
- Confirmed the shared theme token remains `--orange: #FF8C1C`, with `--action` consuming that token and a darker `--action-hover` for hover feedback.
- Kept deep-orange text on white surfaces where required for readability, and preserved warning/error/success colors.

**Verification boundary:** GitHub source changes are committed to `main`. No local build/typecheck/lint, tests, or browser-based page review was run. Vercel preview/build may remain unavailable under the repository's current deployment rate limit.


## 2026-11-11 — Final brand-accent sweep for storefront, charts, and maps

- Corrected storefront hero and marketplace search primary-action text to white on the approved orange background.
- Updated seller shipping/advertising actions and messaging accents to remove their remaining orange gradients and legacy orange shades.
- Updated the location-map pin and shared chart palette orange entries to use the Matjar brand orange.
- Updated the legacy `--matjar-action` compatibility variables and hover token in global CSS so older components cannot silently fall back to the previous dark orange.
- Preserved readable deep-orange text on light surfaces, semantic review-rating colors, and non-brand status colors.

**Verification boundary:** Source edits are committed to `main`. No local build, typecheck, lint, tests, or browser visual verification were performed. Deployment status is checked separately and is not treated as a successful build unless it reports success.


## 2026-11-11 — Seller dashboard palette harmonization

- Reworked the seller product-management header, form surfaces, inputs, image-gallery accents and draft action to use the same warm-white/onyx/orange design language as the seller workspace and storefront.
- Removed the legacy navy/teal treatment from seller application review and application-form headers; aligned application section icons, field text and preview surfaces with the Matjar palette.
- Standardized seller dashboard quick-action cards as white clay surfaces with restrained orange icon accents and consistent dark text, rather than a mix of unrelated pink, teal, purple and yellow gradients.
- Updated primary action labels on advertising, shipping and review-response forms to white over brand orange; primary hover uses `#E8750B`.
- Preserved lime active navigation states and semantic status colors (success, warning, error, inventory/order states and rating charts) rather than recoloring status indicators as brand actions.
- Kept the seller sidebar and topbar's white/onyx surfaces, orange brand accents, and lime active state aligned with the shared theme.

**Verification boundary:** All listed source changes were committed directly to `main`. GitHub source review confirms the targeted seller pages no longer contain the former navy/teal brand treatment or dark text on the orange primary actions. No local build/typecheck/lint/tests or browser screenshot review was run, so responsive visual rendering still needs a live local check.


## 2026-11-11 — Seller dashboard final consistency refinements

- Standardized the seller dashboard's quick-action cards to the same white surface, subtle neutral border/shadow, orange icon accent and onyx text; removed the unrelated multicolor gradients from those navigation shortcuts.
- Completed the remaining seller application form and preview palette cleanup, including its section icons, labels, input surfaces, checklist and primary submit action.
- Confirmed the seller product-creation primary action and dashboard create-product action use brand orange with white text and the darker orange hover state.
- Preserved lime for the active seller navigation item and kept semantic colors in analytics/status charts distinct from brand-action colors.

**Verification boundary:** GitHub source was reviewed after committing. No local build/typecheck/lint/test run or live browser screenshot review was performed. This confirms source-level palette alignment, not pixel-perfect rendering on every viewport.


## 2026-11-11 — Seller subpage palette completion (Vercel excluded)

- Aligned seller financial overview KPI cards to the same white surface, neutral border, restrained shadow and orange section-label treatment used across the Matjar workspace; removed the mismatched mint, lavender and rose metric-card gradients.
- Unified seller Q&A typography, inputs, neutral card surfaces and answer actions; orange primary buttons now use white text and the approved darker hover color.
- Reworked seller inbox conversation list, selected row, message surface, form and send action to match the warm-white/onyx/orange design system, with readable contrast in selected and default states.
- Aligned seller commission statements and staff/team pages with the same shared surface, text and border palette while preserving refund/error/success semantic colors.
- Source-level audit across the seller feature pages and seller messages found no primary orange action using dark text. The seller sidebar's lime active state and data/status chart colors remain intentionally semantic.

**Verification boundary:** Changes were committed directly to `main` and source-level contrast/palette checks were performed. No local build, typecheck, lint, automated tests, or browser visual inspection was performed. Deployment services were not used or consulted for this work.


## 2026-11-11 — Platform-wide theme foundation and cross-area consistency pass

- Removed the obsolete seller-dashboard CSS override block that still declared navy/mist/turquoise tokens and overrode page-level styling. This was a late-cascade conflict: editing individual seller pages alone could not neutralize those old global rules.
- Removed stale seller hero compatibility selectors after confirming the overview hero component already uses the warm-neutral palette.
- Corrected the global foreground rule for the approved brand-orange action surfaces and hover shade to white, including direct `#FF8C1C`, theme action/orange tokens and Tailwind orange utility classes. Existing semantic status colors remain separate.
- Updated the shared footer brand mark to use white foreground on its orange gradient.
- Aligned the admin dashboard canvas with the warm-neutral marketplace background while retaining semantic metric colors (success, pending, failed, moderation and logistics).
- Reviewed storefront catalog/search/product components, customer account/reviews/returns/support, notifications, order detail, identity security, admin navigation/orders/products/users/sellers/support/payments/returns, and seller feature pages for hard-coded conflicting palette colors. Most of these areas already consume shared theme tokens; amber/emerald/rose/blue status and alert colors were intentionally retained.
- The seller-specific final CSS contract remains scoped to the seller workspace and defines the shared sidebar, topbar/search, active/hover navigation, neutral cards, orange primary actions and responsive search behavior.

**Verification boundary:** GitHub source inspection and targeted CSS/source checks only. No local build, typecheck, lint, automated test suite, or browser-based visual validation was run. No deployment platform was used.


- Extended the consistency pass to checkout delivery/review/shipping/tax, cart, registration/MFA/email verification, account overview/profile/addresses/security/store, customer order and support surfaces, and additional admin catalog, coupon, commission, logistics, payment, refund and review screens.
- Replaced the customer profile dashboard's unrelated pink/blue radial canvas with the shared warm-neutral/orange background. Kept the multi-color order and engagement charts because those colors encode distinct metrics rather than button branding.
- Confirmed the seller navy/teal legacy token block and its obsolete hero compatibility selectors are absent from the current global stylesheet; the canonical theme tokens remain `#FF8C1C`, `#454545`, and `#E8750B`.


## 2026-11-11 — Selected orange button state

- Added a final global state rule for brand-orange primary controls (including orange utility classes, the Matjar action token and primary button variant).
- When selected/pressed/current/active, the control remains Matjar orange `#FF8C1C` with white text; hover while selected does not change it to lime or darken the label.
- Removed the visible border, outline and box-shadow frame for the selected orange state, and suppressed the focus frame on these orange controls as requested. Other non-orange active controls retain their existing lime active state.


## 2026-11-11 — Seller sidebar structure aligned with admin navigation

- Replaced the seller sidebar's four visually separated navigation groups with one continuous, vertically stacked navigation list, matching the admin sidebar's information hierarchy and item rhythm.
- Kept the seller-specific destinations, Arabic/English labels, route-aware active state, store identity block, and seller palette; this is a layout alignment, not a replacement of seller links with admin links.
- Matched the desktop sidebar width to the admin navigation width and tightened item spacing so the full seller menu reads as one coherent navigation system.
- Mobile navigation remains horizontally scrollable and preserves all seller destinations.

**Verification boundary:** Source-level change only. No local build, typecheck, or browser visual validation was run in this turn.


## 2026-11-11 — Locale-aware search control order

- Updated the marketplace search and seller dashboard search forms to use an explicit left-to-right control layout so physical placement is predictable in both locales.
- Arabic places the Search button to the right of the input; English places it to the left. Input text direction follows the selected locale.
- Search submission, autocomplete suggestions, labels, and existing destinations are unchanged.

**Verification boundary:** Source-level changes only; no local build or browser visual check was run.


## 2026-11-11 — Identity verification inputs

- Set the seller identity-review panel's editable text fields (seller search and review/store reason fields) to an explicit white background with black text, including neutral placeholder text.
- Added a restrained Matjar-orange focus treatment while preserving the existing field layout and behavior.
- Left select controls and status/decision colors unchanged.

**Verification boundary:** Source-level change only; no local build, typecheck, or browser visual validation was run.


## 2026-11-11 — Return to top on next-page navigation

- Added a shared client-side pagination handler at the root layout so the behavior applies across storefront, customer, seller and admin routes rather than being reimplemented page by page.
- Activating a Next/التالي pagination control (including links marked `rel=next`) scrolls the viewport to the top, allowing the next result set to be read from its beginning.
- Previous-page controls and disabled pagination controls are not intercepted.

**Verification boundary:** Source-level implementation only; no local build, typecheck, or browser interaction test was run.


## 2026-11-11 — Seller sidebar information architecture redesign

- Reorganized seller navigation into task-oriented sections: Overview, Catalog, Sales & fulfillment, Customer experience, Growth, Finance, and Store & team. Moved returns alongside orders/shipping, grouped product questions/messages/reviews under customer experience, and grouped store settings with team access.
- Replaced the dark luxury sidebar treatment with the platform's warm-white/neutral system and restrained Matjar orange. Active items use a soft orange surface with readable dark text; active icon tiles use orange with white icons. Inactive icons use neutral surfaces rather than unrelated pastel gradients.
- Applied the matching light treatment to mobile navigation while retaining the existing links, route matching, store context, and responsive horizontal mobile layout.

**Verification boundary:** Source-level implementation only; no local build, typecheck, or browser visual validation was run. The mobile and desktop layouts still need a visual pass at narrow and wide viewport sizes.


## 2026-11-12 — Seller payout destination review hardening

- Added `SellerPayoutMethod.submissionVersion` and migration `20261112090000_seller_payout_submission_version`. Re-registering a disabled destination increments the generation even when its database row ID is reused.
- The administrator review queue returns the generation; every verify/reject command must submit the exact generation. The domain service performs an atomic `updateMany` guarded by both `PENDING_VERIFICATION` and `submissionVersion`, and only then records the audit event.
- Admin review is restricted to global `platform:manage` with fresh TOTP step-up. Self-verification is prohibited. Only masked bank details are returned; decisions require an external evidence reference and reason. This screen records a human attestation only and does not contact banks or initiate transfers.
- Fixed the E2E fixture to use the seeded market's default currency and the actual `Country.iso2` field. Added domain tests for disabled-destination re-registration version increments, stale review rejection, and atomic-write race conflicts.
- Hardened the review UI's MFA recovery, draft restoration, stale-request protection, page correction, and decision-specific pending feedback. Updated the browser journey to assert the actual review API response and toast.
- Exact head `401cb342d034dd8ad27576dde053ce3454891b7d`: general CI passed (Prisma validate/migrate/generate, typecheck, ESLint, unit tests, production build and route/authorization/UI inventories); PostgreSQL integration passed; Browser E2E passed **13/13**; CodeQL passed. Vercel deployment is intentionally excluded.
- Seller payable ledger posting, withdrawable balances, withdrawal requests, bank transfer execution and settlement/reconciliation remain blocked pending approved accounting policy and provider integrations.


## 2026-11-12 — Payout review queue generation and timestamp corrections

- Removed the artificial 1,000-page limit from the admin queue while keeping page values finite, positive integers whose computed database offset remains a safe integer. Added a route test for page 1001 with 50,001 records.
- Review drafts now use the composite key `methodId:submissionVersion`, including session-storage recovery and clearing, so evidence/reason text from an earlier submission cannot be reused for a newly registered generation.
- After a review succeeds, the page reloads with status/page refs that are synchronously updated by tab and pagination controls. It does not call a stale `load` callback captured before the POST.
- Added `SellerPayoutMethod.submittedAt` and migration `20261112093000_seller_payout_submission_timestamp`. Re-registration refreshes this timestamp, the admin queue sorts by it, and the UI displays it while preserving `createdAt` as the original row-creation time.
- Updated the E2E fixture to refresh `submittedAt` whenever its pending generation is reset.
- Superseded by exact-main verification on `17567cb82c1505ea479ab5b36b91fa7033fc8dce`: CI, PostgreSQL Integration, Database Baseline, Browser E2E (13/13), and CodeQL all passed. The subsequent seller product-media and strict Leaflet zoom coverage is recorded below.


## 2026-11-12 — Seller product-media persistence and strict Leaflet zoom coverage

- Exact application/test head: `fa9012fdccbed41bee5fb359dfa50fb6b0b1921b` on `main`. This commit strengthens Browser E2E assertions only; no application code, schema, migration, secrets, or production settings were changed.
- The seller product journey now verifies that the selected Syrian district is persisted, initial product media is returned by the seller catalog API as one primary asset, and editing a draft (replace the original image, add a second, then remove it) leaves exactly one persisted primary image using the replacement upload's storage key and URL.
- The geography journey now requires a coordinate-backed Damascus governorate/district/subdistrict/locality path rather than conditionally skipping missing-centroid zoom checks. It asserts Leaflet zoom levels 7, 10, 12, and 15, confirms mouse-wheel zoom increases the level, and verifies neighbourhood-field blur moves to zoom 16.
- Neighbourhood remains seller-entered text, not an official OpenSyria administrative level. Zoom 16 focuses the selected locality pin; it does not claim to geocode an unverified neighbourhood centroid.
- Exact-head CI run `43196405446` passed: Prisma validate/migrate/generate, TypeScript, ESLint, **115 Vitest files / 598 tests**, and production build (174 static pages).
- Exact-head Browser E2E run `43196405338` passed **13/13**, including the seller product create/edit/media persistence journey and the full coordinate-backed Leaflet zoom/wheel journey.
- Exact-head CodeQL run `43196405453` passed.
- Vercel deployment `dpl_4abPskRpS9BJ2gvUeKd3wHE7YD25` reached `READY` for this exact SHA and was assigned the production aliases, including `mtjr2.vercel.app`. The earlier Vercel rate-limit status on parent SHA `17567cb` was a provider-side deployment limit, not an application build failure; the subsequent deployment for this head completed successfully.
- The dedicated PostgreSQL Integration (`43192299984`) and Database Baseline (`43192299765`) runs passed on parent SHA `17567cb82c1505ea479ab5b36b91fa7033fc8dce`. The `fa9012fd` commit is test-only and makes no database/schema change; the current Browser E2E run also executed the isolated PostgreSQL-backed application journey.


## 2026-11-12 — Double-entry ledger integrity hardening

- Updated `src/server/finance/ledger.ts`: an idempotency-key retry must match source,
  currency, description, occurrence timestamp, reversal reference and canonical journal
  lines; changed payloads are rejected rather than silently treated as already posted.
- Updated `prisma/schema.prisma` with database-generated `JournalEntry.createdTransactionId`.
- Added migration `20261112130000_journal_append_only_integrity`: PostgreSQL rejects
  JournalLine inserts outside the journal-creation transaction and rejects inactive
  accounts in deferred journal integrity checks.
- Added `tests/finance/ledger.test.ts` (balanced posting, identical retry, changed payload,
  imbalance, account validation and exact reversal) and
  `tests/integration/ledger-postgres.integration.test.ts` (post-commit append rejection and
  inactive-account bypass rejection).
- Commit implementation files are on `main`; **no local or CI verification was run in
  this session**. Prisma validate/generate, typecheck, lint, focused Vitest, migration replay
  and PostgreSQL integration remain required. No account mappings or money-flow wiring were
  inferred; seller payable, reconciliation and withdrawals remain blocked by FIN-01–FIN-12.

- Follow-up hardening: migration also freezes a used ledger account's code, account type, scope and currency; only safe deactivation/label maintenance remains possible. PostgreSQL integration coverage now asserts a used account code cannot be rewritten.


## 2026-11-12 — Accounting ledger read-only administration surface

- Added `listLedgerAccounts` with bounded filters, currency normalization, stable ordering and cursor-ready pagination; account activity now returns `Currency.minorUnit` metadata so the UI formats integer minor-unit values without assuming two decimal places.
- Added `GET /api/admin/finance/ledger`, protected server-side by `requirePlatformManagement`, returning read-only account metadata and selected-account journal lines with private/no-store caching.
- Added `/admin/finance/ledger` server route with MFA enrollment, MFA verification and step-up redirects; added the General ledger link to the platform-only admin navigation.
- Added a bilingual read-only UI for account filtering and journal inspection. It intentionally exposes no balance totals, journal posting, reversal, refunds, seller payable, settlement or payout actions.
- Added focused unit tests for account filters, currency normalization and bounded page sizes. Updated route registry, journey matrix, system 31 specification and Prisma model usage map.
- Fixed financial policy loading so the effect invokes a pure async data loader and performs React state updates only in Promise callbacks; this addresses the ESLint `react-hooks/set-state-in-effect` failure found in CI.
- Earlier exact-head evidence: PostgreSQL migration/integration, CodeQL and Browser E2E passed on `e81a6efaab6b03a324a0e21aaf256f9a6d28c7c1`; the follow-up CI run on `83fddafc9acca44ac91025c4ab661693baa20e44` passed TypeScript and Browser E2E/CodeQL but caught the effect lint issue. The read-only ledger surface is newly added after those runs; full CI, PostgreSQL and E2E on the final code commit remain required before calling it verified.


### Exact-head verification — `ab66e65a66b293c3f063a7fb9ff6ea01a075a77b`

- CI `43216237801`: PASS — Prisma validate, disposable PostgreSQL migrations, Prisma generate, TypeScript, ESLint, full Vitest suite and production build.
- Browser E2E `43216237664`: PASS — production build/start and Playwright browser suite.
- CodeQL `43216237745`: PASS.
- PostgreSQL Integration `43211941124`: PASS on `e81a6efaab6b03a324a0e21aaf256f9a6d28c7c1`; no Prisma schema or migration changed after that integration run. The exact-head CI on `ab66e65` also reapplied migrations to a fresh disposable PostgreSQL database.
- The full unit suite initially exposed two financial-policy transition tests whose fixture status was `APPROVED` even though the transition requires `PENDING_REVIEW`; corrected the fixture and confirmed the full suite passes on this exact code commit.
- The read-only ledger route and UI are build/type/lint verified and covered by the general browser suite; no dedicated authenticated admin ledger browser journey or API permission-route test exists yet. Do not claim that specific journey verified.
