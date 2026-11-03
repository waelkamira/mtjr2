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
