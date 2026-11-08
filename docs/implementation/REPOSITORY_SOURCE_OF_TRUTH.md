# Repository source of truth and consolidation status

**Audit date:** 2026-11-05  
**Audited baseline:** `main` at `5f5d1da7d8fd8d6c7ea4f1981ef39acf9de578d3`  
**Canonical branch:** `main`  
**Canonical Prisma schema:** `prisma/schema.prisma`

## 2026-11-08 — Closed-PR reconciliation and customer-address repair

The closed pull requests were checked by their actual merged state, their changed files, and content comparison against current `main`. A closed PR is not assumed to be merged.

- PR [#77](https://github.com/waelkamira/mtjr2/pull/77) safely reconstructed the remaining useful customer-address correction from closed, unmerged PR #22 and was squash-merged as `881fc9ed5bf3e807b2f4013e991899463adee76b`.
- Exact source head `64044d409da434486ccaff5a6574f7e9ee5a3b45` passed CI run `42475854889`, Platform PostgreSQL Integration run `42475854901`, and Browser E2E run `42475854837`. All three completed successfully.
- The fix aligns `/api/countries` (ISO-2 `iso2`) with `/api/account/addresses` (ISO-2 `countryCode` and flattened `countryName` response). The previous page used incompatible country identifiers and response fields.
- The same change adds focused service tests for session-derived ownership, active-country lookup, default-address handling, and response shape.
- The merge commit is present on `main`; comparing `main` to `881fc9e` reports identical refs.
- No production database migration or Vercel deployment was performed.

### Closed, unmerged PR dispositions

| Closed PRs | Finding | Final disposition |
|---|---|---|
| #2–#14 | Their feature trees are already represented on `main`, have no remaining code diff, or contain only obsolete workflow/UI changes superseded by later implementations. | Do not merge old branches. |
| #16–#17 | Seller return visibility and the per-vendor return design were reconstructed in #19 and #20. | Already represented on `main`. |
| #22 | Identity/OAuth token verification and customer-role corrections are present through later merged identity work, including #59. The saved-address UI still had a country-contract mismatch. | Address defect repaired and tested in #77; old branch remains unmerged. |
| #26 | Seller shipment creation and buyer tracking were rebuilt on current `main` in #41. | Already represented on `main`. |
| #37 | Phase roadmap documentation was superseded by #38 and #39. | Already represented on `main`. |
| #40 | Webhook retry/signature test coverage exists in the current payment webhook test suite under its canonical path. | No unique test to port. |
| #47 | Manual return refunds were reconstructed and merged in #59, including the migration, finance operations, and refund lifecycle tests. | Old branch remains unmerged; functionality is on `main`. |
| #51–#52 | Stale identity/Super Admin rebuilds overlap the merged control center and canonical MFA/privilege workflow (#35, #60, #62). | Do not merge alternate schema or migrations. |
| #55–#56 | Groq provider foundation is included in #54; #56 is explicitly a superseded audit note. | Already represented or obsolete. |
| #63, #65 | Independent reviewer policy and PostgreSQL/browser regression coverage were integrated through #62 and #64. | Already represented on `main`. |
| #67 | Anonymous API boundary sweep and fixes were integrated through #68. | Already represented on `main`. |
| #69, #75 | Superseded by the clean product/catalog extraction in #76. | Old branches remain unmerged. |
| #71–#74 | Verification-only branches or changes already present on `main`; #72 gallery recovery/store-lock logic and #74 multipart guard are present in current source. | No stale verification branch merged. |
| #77 | Focused reconstruction of the address contract fix. | Merged and exact-head verified. |

**Current open integration decisions:** none identified among the closed PRs reviewed in this reconciliation. This does not mean all 49 platform systems or all customer/seller/admin journeys are complete; use the journey matrix for those remaining implementation and release gaps.

## Non-negotiable repository rule


`main` is the only canonical source of truth. Feature, fix, rebuild, integration, and documentation branches are work areas only; their existence, age, or apparent commit count does not establish that their changes are missing from `main`.

Do not merge a branch based only on its ahead/behind count. Squash merges create new commit ancestry, so an already-merged branch can appear divergent from `main`. Verify the originating pull request's merged state and compare the actual file content before considering any port or re-merge.

All future implementation work should start from the latest `main`, use a focused branch, and return through reviewed, exact-head-verified changes. Do not delete old branches until their unique changes have been audited.

## Current open integration decisions

No unresolved decisions remain among the closed pull requests reviewed in the 2026-11-08 reconciliation. This is separate from the unfinished product systems and release gates recorded in the journey matrix.

## Verified work already represented on main

The following areas were checked against their originating pull requests. Their feature branches must not be re-merged simply because they still appear ahead/diverged:

- Transactional notification email outbox and delivery retries — PR #34 merged.
- Support SLA deadlines and escalation — PR #32 merged.
- Guest wishlist merge and private recommendations — PR #30 merged.
- Product Q&A reports, answer history and scoped staff access — PR #31 merged.
- Store-scoped return decisions — PR #43 merged.
- Return receipt into inventory quarantine — PR #46 merged.
- Seller dispatch and buyer tracking — PR #41 merged. Stale PR #26 was closed unmerged and replaced by the current-main implementation in #41.
- The 49-system page/control map and individual system specifications — PR #28 merged.
- Phase plans 1–10 and the Phase 11 production-operations plan are already present on `main`; do not re-import their stale documentation branches without a content-level comparison.

This is a branch/PR provenance audit, not proof that every user journey is production-ready. Use the journey matrix and build log for implementation evidence.

## Merge and verification gates

Before merging any code change into `main`:

1. Rebase or reconstruct it against the current `main`; resolve conflicts without discarding current behavior.
2. Review every changed file, especially Prisma schema, migration ordering, authorization, financial state, inventory, and cross-domain effects.
3. Run General CI on the exact candidate commit: Prisma validate/generate, typecheck, lint, unit tests, and production build.
4. Run the disposable PostgreSQL migration/integration workflow on the exact same candidate commit.
5. Verify critical UI → API → authorization/validation → domain service → Prisma transaction → response/UI journeys, including idempotency, ownership boundaries, retries, and audit records.
6. Record exact commit SHAs, workflow run IDs, results, and remaining external dependencies in `docs/implementation/BUILD_LOG.md` and `docs/implementation/END_TO_END_JOURNEY_MATRIX.md`.
7. Merge only after the evidence is green; then verify the resulting `main` commit and re-check the relevant journeys.

A previous successful run on a different SHA, a branch's old base, or a related PR is not acceptable evidence for the current candidate.

## Deployment boundary

Do not initiate Vercel deployments, previews, promotions, rollbacks, or change Vercel settings as part of this repository consolidation. A GitHub action that could trigger a Vercel preview is not an acceptable substitute for an isolated test run. If the available workflow cannot be run without triggering deployment, leave the candidate unmerged and report the verification blocker.

## Canonical implementation records

- `README.md` — project entry point and canonical phase roadmap.
- `prisma/schema.prisma` — canonical data model.
- `docs/architecture/COMPLETE_PLATFORM_SYSTEMS_BLUEPRINT.md` — 49-system scope.
- `docs/architecture/GLOBAL_PLATFORM_PAGE_AND_CONTROL_SPEC.md` — target page/control behavior.
- `docs/implementation/PAGE_ROUTE_REGISTRY.md` — actual route inventory.
- `docs/implementation/END_TO_END_JOURNEY_MATRIX.md` — action-level integration and verification ledger.
- `docs/implementation/BUILD_LOG.md` — exact implementation and test evidence.
- `docs/implementation/PLATFORM_PHASE_ROADMAP_01_11.md` and `PHASE_11_PRODUCTION_OPERATIONS_PLAN.md` — delivery sequence and phase 11 gates.

Update these canonical records rather than creating competing status documents on multiple feature branches.
