import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const VERSION = "v0.1.5";
const BASE = `https://raw.githubusercontent.com/Open-Syria/data-geography/${VERSION}/data`;
const EXPECTED = { governorates: 14, districts: 62, subdistricts: 272, localities: 7605 };

async function load(name) {
  const response = await fetch(`${BASE}/${name}.json`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Unable to download ${name}: HTTP ${response.status}`);
  const records = await response.json();
  if (!Array.isArray(records)) throw new Error(`${name} must be a JSON array.`);
  if (records.length !== EXPECTED[name]) throw new Error(`${name} count mismatch: expected ${EXPECTED[name]}, received ${records.length}.`);
  return records;
}

function common(record) {
  return {
    nameEn: record.name?.en ?? record.name?.ar ?? record.id,
    nameAr: record.name?.ar ?? null,
    latitude: record.centroid?.latitude ?? null,
    longitude: record.centroid?.longitude ?? null,
    sourceVersion: VERSION,
    sourceIds: Array.isArray(record.sourceIds) ? record.sourceIds : [],
    aliases: record.aliases ?? undefined
  };
}

async function main() {
  console.info(`Downloading pinned OpenSyria Syrian geography ${VERSION}…`);
  const [governorates, districts, subdistricts, localities] = await Promise.all([
    load("governorates"), load("districts"), load("subdistricts"), load("localities")
  ]);

  const governorateIds = new Set(governorates.map((row) => row.id));
  const districtIds = new Set(districts.map((row) => row.id));
  const subdistrictById = new Map(subdistricts.map((row) => [row.id, row]));
  const subdistrictIds = new Set(subdistrictById.keys());
  for (const row of districts) if (!governorateIds.has(row.governorateId)) throw new Error(`Unknown governorate ${row.governorateId} in district ${row.id}`);
  for (const row of subdistricts) if (!governorateIds.has(row.governorateId) || !districtIds.has(row.districtId)) throw new Error(`Invalid parent chain for subdistrict ${row.id}`);
  for (const row of localities) {
    if (!governorateIds.has(row.governorateId)) throw new Error(`Unknown governorate for locality ${row.id}`);
    if (row.districtId && !districtIds.has(row.districtId)) throw new Error(`Unknown district for locality ${row.id}`);
    if (row.subdistrictId && !subdistrictIds.has(row.subdistrictId)) throw new Error(`Unknown subdistrict for locality ${row.id}`);
    const parent = row.subdistrictId ? subdistrictById.get(row.subdistrictId) : null;
    if (row.subdistrictId && !parent) throw new Error(`Unknown subdistrict for locality ${row.id}`);
    if (parent && (parent.governorateId !== row.governorateId || (row.districtId && parent.districtId !== row.districtId))) {
      throw new Error(`Inconsistent parent chain for locality ${row.id}`);
    }
    if (!["city", "town", "village", "locality"].includes(row.kind)) throw new Error(`Locality ${row.id} has an unsupported kind classification.`);
  }

  const existing = await prisma.syriaGovernorate.count();
  if (existing > 0) {
    console.info("Syrian geography is already seeded. This pinned importer is additive and will not overwrite existing IDs.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const g = await tx.syriaGovernorate.createMany({ data: governorates.map((row) => ({ id: row.id, ...common(row) })), skipDuplicates: true });
    const d = await tx.syriaDistrict.createMany({ data: districts.map((row) => ({ id: row.id, governorateId: row.governorateId, ...common(row) })), skipDuplicates: true });
    const sd = await tx.syriaSubdistrict.createMany({ data: subdistricts.map((row) => ({ id: row.id, governorateId: row.governorateId, districtId: row.districtId, ...common(row) })), skipDuplicates: true });
    const loc = await tx.syriaLocality.createMany({ data: localities.map((row) => ({
      id: row.id, governorateId: row.governorateId,
      districtId: row.districtId ?? (row.subdistrictId ? subdistrictById.get(row.subdistrictId)?.districtId : null) ?? null,
      subdistrictId: row.subdistrictId ?? null,
      ...common(row), kind: row.kind
    })), skipDuplicates: true });
    return { governorates: g.count, districts: d.count, subdistricts: sd.count, localities: loc.count };
  }, { timeout: 120000, maxWait: 10000 });
  console.info("OpenSyria import complete:", result);
  console.info("Source: OpenSyria data-geography", VERSION, "https://github.com/Open-Syria/data-geography");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
