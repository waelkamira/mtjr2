# Syrian geography and category-specific seller fields

## Scope

The seller product-draft form now uses a hierarchical Syrian location selector while retaining Leaflet as the map renderer. The complete compact v0.1.5 dataset is bundled locally in Matjar; the runtime route does not depend on the OpenSyria API or its request quota.

Location hierarchy:

1. Governorate
2. District
3. Subdistrict
4. City, town, or village
5. Neighborhood/locality, when the source classifies records at that level

Selecting any administrative level animates the Leaflet map to its published centroid. The seller can still click the map to select the actual product location. The existing privacy behavior remains: exact coordinates are stored privately and only rounded public coordinates are exposed by the product map-location service.

The picker stores the human-readable city and neighborhood/administrative fallback in the existing `Product.city` and `Product.district` fields. It also stores stable source identifiers in the new nullable `Product.geography` JSON field:

- `governorateId`
- `districtId`
- `subdistrictId`
- `localityId`
- `neighborhoodId`
- source name and pinned source version

The API validates identifier format and the source/version marker. The migration adds only the JSON column and does not alter existing product rows.

## Data source and attribution

Matjar bundles the pinned OpenSyria Data Geography release `v0.1.5` as a compact local JSON asset and serves it through a paginated, filtered Next.js route. No external geography API calls are made at runtime. The source release documents:

- 14 governorates
- 62 districts
- 272 subdistricts
- 7,605 localities, including cities, towns, villages, and other localities

Data attribution: OpenSyria Data Geography, CC BY 4.0, with source attribution retained in the UI and this documentation. Pagination is performed locally against the bundled dataset, so there is no upstream daily API quota or runtime dependency.

**Known data limitation:** the upstream locality taxonomy does not provide a complete, independently verified neighborhood list for every Syrian city. The interface labels neighborhood entries only when the source marks them as `locality`; otherwise it allows manual neighborhood text. It does not treat every village or town as a neighborhood, and does not fabricate coordinates.

## Akaar category-field comparison

The Akaar `newPost` flow and its category field modules were reviewed against Matjar's existing category presets. Matjar already had a broad set of 22 category-family presets and field-key aliases, but the seller create/edit form rendered almost every value as a plain text input. Category fields now render as selects when an option set is defined, while free-text fields remain editable inputs.

The option dictionaries cover common and category-specific fields including vehicle year/fuel/condition, phone and computer specifications, fashion size/gender/season, furniture material/style, real-estate sale/rent and rooms, book genre/format, health and beauty product types, sports, games, tools, agriculture, bikes, jewellery, baby products, and employment types.

The field names remain the existing Matjar preset keys so the current server-side required-field validation and saved `customFields` payload remain compatible. This is a data/UI alignment pass, not a claim that every Akaar option list is a complete canonical global taxonomy; categories can still require further option curation and conditional field rules.

## Deployment and verification notes

- Apply the new Prisma migration through the normal reviewed deployment process; it has not been applied to any database by this change.
- Verify the bundled data import, route filtering/pagination, and Arabic search in the target deployment.
- Run Prisma validation/generation, TypeScript, lint, unit tests, and a browser journey for governorate → district → subdistrict → city → neighborhood, including map zoom and product draft creation.
- No successful build, test run, or deployment is claimed until the relevant CI results are available.
