# Syrian geography and seller category attributes

## Data provenance

- The only geographic reference source is [OpenSyria/data-geography](https://github.com/Open-Syria/data-geography), pinned to release **v0.1.5**.
- OpenSyria's geography release is licensed **CC BY 4.0**. Preserve attribution to OpenSyria and its upstream sources: https://creativecommons.org/licenses/by/4.0/.
- Coverage: 14 governorates, 62 districts, 272 subdistricts and 7,605 populated localities (cities, towns, villages and other localities).
- Matjar preserves OpenSyria IDs, Arabic/English names, aliases, WGS84 centroids, source IDs, source references, source review status and source version.
- OpenSyria v0.1.5 does not publish a separate verified neighbourhood directory. Neighbourhood is therefore an optional seller-entered text label; it is never populated from Akaar or represented as an official administrative unit.
- Map place search is also backed by the imported OpenSyria records. Street-level precision is provided by the map pin and manually entered address, not by importing another geography dataset.

## Import

Apply Prisma migrations, then run:

```bash
npm run db:sync-syria-geography
```

The importer downloads only the pinned OpenSyria v0.1.5 files, checks expected record counts, provenance fields and every parent relationship, then imports them additively with duplicate protection. It does not overwrite existing IDs or rewrite product locality references.

The separate `db:seed-akaar-attributes` command imports product-category field definitions only; it is not a geographic source and must never be used to populate location data.

## Runtime contract

- `GET /api/geography/governorates`
- `GET /api/geography/districts?governorateId=...`
- `GET /api/geography/subdistricts?districtId=...`
- `GET /api/geography/localities?districtId=...&subdistrictId=...`
- `GET /api/geography/search?q=...` searches only imported OpenSyria records.
- `GET /api/categories/:categoryId/attributes?locale=ar|en`

All structured geography is backed by the local PostgreSQL tables imported from the pinned OpenSyria release. Product writes validate the selected locality against these tables. Exact street address and neighbourhood labels remain free text, and map coordinates remain explicit user selections.

## Neighbourhood coverage

OpenSyria v0.1.5 has no separate verified neighbourhood dataset. Do not import neighbourhoods from Akaar, OSM, or another unreviewed list. The optional `Product.neighborhood` field is plain text entered by the seller and is kept distinct from the official OpenSyria locality ID.
