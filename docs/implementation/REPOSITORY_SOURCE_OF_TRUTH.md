# Repository source of truth and consolidation status

**Audit date:** 2026-11-05  
**Audited baseline:** `main` at `5f5d1da7d8fd8d6c7ea4f1981ef39acf9de578d3`  
**Canonical branch:** `main`  
**Canonical Prisma schema:** `prisma/schema.prisma`

## Non-negotiable repository rule

`main` is the only canonical source of truth. Feature, fix, rebuild, integration, and documentation branches are work areas only; their existence, age, or apparent commit count does not establish that their changes are missing from `main`.

Do not merge a branch based only on its ahead/behind count. Squash merges create new commit ancestry, so an already-merged branch can appear divergent from `main`. Verify the originating pull request's merged state and compare the actual file content before considering any port or re-merge.

All future implementation work should start from the latest `main`, use a focused branch, and return through reviewed, exact-head-verified changes. Do not delete old branches until their unique changes have been audited.

## Current open integration decisions

| PR / branch | Current disposition | Required next action |
|---|---|---|
| [#47 — manual return refund ledger](https://github.com/waelkamira/mtjr2/pull/47) | Original branch is stale and not mergeable against current `main`. Its useful changes were reconstructed additively on `integration/manual-return-refunds-main` (6 commits ahead, 0 behind at this audit). The reconstructed branch has no exact-head CI or PostgreSQL result. | Review the reconstructed diff against current `main`, run exact-head General CI and disposable PostgreSQL integration, then merge only if both pass. No provider refund call is implemented; finance confirms an externally processed refund. |
| [#22 — identity/account follow-up](https://github.com/waelkamira/mtjr2/pull/22) | Draft, not mergeable, and not verified on its latest head `d5208538c46003d35f8374bc04bcd64678dc5303`. Earlier commits passed checks, but that evidence does not cover the latest head. | Review its identity-only changes and run fresh exact-head CI plus PostgreSQL integration before any merge decision. |
| [#35 — Super Admin control panel](https://github.com/waelkamira/mtjr2/pull/35) | Draft, large and diverged (186 files; 10,284 additions; 1,098 deletions). Explicitly deferred from this consolidation. | Leave untouched until separately requested; reconcile its schema and migrations against the then-current `main` before any future review. |

No pull request or branch is considered merge-ready merely because a prior commit or a related branch passed CI.

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
