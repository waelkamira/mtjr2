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

## Deployment

- Production hosting decision: Vercel.
- Vercel setup, environment variables, PostgreSQL migration procedure, trusted-proxy requirements, and the single Phase 2 production verification journey: [Vercel deployment guide](docs/deployment/VERCEL.md).
- Vercel account/project connection and production secrets are not yet configured; do not treat the deployment gates as passed until evidence is recorded in the build log.

## Documentation

- `docs/architecture/` — architecture decisions, domain boundaries, and system blueprint.
- `docs/implementation/` — phase plans and implementation records.
- `docs/quality/` — test strategy, security, and release evidence.
- `docs/design/` — visual design system, component rules, and accessibility standards.
- `prisma/` — canonical Prisma schema, migrations, and seed data.

## Current status

**Phase 1 foundation: scaffolded. Phase 2 identity/access: implementation and code verification complete; production-only exit checks are deferred, not passed. Phase 3 Marketplace Core: schema implementation in progress. Country/Currency/Market, Seller/Store, Category/Brand taxonomy, and Product/Variant/Media/Price schema foundations are committed; workflows, reference-data seed, product attributes, and post-change CI verification remain pending.**

Implemented identity capabilities include registration, email verification, login/logout services, session resolution and revocation, password reset, persistent abuse throttling, scoped server-side authorization, role assignment/revocation, audit events, same-origin JSON mutation protection, a server-only Resend adapter, and a fail-closed trusted-proxy IP resolver.

**Verification evidence**
- General CI passed on the latest documentation commit `0716f8f43e60771c3702bb6984715915a0a1a665`: [run 41648760634](https://github.com/waelkamira/mtjr2/actions/runs/41648760634). It includes Prisma validate/generate, typecheck, lint, unit tests, and production build.
- PostgreSQL identity integration passed on `0ffb3b4651b06d90c9eecb10eed960c87bae0348`: [run 41647984160](https://github.com/waelkamira/mtjr2/actions/runs/41647984160).
- The existing focused password-reset PostgreSQL lifecycle and general CI evidence is recorded in [Phase 2 execution plan](docs/implementation/PHASE_02_IDENTITY_PLAN.md) and [build log](docs/implementation/BUILD_LOG.md).

**Deferred Phase 2 production exit work (not passed)**
1. Configure a verified Resend sender and perform one real delivery smoke test.
2. Verify the trusted proxy header and block direct origin bypass.
3. Run one deployed HTTP journey: register → verify email → login → `/api/auth/me` → logout → confirm anonymous access is denied.
4. Record deployment evidence and the focused security review.

These are production-release gates, not blockers for schema/domain development in Phase 3. Continue using only local/disposable/CI PostgreSQL until the owner explicitly approves production database access. No additional helper-level test suites are planned.

Phase 3 execution plan: [Marketplace Core plan](docs/implementation/PHASE_03_MARKETPLACE_PLAN.md).