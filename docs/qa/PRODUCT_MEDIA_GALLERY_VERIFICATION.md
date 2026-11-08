# Product media gallery verification

This pull request exists to run the repository's full CI against the current main tree after the product-media replacement and provider-deletion changes.

## Changes under verification
- Draft product updates accept a validated media gallery and replace media records in the same database transaction.
- Removed provider assets are deleted only after the database transaction commits.
- Imgur uses an account OAuth token, ImageKit uses its private API key, and Cloudinary uses a server-generated destroy signature.
- Missing provider deletion credentials leave the asset untouched and emit an operational warning.
- Regression tests cover gallery replacement, transaction rollback safety, and provider-specific deletion.

## Required checks
- Prisma validation, migration replay, and client generation.
- TypeScript typecheck and ESLint.
- Vitest unit suite.
- Next.js production build.

No deployment is requested by this verification PR.
