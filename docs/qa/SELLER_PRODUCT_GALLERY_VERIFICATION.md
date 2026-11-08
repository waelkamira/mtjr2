# Seller product gallery verification

This PR runs the complete CI and browser E2E workflows against the current main tree after the seller draft image editor was completed.

## Covered behavior
- Seller catalog listing returns all image records and their ordering/primary metadata.
- Draft editor preloads the existing gallery and supports adding uploaded images, previewing, removing, and reordering.
- Saving sends the replacement gallery to the product update API.
- Server validates HTTPS media URLs and metadata, replaces image records in one transaction, and deletes removed provider assets only after commit.
- Provider deletion supports Imgur OAuth, ImageKit private API key, and signed Cloudinary destroy requests.

## Required checks
- Prisma validate, migration replay, and generate.
- TypeScript typecheck, ESLint, Vitest, and production build.
- Browser E2E and responsive checks.

No deployment is requested by this PR.
