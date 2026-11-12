// Global bilingual marketplace taxonomy. Inspired by public category structures from Amazon, eBay, Walmart and Etsy.
// This is original Matjar taxonomy data; it does not copy marketplace IDs or proprietary listing metadata.
// Safe to run repeatedly: upserts by stable slug, preserves existing category status and unrelated categories.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const taxonomy = [
  ["electronics", "Electronics", "الإلكترونيات", [
    ["phones-tablets", "Mobile Phones & Tablets", "الهواتف والأجهزة اللوحية"],
    ["smartphones", "Smartphones", "الهواتف الذكية"],
    ["feature-phones", "Basic Mobile Phones", "الهواتف التقليدية"],
    ["phone-accessories", "Mobile Phone Accessories", "ملحقات الهواتف"],
    ["tablet-accessories", "Tablet Accessories", "ملحقات الأجهزة اللوحية"],
    ["laptops", "Laptops & Notebooks", "الحواسيب المحمولة"],
    ["desktop-computers", "Desktop Computers", "الحواسيب المكتبية"],
    ["computer-components", "Computer Components", "مكونات الحاسوب"],
    ["monitors", "Monitors & Displays", "الشاشات"],
    ["printers-scanners", "Printers & Scanners", "الطابعات والماسحات"],
    ["networking", "Networking Equipment", "معدات الشبكات"],
    ["computer-accessories", "Computer Accessories", "ملحقات الحاسوب"],
    ["headphones-audio", "Headphones & Audio", "سماعات الرأس والصوتيات"],
    ["speakers", "Speakers", "مكبرات الصوت"],
    ["cameras", "Cameras & Photography", "الكاميرات والتصوير"],
    ["televisions", "TVs & Home Entertainment", "التلفزيونات والترفيه المنزلي"],
    ["gaming-consoles", "Gaming Consoles", "أجهزة ألعاب الفيديو"],
    ["gaming-accessories", "Gaming Accessories", "ملحقات الألعاب"],
    ["smart-home", "Smart Home Devices", "أجهزة المنزل الذكي"],
    ["electronic-components", "Electronic Components", "المكونات الإلكترونية"]
  ]],
  ["fashion", "Clothing & Fashion", "الملابس والأزياء", [
    ["womens-clothing", "Women's Clothing", "ملابس نسائية"],
    ["mens-clothing", "Men's Clothing", "ملابس رجالية"],
    ["kids-clothing", "Kids' Clothing", "ملابس الأطفال"],
    ["baby-clothing", "Baby Clothing", "ملابس الرضع"],
    ["shoes-women", "Women's Shoes", "أحذية نسائية"],
    ["shoes-men", "Men's Shoes", "أحذية رجالية"],
    ["shoes-kids", "Kids' Shoes", "أحذية الأطفال"],
    ["sportswear", "Sportswear & Activewear", "الملابس الرياضية"],
    ["underwear", "Underwear & Lingerie", "الملابس الداخلية واللانجري"],
    ["sleepwear", "Sleepwear & Loungewear", "ملابس النوم والملابس المنزلية"],
    ["coats-jackets", "Coats & Jackets", "المعاطف والسترات"],
    ["dresses", "Dresses & Jumpsuits", "الفساتين والبدلات النسائية"],
    ["shirts-tops", "Shirts & Tops", "القمصان والبلوزات"],
    ["trousers-jeans", "Trousers & Jeans", "البناطيل والجينز"],
    ["bags-handbags", "Handbags & Purses", "حقائب اليد والمحافظ"],
    ["backpacks", "Backpacks & School Bags", "حقائب الظهر والمدرسة"],
    ["fashion-accessories", "Fashion Accessories", "إكسسوارات الأزياء"],
    ["belts", "Belts & Suspenders", "الأحزمة والحمالات"],
    ["hats-caps", "Hats & Caps", "القبعات"],
    ["socks", "Socks & Hosiery", "الجوارب"],
    ["traditional-clothing", "Traditional & Cultural Clothing", "الملابس التقليدية والتراثية"]
  ]],
  ["jewelry-watches", "Jewelry & Watches", "المجوهرات والساعات", [
    ["fine-jewelry", "Fine Jewelry", "المجوهرات الفاخرة"],
    ["fashion-jewelry", "Fashion Jewelry", "المجوهرات والإكسسوارات"],
    ["rings", "Rings", "الخواتم"],
    ["necklaces", "Necklaces & Pendants", "القلائد والسلاسل"],
    ["earrings", "Earrings", "الأقراط"],
    ["bracelets", "Bracelets", "الأساور"],
    ["wristwatches", "Wristwatches", "ساعات اليد"],
    ["smartwatches", "Smartwatches", "الساعات الذكية"],
    ["watch-accessories", "Watch Accessories", "ملحقات الساعات"],
    ["jewelry-storage", "Jewelry Boxes & Storage", "علب وحافظات المجوهرات"]
  ]],
  ["home-furniture", "Home & Furniture", "المنزل والأثاث", [
    ["living-room-furniture", "Living Room Furniture", "أثاث غرف المعيشة"],
    ["bedroom-furniture", "Bedroom Furniture", "أثاث غرف النوم"],
    ["dining-furniture", "Dining Room Furniture", "أثاث غرف الطعام"],
    ["office-furniture", "Home Office Furniture", "أثاث المكاتب المنزلية"],
    ["outdoor-furniture", "Outdoor Furniture", "الأثاث الخارجي"],
    ["sofas", "Sofas & Couches", "الأرائك والكنب"],
    ["beds-mattresses", "Beds & Mattresses", "الأسرّة والمراتب"],
    ["tables", "Tables & Desks", "الطاولات والمكاتب"],
    ["chairs", "Chairs & Stools", "الكراسي والمقاعد"],
    ["wardrobes-storage", "Wardrobes & Storage", "الخزائن والتخزين"],
    ["home-decor", "Home Décor", "ديكور المنزل"],
    ["lighting", "Lighting & Lamps", "الإضاءة والمصابيح"],
    ["rugs-carpets", "Rugs & Carpets", "السجاد والموكيت"],
    ["curtains-blinds", "Curtains & Blinds", "الستائر"],
    ["bedding", "Bedding & Bed Linen", "أغطية ومفروشات الأسرّة"],
    ["bathroom-accessories", "Bathroom Accessories", "إكسسوارات الحمام"],
    ["storage-organization", "Storage & Organization", "التخزين والتنظيم"],
    ["cleaning-supplies", "Cleaning Supplies", "مستلزمات التنظيف"],
    ["home-improvement", "Home Improvement", "تحسينات المنزل"]
  ]],
  ["kitchen-dining", "Kitchen & Dining", "المطبخ ومستلزمات الطعام", [
    ["cookware", "Cookware", "أواني الطهي"],
    ["bakeware", "Bakeware", "أدوات الخَبز"],
    ["kitchen-utensils", "Kitchen Utensils & Gadgets", "أدوات ومستلزمات المطبخ"],
    ["tableware", "Tableware & Dinnerware", "أواني المائدة"],
    ["drinkware", "Drinkware & Barware", "أكواب وأدوات المشروبات"],
    ["kitchen-storage", "Kitchen Storage", "تخزين المطبخ"],
    ["knives-cutlery", "Knives & Cutlery", "السكاكين وأدوات المائدة"],
    ["coffee-tea", "Coffee & Tea Accessories", "مستلزمات القهوة والشاي"],
    ["food-containers", "Food Storage & Containers", "حفظ الطعام والحاويات"],
    ["kitchen-textiles", "Kitchen Textiles", "منسوجات المطبخ"]
  ]],
  ["appliances", "Home Appliances", "الأجهزة المنزلية", [
    ["large-appliances", "Large Home Appliances", "الأجهزة المنزلية الكبيرة"],
    ["refrigerators", "Refrigerators & Freezers", "الثلاجات والمجمدات"],
    ["washing-machines", "Washing Machines & Dryers", "الغسالات والنشافات"],
    ["cookers-ovens", "Cookers, Ovens & Hobs", "الأفران والطباخات والمواقد"],
    ["dishwashers", "Dishwashers", "غسالات الصحون"],
    ["small-appliances", "Small Kitchen Appliances", "أجهزة المطبخ الصغيرة"],
    ["coffee-machines", "Coffee Machines", "ماكينات القهوة"],
    ["vacuums", "Vacuum Cleaners", "المكانس الكهربائية"],
    ["air-conditioners", "Air Conditioners", "مكيفات الهواء"],
    ["heaters-fans", "Heaters & Fans", "المدافئ والمراوح"],
    ["air-purifiers", "Air Purifiers & Humidifiers", "منقيات ومرطبات الهواء"],
    ["irons-steamers", "Irons & Steamers", "المكاوي وأجهزة البخار"],
    ["water-heaters", "Water Heaters", "سخانات المياه"]
  ]],
  ["beauty", "Beauty & Personal Care", "الجمال والعناية الشخصية", [
    ["skincare", "Skin Care", "العناية بالبشرة"],
    ["makeup", "Makeup", "مستحضرات التجميل"],
    ["haircare", "Hair Care", "العناية بالشعر"],
    ["hair-styling", "Hair Styling Tools", "أدوات تصفيف الشعر"],
    ["fragrance", "Perfumes & Fragrances", "العطور"],
    ["bath-body", "Bath & Body Care", "العناية بالجسم والاستحمام"],
    ["mens-grooming", "Men's Grooming", "العناية بالرجل"],
    ["nail-care", "Nail Care", "العناية بالأظافر"],
    ["beauty-tools", "Beauty Tools & Accessories", "أدوات وإكسسوارات التجميل"],
    ["oral-care", "Oral Care", "العناية بالفم والأسنان"],
    ["shaving-hair-removal", "Shaving & Hair Removal", "الحلاقة وإزالة الشعر"],
    ["beauty-sets", "Beauty Gift Sets", "مجموعات هدايا التجميل"]
  ]],
  ["health", "Health & Wellness", "الصحة والعافية", [
    ["medical-equipment", "Medical Equipment", "المعدات الطبية"],
    ["health-monitors", "Health Monitoring Devices", "أجهزة مراقبة الصحة"],
    ["mobility-aids", "Mobility & Accessibility Aids", "وسائل الحركة والمساعدة"],
    ["first-aid", "First Aid & Safety", "الإسعافات الأولية والسلامة"],
    ["personal-care-devices", "Personal Care Devices", "أجهزة العناية الشخصية"],
    ["vision-care", "Vision & Eye Care", "العناية بالبصر والعيون"],
    ["hearing-care", "Hearing Care", "العناية بالسمع"],
    ["wellness-products", "Wellness Products", "منتجات العافية"],
    ["healthcare-supplies", "Healthcare Supplies", "مستلزمات الرعاية الصحية"]
  ]],
  ["grocery-food", "Grocery & Food", "البقالة والمواد الغذائية", [
    ["fresh-produce", "Fresh Fruits & Vegetables", "الفواكه والخضروات الطازجة"],
    ["meat-seafood", "Meat & Seafood", "اللحوم والمأكولات البحرية"],
    ["dairy-eggs", "Dairy, Cheese & Eggs", "الألبان والأجبان والبيض"],
    ["bakery", "Bakery & Desserts", "المخبوزات والحلويات"],
    ["pantry", "Pantry Staples", "المواد الغذائية الأساسية"],
    ["rice-grains", "Rice, Grains & Pulses", "الأرز والحبوب والبقوليات"],
    ["spices-condiments", "Spices, Sauces & Condiments", "التوابل والصلصات والمنكهات"],
    ["snacks", "Snacks & Sweets", "الوجبات الخفيفة والحلويات"],
    ["coffee-tea-food", "Coffee, Tea & Cocoa", "القهوة والشاي والكاكاو"],
    ["beverages", "Non-alcoholic Beverages", "المشروبات غير الكحولية"],
    ["organic-food", "Organic & Specialty Food", "الأغذية العضوية والمتخصصة"],
    ["frozen-food", "Frozen Food", "الأطعمة المجمدة"],
    ["baby-food", "Baby Food", "أغذية الأطفال"]
  ]],
  ["baby-kids", "Baby & Kids", "الأطفال والرضّع", [
    ["baby-gear", "Baby Gear & Travel", "مستلزمات تنقل الأطفال"],
    ["strollers", "Strollers & Pushchairs", "عربات الأطفال"],
    ["car-seats", "Car Seats", "مقاعد السيارة للأطفال"],
    ["nursery-furniture", "Nursery Furniture", "أثاث غرف الأطفال"],
    ["feeding", "Baby Feeding", "رضاعة وإطعام الأطفال"],
    ["diapering", "Diapers & Changing", "الحفاضات ومستلزمات التغيير"],
    ["baby-bathing", "Baby Bathing & Care", "استحمام وعناية الرضع"],
    ["baby-toys", "Baby Toys", "ألعاب الرضع"],
    ["school-supplies-kids", "School Supplies", "المستلزمات المدرسية"],
    ["kids-room", "Kids' Room Décor", "ديكور غرف الأطفال"]
  ]],
  ["toys-games", "Toys & Games", "الألعاب", [
    ["educational-toys", "Educational Toys", "الألعاب التعليمية"],
    ["building-toys", "Building & Construction Toys", "ألعاب البناء والتركيب"],
    ["dolls", "Dolls & Accessories", "الدمى وإكسسواراتها"],
    ["action-figures", "Action Figures & Collectibles", "مجسمات الشخصيات والمقتنيات"],
    ["board-games", "Board Games", "ألعاب الطاولة"],
    ["puzzles", "Puzzles", "الألغاز والتركيب"],
    ["remote-control", "Remote Control Toys", "ألعاب التحكم عن بُعد"],
    ["outdoor-toys", "Outdoor Play Equipment", "ألعاب خارجية"],
    ["pretend-play", "Pretend Play & Costumes", "ألعاب التمثيل والأزياء التنكرية"],
    ["video-games", "Video Games", "ألعاب الفيديو"],
    ["party-supplies", "Party & Celebration Supplies", "مستلزمات الحفلات والمناسبات"]
  ]],
  ["sports-outdoors", "Sports & Outdoors", "الرياضة والأنشطة الخارجية", [
    ["fitness-equipment", "Fitness Equipment", "معدات اللياقة البدنية"],
    ["exercise-accessories", "Exercise Accessories", "إكسسوارات التمارين"],
    ["team-sports", "Team Sports", "الرياضات الجماعية"],
    ["football-soccer", "Football & Soccer", "كرة القدم"],
    ["cycling", "Cycling", "ركوب الدراجات"],
    ["camping-hiking", "Camping & Hiking", "التخييم والمشي الجبلي"],
    ["fishing", "Fishing", "صيد الأسماك"],
    ["water-sports", "Water Sports", "الرياضات المائية"],
    ["racket-sports", "Racket Sports", "رياضات المضرب"],
    ["martial-arts", "Martial Arts & Boxing", "الفنون القتالية والملاكمة"],
    ["sportswear-equipment", "Sports Clothing & Equipment", "الملابس والمعدات الرياضية"],
    ["outdoor-recreation", "Outdoor Recreation", "الأنشطة الترفيهية الخارجية"]
  ]],
  ["automotive", "Automotive & Motorcycles", "السيارات والدراجات النارية", [
    ["car-parts", "Car Parts & Components", "قطع غيار السيارات"],
    ["car-accessories", "Car Accessories", "إكسسوارات السيارات"],
    ["car-electronics", "Car Electronics & Audio", "إلكترونيات وصوتيات السيارات"],
    ["car-care", "Car Care & Cleaning", "العناية بالسيارات والتنظيف"],
    ["tyres-wheels", "Tyres & Wheels", "الإطارات والعجلات"],
    ["motorcycle-parts", "Motorcycle Parts", "قطع غيار الدراجات النارية"],
    ["motorcycle-accessories", "Motorcycle Accessories", "إكسسوارات الدراجات النارية"],
    ["tools-garage", "Automotive Tools & Garage", "أدوات السيارات ومعدات الورش"],
    ["vehicle-safety", "Vehicle Safety & Security", "سلامة وأمان المركبات"],
    ["oils-fluids", "Oils & Fluids", "الزيوت والسوائل"]
  ]],
  ["books-media", "Books & Media", "الكتب والوسائط", [
    ["fiction-books", "Fiction Books", "الكتب الروائية"],
    ["nonfiction-books", "Non-fiction Books", "كتب غير روائية"],
    ["children-books", "Children's Books", "كتب الأطفال"],
    ["educational-books", "Educational & Textbooks", "الكتب التعليمية والمقررات"],
    ["business-books", "Business & Economics Books", "كتب الأعمال والاقتصاد"],
    ["science-books", "Science & Technology Books", "كتب العلوم والتقنية"],
    ["religion-books", "Religion & Spirituality Books", "كتب الدين والروحانيات"],
    ["comics-manga", "Comics, Graphic Novels & Manga", "القصص المصورة والمانغا"],
    ["ebooks", "E-books & Digital Reading", "الكتب الإلكترونية"],
    ["music-movies", "Music & Movies", "الموسيقى والأفلام"],
    ["stationery", "Stationery & Journals", "القرطاسية والدفاتر"]
  ]],
  ["office-school", "Office & School Supplies", "مستلزمات المكتب والمدرسة", [
    ["office-workspace-furniture", "Office Workspace Furniture", "أثاث مساحات العمل"],
    ["office-electronics", "Office Electronics", "إلكترونيات المكتب"],
    ["paper-products", "Paper & Paper Products", "الورق والمنتجات الورقية"],
    ["writing-supplies", "Writing & Drawing Supplies", "أدوات الكتابة والرسم"],
    ["filing-storage", "Filing & Organization", "الأرشفة والتنظيم"],
    ["school-bags", "School Bags & Accessories", "الحقائب المدرسية وإكسسواراتها"],
    ["school-art", "School Art & Craft Supplies", "مستلزمات الفنون والأشغال المدرسية"],
    ["presentation", "Presentation Supplies", "مستلزمات العروض التقديمية"],
    ["mailing-shipping", "Mailing & Shipping Supplies", "مستلزمات البريد والشحن"]
  ]],
  ["garden-outdoors", "Garden & Outdoor Living", "الحدائق والمساحات الخارجية", [
    ["garden-plants", "Plants, Seeds & Bulbs", "النباتات والبذور والأبصال"],
    ["garden-tools", "Garden Tools", "أدوات الحدائق"],
    ["irrigation", "Irrigation & Watering", "الري والسقاية"],
    ["planters-pots", "Planters & Plant Pots", "أحواض وأصص النباتات"],
    ["outdoor-decor", "Outdoor Décor", "ديكور الحدائق"],
    ["barbecue", "Barbecues & Outdoor Cooking", "الشواء والطهي الخارجي"],
    ["pools-spas", "Pools & Spa Supplies", "مستلزمات المسابح والمنتجعات"],
    ["lawn-care", "Lawn Care & Landscaping", "العناية بالعشب وتنسيق الحدائق"],
    ["greenhouse", "Greenhouses & Growing Supplies", "البيوت المحمية ومستلزمات الزراعة"]
  ]],
  ["tools-hardware", "Tools & Hardware", "الأدوات ومستلزمات البناء", [
    ["power-tools", "Power Tools", "الأدوات الكهربائية"],
    ["hand-tools", "Hand Tools", "الأدوات اليدوية"],
    ["tool-storage", "Tool Storage", "تخزين الأدوات"],
    ["fasteners", "Fasteners & Fixings", "المثبتات ووسائل التثبيت"],
    ["plumbing", "Plumbing Supplies", "مستلزمات السباكة"],
    ["electrical-supplies", "Electrical Supplies", "المستلزمات الكهربائية"],
    ["building-materials", "Building Materials", "مواد البناء"],
    ["paint-decorating", "Paint & Decorating", "الدهانات والديكور"],
    ["safety-equipment", "Work Safety Equipment", "معدات السلامة المهنية"],
    ["measuring-tools", "Measuring & Testing Tools", "أدوات القياس والفحص"]
  ]],
  ["pet-supplies", "Pet Supplies", "مستلزمات الحيوانات الأليفة", [
    ["dog-supplies", "Dog Supplies", "مستلزمات الكلاب"],
    ["cat-supplies", "Cat Supplies", "مستلزمات القطط"],
    ["bird-supplies", "Bird Supplies", "مستلزمات الطيور"],
    ["fish-aquarium", "Fish & Aquarium Supplies", "مستلزمات الأسماك وأحواضها"],
    ["small-animal", "Small Animal Supplies", "مستلزمات الحيوانات الصغيرة"],
    ["pet-food", "Pet Food & Treats", "طعام ومكافآت الحيوانات"],
    ["pet-grooming", "Pet Grooming & Hygiene", "تنظيف وعناية الحيوانات"],
    ["pet-beds", "Pet Beds & Furniture", "أسرّة وأثاث الحيوانات"],
    ["pet-travel", "Pet Carriers & Travel", "حاملات وتنقل الحيوانات"],
    ["pet-toys", "Pet Toys & Accessories", "ألعاب وإكسسوارات الحيوانات"]
  ]],
  ["arts-crafts", "Arts, Crafts & Sewing", "الفنون والحرف والخياطة", [
    ["art-supplies", "Art Supplies", "مستلزمات الفنون"],
    ["painting-drawing", "Painting & Drawing", "الرسم والتلوين"],
    ["craft-supplies", "Craft Supplies", "مستلزمات الأشغال اليدوية"],
    ["sewing-machines", "Sewing Machines", "ماكينات الخياطة"],
    ["sewing-supplies", "Sewing & Needlework Supplies", "مستلزمات الخياطة والتطريز"],
    ["fabric-textiles", "Fabric & Textiles", "الأقمشة والمنسوجات"],
    ["beading-jewelry-making", "Beading & Jewelry Making", "الخرز وصناعة المجوهرات"],
    ["woodworking-crafts", "Woodworking & DIY Crafts", "أشغال الخشب والحرف اليدوية"],
    ["scrapbooking", "Scrapbooking & Paper Crafts", "فن القصاصات والأعمال الورقية"],
    ["knitting-crochet", "Knitting & Crochet", "الحياكة والكروشيه"]
  ]],
  ["musical-instruments", "Musical Instruments", "الآلات الموسيقية", [
    ["guitars", "Guitars & Basses", "الغيتارات والباص"],
    ["keyboards-pianos", "Keyboards & Pianos", "لوحات المفاتيح والبيانو"],
    ["drums-percussion", "Drums & Percussion", "الطبول وآلات الإيقاع"],
    ["wind-instruments", "Wind Instruments", "آلات النفخ"],
    ["string-instruments", "String Instruments", "الآلات الوترية"],
    ["studio-recording", "Studio & Recording Equipment", "معدات الاستوديو والتسجيل"],
    ["live-sound", "Live Sound & PA Equipment", "معدات الصوت الحي"],
    ["music-accessories", "Musical Instrument Accessories", "ملحقات الآلات الموسيقية"]
  ]],
  ["luggage-travel", "Luggage & Travel", "الأمتعة والسفر", [
    ["suitcases", "Suitcases & Luggage", "حقائب السفر والأمتعة"],
    ["travel-bags", "Travel Bags", "حقائب الرحلات"],
    ["travel-accessories", "Travel Accessories", "إكسسوارات السفر"],
    ["travel-organizers", "Travel Organizers", "منظمات السفر"],
    ["passport-holders", "Passport & Document Holders", "حافظات الجوازات والوثائق"],
    ["travel-comfort", "Travel Comfort Products", "مستلزمات الراحة أثناء السفر"]
  ]],
  ["industrial-scientific", "Industrial & Scientific", "المستلزمات الصناعية والعلمية", [
    ["lab-equipment", "Laboratory Equipment", "معدات المختبرات"],
    ["industrial-machinery", "Industrial Machinery", "الآلات الصناعية"],
    ["measurement-instruments", "Measurement Instruments", "أجهزة القياس"],
    ["material-handling", "Material Handling", "معدات مناولة المواد"],
    ["commercial-cleaning", "Commercial Cleaning Equipment", "معدات التنظيف التجاري"],
    ["restaurant-equipment", "Commercial Kitchen Equipment", "معدات المطابخ التجارية"],
    ["safety-workwear", "Industrial Safety & Workwear", "السلامة الصناعية وملابس العمل"],
    ["packaging-equipment", "Packaging Equipment & Supplies", "معدات ومستلزمات التغليف"],
    ["agricultural-equipment", "Agricultural Equipment", "المعدات الزراعية"]
  ]],
  ["real-estate", "Property & Real Estate", "العقارات", [
    ["apartments", "Apartments & Flats", "الشقق السكنية"],
    ["houses-villas", "Houses & Villas", "المنازل والفلل"],
    ["land-plots", "Land & Plots", "الأراضي والمقاسم"],
    ["commercial-property", "Commercial Properties", "العقارات التجارية"],
    ["offices-property", "Offices & Workspaces", "المكاتب ومساحات العمل"],
    ["shops-property", "Shops & Retail Units", "المحلات والوحدات التجارية"],
    ["warehouses-property", "Warehouses & Industrial Property", "المستودعات والعقارات الصناعية"],
    ["farms-property", "Farms & Agricultural Land", "المزارع والأراضي الزراعية"],
    ["short-term-rentals", "Holiday & Short-term Rentals", "الإيجارات السياحية والقصيرة"]
  ]],
  ["collectibles-art", "Collectibles & Art", "المقتنيات والفنون", [
    ["fine-art", "Original Art & Fine Art", "الفنون الأصلية والفنون الجميلة"],
    ["antiques", "Antiques", "التحف والأنتيكات"],
    ["coins-banknotes", "Coins & Banknotes", "العملات المعدنية والورقية"],
    ["stamps", "Stamps & Philately", "الطوابع وهواية جمعها"],
    ["memorabilia", "Sports & Entertainment Memorabilia", "تذكارات الرياضة والترفيه"],
    ["vintage-items", "Vintage & Retro Items", "المنتجات القديمة والكلاسيكية"],
    ["collectible-toys", "Collectible Toys & Figures", "الألعاب والمجسمات القابلة للاقتناء"],
    ["trading-cards", "Trading Cards", "بطاقات التجميع"]
  ]],
  ["handmade", "Handmade & Personalized", "المنتجات اليدوية والمخصصة", [
    ["handmade-home", "Handmade Home Décor", "ديكور منزلي مصنوع يدوياً"],
    ["handmade-jewelry", "Handmade Jewelry", "مجوهرات مصنوعة يدوياً"],
    ["handmade-clothing", "Handmade Clothing & Accessories", "ملابس وإكسسوارات مصنوعة يدوياً"],
    ["handmade-gifts", "Personalized Gifts", "هدايا مخصصة"],
    ["handmade-wood", "Handcrafted Wood Products", "منتجات خشبية يدوية"],
    ["handmade-ceramics", "Pottery & Ceramics", "الفخار والسيراميك"],
    ["handmade-soaps", "Handmade Soaps & Candles", "صابون وشموع يدوية"],
    ["handmade-art", "Handmade Art & Prints", "أعمال فنية ومطبوعات يدوية"]
  ]],
  ["digital-software", "Software & Digital Products", "البرمجيات والمنتجات الرقمية", [
    ["software-applications", "Software Applications", "البرامج والتطبيقات"],
    ["security-software", "Security & Antivirus Software", "برامج الحماية ومكافحة الفيروسات"],
    ["business-software", "Business & Productivity Software", "برامج الأعمال والإنتاجية"],
    ["design-software", "Design & Creative Software", "برامج التصميم والإبداع"],
    ["digital-gift-cards", "Digital Gift Cards", "بطاقات الهدايا الرقمية"],
    ["digital-downloads", "Digital Downloads & Templates", "الملفات والقوالب الرقمية"],
    ["online-courses", "Online Courses & Learning", "الدورات والتعلم عبر الإنترنت"]
  ]]
];

async function upsertTranslation(categoryId, locale, name) {
  await prisma.categoryTranslation.upsert({
    where: { categoryId_locale: { categoryId, locale } },
    create: { categoryId, locale, name },
    update: { name }
  });
}

async function main() {
  let created = 0;
  let updated = 0;
  for (let rootIndex = 0; rootIndex < taxonomy.length; rootIndex += 1) {
    const [slug, name, ar, children] = taxonomy[rootIndex];
    const existingRoot = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
    const root = await prisma.category.upsert({
      where: { slug },
      create: { slug, name, parentId: null, status: "ACTIVE", sortOrder: (rootIndex + 1) * 100 },
      update: { name, parentId: null, sortOrder: (rootIndex + 1) * 100 }
    });
    if (existingRoot) updated += 1; else created += 1;
    await upsertTranslation(root.id, "en", name);
    await upsertTranslation(root.id, "ar", ar);

    for (let childIndex = 0; childIndex < children.length; childIndex += 1) {
      const [childSlug, childName, childAr] = children[childIndex];
      const fullSlug = childSlug;
      const existingChild = await prisma.category.findUnique({ where: { slug: fullSlug }, select: { id: true } });
      const child = await prisma.category.upsert({
        where: { slug: fullSlug },
        create: { slug: fullSlug, name: childName, parentId: root.id, status: "ACTIVE", sortOrder: childIndex + 1 },
        update: { name: childName, parentId: root.id, sortOrder: childIndex + 1 }
      });
      if (existingChild) updated += 1; else created += 1;
      await upsertTranslation(child.id, "en", childName);
      await upsertTranslation(child.id, "ar", childAr);
    }
  }
  const expected = taxonomy.reduce((sum, item) => sum + 1 + item[3].length, 0);
  const [activeCount, missingTranslations] = await Promise.all([
    prisma.category.count({ where: { status: "ACTIVE", slug: { in: taxonomy.flatMap(([slug, , , children]) => [slug, ...children.map(([childSlug]) => childSlug)]) } } }),
    prisma.categoryTranslation.count({ where: { locale: { in: ["ar", "en"] }, category: { slug: { in: taxonomy.flatMap(([slug, , , children]) => [slug, ...children.map(([childSlug]) => childSlug)]) } } })
  ]);
  if (activeCount !== expected || missingTranslations !== expected * 2) {
    throw new Error(`Taxonomy verification failed: expected ${expected} active categories and ${expected * 2} translations; found ${activeCount} and ${missingTranslations}.`);
  }
  console.log(`Matjar taxonomy synchronized: ${expected} bilingual categories (${created} created, ${updated} updated).`);
}

main().catch((error) => { console.error("Category taxonomy seed failed.", error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
