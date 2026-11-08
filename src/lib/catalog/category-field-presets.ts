export type CategoryFieldPreset = { key: string; label: string; value: string; required?: boolean; options?: string[] };

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


const commonFieldOptions: Record<string, string[]> = {
  condition: ["جديد", "مستعمل - بحالة ممتازة", "مستعمل - بحالة جيدة", "مستعمل - بحالة مقبولة", "مستعمل - بحاجة إلى صيانة"],
  color: ["أسود", "أبيض", "رمادي", "فضي", "ذهبي", "بني", "بيج", "أحمر", "أزرق", "أخضر", "أصفر", "وردي", "بنفسجي", "متعدد الألوان", "أخرى"],
  gender: ["رجالي", "نسائي", "أطفال", "للجنسين"],
  season: ["شتوي", "صيفي", "ربيعي", "خريفي", "طوال العام"],
  size: ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "مقاسات أطفال", "مقاس موحد", "أخرى"],
  adType: ["بيع", "إيجار"],
  rooms: ["استوديو", "1", "2", "3", "4", "5", "6", "أكثر من 6"],
  livingrooms: ["0", "1", "2", "3", "4", "5", "أكثر من 5"],
  bathrooms: ["1", "2", "3", "4", "5", "أكثر من 5"],
  propertyType: ["شقة", "منزل", "فيلا", "أرض", "مزرعة", "مكتب", "محل تجاري", "مستودع", "معمل", "أخرى"],
  fuelType: ["بنزين", "ديزل", "كهرباء", "هجين", "غاز"],
  year: Array.from({ length: 57 }, (_, index) => String(new Date().getFullYear() - index)),
  mileage: ["0", "حتى 10,000", "10,001–30,000", "30,001–50,000", "50,001–75,000", "75,001–100,000", "100,001–150,000", "150,001–200,000", "أكثر من 200,000"],
  brand: ["Apple", "Samsung", "Xiaomi", "Huawei", "Oppo", "Vivo", "Realme", "Nokia", "Sony", "LG", "Lenovo", "HP", "Dell", "Asus", "Acer", "MSI", "Toyota", "Hyundai", "Kia", "Nissan", "Mercedes-Benz", "BMW", "Volkswagen", "Renault", "Peugeot", "أخرى"],
  storage: ["16 GB", "32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB", "2 TB", "أخرى"],
  ram: ["2 GB", "4 GB", "6 GB", "8 GB", "12 GB", "16 GB", "24 GB", "32 GB", "64 GB", "أخرى"],
  camera: ["كاميرا واحدة", "كاميرتان", "ثلاث كاميرات", "أربع كاميرات", "أكثر من أربع"],
  battery: ["أقل من 3000 mAh", "3000 mAh", "4000 mAh", "5000 mAh", "6000 mAh", "أكثر من 6000 mAh"],
  material: ["خشب طبيعي", "خشب MDF", "معدن", "قطن", "صوف", "جلد طبيعي", "جلد صناعي", "بوليستر", "زجاج", "بلاستيك", "رخام", "سيراميك", "أخرى"],
  style: ["حديث", "كلاسيكي", "ريفي", "بسيط", "صناعي", "اسكندنافي", "شرقي", "فاخر", "أخرى"],
  dimensions: ["صغير", "متوسط", "كبير", "كبير جداً", "مقاس مخصص"],
  assembly: ["مجمّع بالكامل", "يحتاج تجميعاً بسيطاً", "يحتاج تجميعاً كاملاً", "خدمة التجميع غير متوفرة"],
  type: ["ملابس", "أحذية", "حقائب", "إكسسوارات", "أجهزة", "معدات", "أثاث", "أخرى"],
  productType: ["جديد", "مستعمل", "قطعة", "مجموعة", "مستلزم", "أخرى"],
  capacity: ["صغير", "متوسط", "كبير", "قابل للتعديل", "أخرى"],
  screenSize: ["أقل من 10 بوصات", "10–13 بوصة", "14–15 بوصة", "16–17 بوصة", "18 بوصة فأكثر"],
  resolution: ["HD", "Full HD", "2K", "4K", "8K", "أخرى"],
  operatingSystem: ["Windows", "macOS", "Linux", "Android", "iOS", "ChromeOS", "بدون نظام", "أخرى"],
  connectivity: ["Wi-Fi", "Bluetooth", "Wi-Fi وBluetooth", "Ethernet", "USB", "أخرى"],
  platform: ["PlayStation", "Xbox", "Nintendo", "PC", "Android", "iOS", "متعددة المنصات"],
  language: ["العربية", "الإنجليزية", "الفرنسية", "الألمانية", "التركية", "متعدد اللغات", "أخرى"],
  format: ["ورقي", "إلكتروني", "صوتي", "مجموعة"],
  employmentType: ["دوام كامل", "دوام جزئي", "عن بُعد", "عقد مؤقت", "عمل حر", "تدريب"],
  educationLevel: ["بدون شهادة", "ثانوية", "دبلوم", "بكالوريوس", "ماجستير", "دكتوراه"],
  experience: ["بدون خبرة", "أقل من سنة", "1–3 سنوات", "3–5 سنوات", "5–10 سنوات", "أكثر من 10 سنوات"],
  wrapping: ["تغليف عادي", "تغليف فاخر", "بدون تغليف"],
  delivery: ["متاح", "غير متاح", "حسب الاتفاق"]
};

const categorySpecificOptions: Record<string, Record<string, string[]>> = {
  phones: { brand: ["Apple", "Samsung", "Huawei", "Xiaomi", "Oppo", "Realme", "Vivo", "Nokia", "Honor", "OnePlus", "أخرى"] },
  cars: { brand: ["Toyota", "Hyundai", "Kia", "Nissan", "Mercedes-Benz", "BMW", "Volkswagen", "Renault", "Peugeot", "Ford", "Chevrolet", "Mitsubishi", "Suzuki", "Lexus", "Jeep", "أخرى"] },
  fashion: { type: ["ملابس", "أحذية", "حقائب", "إكسسوارات", "ملابس داخلية", "أحزمة", "نظارات", "ساعات", "أخرى"], clothingType: ["تيشيرت", "قميص", "بنطال", "جاكيت", "بدلة", "تنورة", "فستان", "ملابس رياضية", "ملابس داخلية", "أخرى"] },
  furniture: { type: ["كنبة", "كرسي", "طاولة", "سرير", "خزانة", "مكتب", "رف", "دولاب", "أثاث حديقة", "أخرى"], dimensions: ["صغير", "متوسط", "كبير", "ضخم", "مقاس خاص"] },
  books: { genre: ["رواية", "تاريخ", "علوم", "أدب", "دين", "أطفال", "تعليم", "تقنية", "إدارة وأعمال", "أخرى"] },
  realEstate: { propertyType: ["بيت", "شقة", "أرض", "مزرعة", "فيلا", "معمل", "مكتب", "محل تجاري", "غير ذلك"] },
  agriculture: { type: ["بذور", "شتلات", "نباتات", "فواكه", "خضروات", "معدات زراعية", "أسمدة", "تربة", "أخرى"] },
  shoes: { type: ["حذاء رياضي", "حذاء رسمي", "حذاء يومي", "صندل", "حذاء أطفال", "أخرى"] },
  bags: { productType: ["حقيبة يد", "حقيبة ظهر", "حقيبة سفر", "حقيبة مدرسية", "حقيبة لابتوب", "محفظة", "أخرى"] },
  jobs: { employmentType: ["دوام كامل", "دوام جزئي", "عن بُعد", "عقد مؤقت", "عمل حر", "تدريب"] }
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
  return (categoryFieldPresets[key] ?? []).map(([fieldKey, label]) => ({
    key: fieldKey,
    label,
    value: "",
    options: categorySpecificOptions[key]?.[fieldKey] ?? commonFieldOptions[fieldKey]
  }));
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
  const standard = presets.map((field) => ({ ...field, required: true, value: String(values[field.key] ?? "") }));
  const additional = Object.entries(values)
    .filter(([key]) => !knownKeys.has(key))
    .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
    .map(([key, value]) => ({ key, label: key, required: false, value: String(value) }));
  return [...standard, ...additional];
}

/** Apply scalar editor values while preserving non-scalar legacy JSON fields. */
export function mergeEditedCategoryFields(
  savedValues: unknown,
  currentFields: Array<{ key: string; value: string }>
): Record<string, unknown> {
  const result = Object.create(null) as Record<string, unknown>;
  if (savedValues && typeof savedValues === "object" && !Array.isArray(savedValues)) {
    for (const [key, value] of Object.entries(savedValues as Record<string, unknown>)) {
      result[key] = value;
    }
  }
  for (const field of currentFields) {
    const key = field.key.trim();
    if (!key) continue;
    const value = field.value.trim();
    if (value) result[key] = value;
    else delete result[key];
  }
  return result;
}
