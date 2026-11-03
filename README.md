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

The initial architecture will be established before feature implementation:

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

## Documentation

- `docs/architecture/` — architecture decisions, domain boundaries, and system blueprint.
- `docs/implementation/` — phase plans and implementation records.
- `docs/quality/` — test strategy, security, and release evidence.
- `prisma/` — canonical Prisma schema, migrations, and seed data.

## Current status

**Status: Phase 1 foundation scaffolded; Phase 2 identity/access in progress.** The repository was verified empty before initialization. The Next.js/TypeScript application shell, environment validation, Prisma client singleton, identity/access schema, authorization policy, password hashing, session lifecycle, and transactional registration/email-verification services are committed. CI is still being stabilized; no migration has been generated or applied, email delivery is not connected, and no public registration/login route is exposed. See [Phase 2 execution plan](docs/implementation/PHASE_02_IDENTITY_PLAN.md) and the [build log](docs/implementation/BUILD_LOG.md).
