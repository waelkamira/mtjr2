# Platform delivery roadmap audit — Phases 1–11

**Audit date:** 2026-11-05  
**Repository baseline reviewed:** `main` at `1a111c59aebdc3bed117ac2faf31dcf5db35060a`  
**Canonical data contract:** `prisma/schema.prisma`  
**Scope:** Reconcile the README delivery phases, phase plans, 49 system specifications, route registry, journey evidence, and operational gates. This is a planning correction, not a claim that every phase has passed.

## 1. Audit findings and corrections

The previous roadmap was not a complete 1–10 plan:

1. The README listed only **nine** phases.
2. Only detailed execution plans for Phases 2, 3, and 4 existed under `docs/implementation/`; Phase 1 had a technical foundation note, not a delivery/acceptance plan. Dedicated phase plans for 5–10 were missing at audit time; this follow-up adds those execution plans.
3. The 49-system inventory and the phase roadmap were being used interchangeably. They are different dimensions: phases are delivery gates; systems are independently owned capabilities. System 10 (notifications) is not Phase 10.
4. The README and older audit snapshots contain historical branch/PR states. They must not override current GitHub state or exact-commit CI evidence.
5. Several documents list routes/models as present while explicitly warning that this is not proof of working journeys. The route registry and journey matrix must remain the evidence ledger.
6. Some phase boundaries overlap: payments/refunds, tax/customs, seller operations, trust/communications and release operations appear in multiple broad descriptions. Ownership is clarified below.
7. “Global marketplace” cannot be declared launch-ready from a basic market/currency table or percentage tax rule. Legal entity/KYB, product compliance, jurisdictional tax, customs, payment coverage, settlement, logistics, privacy and market-specific policy require explicit approval and evidence.
8. Phase 2 has meaningful implemented identity services, but production completion still depends on provider/proxy configuration and a deployed HTTP journey. Distinguishing unknown email from wrong password is an intentional account-enumeration trade-off and must remain an explicit security decision.
9. Phase 3 remains incomplete pending seller/catalog end-to-end acceptance and owner-approved reference data. Phase 4 remains incomplete while payment, fulfillment and remaining order lifecycle gates are open.
10. The current roadmap did not define a separate post-launch operations phase. This is added as Phase 11.

## 2. Corrected canonical phase sequence

| Phase | Name | Main ownership boundary | Exit gate |
|---:|---|---|---|
| 1 | Technical foundation | Runtime, repository, environment, Prisma baseline, CI, logging, error conventions | Clean disposable PostgreSQL migration replay; Prisma/typecheck/lint/unit/build pass |
| 2 | Identity and access | Accounts, credentials, sessions, OAuth, verification, recovery, RBAC, scoped authorization, audit | Critical identity integration passes; deployed HTTP journey and provider/proxy gates recorded before production |
| 3 | Marketplace core | Markets/reference data, seller/store onboarding foundation, taxonomy, catalog, variants, media, discovery, inventory primitives | Seller and catalog journeys verified; launch reference data approved |
| 4 | Buying core | Cart, quote, reservation, address, shipping quote, tax snapshot, order/vendor order, payment and customer order lifecycle | One complete multi-vendor purchase path; payment only through verified provider events; rollback/idempotency and stock invariants pass |
| 5 | Seller operations and administration | Seller workspace, store staff, procurement, seller order/fulfillment, platform admin queues and domain operations | Seller-scoped workflows and admin decisions verified; no cross-store access |
| 6 | Financial integrity | Payment lifecycle, commissions, ledger, reconciliation, seller balances, payout execution, invoices/credit notes | Double-entry invariants, provider reconciliation, idempotent money movement and dual-control policies pass |
| 7 | Trust, engagement and communications | Reviews, Q&A, messaging, support, returns, notifications, loyalty/promotions, lifecycle communications, moderation | Customer/seller/admin journeys, consent, privacy, abuse and event-delivery behavior verified |
| 8 | Separate property and booking domain | Property listings, inquiries, booking lifecycle and domain-specific policies | Separate domain ownership and access rules proven; shared services reused without commerce coupling |
| 9 | Global market and regulatory readiness | Market localization, FX display, tax determination, customs/landed cost, KYB, product compliance, privacy and market eligibility | Per-market legal/operational checklist approved; no market activated on assumed rates or unsupported services |
| 10 | Release readiness and controlled launch | Security review, performance, accessibility, SEO, observability baseline, backup/restore rehearsal, deployment and runbooks | Release checklist passes for one explicitly approved market and deployment target |
| 11 | Production operations, reliability and scale | SLOs, incident response, operational analytics, queue/outbox health, capacity, DR, continuous security and safe market expansion | Operational ownership, alerts, restore evidence, capacity thresholds and rollback/incident drills are demonstrated |

### Dependency corrections

- Phase 4 consumes Phase 2 identity and Phase 3 catalog/inventory; it does not own seller catalog authoring.
- Phase 5 owns seller/admin operational workflows; it consumes orders/payments/returns instead of duplicating their domain rules.
- Phase 6 owns financial records and money movement. Payment-provider integration starts in Phase 4, but accounting, settlement, payout and reconciliation belong to Phase 6.
- Phase 7 owns customer trust and engagement. Refund execution remains in Phase 6/33; System 11 returns owns the customer return request and eligibility journey.
- Phase 9 owns regulatory and market approval. Phase 3 market reference tables do not imply a market is commercially/legal-ready.
- Phase 10 is the pre-launch release gate. Phase 11 begins only after controlled launch; it is not a substitute for missing launch gates.
- Phase 8 remains a separate bounded context. It may reuse identity, notifications and payment infrastructure only through explicit contracts.

## 3. Phase-by-phase review of 1–10

### Phase 1 — Foundation
**Existing evidence:** `docs/architecture/FOUNDATION.md`, root architecture, environment validation, Prisma singleton, CI workflows and migrations.  
**Correction:** FOUNDATION.md describes the original scaffold and still says registration/authentication are absent; that paragraph is historical and must not be interpreted as current identity status.  
**Status:** Implemented foundations exist; operational completeness must be assessed against current exact-head CI and clean-database replay.  
**Remaining gate:** Confirm clean disposable DB migration replay, environment validation, production build and error/logging behavior. Never use the owner's important database.

### Phase 2 — Identity and access
**Existing plan:** `PHASE_02_IDENTITY_PLAN.md`.  
**Status:** Core services, UI and security primitives are implemented. The plan correctly leaves production HTTP journey, verified Resend delivery and trusted-proxy configuration as operational gates. Account-address edit/delete/default management and real Google provider journey remain gaps where applicable.  
**Correction:** Distinguish “implemented”, “verified”, and “production-ready”; do not mark System 01 complete because APIs or forms exist. Unknown-email versus wrong-password feedback deliberately reveals account existence; preserve rate limits and document the risk.

### Phase 3 — Marketplace core
**Existing plan:** `PHASE_03_MARKETPLACE_PLAN.md`.  
**Status:** Market/store/seller, taxonomy, catalog/discovery and inventory foundations have implementation evidence; seller/catalog end-to-end acceptance and owner-approved market/taxonomy seed remain open.  
**Correction:** Typo-tolerant/full-text ranking, seller structured-attribute authoring, product structured data and live browser acceptance are not assumed complete. Do not seed/activate launch markets without owner approval.

### Phase 4 — Buying core
**Existing plan:** `PHASE_04_BUYING_PLAN.md`.  
**Status:** Cart, quote/reservation, address, shipping/tax snapshots and transactional order/vendor-order creation have been developed; payment and fulfillment lifecycle remain incomplete.  
**Correction:** Keep orders pending payment until verified provider events. Return approval is not a refund. A configured percentage tax rule is not a global tax engine. Never fake payment, shipment or delivery state.

### Phase 5 — Seller operations and administration
**Existing coverage:** System specs 12–30, seller workspace, staff, inventory, moderation and admin surfaces. No dedicated phase execution plan existed.  
**Status:** Partial/implemented slices exist; do not infer all seller, procurement, admin and fulfillment journeys are complete.  
**Remaining:** KYC document lifecycle, store profile/suspension, procurement, shipping labels/tracking/exceptions, seller analytics, admin domain boundaries and full route/action evidence.

### Phase 6 — Financial integrity
**Existing coverage:** Systems 19, 29–32, 42 and related payment/order contracts. No dedicated phase execution plan existed.  
**Status:** Partial foundations only; provider-neutral payment intent/webhook work does not equal live payment, accounting, reconciliation or payout readiness.  
**Remaining:** Double-entry ledger, commission accrual, settlement, payout/bank verification, refund/dispute money movement, invoice/credit-note lifecycle, reconciliation and financial dual control.

### Phase 7 — Trust, engagement and communications
**Existing coverage:** Systems 06–11, 21, 33, 37–39, 45 and 48. No dedicated phase execution plan existed.  
**Status:** Several customer-facing slices exist (reviews, wishlist, Q&A, messaging/support, notifications and return requests); provider delivery and complete moderation/refund/retention journeys remain conditional or partial.  
**Remaining:** Real outbound delivery, consent enforcement at send time, attachment scanning/storage, return-to-refund integration, dispute workflows, moderation appeals and lifecycle suppression/bounce handling.

### Phase 8 — Property and booking
**Existing coverage:** System 49 and the separate property/booking design. No dedicated phase execution plan existed.  
**Status:** Treat as a separate bounded context and do not assume a complete implementation from schema/design presence.  
**Remaining:** Property-specific listing, inquiry, booking, availability, cancellation, payment/refund and dispute workflows, each with its own policies and tests.

### Phase 9 — Global market and regulatory readiness
**Existing coverage:** Systems 35, 40, 41, 44, 46 and global capabilities in the page/control specification. No dedicated phase execution plan existed.  
**Status:** Basic market/currency reference and configurable tax foundations do not satisfy global launch requirements.  
**Remaining:** Legal entity/KYB, product compliance, jurisdictional tax evidence, customs/landed cost, privacy/data governance, market eligibility, FX policy and localized legal content.

### Phase 10 — Release readiness and controlled launch
**Existing coverage:** Deployment guide, quality/security docs and release-readiness references; no dedicated phase execution plan existed.  
**Status:** Not launch-ready by inference. Vercel account/project, production secrets, provider configuration and production database approval are not established by repository docs.  
**Remaining:** Threat/security review, load/performance budgets, accessibility, backup/restore, deployment/rollback rehearsal, operational ownership and a single approved-market launch checklist.

## 4. Required evidence and status vocabulary

Use the same status values consistently:

- **Target:** specified but no implementation evidence.
- **Present:** code/schema/page exists; no end-to-end proof.
- **Wired:** UI/API/service/persistence path is connected; verification still incomplete.
- **Verified:** exact-commit CI and the relevant disposable PostgreSQL/journey checks pass.
- **Conditional:** blocked on approved policy, provider credentials, external service or owner decision.
- **Launch-ready:** all required operational, legal, security and production gates for the named market are passed.

A CI pass on an ancestor, a cancelled/pending run, a stale branch, a schema model, or a UI screenshot cannot promote a capability to Verified. Never mix “not audited” with “missing”.

## 5. Source-of-truth hierarchy

1. Current GitHub branch/PR state and exact commit checks.
2. `prisma/schema.prisma` plus committed migrations.
3. System-specific contract in `docs/systems/NN-*.md`.
4. `SYSTEM_INTEGRATION_MATRIX.md` for dependencies.
5. `PAGE_ROUTE_REGISTRY.md` for actual routes and route status.
6. `END_TO_END_JOURNEY_MATRIX.md` and `END_TO_END_JOURNEY_STANDARD.md` for action-level evidence.
7. Phase plans for delivery sequence and exit gates.
8. `BUILD_LOG.md` for dated implementation history (historical entries are not automatically current state).

If two documents disagree, update the owning canonical document and record the correction; do not silently choose the more optimistic statement.

## 6. Execution order from this audit

1. Close the identity feedback PR only after exact-head General CI and PostgreSQL integration pass; do not confuse that UX slice with all Phase 2 production exit gates.
2. Reconcile the current buying/payment and seller branches against main; remove stale historical claims and avoid merging stacked branches blindly.
3. Continue Phase 4 payment/fulfillment only with real provider contracts and no simulated success.
4. Close Phase 3 seller/catalog acceptance and approved reference data.
5. Complete seller/admin Phase 5 and financial Phase 6 in dependency order.
6. Complete trust/engagement Phase 7, including returns-to-refunds contracts.
7. Keep Phase 8 property isolated.
8. Approve Phase 9 market/regulatory scope before enabling any market.
9. Pass Phase 10 release gates for one named market.
10. Start Phase 11 operational scaling only after launch evidence exists.

**Safety:** No production database migration, production secret change, Vercel deployment, real payment, or real customer email is authorized by this roadmap.


## 7. Phase plan coverage follow-up — 2026-11-05

Dedicated execution plans have now been added for Phase 1 and Phases 5–10:
- `PHASE_01_FOUNDATION_PLAN.md`
- `PHASE_05_SELLER_ADMIN_PLAN.md`
- `PHASE_06_FINANCIAL_INTEGRITY_PLAN.md`
- `PHASE_07_TRUST_ENGAGEMENT_PLAN.md`
- `PHASE_08_PROPERTY_BOOKING_PLAN.md`
- `PHASE_09_GLOBAL_REGULATORY_PLAN.md`
- `PHASE_10_RELEASE_READINESS_PLAN.md`

Phase 2–4 retain their existing detailed execution plans. Phase 11 remains defined in `PHASE_11_PRODUCTION_OPERATIONS_PLAN.md`. These documents close the plan-documentation gap only; they do not mark their phases implemented or verified.
