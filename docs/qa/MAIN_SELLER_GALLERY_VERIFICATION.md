# Current-main seller gallery and store-limit verification

This PR is based directly on the current main commit and exists only to execute CI and browser E2E on the final current-main source tree.

Scope:
- Seller draft product gallery listing, upload, preview, remove, reorder and save.
- Provider-side cleanup after successful database commit.
- Partial upload recovery.
- One-store-per-seller transaction guard and matching-store idempotent retry.

Required verification:
- Prisma validation, migration replay and client generation.
- TypeScript, ESLint, all Vitest tests and production build.
- Browser E2E and responsive checks.

No deployment is requested.
