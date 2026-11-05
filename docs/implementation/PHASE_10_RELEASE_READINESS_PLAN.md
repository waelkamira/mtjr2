# Phase 10 — Release readiness and controlled launch execution plan

**Status:** Not launch-ready by inference.  
**Prerequisites:** Phases 1–9 have passed the gates applicable to the first explicitly approved market.

## Objective
Release one controlled marketplace slice safely, with known operating ownership, rollback capability and verifiable customer journeys. This phase does not itself activate a market or authorize deployment.

## Work packages
1. Release scope: name the market, roles, product categories, shipping methods, currencies, payment providers, support coverage and excluded capabilities.
2. Security: threat model, auth/session review, authorization/scope tests, secret handling, dependency scan, webhook verification, rate limiting, privacy and privileged-action controls.
3. Data safety: production schema diff review, backup confirmation, migration rehearsal, lock/duration assessment, forward recovery and rollback/disable plan.
4. Quality: exact-head Prisma validate/generate, typecheck, lint, focused unit/integration tests, production build and critical browser journey.
5. Customer journeys: buyer browse → cart → checkout → payment result → order; seller order preparation; customer support/return; admin review; identity register/verify/login/logout where enabled.
6. UX/accessibility: responsive layout, keyboard/focus, screen-reader labels, loading/empty/error/forbidden/not-found/conflict states and no dead controls.
7. Performance: baseline browse/search, product detail, login, cart/checkout, order placement and seller/admin lists; agree budgets before load testing.
8. Operations: dashboards, alert routing, support escalation, incident/change runbooks, worker/outbox health and status communication.
9. Deployment: environment inventory, domain/TLS, trusted proxy, secrets, database connection/pooling, migration window, smoke test, rollback and post-release monitoring.

## Launch blockers
- No real payment success without verified provider sandbox/live evidence and approved merchant setup.
- No public email delivery without verified sender and provider smoke test.
- No market activation without Phase 9 approval.
- No production migration without owner approval, backup evidence and reviewed migration plan.
- No Vercel deployment or secret changes are authorized by this document alone.

## P0 acceptance
- All critical CI jobs pass on exact release SHA.
- Disposable PostgreSQL migration/integration passes; production migration is reviewed separately.
- Critical user journeys pass against the release candidate and selected market configuration.
- Security review has no unresolved critical/high-risk issue.
- Restore/rollback rehearsal and alert routing are demonstrated.
- Every enabled customer-facing control has a verified outcome or is clearly unavailable/disabled.

## Exit criteria
Owner signs off the named market, provider set, deployment window, support ownership and rollback plan. Record exact release SHA, checks, smoke evidence, migration evidence and known limitations. Launch only the approved scope.
