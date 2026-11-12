# Jurisdiction-Aware Financial Policy Engine

**Status:** DESIGN BASELINE — no accounting treatment or payout permission is approved by this document  
**Scope:** Market, country, region, currency, product, seller, payment rail, and effective-date policy selection  
**Related decision register:** `docs/finance/SELLER_PAYOUT_POLICY_DECISIONS.md`

## 1. Purpose

Matjar operates across markets whose tax, consumer-protection, refund, settlement, payment, and seller-verification rules may differ. A single global rule must therefore never silently override a mandatory local requirement.

The platform will use a versioned policy engine. The engine selects and explains applicable rules; it does not invent missing legal values and does not itself post money.

## 2. Policy layers and precedence

Evaluate applicable policy candidates in this order, from most specific to least specific:

1. **Mandatory legal rule** — country and, where relevant, state/province/region; includes effective dates and legal source/review metadata.
2. **Market rule** — the Matjar market configured for the checkout or seller operation.
3. **Payment-rail / provider constraint** — supported currencies, settlement timing, refund capabilities, limits, and provider-specific restrictions.
4. **Product or transaction-class rule** — perishable, digital, made-to-order, regulated, subscription, and other legally meaningful classes.
5. **Seller agreement / risk rule** — only where contractually and legally permitted.
6. **Platform default** — applies only to non-legal operational choices where no higher-priority rule exists.

A lower layer may make a rule stricter only when allowed by law and contract. It may not weaken or replace a mandatory legal rule. If two mandatory rules conflict or the engine cannot determine which applies, return a blocked/needs-review result; do not guess.

## 3. Policy domains

Each domain is independently versioned and evaluated. Do not assume that a decision in one domain automatically determines another.

- Tax calculation, collection, invoicing, and remittance responsibility.
- Consumer cancellation and return eligibility, deadlines, and exceptions.
- Refund method, timing, partial-refund allocation, and shipping/tax treatment.
- Seller payable recognition, reserve/hold, release, and negative-balance recovery.
- Settlement cadence, cutoffs, payout rails, minimums, maximums, and fees.
- Seller identity, business verification, beneficiary ownership, and payout eligibility.
- Currency support, conversion permission, rate source, timestamp, and FX accounting.
- Chargeback/dispute allocation and evidence deadlines.
- Record retention, disclosures, and required audit evidence.

## 4. Rule record requirements

Every published rule must carry:

- Stable rule ID and immutable version.
- Domain and rule key.
- Jurisdiction: country code and optional subdivision/region.
- Optional market, currency, product-class, seller, and payment-provider scope.
- Effective-from and effective-until timestamps, with an explicit timezone convention.
- Value and typed unit (basis points, minor units, calendar days, business days, currency code, boolean, or enumerated value).
- Mandatory/legal versus contractual versus platform classification.
- Legal/source reference, reviewer, approval timestamp, and review status when it represents a legal requirement.
- Created-by, changed-by, reason, and audit event.

Published versions are immutable. A correction creates a new version; historical orders and journal entries retain the rule-version IDs used at the time.

## 5. Evaluation contract

The policy resolver must return one of:

- `APPLICABLE` — a single unambiguous, approved rule was selected.
- `NOT_REQUIRED` — the domain is explicitly not applicable to this transaction.
- `MISSING_CONFIGURATION` — no eligible rule exists.
- `CONFLICT` — multiple incompatible mandatory rules match.
- `REVIEW_REQUIRED` — a rule exists but lacks required legal review/approval or its source is stale.
- `UNSUPPORTED` — the country, currency, product class, or payment rail is not supported for this operation.

The result must include selected rule IDs/versions, matched scope, evaluation timestamp, and reason codes. Do not return a guessed fallback value for blocked outcomes.

## 6. Fail-closed money controls

The following operations remain disabled for a transaction whenever their required policy domains are unresolved:

- Tax finalization and checkout payment capture where a legally required tax treatment is unknown.
- Seller payable recognition and release.
- Reserve/hold release.
- Refund posting where the allocation treatment is unresolved.
- Withdrawal eligibility, reservation, submission, and completion.
- Cross-currency conversion or aggregation.

Informational reports may show source facts and clearly label estimates/unconfigured states, but must not describe them as withdrawable or settled funds.

## 7. Relationship to existing Matjar implementation

The current codebase already has market-scoped tax rates with region matching and effective dates in `src/server/tax/tax.ts`; it explicitly returns an unconfigured result instead of assuming a tax amount. Commission selection already supports seller+category, seller, category, and global scopes in `src/server/admin/commission-policy.ts`.

These are useful existing patterns, not a complete jurisdiction policy engine. The next implementation phase should extract a shared typed resolver and migrate domains incrementally without changing current money behavior until each domain's rules and tests are approved.

The double-entry journal in `src/server/finance/ledger.ts` remains a posting primitive. It must not be connected to seller payable, refund, reserve, or payout events until the corresponding policy decisions in the decision register are approved.

## 8. Implementation sequence

1. Inventory the existing market, country, currency, tax, commission, payout, and provider models.
2. Define a typed rule schema and immutable version/audit model; do not duplicate existing market-tax records unnecessarily.
3. Implement a pure resolver with deterministic precedence, ambiguity detection, effective-date handling, and explicit blocked outcomes.
4. Add table-driven tests for exact-country, region-over-country, market, provider, effective-date boundaries, conflicting legal rules, missing configuration, and unsupported operations.
5. Integrate read-only policy evaluation into admin previews first.
6. Integrate checkout/tax only after mapping current tax records and validating market-country-region relationships.
7. Integrate refunds, seller payable, reserves, and payouts only after the relevant FIN decisions are approved.
8. Add jurisdiction-specific legal review and operational monitoring before enabling a new market.

## 9. Explicit non-decisions

This design does **not** select a universal return window, payout schedule, reserve percentage, tax liability model, shipping ownership, seller earnings basis, refund allocation, chargeback liability, or FX policy. Those remain market- and transaction-specific decisions requiring verified rules and approval.

No rule may be published as legally approved merely because a platform administrator entered it. Legal review status and source evidence must be explicit.


## 10. First implementation checkpoint

A pure resolver is now available at `src/server/finance/policy-resolver.ts`. It implements the precedence and fail-closed outcomes above without database writes or journal posting. Legal candidates must be explicitly country-scoped and include both a source reference and review timestamp before they can be selected. Matching pending/rejected rules block fallback at the winning precedence/specificity level. Equal-rank rules with different values return `CONFLICT`.

Focused unit coverage is in `tests/finance/policy-resolver.test.ts`, including legal-over-platform precedence, subdivision specificity, pending-review blocking, equal-rank conflict, effective-date boundaries, invalid country/currency, and unscoped legal rules.

**Boundary:** this first resolver is not yet wired into checkout, refund, commission, ledger, or payout flows. It has not been runtime-tested in this change session. Do not treat its existence as approval to enable any money movement. Before persistence/integration, add schema-backed rule versioning and verify resolver semantics against the jurisdiction model and legal review workflow.
