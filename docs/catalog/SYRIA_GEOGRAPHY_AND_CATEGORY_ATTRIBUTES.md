# Syrian geography and seller category attributes

## Data provenance

- Geography source: [OpenSyria/data-geography](https://github.com/Open-Syria/data-geography), pinned release **v0.1.5**.
- The pinned release contains 14 governorates, 62 districts, 272 subdistricts and 7,605 localities. The importer validates the expected counts and every parent relationship before writing.
- Source data retains stable OpenSyria IDs, Arabic/English names, aliases, WGS84 centroids, source IDs and the imported release version.
- The upstream dataset is an administrative/populated-place gazetteer. It does **not** currently publish a verified comprehensive neighbourhood directory. The seller form therefore distinguishes administrative locality from the seller-entered neighbourhood label; it must not invent neighbourhood-to-city relationships.
- The source repository lists geoBoundaries/OCHA and GeoNames source licensing. Review the upstream licence and attribution before redistribution or combining additional OSM-derived datasets. OpenSyria data repository: https://github.com/Open-Syria/data-geography

## Import

Apply committed migrations first, then run:

```bash
npm run db:sync-syria-geography
npm run db:seed-akaar-attributes
```

The geography importer downloads only the pinned v0.1.5 source files, validates counts and parent IDs, and inserts records additively with duplicate protection. It does not call the public API per seller request. It does not delete existing location rows or rewrite product location references.

The category importer uses the 22 field-definition files in the Akaar repository at commit `7d3374c2b885895dffa824db850f709bebd516c8`. It stores normalized field definitions and per-category option sets in `AttributeDefinition` and `CategoryAttribute`. Category field names are namespaced to avoid global-key collisions. Property and jobs fields are retained in the source JSON but deliberately not inserted into ordinary product categories; they belong to their separate listing/workflow domains.

## Runtime contract

- `GET /api/geography/governorates`
- `GET /api/geography/districts?governorateId=...`
- `GET /api/geography/subdistricts?districtId=...`
- `GET /api/geography/localities?subdistrictId=...`
- `GET /api/categories/:categoryId/attributes?locale=ar|en`

All geography endpoints are backed by the local PostgreSQL reference tables. They are paginated and filtered by their parent IDs. Product writes validate category membership, required values, typed values and selected locality server-side.

## Neighbourhood coverage

The OpenSyria release currently contains localities, not a verified neighbourhood dataset. The `Product.neighborhood` field is intentionally a separate text value, not an incorrectly inferred foreign key. A neighbourhood directory can be added only after a reviewed city-by-city source is selected, with its own source IDs, licence, aliases and parent-locality validation. Do not treat Nominatim's public endpoint as a bulk import or autocomplete service.
