# Multipart image upload guard verification

This verification branch is based on current main after the multipart upload guard fix.

## Required checks
- Prisma validation, migrations and client generation.
- TypeScript, ESLint, Vitest, production build.
- PostgreSQL integration and repeatable seed.
- Browser E2E for current seller/customer/admin journeys.

## Regression covered
- JSON mutation endpoints remain JSON-only.
- Seller product image endpoints accept same-origin multipart/form-data with a boundary.
- Missing and cross-origin requests remain rejected.
- Both the primary media route and backward-compatible images route use the multipart guard.

No deployment is requested.
