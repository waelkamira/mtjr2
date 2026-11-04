# Platform End-to-End Journey Matrix — 49 Systems

**Canonical system scope:** `docs/architecture/COMPLETE_PLATFORM_SYSTEMS_BLUEPRINT.md`  
**Universal execution contract:** `docs/implementation/END_TO_END_JOURNEY_STANDARD.md`  
**Page/route registry:** `docs/implementation/PAGE_ROUTE_REGISTRY.md`  
**Prisma ownership map:** `docs/architecture/PRISMA_MODEL_USAGE_MAP.md`  
**Baseline:** `feat/returns-workflow`, 2026-11-04.

## Purpose and non-negotiable rule

This matrix applies the end-to-end rule to **all 49 systems**. It is a work ledger, not a claim that the listed journeys already work. Every system remains not audited until its real user journeys and every visible action have been traced and verified. No system is complete merely because its page, API, Prisma model, or unit test exists.

A visible control must either:
- complete a real, authorized workflow and show the server-confirmed result; or
- be clearly marked unavailable/coming later and disabled or removed from the active user journey.

No inert buttons, fake data presented as live, optimistic success without persistence, client-only business writes, placeholder payment/refund/payout success, or navigation to missing pages.

## 49-system audit ledger

| # | System | Journey audit | Entry points mapped | Action-to-API trace | Prisma impact reviewed | Exact-commit evidence |
|---:|---|---|---|---|---|---|
| 01 | Identity, authentication and customer account | Partial — source-traced login, verify/resend and password recovery UI/API; registration deliberately blocked; logout UI absent | `/login`, `/verify-email`, `/forgot-password`, `/reset-password`, `/register` (unavailable) | Partial — exact API traces recorded in route registry; logout control not wired | Existing User/session/token/consent/audit models reviewed; no schema change for these pages | Not verified on current head; earlier exact app head CI + disposable PostgreSQL passed, newer UI commits pending CI and deployed HTTP/browser journey |
| 02 | Product catalog and discovery | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 03 | Search, filtering and sorting | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 04 | Cart and checkout | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 05 | Orders and order tracking | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 06 | Product and store reviews | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 07 | Wishlist, favorites and recommendations | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 08 | Product questions and answers | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 09 | Customer messaging and support | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 10 | Customer notifications | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 11 | Returns and refunds (customer journey) | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 12 | Seller onboarding, verification and KYC | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 13 | Seller dashboard and analytics | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 14 | Seller product management | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 15 | Seller order management | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 16 | Seller inventory and warehouse management | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 17 | Supplier and procurement management | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 18 | Shipping and fulfillment (seller) | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 19 | Seller finance, commissions and payouts | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 20 | Seller marketing and promotions | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 21 | Seller reviews and reputation | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 22 | Seller staff and scoped permissions | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 23 | Store management and settings | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 24 | Platform admin dashboard / command center | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 25 | User administration | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 26 | Seller administration and KYC review | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 27 | Catalog administration | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 28 | Central order operations | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 29 | Payment administration | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 30 | Commission management | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 31 | Accounting and general ledger | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 32 | Payout administration | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 33 | Returns, refunds and disputes administration | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 34 | Shipping administration | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 35 | Tax and regulatory compliance | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 36 | Promotions, coupons, loyalty and gift cards | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 37 | Review moderation | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 38 | Central customer support | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 39 | CMS and content administration | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 40 | Platform settings and governance | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 41 | Global markets, currency, FX and localization | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 42 | Invoicing and credit notes | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 43 | Analytics and reporting | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 44 | External integrations and provider adapters | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 45 | Background jobs, event processing and outbox | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 46 | Security, audit and platform risk controls | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 47 | SEO and public discovery | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 48 | Newsletter and lifecycle email | Not audited | Not mapped | Not audited | Not audited | Not verified |
| 49 | Property listings and booking domain (separate bounded context) | Not audited | Not mapped | Not audited | Not audited | Not verified |

**Status vocabulary:** Not audited → Mapped → Wired → Implemented → Verified → Complete. A status can move forward only with linked evidence. If a feature has no required persistence, record “No schema change — reason” rather than inventing a table. “Complete” applies only to the agreed scope and requires provider/policy/operational dependencies to be explicitly resolved or excluded.

## Required action trace record

Create one record for **each** visible button, link, form submission, menu action, bulk action, background-triggering action, and API mutation. Group controls only when they share the same handler, payload, authorization rule, domain operation, and outcome; otherwise trace them separately.

| Field | Required evidence |
|---|---|
| Action identity | System number, page/route, component/file, exact visible label, actor (guest/customer/seller/staff/admin/system), starting state |
| Interaction | Click/submit handler, fields, client validation, loading/disabled state, double-submit prevention, destination/confirmation |
| Preconditions | Session, email verification, role, resource ownership/scope, entity status, market/policy/provider prerequisites |
| API contract | Method/path, request schema, response schema, safe error codes, CSRF/origin/rate-limit protections where applicable |
| Domain execution | Service/use-case and repository; business invariants enforced server-side, not only in UI |
| Authorization | Server-derived actor; ownership and tenant/store scope; forbidden cross-user/cross-store/escalation tests |
| Prisma decision | Existing models checked; exact models/relations/constraints/indexes; or explicit reason no schema change is required |
| Transaction integrity | Atomic writes, concurrency/stale-state behavior, uniqueness, idempotency/retry, audit/outbox/notification effects |
| Final outcome | Persisted state, returned data, refreshed UI, final route, user-visible confirmation, refresh/retry behavior |
| Failure outcomes | Validation, unauthenticated, forbidden, not found, conflict, rate limit, provider unavailable, timeout, server failure |
| Evidence | Focused tests, exact CI/PG run for exact commit, browser/HTTP evidence when configured, reviewer notes |
| Remaining scope | Explicit exclusions, external decisions, operational dependencies, known gaps and owner |

## End-to-end lifecycle that must be covered

For each system, map the full lifecycle relevant to its domain:

1. **Discover and enter:** where the actor finds the action; visible CTA and navigation; guest/unauthorized behavior.
2. **Prepare:** required data, form state, validation, policy disclosure and prerequisites.
3. **Submit/execute:** exact click/submit event, API contract, pending state, retry and duplicate handling.
4. **Authorize:** server-side session, role, ownership, resource scope and business-state checks.
5. **Process:** domain service, database transaction, external provider or job handoff, idempotency and concurrency.
6. **Persist:** canonical Prisma records and relations, audit/event/notification records; migration/backfill if schema changes.
7. **Confirm:** server-confirmed outcome, updated UI, destination, status and receipt/reference where applicable.
8. **Continue:** subsequent user/admin/seller actions, state transitions, cancellation, correction, dispute, return or reversal as applicable.
9. **Recover:** retry, stale state, provider timeout/webhook replay, duplicate delivery, failed job, compensation/reconciliation.
10. **Verify:** relevant happy path and distinct security/data-integrity/failure invariants with exact-commit evidence.

## Completion gates

- **Mapped:** every page and action for the agreed system scope has an owner, actor, API/service, persistence decision and outcome.
- **Wired:** the visible control invokes the intended real route/API and handles pending and error responses.
- **Implemented:** domain rules, authorization, persistence, audit/events and state transitions exist; no fake outcome.
- **Verified:** critical success, failure, ownership/permission, duplicate/retry and concurrency invariants are tested; required CI and disposable PostgreSQL checks pass for the exact commit. Browser/HTTP journey evidence is recorded where a runnable environment exists.
- **Complete:** all agreed user journeys and operational dependencies for the system scope pass; no visible dead end or knowingly nonfunctional control remains in that scope.

A missing browser environment is a verification limitation, not a reason to claim success. A control intentionally not yet implemented must not be exposed as an active feature. Provider-dependent systems cannot be marked complete using mocks alone.

## Cross-cutting audit order

Audit shared dependencies once, then re-check them from each consumer journey: identity/session → permission and resource scope → market/currency → catalog → cart/checkout/order → payment/refund/payout → inventory/fulfillment → returns/disputes → notifications/support → admin/audit/reporting. A shared component passing its own test does not waive verification at each system boundary.

## Change log

- 2026-11-04: Created the all-49 system ledger. All rows start as Not audited; this intentionally avoids converting route/model presence into completion claims.


## System 01 initial action trace — source implementation, not yet verified

| User action | UI → API | Server/domain/persistence | Final outcome and remaining gate |
|---|---|---|---|
| Sign in | `/login` submit → `POST /api/auth/login` | same-origin JSON guard → trusted-proxy IP resolution → `loginWithPassword` → session cookie, LoginAttempt, lastLoginAt, AuditLog | Server sets HttpOnly session cookie; client redirects only to same-origin local return path or `/account/orders`. Needs deployed proxy config and HTTP/browser test. |
| Verify email | `/verify-email` submit → `POST /api/auth/verify-email` | same-origin guard → `verifyUserEmail`; consumes one-time token and activates only PENDING user; AuditLog | Shows server message; token removed from visible URL. Needs real email delivery and HTTP/browser proof. |
| Resend verification | `/verify-email` resend → `POST /api/auth/verification/resend` | IP throttle → issue new single-use token digest → Resend adapter | Generic anti-enumeration response; needs configured sender and delivery smoke test. |
| Request reset | `/forgot-password` submit → `POST /api/auth/password-reset/request` | trusted IP + separate reset throttle → eligible account challenge, token digest, AuditLog → Resend adapter | Generic response regardless of account existence; needs delivery smoke test. |
| Complete reset | `/reset-password` submit → `POST /api/auth/password-reset/complete` | consume token once → hash new password → revoke all sessions → AuditLog | User can sign in with new password; service has PostgreSQL coverage on earlier commit; current UI requires exact-head CI/HTTP proof. |
| Register | `/register` displays unavailable state; no submit control | Registration API/service exists; consent stored in UserConsent; legal documents are absent | Deliberately blocked until approved Terms and Privacy Notice are published. No false success. |
| Logout | No user-facing action currently wired | `POST /api/auth/logout` and logout service exist | Not complete as a user journey; add account navigation control and verify session denial after logout before claiming completion. |
