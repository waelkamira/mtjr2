export type CategoryFieldPreset = { key: string; label: string; value: string };

const categoryFieldPresets: Record<string, Array<[string, string]>> = {
  "real-estate": [["adType","بيع / إيجار"],["rooms","الغرف"],["livingrooms","الصالونات"],["area","المساحة"],["propertyType","نوع العقار"],["bathrooms","الحمامات"]],
  cars: [["adType","بيع / إيجار"],["brand","الماركة"],["model","الموديل"],["year","سنة الصنع"],["condition","الحالة"],["fuelType","نوع الوقود"],["mileage","عدد الكيلومترات"]],
  phones: [["brand","الماركة"],["model","الموديل"],["storage","سعة التخزين"],["ram","الذاكرة العشوائية"],["camera","الكاميرا"],["battery","سعة البطارية"],["color","اللون"],["condition","الحالة"]],
  computers: [["type","نوع الجهاز"],["brand","الماركة"],["processor","المعالج"],["ram","الذاكرة العشوائية"],["storage","وحدة التخزين"],["graphicsCard","كرت الشاشة"],["screenSize","حجم الشاشة"],["operatingSystem","نظام التشغيل"],["condition","الحالة"]],
  electronics: [["type","نوع الجهاز"],["brand","الماركة"],["screenSize","حجم الشاشة"],["resolution","دقة العرض"],["audioOutput","قوة الصوت"],["smartFeatures","الميزات الذكية"],["connectivity","إمكانيات الاتصال"],["condition","الحالة"],["power","الجهد الكهربائي"]],
  furniture: [["type","نوع الأثاث"],["material","المادة المصنوعة"],["color","اللون"],["dimensions","الأبعاد"],["style","النمط التصميمي"],["condition","الحالة"],["assembly","التجميع"]],
  kitchen: [["productType","نوع المنتج"],["furnitureType","نوع الأثاث"],["tableShape","شكل الطاولة"],["applianceType","نوع الجهاز"],["cooktopType","نوع الموقد"],["capacity","السعة"],["material","المادة"],["color","اللون"],["style","النمط"],["dimensions","الأبعاد"],["condition","الحالة"]],
  fashion: [["type","نوع المنتج"],["clothingType","نوع الملابس"],["gender","الفئة"],["size","المقاس"],["color","اللون"],["brand","الماركة"],["material","المادة"],["condition","الحالة"],["season","الموسم"]],
  beauty: [["productType","نوع المنتج"],["makeupType","نوع المكياج"],["skinCareType","نوع العناية بالبشرة"],["skinType","نوع البشرة"],["hairType","نوع الشعر"],["hairCareType","نوع العناية بالشعر"],["fragranceType","نوع العطر"],["color","اللون"],["condition","الحالة"]],
  sports: [["type","نوع المنتج"],["sport","الرياضة"],["equipmentType","نوع المعدات"],["clothingType","نوع الملابس"],["size","المقاس"],["brand","الماركة"],["material","المادة"],["condition","الحالة"]],
  games: [["type","نوع اللعبة"],["platform","المنصة"],["genre","النوع"],["boardGameType","نوع اللعبة اللوحية"],["minAge","الحد الأدنى للعمر"],["players","عدد اللاعبين"],["brand","الماركة"],["condition","الحالة"]],
  tools: [["productType","نوع المنتج"],["toolCategory","تصنيف الأداة"],["powerSource","مصدر الطاقة"],["powerToolType","نوع الأداة الكهربائية"],["voltage","الجهد الكهربائي"],["lightingType","نوع الإضاءة"],["material","المادة"],["measurement","القياسات"],["brand","الماركة"],["safetyRating","تصنيف السلامة"]],
  books: [["productType","نوع المنتج"],["genre","التصنيف الأدبي"],["author","المؤلف / المترجم"],["publisher","دار النشر"],["language","اللغة"],["format","نوع النسخة"],["edition","الطبعة"],["condition","الحالة"],["isbn","رقم ISBN"]],
  gifts: [["giftCategory","فئة الهدية"],["wrapping","التغليف"],["personalization","التخصيص"],["delivery","التوصيل"]],
  agriculture: [["type","نوع المنتج"],["plantType","نوع النبات"],["fruitType","نوع الفاكهة"],["vegetableType","نوع الخضار"],["growthCondition","ظروف النمو"],["wateringNeeds","احتياجات الري"],["soilType","نوع التربة"],["season","الموسم"],["harvestTime","وقت الحصاد"]],
  bikes: [["bikeType","نوع الدراجة"],["motorcycleType","نوع الدراجة النارية"],["engineType","نوع المحرك"],["engineSize","سعة المحرك"],["batteryRange","مدى البطارية"],["frameMaterial","مادة الهيكل"],["suspensionType","نوع التعليق"],["brakeType","نوع الفرامل"],["color","اللون"],["condition","الحالة"],["brand","الماركة"],["year","سنة الصنع"]],
  health: [["productType","نوع المنتج"],["healthCategory","التصنيف الصحي"],["productForm","شكل المنتج"],["personalCareType","نوع العناية الشخصية"],["cleaningType","نوع المنظفات"],["oralCareType","نوع العناية بالفم"],["sizeVolume","الحجم / الكمية"],["brand","الماركة"],["specialFeatures","مميزات خاصة"]],
  shoes: [["type","نوع الحذاء"],["category","التصنيف"],["size","المقاس"],["color","اللون"],["material","المادة"],["brand","الماركة"],["usage","الاستخدام"],["condition","الحالة"]],
  bags: [["productType","نوع الحقيبة"],["style","النمط التصميمي"],["material","المادة"],["color","اللون"],["size","الحجم"],["capacity","السعة"],["features","المميزات"],["brand","الماركة"],["condition","الحالة"]],
  jewelry: [["productType","نوع المجوهرات"],["metalType","نوع المعدن"],["karat","العيار"],["gemstone","الحجر الكريم"],["style","النمط التصميمي"],["brand","الماركة"],["gender","الفئة"],["occasion","المناسبة"],["condition","الحالة"]],
  baby: [["type","نوع المنتج"],["subType","التفاصيل"],["ageRange","الفئة العمرية"],["gender","الفئة"],["material","المادة"],["safetyCertification","شهادات السلامة"],["condition","الحالة"],["brand","الماركة"]],
  jobs: [["title","المسمى الوظيفي"],["company","الشركة"],["location","المحافظة"],["salary","الراتب"],["employmentType","نوع الوظيفة"],["jobCategory","مجال الوظيفة"],["educationLevel","المؤهل العلمي"],["experience","الخبرة المطلوبة"],["skills","المهارات المطلوبة"],["description","وصف الوظيفة"],["deadline","آخر موعد للتقديم"]]
};

export function getCategoryFieldPresets(slug: string): CategoryFieldPreset[] {
  const normalized = slug.toLowerCase();
  const aliases: Record<string, string> = {
    "mobile-phones": "phones", "phones-electronics": "phones", "smartphones": "phones", "laptops": "computers", "computers-tablets": "computers",
    "home-furniture": "furniture", "furniture-home": "furniture", "home-decor-lighting": "furniture", "home-kitchen": "kitchen", "home-appliances": "kitchen", "kitchen-appliances": "kitchen", "clothing": "fashion", "clothing-fashion": "fashion",
    "beauty-personal-care": "beauty", "skincare": "beauty", "hair-grooming": "beauty", "makeup": "beauty", "wellness-personal-care": "health", "sports-outdoors": "sports", "sports-equipment": "sports", "fitness-training": "sports", "outdoor-camping": "sports", "video-games": "games",
    "tools-hardware": "tools", "books-stationery": "books", "office-stationery": "books", "arts-crafts": "gifts", "gifts-occasions": "gifts",
    "plants-gardening": "agriculture", "bicycles-motorcycles": "bikes", "medical-health": "health",
    "footwear": "shoes", "bags-luggage": "bags", "bags-accessories": "bags", "jewellery": "jewelry", "automotive-accessories": "cars", "car-electronics": "electronics", "car-care-safety": "cars", "tech-accessories": "electronics", "audio-headphones": "electronics", "wearables": "electronics", "cameras-photography": "electronics", "baby-products": "baby",
    "employment": "jobs"
  };
  const key = aliases[normalized] ?? normalized;
  return (categoryFieldPresets[key] ?? []).map(([fieldKey, label]) => ({ key: fieldKey, label, value: "" }));
}

/** Build an editable field list without discarding previously saved custom keys. */
export function buildCategoryFieldsForEdit(
  slug: string,
  savedValues: unknown,
  currentFields: Array<{ key: string; value: string; label?: string }> = []
): CategoryFieldPreset[] {
  const saved = savedValues && typeof savedValues === "object" && !Array.isArray(savedValues)
    ? savedValues as Record<string, unknown>
    : {};
  const current = Object.fromEntries(
    currentFields.filter((field) => field.key.trim()).map((field) => [field.key, field.value])
  );
  const values = { ...saved, ...current };
  const presets = getCategoryFieldPresets(slug);
  const knownKeys = new Set(presets.map((field) => field.key));
  const standard = presets.map((field) => ({ ...field, value: String(values[field.key] ?? "") }));
  const additional = Object.entries(values)
    .filter(([key]) => !knownKeys.has(key))
    .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
    .map(([key, value]) => ({ key, label: key, value: String(value) }));
  return [...standard, ...additional];
}

/** Apply scalar editor values while preserving non-scalar legacy JSON fields. */
export function mergeEditedCategoryFields(
  savedValues: unknown,
  currentFields: Array<{ key: string; value: string }>
): Record<string, unknown> {
  const result: Record<string, unknown> = savedValues && typeof savedValues === "object" && !Array.isArray(savedValues)
    ? { ...(savedValues as Record<string, unknown>) }
    : {};
  for (const field of currentFields) {
    const key = field.key.trim();
    if (!key) continue;
    const value = field.value.trim();
    if (value) result[key] = value;
    else delete result[key];
  }
  return result;
}
