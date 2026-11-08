import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const prisma = new PrismaClient();
const VERSION = "7d3374c2b885895dffa824db850f709bebd516c8";
const SOURCE = "Akaar Cities.jsx";
const groupToGovernorate = {
  "دمشق": "دمشق", "إدلب": "إدلب", "حلب": "حلب", "حمص": "حمص", "درعا": "درعا",
  "حماة": "حماة", "القنيطرة": "القنيطرة", "الرقة": "الرقة", "الحسكة": "الحسكة",
  "دير الزور": "دير الزور", "اللاذقية": "اللاذقية", "طرطوس": "طرطوس", "جبلة": "اللاذقية"
};
const radiusByGroup = {
  "دمشق": 16, "إدلب": 14, "حلب": 16, "حمص": 15, "درعا": 13, "حماة": 15,
  "القنيطرة": 12, "الرقة": 15, "الحسكة": 15, "دير الزور": 15, "اللاذقية": 15, "طرطوس": 14, "جبلة": 13
};
function normalize(value) {
  return String(value ?? "").normalize("NFKC").replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/\s+/g, " ").trim().toLowerCase();
}
function distanceKm(aLat, aLon, bLat, bLon) {
  const rad = (value) => value * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
async function main() {
  const source = JSON.parse(await readFile(new URL("../prisma/data/akaar-syria-location-suggestions.json", import.meta.url), "utf8"));
  const [governorates, districts, subdistricts, localities] = await Promise.all([
    prisma.syriaGovernorate.findMany({ select: { id: true, nameAr: true, nameEn: true } }),
    prisma.syriaDistrict.findMany({ select: { nameAr: true, nameEn: true } }),
    prisma.syriaSubdistrict.findMany({ select: { nameAr: true, nameEn: true } }),
    prisma.syriaLocality.findMany({ select: { nameAr: true, nameEn: true } })
  ]);
  if (governorates.length < 14 || localities.length < 7605) {
    throw new Error("Import OpenSyria geography first (expected 14 governorates and 7,605 localities).");
  }
  const governorateByName = new Map(governorates.map((item) => [normalize(item.nameAr ?? item.nameEn), item.id]));
  const officialNames = new Set();
  for (const item of [...governorates, ...districts, ...subdistricts, ...localities]) {
    if (item.nameAr) officialNames.add(normalize(item.nameAr));
    if (item.nameEn) officialNames.add(normalize(item.nameEn));
  }

  const rows = [];
  const seen = new Set();
  for (const group of source.groups) {
    const governorateName = groupToGovernorate[group.nameAr];
    if (!governorateName || !group.latitude || !group.longitude) continue;
    const governorateId = governorateByName.get(normalize(governorateName));
    if (!governorateId) continue;
    const radius = radiusByGroup[group.nameAr] ?? 12;
    for (const candidate of group.towns) {
      if (!candidate.nameAr || ["غير محدد", "غير ذلك"].includes(candidate.nameAr)) continue;
      if (candidate.latitude < 32 || candidate.latitude > 37.7 || candidate.longitude < 35.4 || candidate.longitude > 42.5) continue;
      if (distanceKm(group.latitude, group.longitude, candidate.latitude, candidate.longitude) > radius) continue;
      // Akaar's old city lists mix neighbourhoods and nearby towns. Exclude names
      // already represented in the official locality gazetteer; keep the rest as
      // explicitly unverified suggestions, never as administrative records.
      if (officialNames.has(normalize(candidate.nameAr))) continue;
      const normalized = normalize(candidate.nameAr);
      const dedupe = `${governorateId}|${group.nameAr}|${normalized}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      const id = "akaar-n-" + createHash("sha256").update(`${group.nameAr}|${candidate.nameAr}|${candidate.latitude.toFixed(6)}|${candidate.longitude.toFixed(6)}`).digest("hex").slice(0, 24);
      rows.push({
        id, governorateId, cityGroupNameAr: group.nameAr, nameAr: candidate.nameAr,
        latitude: candidate.latitude, longitude: candidate.longitude,
        source: SOURCE, sourceCommit: VERSION, verificationStatus: "CANDIDATE"
      });
    }
  }

  const result = await prisma.syriaNeighborhood.createMany({ data: rows, skipDuplicates: true });
  console.info(`Imported ${result.count} neighbourhood suggestions from ${source.groups.length} Akaar city groups.`);
  console.info("Every imported row remains CANDIDATE until reviewed. They are not official administrative divisions.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
