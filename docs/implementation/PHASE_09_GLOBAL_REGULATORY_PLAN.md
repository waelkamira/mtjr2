# Phase 9 — Global market and regulatory readiness execution plan

**Systems:** 35, 40, 41, 44, 46; cross-cutting with seller onboarding, catalog, payments, shipping and privacy.  
**Status:** Reference-data and selected configuration foundations exist; global regulatory readiness is not complete.

## Objective
Make market availability an explicit, approved capability rather than assuming that country/currency rows or a generic tax percentage permit cross-border trading.

## Work packages
1. Market policy: approved country/region, legal operator/entity, buyer/seller eligibility, product restrictions, language, currency and service availability.
2. KYB/merchant governance: legal entity, beneficial owners, representatives, tax IDs, evidence/document expiry, screening where required, review and re-verification.
3. Product compliance: restricted/prohibited goods, certifications, safety warnings, traceability, recalls and market-specific listing eligibility.
4. Tax determination: jurisdiction, seller nexus, tax-inclusive/exclusive pricing, exemptions, invoice rules, calculation evidence and filing exports.
5. Customs/landed cost: origin, HS classification, duties, import restrictions, Incoterms, broker handoff and customer disclosure.
6. FX policy: source/time, rate precision, stale-rate behavior, rounding, conversion disclosure and settlement currency.
7. Privacy/data governance: consent, access/export/deletion, retention, legal hold, data residency assessment, subprocessors and breach response.
8. External provider governance: contracts, data flows, service regions, credential ownership, outage fallback and security review.
9. Server-side enforcement: every market-sensitive API validates eligibility; UI hiding alone is never a restriction.

## P0 acceptance
- Unsupported country/product/seller/payment/shipping combinations are rejected server-side.
- Tax cannot silently default to zero when a required rule is absent.
- Market activation is blocked without approved legal, tax, customs, payment, payout and logistics evidence.
- Sensitive compliance documents are private, scoped and audited.
- FX snapshots preserve source/time/precision and never rewrite historical order values.

## Exit criteria
Owner-approved market activation checklist, reviewed legal/tax/compliance decisions, focused jurisdiction and permission tests, and a documented rollback/disable path. A demo market is not a launch-market approval.
