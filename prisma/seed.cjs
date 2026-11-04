// CommonJS is intentional: Prisma's seed command executes this file directly with Node.
const { PrismaClient } = require("@prisma/client");

const demoCatalogRequested = process.env.SEED_DEMO_CATALOG === "true";

function resolveDemoDatabaseUrl() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo catalog seeding is blocked when NODE_ENV=production.");
  }
  if (process.env.ALLOW_DEMO_CATALOG_SEED !== "true") {
    throw new Error("Set ALLOW_DEMO_CATALOG_SEED=true to explicitly allow demo catalog seeding.");
  }
  const value = process.env.DEMO_DATABASE_URL;
  if (!value) throw new Error("DEMO_DATABASE_URL is required; demo seeding never uses DATABASE_URL.");
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error("DEMO_DATABASE_URL must be a valid PostgreSQL URL."); }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!/(^|[-_])(demo|test|testing|ci|dev|development)([-_]|$)/i.test(databaseName)) {
    throw new Error("The DEMO_DATABASE_URL database name must contain a demo/test/ci/dev marker.");
  }
  return value;
}

const prismaOptions = demoCatalogRequested
  ? { datasources: { db: { url: resolveDemoDatabaseUrl() } } }
  : {};
const prisma = new PrismaClient(prismaOptions);

const permissions = [
  { key: "account:read:own", description: "Read the authenticated user's own account." },
  { key: "account:update:own", description: "Update the authenticated user's own account." },
  { key: "orders:read:own", description: "Read orders belonging to the authenticated user." },
  { key: "store:read", description: "Read a store within the granted scope." },
  { key: "store:manage", description: "Manage a store within the granted scope." },
  { key: "store:staff:manage", description: "Manage staff assignments within the granted store scope." },
  { key: "catalog:read", description: "Read catalog products within the granted scope." },
  { key: "catalog:manage", description: "Create and manage catalog products within the granted scope." },
  { key: "inventory:manage", description: "Manage inventory within the granted scope." },
  { key: "orders:read", description: "Read orders within the granted scope." },
  { key: "orders:manage", description: "Manage orders within the granted scope." },
  { key: "users:read", description: "Read user records for authorized support or administration." },
  { key: "users:manage", description: "Manage user accounts and account status." },
  { key: "payments:read", description: "Read payment records within the granted scope." },
  { key: "payments:refund", description: "Initiate or approve refunds within the granted scope." },
  { key: "support:read", description: "Read customer support cases." },
  { key: "support:manage", description: "Manage customer support cases." },
  { key: "returns:manage", description: "Review and manage customer return requests." },
  { key: "messages:manage", description: "Read and reply to customer conversations within the granted store scope." },
  { key: "roles:read", description: "Read role and permission definitions." },
  { key: "roles:assign", description: "Assign roles within authorized scopes." },
  { key: "audit:read", description: "Read security and administrative audit events." },
  { key: "platform:manage", description: "Manage platform-wide configuration and operations." },
];

const roles = [
  { key: "CUSTOMER", name: "Customer", description: "Default buyer account role.", permissions: ["account:read:own", "account:update:own", "orders:read:own"] },
  { key: "SELLER", name: "Seller", description: "Seller account with store-scoped catalog, inventory, and order capabilities.", permissions: ["account:read:own", "account:update:own", "store:read", "store:manage", "catalog:read", "catalog:manage", "inventory:manage", "orders:read", "orders:manage", "messages:manage"] },
  { key: "STORE_MANAGER", name: "Store Manager", description: "Delegated store operations role; assignments must be store-scoped.", permissions: ["store:read", "store:manage", "store:staff:manage", "catalog:read", "catalog:manage", "inventory:manage", "orders:read", "orders:manage", "messages:manage"] },
  { key: "SUPPORT_AGENT", name: "Support Agent", description: "Customer support access limited by explicit support and resource scopes.", permissions: ["users:read", "orders:read", "support:read", "support:manage", "returns:manage"] },
  { key: "ADMIN", name: "Administrator", description: "Operational administration; grant only to approved staff.", permissions: ["users:read", "users:manage", "store:read", "store:manage", "catalog:read", "catalog:manage", "inventory:manage", "orders:read", "orders:manage", "payments:read", "payments:refund", "support:read", "support:manage", "returns:manage", "roles:read", "roles:assign", "audit:read"] },
  { key: "SUPER_ADMIN", name: "Super Administrator", description: "Break-glass platform-wide administrator; never assign by default.", permissions: permissions.map((permission) => permission.key) },
];

const image = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1000&q=82`;

const demoCategories = [
  {
    slug: "phones-electronics", name: "Phones & Electronics", ar: "الهواتف والإلكترونيات", description: "Smartphones, computers and everyday electronics.", store: 0,
    images: [image("photo-1511707171634-5f897ff02aa9"), image("photo-1592899677977-9c10ca588bbd"), image("photo-1512499617640-c74ae3a79d37")],
    products: [
      ["Nova X Pro Smartphone", "هاتف نوفا X برو", "Flagship smartphone with vivid OLED display and all-day battery.", "هاتف رائد بشاشة OLED زاهية وبطارية تدوم طوال اليوم.", 899],
      ["Nova Lite 5G", "نوفا لايت 5G", "Fast 5G smartphone for daily work and entertainment.", "هاتف 5G سريع للعمل والترفيه اليومي.", 429],
      ["Orbit Wireless Earbuds", "سماعات أوربت اللاسلكية", "Compact wireless earbuds with clear calls and rich sound.", "سماعات لاسلكية صغيرة بصوت غني ومكالمات واضحة.", 79],
      ["Pulse Smart Watch", "ساعة بالس الذكية", "Smart watch with activity tracking and a bright display.", "ساعة ذكية لتتبع النشاط وشاشة واضحة.", 149],
      ["AeroBook 14 Laptop", "حاسوب إيروبوك 14", "Lightweight laptop for study, office and travel.", "حاسوب محمول خفيف للدراسة والعمل والسفر.", 1099],
      ["TabView 11 Tablet", "جهاز تاب فيو 11 اللوحي", "Versatile tablet for reading, streaming and productivity.", "جهاز لوحي للقراءة والمشاهدة والإنتاجية.", 529],
      ["MagSafe Power Bank", "بطارية ماج سيف المحمولة", "Pocket-size fast charging power bank.", "بطارية محمولة صغيرة للشحن السريع.", 49],
      ["4K Action Camera", "كاميرا أكشن 4K", "Rugged action camera for travel and outdoor footage.", "كاميرا متينة لتصوير الرحلات والأنشطة الخارجية.", 219],
      ["Mechanical Keyboard", "لوحة مفاتيح ميكانيكية", "Tactile mechanical keyboard for focused work and gaming.", "لوحة مفاتيح ميكانيكية للعمل والألعاب.", 119],
      ["USB-C Hub 8-in-1", "موزع USB-C ثماني المنافذ", "Multiport hub for modern laptops and desk setups.", "موزع منافذ متعدد للحواسيب المحمولة.", 59],
    ],
  },
  {
    slug: "clothing-fashion", name: "Clothing & Fashion", ar: "الملابس والأزياء", description: "Clothing, footwear and accessories for every day.", store: 1,
    images: [image("photo-1521572163474-6864f9cf17ab"), image("photo-1529139574466-a303027c1d8"), image("photo-1542291026-7eec264c27ff")],
    products: [
      ["Essential Cotton T-Shirt", "قميص قطني أساسي", "Soft premium cotton T-shirt with a relaxed everyday fit.", "قميص قطني ناعم بقصة مريحة للاستخدام اليومي.", 24],
      ["Classic Denim Jacket", "سترة جينز كلاسيكية", "Timeless denim jacket with durable metal buttons.", "سترة جينز بتصميم كلاسيكي وأزرار معدنية متينة.", 89],
      ["Urban Running Sneakers", "حذاء رياضي أوربان", "Lightweight cushioned sneakers for daily movement.", "حذاء خفيف ومريح للحركة اليومية.", 74],
      ["Linen Summer Dress", "فستان صيفي من الكتان", "Breathable linen dress for warm-weather occasions.", "فستان كتان يسمح بمرور الهواء للمناسبات الصيفية.", 68],
      ["Tailored Chino Trousers", "بنطال تشينو أنيق", "Modern straight-fit chinos with a clean silhouette.", "بنطال تشينو بقصة مستقيمة ومظهر أنيق.", 59],
      ["Everyday Leather Belt", "حزام جلدي يومي", "Minimal leather belt with a brushed metal buckle.", "حزام جلدي بسيط بإبزيم معدني مصقول.", 39],
      ["Classic Canvas Backpack", "حقيبة ظهر قماشية", "Practical canvas backpack with padded laptop sleeve.", "حقيبة عملية مع جيب مبطن للحاسوب.", 54],
      ["Merino Knit Sweater", "كنزة ميرينو محبوكة", "Soft merino-blend knit for versatile layering.", "كنزة ناعمة من مزيج صوف الميرينو.", 99],
      ["Minimalist Crossbody Bag", "حقيبة كتف صغيرة", "Compact crossbody bag for daily essentials.", "حقيبة كتف صغيرة للأغراض اليومية.", 47],
      ["Performance Sports Leggings", "بنطال رياضي مرن", "Stretch performance leggings with a secure high waist.", "بنطال رياضي مرن بخصر مرتفع وثابت.", 42],
    ],
  },
  {
    slug: "furniture-home", name: "Furniture & Home", ar: "الأثاث والمنزل", description: "Furniture and thoughtful details for living spaces.", store: 2,
    images: [image("photo-1555041469-a586c61ea9bc"), image("photo-1505693416388-ac5ce068fe85"), image("photo-1494438639946-1ebd1d20bf85")],
    products: [
      ["Luna Three-Seat Sofa", "أريكة لونا بثلاثة مقاعد", "Contemporary sofa with supportive cushions and textured fabric.", "أريكة عصرية بوسائد داعمة وقماش ذي ملمس مميز.", 1299],
      ["Oak Dining Table", "طاولة طعام من خشب البلوط", "Solid-look oak dining table for family gatherings.", "طاولة طعام بتصميم خشب البلوط للاجتماعات العائلية.", 649],
      ["Nordic Lounge Chair", "كرسي استرخاء نوردك", "Scandinavian-inspired accent chair with comfortable seating.", "كرسي بتصميم اسكندنافي ومقعد مريح.", 329],
      ["Modular Bookshelf", "مكتبة وحدات مرنة", "Open modular shelving for books and home décor.", "رفوف مفتوحة للكتب وديكور المنزل.", 189],
      ["Cloud Queen Bed Frame", "هيكل سرير كلاود", "Queen-size bed frame with a clean upholstered headboard.", "هيكل سرير مزدوج بلوح رأس مبطن.", 579],
      ["Arc Floor Lamp", "مصباح أرضي آرك", "Sculptural floor lamp for warm ambient lighting.", "مصباح أرضي بتصميم فني وإضاءة دافئة.", 139],
      ["Ceramic Side Table", "طاولة جانبية سيراميك", "Compact side table with a refined ceramic finish.", "طاولة جانبية صغيرة بلمسة سيراميك أنيقة.", 119],
      ["Woven Storage Basket Set", "مجموعة سلال تخزين منسوجة", "Set of woven baskets for tidy, natural storage.", "مجموعة سلال منسوجة للتخزين بلمسة طبيعية.", 49],
      ["SoftWeave Area Rug", "سجادة سوفت ويف", "Soft area rug that adds warmth and texture.", "سجادة ناعمة تضيف الدفء والملمس للمكان.", 159],
      ["Minimal Wall Mirror", "مرآة جدارية بسيطة", "Large minimalist mirror for bedrooms and entryways.", "مرآة كبيرة بتصميم بسيط لغرف النوم والمداخل.", 99],
    ],
  },
  {
    slug: "home-appliances", name: "Home Appliances", ar: "الأجهزة المنزلية", description: "Useful appliances for a more comfortable home.", store: 2,
    images: [image("photo-1556911220-bff31c812dba"), image("photo-1574269909862-7e1d70bb8078"), image("photo-1585238342024-78d387f4a707")],
    products: [
      ["BrewMaster Coffee Machine", "آلة قهوة بروماستر", "Programmable coffee machine for consistent morning brews.", "آلة قهوة قابلة للبرمجة لتحضير قهوة صباحية ثابتة الجودة.", 179],
      ["PureAir HEPA Purifier", "منقي هواء بيور إير", "Room air purifier with multi-stage HEPA filtration.", "منقي هواء منزلي بفلترة HEPA متعددة المراحل.", 229],
      ["QuickChef Air Fryer", "قلاية كويك شيف الهوائية", "Large-capacity air fryer with simple digital controls.", "قلاية هوائية بسعة كبيرة وتحكم رقمي سهل.", 129],
      ["SteamPro Garment Steamer", "مكواة بخار ستيم برو", "Handheld garment steamer for quick fabric care.", "مكواة بخار محمولة للعناية السريعة بالأقمشة.", 69],
      ["SilentClean Robot Vacuum", "مكنسة روبوت سايلنت كلين", "Smart robot vacuum for scheduled everyday cleaning.", "مكنسة روبوت ذكية للتنظيف اليومي المجدول.", 349],
      ["ChillBox Mini Fridge", "ثلاجة تشيل بوكس الصغيرة", "Compact refrigerator for offices and small spaces.", "ثلاجة صغيرة للمكاتب والمساحات المحدودة.", 259],
      ["BlendPro Kitchen Blender", "خلاط مطبخ بليند برو", "High-speed blender for smoothies and meal preparation.", "خلاط سريع للعصائر وتحضير الطعام.", 89],
      ["AquaPure Water Filter", "فلتر مياه أكوا بيور", "Countertop water filtration system for daily use.", "نظام ترشيح مياه يوضع على سطح المطبخ.", 109],
      ["WarmNest Electric Kettle", "غلاية وورم نيست الكهربائية", "Fast-boil kettle with automatic shut-off.", "غلاية سريعة مع إيقاف تلقائي.", 39],
      ["FreshSeal Vacuum Sealer", "جهاز تفريغ الهواء فريش سيل", "Food vacuum sealer to help preserve freshness.", "جهاز تفريغ هواء الطعام للمساعدة في حفظ النضارة.", 79],
    ],
  },
  {
    slug: "beauty-personal-care", name: "Beauty & Personal Care", ar: "الجمال والعناية الشخصية", description: "Everyday beauty, skincare and personal care essentials.", store: 3,
    images: [image("photo-1608248543803-ba4f8c70ae0b"), image("photo-1596462502278-27bfdc403348"), image("photo-1556228720-195a672e8a03")],
    products: [
      ["HydraGlow Daily Moisturizer", "مرطب هيدرا جلو اليومي", "Lightweight daily moisturizer for a comfortable skin feel.", "مرطب يومي خفيف يمنح البشرة إحساساً مريحاً.", 28],
      ["Vitamin C Brightening Serum", "سيروم فيتامين C للإشراقة", "Daily facial serum with a smooth lightweight texture.", "سيروم يومي للوجه بقوام خفيف وناعم.", 34],
      ["SilkTouch Hair Dryer", "مجفف شعر سيلك تاتش", "Compact hair dryer with multiple heat settings.", "مجفف شعر مدمج بإعدادات حرارة متعددة.", 59],
      ["SoftBlend Makeup Brush Set", "مجموعة فرش سوفت بلند", "Versatile makeup brush set for everyday application.", "مجموعة فرش متعددة للاستخدام اليومي.", 32],
      ["CalmSkin Gentle Cleanser", "غسول كالم سكين اللطيف", "Gentle facial cleanser for a simple daily routine.", "غسول وجه لطيف لروتين يومي بسيط.", 19],
      ["SatinFinish Lip Color", "أحمر شفاه ساتان فينيش", "Comfortable satin-finish lip color for everyday wear.", "لون شفاه بلمسة ساتان مريحة للاستخدام اليومي.", 16],
      ["PureMist Facial Steamer", "جهاز بخار الوجه بيور ميست", "At-home facial steamer with a compact design.", "جهاز بخار للوجه للاستخدام المنزلي بتصميم مدمج.", 49],
      ["DailyShield Sunscreen SPF50", "واقي شمس ديلي شيلد SPF50", "Light-feel broad-spectrum sunscreen for daily routines.", "واقي شمس واسع الطيف بقوام خفيف للاستخدام اليومي.", 22],
      ["NourishBody Care Set", "مجموعة نورش للعناية بالجسم", "Body care set for a simple, comforting routine.", "مجموعة للعناية بالجسم لروتين مريح وبسيط.", 39],
      ["Precision Grooming Kit", "مجموعة عناية دقيقة", "Multi-piece grooming kit for home personal care.", "مجموعة متعددة القطع للعناية الشخصية في المنزل.", 44],
    ],
  },
  {
    slug: "sports-outdoors", name: "Sports & Outdoors", ar: "الرياضة والأنشطة الخارجية", description: "Fitness, training and outdoor essentials.", store: 3,
    images: [image("photo-1461896836934-ffe607ba8211"), image("photo-1517836357463-d25dfeac3438"), image("photo-1530549387789-4c1017266635")],
    products: [
      ["FlexFit Yoga Mat", "بساط يوغا فليكس فيت", "Non-slip exercise mat for yoga and floor workouts.", "بساط تمارين مانع للانزلاق لليوغا والتمارين الأرضية.", 35],
      ["TrailRunner Hydration Pack", "حقيبة ترطيب تريل رانر", "Lightweight hydration pack for running and hiking.", "حقيبة ترطيب خفيفة للجري والمشي الجبلي.", 69],
      ["Adjustable Dumbbell Pair", "زوج دمبل قابل للتعديل", "Space-saving adjustable weights for home workouts.", "أوزان قابلة للتعديل لتوفير المساحة في المنزل.", 149],
      ["ProCourt Basketball", "كرة سلة برو كورت", "Durable basketball with a reliable outdoor grip.", "كرة سلة متينة بقبضة مناسبة للعب الخارجي.", 29],
      ["Endurance Cycling Helmet", "خوذة دراجات إندورنس", "Ventilated cycling helmet with adjustable fit.", "خوذة دراجات جيدة التهوية وقابلة للتعديل.", 79],
      ["Active Resistance Bands", "أشرطة مقاومة أكتيف", "Resistance band set for strength and mobility training.", "مجموعة أشرطة مقاومة للقوة والمرونة.", 24],
      ["Summit Camping Tent", "خيمة تخييم ساميت", "Weather-ready two-person tent for weekend trips.", "خيمة لشخصين للرحلات ونهايات الأسبوع.", 189],
      ["Sprint Training Shoes", "حذاء تدريب سبرينت", "Responsive training shoes for gym and short runs.", "حذاء تدريب سريع الاستجابة للنادي والجري القصير.", 94],
      ["Insulated Steel Bottle", "قارورة فولاذية عازلة", "Reusable insulated bottle for hot and cold drinks.", "قارورة قابلة لإعادة الاستخدام للمشروبات الساخنة والباردة.", 27],
      ["Compact Sports Duffel", "حقيبة رياضية مدمجة", "Organized duffel bag for gym and weekend travel.", "حقيبة منظمة للنادي والرحلات القصيرة.", 52],
    ],
  },
  {
    slug: "books-stationery", name: "Books & Stationery", ar: "الكتب والقرطاسية", description: "Reading, learning and creative desk essentials.", store: 3,
    images: [image("photo-1544947950-fa07a98d237f"), image("photo-1512820790803-83ca734da794"), image("photo-1455390582262-044cdead277a")],
    products: [
      ["The Creative Focus Journal", "دفتر التركيز الإبداعي", "Guided journal for planning, reflection and ideas.", "دفتر موجه للتخطيط والتأمل وتدوين الأفكار.", 18],
      ["Hardcover Reading Notebook", "دفتر قراءة بغلاف صلب", "Durable notebook for notes and reading lists.", "دفتر متين للملاحظات وقوائم القراءة.", 14],
      ["Modern Desk Organizer", "منظم مكتب مودرن", "Minimal desk organizer for a tidy workspace.", "منظم مكتب بسيط لمساحة عمل مرتبة.", 26],
      ["FineLine Pen Set", "مجموعة أقلام فاين لاين", "Smooth-writing pen set for notes and sketches.", "مجموعة أقلام سلسة للكتابة والرسم.", 12],
      ["World Atlas Illustrated", "أطلس العالم المصور", "Illustrated world atlas for curious readers.", "أطلس مصور للعالم للقراء محبي الاستكشاف.", 32],
      ["Classic Literature Collection", "مجموعة الأدب الكلاسيكي", "Curated classic literature collection for home libraries.", "مجموعة مختارة من الأدب الكلاسيكي للمكتبات المنزلية.", 45],
      ["Watercolor Starter Kit", "مجموعة ألوان مائية للمبتدئين", "Beginner watercolor kit with essential supplies.", "مجموعة ألوان مائية للمبتدئين مع الأدوات الأساسية.", 29],
      ["Premium Sketchbook A4", "دفتر رسم فاخر A4", "Heavyweight paper sketchbook for drawing and studies.", "دفتر رسم بورق سميك للرسم والدراسة.", 21],
      ["Weekly Planner Pad", "مفكرة تخطيط أسبوعية", "Undated weekly planner pad for flexible scheduling.", "مفكرة أسبوعية غير مؤرخة لتنظيم مرن.", 11],
      ["Study Desk Lamp", "مصباح مكتب للدراسة", "Adjustable desk lamp for focused reading and study.", "مصباح مكتب قابل للتعديل للقراءة والدراسة.", 38],
    ],
  },
  {
    slug: "automotive-accessories", name: "Automotive Accessories", ar: "السيارات والإكسسوارات", description: "Practical accessories for drivers and vehicles.", store: 3,
    images: [image("photo-1486262715619-67b85e0b08d3"), image("photo-1492144534655-ae79c964c9d7"), image("photo-1503376780353-7e6692767b70")],
    products: [
      ["DriveSafe Dash Camera", "كاميرا سيارة درايف سيف", "Compact dash camera for recording everyday journeys.", "كاميرا سيارة مدمجة لتسجيل الرحلات اليومية.", 89],
      ["Wireless Car Charger", "شاحن سيارة لاسلكي", "Dashboard wireless charger with secure phone mounting.", "شاحن لاسلكي للوحة القيادة مع تثبيت الهاتف.", 42],
      ["Portable Tire Inflator", "منفاخ إطارات محمول", "Compact tire inflator with a clear pressure display.", "منفاخ إطارات مدمج بشاشة واضحة لضغط الهواء.", 55],
      ["All-Weather Floor Mats", "فرش أرضية لجميع الأجواء", "Easy-clean floor mats designed for everyday protection.", "فرش أرضية سهل التنظيف للحماية اليومية.", 69],
      ["Car Care Detailing Kit", "مجموعة عناية وتنظيف السيارة", "Car cleaning kit for interior and exterior detailing.", "مجموعة لتنظيف السيارة من الداخل والخارج.", 37],
      ["RoadReady Jump Starter", "جهاز تشغيل بطارية رود ريدي", "Portable jump starter for emergency roadside support.", "جهاز محمول لتشغيل البطارية في حالات الطوارئ.", 99],
      ["Rear Seat Organizer", "منظم المقعد الخلفي", "Multi-pocket organizer for family and road trips.", "منظم متعدد الجيوب للعائلة والرحلات.", 24],
      ["Universal Roof Rack", "حامل سقف شامل", "Versatile roof rack system for compatible vehicles.", "نظام حامل سقف متعدد الاستخدام للسيارات المتوافقة.", 179],
      ["LED Interior Light Kit", "مجموعة إضاءة داخلية LED", "Ambient LED lighting kit for vehicle interiors.", "مجموعة إضاءة LED محيطية لداخل السيارة.", 31],
      ["Smart Parking Sensor Set", "مجموعة حساسات ركن ذكية", "Parking sensor kit designed to assist tight maneuvers.", "مجموعة حساسات للمساعدة في الركن بالأماكن الضيقة.", 64],
    ],
  },
];

const demoBrands = [
  { slug: "mtjr-select", name: "Mtjr Select", ar: "متجر سيليكت" },
  { slug: "nova-labs", name: "Nova Labs", ar: "نوفا لابس" },
  { slug: "northline", name: "Northline", ar: "نورث لاين" },
  { slug: "atelier-home", name: "Atelier Home", ar: "أتيليه هوم" },
  { slug: "pureday", name: "Pureday", ar: "بيورداي" },
  { slug: "trailworks", name: "Trailworks", ar: "تريل ووركس" },
  { slug: "paper-and-co", name: "Paper & Co.", ar: "بيبر آند كو" },
  { slug: "roadmate", name: "Roadmate", ar: "رودميت" },
];

const storeDefinitions = [
  { slug: "demo-electronics-store", name: "Demo Electronics", ar: "متجر الإلكترونيات التجريبي", sellerEmail: "electronics@demo.mtjr2.test", sellerName: "Demo Electronics Seller" },
  { slug: "demo-fashion-store", name: "Demo Fashion", ar: "متجر الأزياء التجريبي", sellerEmail: "fashion@demo.mtjr2.test", sellerName: "Demo Fashion Seller" },
  { slug: "demo-home-store", name: "Demo Home", ar: "متجر المنزل التجريبي", sellerEmail: "home@demo.mtjr2.test", sellerName: "Demo Home Seller" },
  { slug: "demo-lifestyle-store", name: "Demo Lifestyle", ar: "متجر أسلوب الحياة التجريبي", sellerEmail: "lifestyle@demo.mtjr2.test", sellerName: "Demo Lifestyle Seller" },
];

async function upsertTranslation(model, where, create, update) {
  return model.upsert({ where, create, update });
}

async function seedDemoCatalog() {
  const now = new Date();
  const country = await prisma.country.upsert({
    where: { iso2: "US" },
    create: { iso2: "US", iso3: "USA", name: "United States", nativeName: "United States", isActive: true },
    update: { isActive: true },
  });
  const currency = await prisma.currency.upsert({
    where: { code: "USD" },
    create: { code: "USD", name: "US Dollar", symbol: "$", minorUnit: 2, isActive: true },
    update: { isActive: true, minorUnit: 2 },
  });
  const market = await prisma.market.upsert({
    where: { code: "DEMO-US" },
    create: { code: "DEMO-US", name: "Demo United States", countryId: country.id, defaultCurrencyCode: currency.code, status: "ACTIVE" },
    update: { name: "Demo United States", countryId: country.id, defaultCurrencyCode: currency.code, status: "ACTIVE" },
  });
  await prisma.marketCurrency.upsert({
    where: { marketId_currencyCode: { marketId: market.id, currencyCode: currency.code } },
    create: { marketId: market.id, currencyCode: currency.code, isEnabled: true },
    update: { isEnabled: true },
  });

  const stores = [];
  for (const definition of storeDefinitions) {
    const emailNormalized = definition.sellerEmail.toLowerCase();
    const owner = await prisma.user.upsert({
      where: { email: definition.sellerEmail },
      create: { email: definition.sellerEmail, emailNormalized, displayName: definition.sellerName, status: "ACTIVE", emailVerifiedAt: now },
      update: { emailNormalized, displayName: definition.sellerName, status: "ACTIVE", emailVerifiedAt: now },
    });
    const seller = await prisma.seller.upsert({
      where: { ownerId: owner.id },
      create: { ownerId: owner.id, status: "ACTIVE", legalName: definition.sellerName, displayName: definition.name },
      update: { status: "ACTIVE", legalName: definition.sellerName, displayName: definition.name },
    });
    const store = await prisma.store.upsert({
      where: { slug: definition.slug },
      create: { sellerId: seller.id, slug: definition.slug, name: definition.name, status: "ACTIVE" },
      update: { sellerId: seller.id, name: definition.name, status: "ACTIVE" },
    });
    await prisma.storeMarket.upsert({
      where: { storeId_marketId: { storeId: store.id, marketId: market.id } },
      create: { storeId: store.id, marketId: market.id, isEnabled: true },
      update: { isEnabled: true },
    });
    const warehouse = await prisma.warehouse.upsert({
      where: { storeId_code: { storeId: store.id, code: "DEMO-MAIN" } },
      create: { storeId: store.id, code: "DEMO-MAIN", name: "Demo Main Warehouse", isActive: true },
      update: { name: "Demo Main Warehouse", isActive: true },
    });
    stores.push({ store, warehouse });
  }

  const categoryRows = new Map();
  for (let index = 0; index < demoCategories.length; index += 1) {
    const definition = demoCategories[index];
    const category = await prisma.category.upsert({
      where: { slug: definition.slug },
      create: { slug: definition.slug, name: definition.name, description: definition.description, imageUrl: definition.images[0], status: "ACTIVE", sortOrder: index + 1 },
      update: { name: definition.name, description: definition.description, imageUrl: definition.images[0], status: "ACTIVE", sortOrder: index + 1 },
    });
    categoryRows.set(definition.slug, category);
    await upsertTranslation(prisma.categoryTranslation, {
      categoryId_locale: { categoryId: category.id, locale: "ar" },
    }, { categoryId: category.id, locale: "ar", name: definition.ar, description: definition.description }, { name: definition.ar, description: definition.description });
    await upsertTranslation(prisma.categoryTranslation, {
      categoryId_locale: { categoryId: category.id, locale: "en" },
    }, { categoryId: category.id, locale: "en", name: definition.name, description: definition.description }, { name: definition.name, description: definition.description });
  }

  const brandRows = new Map();
  for (const definition of demoBrands) {
    const brand = await prisma.brand.upsert({
      where: { slug: definition.slug },
      create: { slug: definition.slug, name: definition.name, status: "ACTIVE" },
      update: { name: definition.name, status: "ACTIVE" },
    });
    brandRows.set(definition.slug, brand);
    await upsertTranslation(prisma.brandTranslation, {
      brandId_locale: { brandId: brand.id, locale: "ar" },
    }, { brandId: brand.id, locale: "ar", name: definition.ar }, { name: definition.ar });
    await upsertTranslation(prisma.brandTranslation, {
      brandId_locale: { brandId: brand.id, locale: "en" },
    }, { brandId: brand.id, locale: "en", name: definition.name }, { name: definition.name });
  }

  for (const [categoryIndex, definition] of demoCategories.entries()) {
    const category = categoryRows.get(definition.slug);
    const { store, warehouse } = stores[definition.store];
    const brand = brandRows.get(demoBrands[categoryIndex].slug);

    for (const [productIndex, productDefinition] of definition.products.entries()) {
      const [name, nameAr, description, descriptionAr, price] = productDefinition;
      const slug = `demo-${definition.slug}-${String(productIndex + 1).padStart(2, "0")}`;
      const product = await prisma.product.upsert({
        where: { storeId_slug: { storeId: store.id, slug } },
        create: {
          storeId: store.id, brandId: brand.id, slug, name, description,
          status: "ACTIVE", approvalStatus: "APPROVED", approvedAt: now, publishedAt: now,
        },
        update: {
          brandId: brand.id, name, description, status: "ACTIVE",
          approvalStatus: "APPROVED", approvedAt: now, publishedAt: now,
        },
      });
      await upsertTranslation(prisma.productTranslation, {
        productId_locale: { productId: product.id, locale: "ar" },
      }, { productId: product.id, locale: "ar", name: nameAr, description: descriptionAr }, { name: nameAr, description: descriptionAr });
      await upsertTranslation(prisma.productTranslation, {
        productId_locale: { productId: product.id, locale: "en" },
      }, { productId: product.id, locale: "en", name, description }, { name, description });
      await prisma.productCategory.upsert({
        where: { productId_categoryId: { productId: product.id, categoryId: category.id } },
        create: { productId: product.id, categoryId: category.id, isPrimary: true, sortOrder: 0 },
        update: { isPrimary: true, sortOrder: 0 },
      });

      const imageUrl = definition.images[productIndex % definition.images.length];
      const existingMedia = await prisma.productMedia.findFirst({ where: { productId: product.id, url: imageUrl } });
      if (!existingMedia) {
        await prisma.productMedia.create({
          data: { productId: product.id, type: "IMAGE", url: imageUrl, altText: name, sortOrder: 0, isPrimary: true },
        });
      } else if (!existingMedia.isPrimary) {
        await prisma.productMedia.update({ where: { id: existingMedia.id }, data: { isPrimary: true } });
      }

      const sku = `DEMO-${definition.slug.toUpperCase()}-${String(productIndex + 1).padStart(2, "0")}`;
      const variant = await prisma.productVariant.upsert({
        where: { sku },
        create: { productId: product.id, sku, name: "Standard", optionValues: { option: "Standard" }, isActive: true },
        update: { productId: product.id, name: "Standard", optionValues: { option: "Standard" }, isActive: true },
      });
      const amountMinor = BigInt(price) * 100n;
      await prisma.productPrice.upsert({
        where: { variantId_marketId_currencyCode: { variantId: variant.id, marketId: market.id, currencyCode: currency.code } },
        create: { variantId: variant.id, marketId: market.id, currencyCode: currency.code, amountMinor, compareAtMinor: amountMinor + amountMinor / 5n },
        update: { amountMinor, compareAtMinor: amountMinor + amountMinor / 5n },
      });

      const inventory = await prisma.inventory.findUnique({
        where: { warehouseId_variantId: { warehouseId: warehouse.id, variantId: variant.id } },
      });
      if (!inventory) {
        const createdInventory = await prisma.inventory.create({
          data: { warehouseId: warehouse.id, variantId: variant.id, quantityOnHand: 25, quantityReserved: 0, reorderPoint: 5 },
        });
        await prisma.inventoryMovement.create({
          data: {
            inventoryId: createdInventory.id, type: "RECEIPT", quantityDelta: 25,
            referenceType: "DEMO_SEED", referenceId: sku,
            idempotencyKey: `demo-seed:initial-stock:${sku}`, note: "Initial demo catalog stock",
          },
        });
      }
    }
  }

  const synonyms = [
    ["en", "phone", "mobile"], ["en", "sofa", "couch"], ["en", "sneakers", "shoes"],
    ["en", "laptop", "notebook"], ["en", "headphones", "earbuds"], ["en", "furniture", "home"],
    ["ar", "هاتف", "موبايل"], ["ar", "أريكة", "كنبة"], ["ar", "حذاء", "أحذية"],
    ["ar", "حاسوب", "كمبيوتر"], ["ar", "أثاث", "منزل"], ["ar", "ملابس", "أزياء"],
  ];
  for (const [locale, term, synonym] of synonyms) {
    await prisma.searchSynonym.upsert({
      where: { locale_term_synonym: { locale, term, synonym } },
      create: { locale, term, synonym, isActive: true },
      update: { isActive: true },
    });
  }

  const [productCount, categoryCount, storeCount, inventoryCount] = await Promise.all([
    prisma.product.count({ where: { slug: { startsWith: "demo-" } } }),
    prisma.category.count({ where: { slug: { in: demoCategories.map((item) => item.slug) }, status: "ACTIVE" } }),
    prisma.store.count({ where: { slug: { startsWith: "demo-" }, status: "ACTIVE" } }),
    prisma.inventory.count({ where: { warehouse: { store: { slug: { startsWith: "demo-" } } } } }),
  ]);
  if (categoryCount !== demoCategories.length || productCount < demoCategories.length * 10) {
    throw new Error(`Demo catalog verification failed: ${categoryCount} categories, ${productCount} products.`);
  }
  console.log(`Demo catalog verified: ${productCount} products across ${categoryCount} categories, ${storeCount} stores, ${inventoryCount} inventory rows in DEMO-US/USD.`);
}

async function main() {
  await prisma.$transaction(async (tx) => {
    const permissionRows = new Map();
    for (const permission of permissions) {
      const row = await tx.permission.upsert({
        where: { key: permission.key }, create: permission,
        update: { description: permission.description },
      });
      permissionRows.set(permission.key, row);
    }
    for (const role of roles) {
      const row = await tx.role.upsert({
        where: { key: role.key },
        create: { key: role.key, name: role.name, description: role.description, isSystem: true },
        update: { name: role.name, description: role.description, isSystem: true },
      });
      for (const permissionKey of role.permissions) {
        const permission = permissionRows.get(permissionKey);
        if (!permission) throw new Error(`Unknown permission "${permissionKey}" in role "${role.key}".`);
        await tx.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: row.id, permissionId: permission.id } },
          create: { roleId: row.id, permissionId: permission.id }, update: {},
        });
      }
    }
  });

  if (demoCatalogRequested) await seedDemoCatalog();

  const [roleCount, permissionCount, assignmentCount] = await Promise.all([
    prisma.role.count({ where: { isSystem: true } }),
    prisma.permission.count(),
    prisma.rolePermission.count(),
  ]);
  console.log(`Identity seed verified: ${roleCount} system roles, ${permissionCount} permissions, ${assignmentCount} role-permission links.`);
}

main()
  .catch((error) => {
    console.error("Seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
