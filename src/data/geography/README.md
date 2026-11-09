# Syrian geography data

Matjar imports Syrian administrative geography into PostgreSQL from the pinned
OpenSyria Data Geography release.

- Dataset: OpenSyria Data Geography
- Pinned release: `v0.1.5`
- Source: https://github.com/Open-Syria/data-geography/tree/v0.1.5
- Dataset page: https://opensyria.org/datasets/geography
- License: Creative Commons Attribution 4.0 International (CC BY 4.0)
- License text: https://creativecommons.org/licenses/by/4.0/

The importer is `scripts/sync-syria-geography.mjs`. It validates the source
hierarchy and required provenance fields before inserting records into the
canonical geography tables. Import is an explicit database operation; the
regular identity seed does not download this dataset. After applying Prisma
migrations to a database, run `npm run db:sync-syria-geography` (or
`npm run db:seed:all` to run the regular seed followed by the geography import)
against that same `DATABASE_URL`. The application cannot display location
options until this import has populated the geography tables. The pinned release is expected to contain 14
governorates, 62 districts, 272 subdistricts, and 7,605 localities.

The seller location picker reads paginated records from the database-backed
`/api/geography/[level]` routes; it does not load a bundled JSON geography
file at runtime. The importer is additive and deliberately does not overwrite
existing IDs when geography has already been seeded.

Preserve attribution to OpenSyria and the underlying source datasets. Do not
silently replace the pinned release with unreviewed live data. To upgrade,
review the new tagged release, its data-quality notes and license, validate
parent relationships and record counts, update the pinned version and
importer, and document the change.
