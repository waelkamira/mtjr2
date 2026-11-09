# Syrian geography data

Matjar uses **OpenSyria Data Geography as its sole structured geographic source**.

- Dataset: OpenSyria Data Geography
- Pinned release: `v0.1.5`
- Source: https://github.com/Open-Syria/data-geography/tree/v0.1.5
- Dataset page: https://opensyria.org/datasets/geography
- License: Creative Commons Attribution 4.0 International (CC BY 4.0)
- License text: https://creativecommons.org/licenses/by/4.0/

The importer is `scripts/sync-syria-geography.mjs`. It validates the pinned release's expected counts, provenance fields and parent hierarchy before inserting records into PostgreSQL.

Expected coverage: 14 governorates, 62 districts, 272 subdistricts and 7,605 localities (cities, towns, villages and other populated places).

After applying Prisma migrations, run `npm run db:sync-syria-geography` against the same `DATABASE_URL` used by the application. The importer is additive and preserves stable OpenSyria IDs and existing product references.

**No Akaar-derived geographic data is used.** OpenSyria v0.1.5 does not provide a separate verified neighbourhood directory. Neighbourhood and exact street address are optional seller-entered text; they are not fabricated or imported from another source. Map place search queries the imported OpenSyria records, while the user can fine-tune exact coordinates with the map pin.

The separate Akaar category-attribute seed is product taxonomy metadata, not geographic data.

Preserve attribution to OpenSyria and upstream sources. Do not silently replace the pinned release with unreviewed live data. To upgrade, review the new tagged release, data-quality notes and licence, validate counts and parent relationships, then update the pin and importer.
