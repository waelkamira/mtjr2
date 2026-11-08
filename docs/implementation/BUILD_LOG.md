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


- Completed the Akaar category comparison across its 22 listing categories. Shared category presets now drive the form and server-side required-field validation; a focused Vitest suite was added at `tests/catalog/category-field-presets.test.ts` (not executed in this session). Added shared category field presets for real estate, cars, phones, computers, electronics, furniture, kitchen, fashion, beauty, sports, games, tools, books, gifts, agriculture, bikes, health, shoes, bags, jewelry, baby supplies, and jobs. Preset values are mandatory in both the form and the server-side product creation service; sellers can still append extra custom fields.
- Matched Akaar's required core listing fields by requiring category, description, city, district/area, and a contact phone. Added optional video link, initial stock, barcode and variant weight in grams. Real-estate listings retain Matjar's structured property details and map-pin requirement.

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
- Closed a seller onboarding retry gap without changing the schema or restricting sellers to one store. `POST /api/seller/stores` now uses the globally unique store slug as the idempotency key: exact owner/name/market retries return the existing store, mismatched/cross-seller uses are rejected, and a concurrent same-slug unique conflict is reconciled only after re-reading and matching persisted values.
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

## 2026-11-08 — Product image storage rebuild and ImageKit 403 diagnosis

**Rebuilt**
- Replaced the product-image provider module with a small provider adapter that validates the actual JPEG/PNG/WebP file signature, enforces the 8 MB limit, sanitizes filenames, applies timeouts, validates returned HTTPS URLs, and records provider-specific storage identifiers.
- Removed process-local successful-upload caching and in-flight deduplication. Upload success is no longer reused across users/requests merely because file bytes match.
- Kept the server-side ImageKit Basic Auth flow (private key as the username and an empty password) and Imgur fallback. Provider failures now retain HTTP status, a bounded provider message, and request ID in server logs without exposing raw provider responses to the browser.
- ImageKit HTTP 403 is classified as a provider configuration/permission/quota failure (503 to the application), not as a generic 502 gateway failure. The seller receives an actionable configuration message.
- Product media creation now accepts and persists the existing Prisma `ProductMedia.storageKey`, `mimeType`, `width`, and `height` columns. The seller product flow forwards this metadata returned by the upload endpoint.
- Added focused regression tests for MIME/signature validation, ImageKit success metadata, ImageKit 403 classification, and missing provider configuration.

**ImageKit 403 operational requirement**
- ImageKit documents HTTP 403 for failed account authentication, expired public/private keys, disabled accounts, or exhausted storage/upload limits. Restricted API keys must grant Media Read & Write for uploads.
- Verify the private key in the ImageKit dashboard and replace the deployment's `IMAGEKIT_PRIVATE_KEY` with the current private key. Do not use a public key or client-side key. Check the account's storage/upload quota.
- This repository-only change cannot validate or repair the external ImageKit account credential. No live upload, local typecheck, unit-test run, production deployment, or browser journey is claimed here; run CI against this exact branch head and perform one real seller upload after correcting the provider configuration.


## 2026-11-08 — Seller center, single-store ownership, listing completeness and media studio

**Implemented on `feat/super-admin-control-panel`**
- Reworked the seller workspace presentation with a responsive sticky navigation, wider dashboard canvas, refined forest/ivory visual system, stronger store overview hero, and elevated KPI cards. Existing order/inventory charts remain data-backed; unavailable metrics are not fabricated.
- Enforced one owned store per seller account in the creation service. A second create request returns the existing owned store instead of creating another. The seller UI hides the creation form once the account already owns a store.
- Added a database unique constraint on `Store.sellerId`. The migration checks for existing duplicate seller ownership and deliberately aborts with a clear message instead of deleting or silently merging existing stores. It also removes the now-redundant seller/status index.
- Compared Akaar's `app/(selling)/newPost/product-create-form.jsx` with Matjar's draft flow. Added city, district/area, contact phone, HTTPS video URL, initial stock quantity, and flexible category-specific key/value details to the Matjar product draft form and API schema.
- Extended Prisma `Product` with `city`, `district`, `contactPhone`, `videoUrl`, and JSON `customFields`. Initial stock is written into the store's MAIN warehouse inventory; the MAIN warehouse is created or reactivated when necessary. The initial stock amount is included in the product-created audit metadata.
- Rebuilt the image interaction as a modal image studio with multi-image selection, local previews, thumbnails, primary-cover selection, per-image deletion, replacement upload, and drag-and-drop upload. The existing provider upload endpoint and server-side validation remain in use.
- Added seller-owned shipping-rate editing: saved services can be loaded into the editor, updated through a scoped PATCH endpoint, and reloaded after save. Changes are audited.

**Migration**
- `prisma/migrations/20261108123000_seller_store_limit_and_listing_fields/migration.sql`
- Apply with the project's normal Prisma migration deployment after reviewing the duplicate-store precondition. If historical duplicate stores exist for one seller, consolidate their business data first; this migration intentionally refuses to destroy or merge records.

**Verification status**
- Source and migration files were committed to the feature branch.
- Automated typecheck, unit tests, Prisma migration execution, and browser/device journeys have not been run in this editing session. Do not treat this commit as a verified deployment.
- Existing Vercel deployment rate-limit restrictions may still prevent a hosted build/deploy; check the current commit status separately.


## 2026-11-08 — Seller product editor and shipping form follow-up

**Changes**
- Expanded draft-product updates to accept and persist city, district, contact phone, HTTPS video URL, category-specific JSON fields, brand, category assignments, map coordinates, and property details.
- Map coordinates are stored with the same exact/private and rounded/public coordinate split used during product creation.
- Seller catalog responses now include the listing metadata needed to prefill the editor.
- Expanded the seller draft editor with fields for location/contact/video, brand, multiple categories, custom fields, map coordinates, and property details.
- Added unit-test coverage for the expanded metadata update path and its nested map/property persistence calls.
- Removed duplicate `categoryIds` keys from product test fixtures and made generic fixtures use a category without mandatory category presets.
- Confirmed from `src/server/marketplace/market-query.ts` and `src/app/api/markets/route.ts` that the markets API includes `defaultCurrency.minorUnit` and currency minor-unit metadata.
- Added `src/lib/money.ts` with exact decimal-to-minor-unit conversion, rejecting excess decimal precision instead of silently rounding. Added focused tests for zero-, two-, and three-decimal currencies, invalid inputs, and amount limits.

**Verification and blockers**
- GitHub/Vercel status for the latest previously deployed commit reported a Vercel build-rate-limit failure. No new deployment was available for the latest source changes during this review.
- No local checkout or repository shell was available in this session. TypeScript, lint, Vitest, Prisma validation/generation, PostgreSQL migration rehearsal, and browser/device visual checks have **not** been run for these latest edits.
- The seller edit form currently exposes nested custom fields, map location, and property details as JSON text areas. Product media and variant/price/inventory editing are not yet part of the existing-product editor; the image studio currently supports the create-draft flow. These are remaining UX/product-scope gaps, not verified complete.
- The one-store-per-seller migration has not been applied to any database. Check for existing duplicate seller ownership and take a backup before applying it.
- The feature branch remains divergent from `main` (58 commits behind at the latest comparison; the branch remains divergent); merge/rebase is intentionally deferred until the diff is reconciled and conflicts/security-sensitive changes are reviewed.


**Follow-up static review**
- Corrected escaped decimal-point patterns in the new shipping amount parser and draft property-area update validator.
- Added category-preset validation to draft updates and kept real-estate map/property requirements consistent when changing categories.
- The latest seller-editor source commit `8be0e08ea83b137879fb3ad3eb54709a6eb3f50f` has no matching Vercel deployment record; its Vercel status points to the build-rate-limit restriction. The later documentation-only commit has no CI status. These code changes therefore remain unbuilt and unverified.
