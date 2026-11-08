import { PrismaClient, CatalogEntityStatus } from "@prisma/client";
import { readFile } from "node:fs/promises";

const prisma = new PrismaClient();
const dataFiles = [
  new URL("../prisma/data/akaar-category-attributes-01.json", import.meta.url),
  new URL("../prisma/data/akaar-category-attributes-02.json", import.meta.url),
  new URL("../prisma/data/akaar-category-attributes-03.json", import.meta.url)
];

const roots = {
  "phones-electronics": { en: "Phones & Electronics", ar: "الهواتف والإلكترونيات" },
  "clothing-fashion": { en: "Clothing & Fashion", ar: "الملابس والأزياء" },
  "furniture-home": { en: "Furniture & Home", ar: "الأثاث والمنزل" },
  "beauty-personal-care": { en: "Beauty & Personal Care", ar: "الجمال والعناية الشخصية" },
  "sports-outdoors": { en: "Sports & Outdoors", ar: "الرياضة والأنشطة الخارجية" },
  "books-stationery": { en: "Books & Stationery", ar: "الكتب والقرطاسية" },
  "automotive-accessories": { en: "Automotive & Accessories", ar: "السيارات والإكسسوارات" },
  "tools-diy": { en: "Tools & DIY", ar: "الأدوات ومستلزمات البناء" }
};
const mapping = {
  "أثاث": ["furniture-home", "furniture", "Furniture", "الأثاث"],
  "أحذية": ["clothing-fashion", "shoes", "Shoes", "الأحذية"],
  "أدوات": ["tools-diy", "tools", "Tools", "الأدوات"],
  "ألعاب": ["phones-electronics", "games", "Games", "الألعاب"],
  "إلكترونيات": ["phones-electronics", "electronics", "Electronics", "الإلكترونيات"],
  "جمال": ["beauty-personal-care", "beauty", "Beauty", "الجمال والعناية"],
  "حقائب": ["clothing-fashion", "bags", "Bags", "الحقائب"],
  "دراجات": ["automotive-accessories", "bicycles-motorcycles", "Bicycles & Motorcycles", "الدراجات"],
  "رياضة": ["sports-outdoors", "sports", "Sports", "الرياضة"],
  "زراعة": ["sports-outdoors", "agriculture", "Agriculture", "الزراعة"],
  "سيارات": ["automotive-accessories", "cars", "Cars", "السيارات"],
  "صحة": ["beauty-personal-care", "health", "Health & Personal Care", "الصحة والعناية الشخصية"],
  "طفلك": ["clothing-fashion", "baby-kids", "Baby & Kids", "الأطفال"],
  "كتب": ["books-stationery", "books", "Books", "الكتب"],
  "كمبيوتر": ["phones-electronics", "computers", "Computers", "الكمبيوتر"],
  "مجوهرات": ["clothing-fashion", "jewelry", "Jewelry", "المجوهرات"],
  "مطبخ": ["furniture-home", "kitchen", "Kitchen & Dining", "المطبخ"],
  "موضة": ["clothing-fashion", "fashion", "Fashion", "الموضة"],
  "هدايا": ["furniture-home", "gifts", "Gifts", "الهدايا"],
  "هواتف": ["phones-electronics", "phones", "Phones", "الهواتف"]
};

function englishKey(value) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}
async function ensureTranslation(tx, categoryId, locale, name) {
  await tx.categoryTranslation.upsert({
    where: { categoryId_locale: { categoryId, locale } },
    update: { name },
    create: { categoryId, locale, name }
  });
}
async function main() {
  const imported = (await Promise.all(dataFiles.map(async (url) => JSON.parse(await readFile(url, "utf8"))))).flatMap((item) => item.categories);
  const skipped = [];
  let linkedFields = 0;
  for (const item of imported) {
    const target = mapping[item.categoryAr];
    if (!target) { skipped.push(item.categoryAr); continue; }
    const [rootSlug, childSlug, childEn, childAr] = target;
    const rootNames = roots[rootSlug];
    const root = await prisma.category.upsert({
      where: { slug: rootSlug },
      update: { name: rootNames.en, status: CatalogEntityStatus.ACTIVE },
      create: { slug: rootSlug, name: rootNames.en, status: CatalogEntityStatus.ACTIVE }
    });
    await ensureTranslation(prisma, root.id, "en", rootNames.en);
    await ensureTranslation(prisma, root.id, "ar", rootNames.ar);
    const child = await prisma.category.upsert({
      where: { slug: childSlug },
      update: { parentId: root.id, name: childEn, status: CatalogEntityStatus.ACTIVE },
      create: { slug: childSlug, parentId: root.id, name: childEn, status: CatalogEntityStatus.ACTIVE }
    });
    await ensureTranslation(prisma, child.id, "en", childEn);
    await ensureTranslation(prisma, child.id, "ar", childAr);

    for (let index = 0; index < item.fields.length; index += 1) {
      const field = item.fields[index];
      const key = `ak_${childSlug.replace(/-/g, "_")}_${field.key.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase()}`.slice(0, 100);
      const definition = await prisma.attributeDefinition.upsert({
        where: { key },
        update: { valueType: field.valueType },
        create: { key, valueType: field.valueType }
      });
      await prisma.attributeTranslation.upsert({
        where: { attributeDefinitionId_locale: { attributeDefinitionId: definition.id, locale: "ar" } },
        update: { name: field.labelAr, description: field.placeholderAr },
        create: { attributeDefinitionId: definition.id, locale: "ar", name: field.labelAr, description: field.placeholderAr }
      });
      await prisma.attributeTranslation.upsert({
        where: { attributeDefinitionId_locale: { attributeDefinitionId: definition.id, locale: "en" } },
        update: { name: englishKey(field.key) },
        create: { attributeDefinitionId: definition.id, locale: "en", name: englishKey(field.key) }
      });
      // Akaar's source definitions do not declare mandatory fields. Keep them optional
      // until product-domain requirements are explicitly reviewed and versioned.
      const isRequired = field.required === true;
      await prisma.categoryAttribute.upsert({
        where: { categoryId_attributeDefinitionId: { categoryId: child.id, attributeDefinitionId: definition.id } },
        update: { sortOrder: index, isRequired, options: field.options.length ? field.options : undefined },
        create: {
          categoryId: child.id, attributeDefinitionId: definition.id, sortOrder: index,
          isRequired, options: field.options.length ? field.options : undefined
        }
      });
      linkedFields += 1;
    }
  }
  console.info(`Imported ${imported.length} Akaar category field sets and linked ${linkedFields} attribute definitions.`);
  if (skipped.length) console.info("Kept outside product taxonomy (separate domain):", skipped.join(", "));
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
