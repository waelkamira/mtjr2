# Phase 1 — Technical foundation execution plan

**Status:** Foundation exists; this plan defines the verified exit gate.  
**Canonical schema:** `prisma/schema.prisma`

## Objective
Provide a reproducible, secure application foundation on which all later domains can be built without leaking business logic into UI or route handlers.

## Work packages
1. Repository/runtime: pin Node/package manager and framework versions; deterministic install and documented Windows/Linux setup.
2. Configuration: Zod-validated server environment, explicit development/test/production behavior, safe error messages, no secret echo.
3. Persistence: one Prisma client singleton; PostgreSQL-only datasource; committed additive migrations; isolated CI database; no production URL fallback in tests/seeds.
4. Application boundaries: `src/app` routes/pages, `src/features` UI, `src/server` domain/services/repositories/policies, `src/lib` infrastructure, `prisma` schema/migrations, `tests` verification.
5. Reliability primitives: structured logging, request correlation, centralized error translation, health/readiness checks, bounded input and pagination conventions.
6. Quality pipeline: Prisma validate/generate, typecheck, lint, focused unit tests, production build, disposable PostgreSQL migration replay.
7. Documentation: environment template, local Windows setup, migration safety, test commands and ownership boundaries.

## Required implementation rules
- No direct Prisma calls from React components.
- Route handlers authenticate, validate and call domain services; services own business rules; repositories own persistence.
- No secrets in source, logs, browser bundles or test fixtures.
- Seeds must be deterministic/idempotent and explicitly blocked from production.
- Use only disposable/local/CI PostgreSQL unless production access is explicitly approved.

## Exit criteria
- Clean checkout installs reproducibly on the supported Node runtime.
- Environment validation fails closed and does not disclose secret values.
- Prisma validate/generate and full migration replay pass on clean disposable PostgreSQL.
- Typecheck, lint, unit tests and production build pass on the exact commit.
- A minimal health/readiness path and actionable logging/error behavior are documented.
- Local Windows setup can use a separate `mtjr2_demo` database without touching the user's existing database.

## Not included
Identity business workflows belong to Phase 2. Marketplace, checkout, provider setup and production deployment are not implied by a successful scaffold.
