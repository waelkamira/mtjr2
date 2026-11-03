# Mtjr2 — Global Multi-Vendor Marketplace

A ground-up implementation of a global, multi-vendor commerce platform.

## Project principles

- Build from a clean repository; do not import legacy application code.
- Treat the 49-system platform blueprint as the functional scope.
- Treat the previous Prisma schema as a domain reference, not as code to copy blindly. Every model must support a defined workflow.
- Keep business logic in domain services, not UI components or route handlers.
- Enforce authorization on the server for every protected operation.
- Use transactions, idempotency, audit trails, and concurrency-safe operations for orders, payments, inventory, refunds, and payouts.
- A capability is not complete until its user journey, persistence, authorization, error handling, and automated tests pass.
- Record decisions, implementation status, blockers, and test evidence in this repository.

## Target architecture

- **Web application:** Next.js App Router and TypeScript.
- **Database:** PostgreSQL with Prisma ORM.
- **Application layers:** UI → route/controller → authentication and validation → domain service → repository → Prisma.
- **Domains:** identity/access, marketplace/catalog, buying, seller operations, platform administration, global operations, and the separate property/booking domain.
- **Quality:** unit, integration, and end-to-end tests; linting, type checking, and CI.

Exact dependency versions and deployment choices will be pinned during the foundation setup and verified against the runtime environment.

## Build sequence

1. **Foundation:** repository conventions, TypeScript/Next.js setup, environment validation, database connection, Prisma baseline, logging, error handling, CI, and test harness.
2. **Identity and access:** users, sessions, authentication, role/permission model, authorization policies, and audit events.
3. **Marketplace core:** countries/markets, currencies, stores, seller onboarding, categories, brands, products, variants, media, and search.
4. **Buying core:** cart, pricing, checkout, inventory reservation, orders, payments, shipment, cancellation, returns, and refunds.
5. **Seller and admin operations:** seller center, inventory/warehouses, procurement, commissions, moderation, support, and administration.
6. **Global and financial systems:** tax, customs, localization, invoices, ledger, reconciliation, payouts, and reporting.
7. **Trust, engagement, and scale:** reviews, Q&A, messaging, notifications, loyalty, promotions, integrations, background jobs, security, SEO, and analytics.
8. **Separate property domain:** property listings and booking workflows, sharing only the platform capabilities that genuinely belong in common domains.
9. **Release readiness:** security review, performance/load tests, observability, backups, deployment, and operational runbooks.

This sequence is dependency-aware. The 49 systems will be mapped to these delivery slices and implemented incrementally; it is not a promise to create all systems in one pass.

## Definition of done

A system may be marked **Complete** only when:
- its user and operational workflows are implemented;
- data ownership, schema constraints, and migrations are correct;
- APIs validate inputs and enforce authorization;
- business rules and failure paths are handled;
- relevant unit/integration/end-to-end tests pass;
- type checking and linting pass;
- documentation includes implementation evidence and known limitations.

## Visual design direction

- Approved premium visual direction: forest green, sage, warm ivory, and restrained copper, based on the user's supplied references.
- Shared design specification: [Mtjr2 Visual Design System](docs/design/VISUAL_DESIGN_SYSTEM.md).
- Foundation tokens are implemented in `src/app/globals.css`; storefront, seller, and admin UI implementation follows the delivery sequence and does not bypass Phase 2 security gates.

## Documentation

- `docs/architecture/` — architecture decisions, domain boundaries, and system blueprint.
- `docs/implementation/` — phase plans and implementation records.
- `docs/quality/` — test strategy, security, and release evidence.
- `docs/design/` — visual design system, component rules, and accessibility standards.
- `prisma/` — canonical Prisma schema, migrations, and seed data.

## Current status

**Status: Phase 1 foundation scaffolded; Phase 2 identity/access in progress.** The canonical identity migration and repeatable seed passed clean PostgreSQL baseline checks. Registration/email verification, scoped authorization, password login, session resolution/revocation, login throttling, logout primitive, and password reset are implemented at the server-service layer. The password-reset lifecycle (digest-only token, one-time consumption, password replacement, audit event, and session revocation) passed PostgreSQL integration run [41581259836](https://github.com/waelkamira/mtjr2/actions/runs/41581259836); general CI passed on commit `79e260082aebe48d6fe2bca535b4f36a55ba4f3b` in [run 41581280754](https://github.com/waelkamira/mtjr2/actions/runs/41581280754). These checks are intentionally focused on critical workflows, not exhaustive tests for every helper. Public HTTP authentication routes, Resend credentials/verified sender configuration and delivery smoke test, resend-verification cooldown, session-cookie/API integration, and one end-to-end public HTTP journey remain outstanding. The server-only Resend adapter, separate password-reset abuse limits, and fail-closed same-origin JSON mutation guard are implemented; the latest CI verification is pending. Routes must invoke the guard before domain operations. **Phase 3 remains blocked** until the essential Phase 2 gates are closed. See [Phase 2 execution plan](docs/implementation/PHASE_02_IDENTITY_PLAN.md) and [build log](docs/implementation/BUILD_LOG.md).

## Phase 2 — Verified database baseline

- [x] Initial Prisma identity migration committed and deployed to clean PostgreSQL 16.
- [x] Deterministic baseline role/permission seed verified through two consecutive executions.
- [x] Initial PostgreSQL-backed identity integration journey passed.
- [x] Updated PostgreSQL concurrency integration suite passed on commit `399fd314a5c94585b02089e939ae1f3b9bd5e19b`.
- [x] Add separate password-reset abuse buckets, same-origin JSON mutation guard, and server-only Resend email adapter (CI verification pending).\n- [ ] Configure real transactional email delivery and verification resend controls.\n- [ ] Complete public login/logout/recovery routes and the protected HTTP journey.
- Phase 3 remains blocked until all Phase 2 exit gates pass.
