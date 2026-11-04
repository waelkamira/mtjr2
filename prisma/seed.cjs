// CommonJS is intentional: this seed is executed directly by Node via `db:seed`.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

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
  {
    key: "CUSTOMER",
    name: "Customer",
    description: "Default buyer account role.",
    permissions: ["account:read:own", "account:update:own", "orders:read:own"],
  },
  {
    key: "SELLER",
    name: "Seller",
    description: "Seller account with store-scoped catalog, inventory, and order capabilities.",
    permissions: [
      "account:read:own", "account:update:own", "store:read", "store:manage",
      "catalog:read", "catalog:manage", "inventory:manage", "orders:read", "orders:manage", "messages:manage",
    ],
  },
  {
    key: "STORE_MANAGER",
    name: "Store Manager",
    description: "Delegated store operations role; assignments must be store-scoped.",
    permissions: [
      "store:read", "store:manage", "store:staff:manage", "catalog:read",
      "catalog:manage", "inventory:manage", "orders:read", "orders:manage", "messages:manage",
    ],
  },
  {
    key: "SUPPORT_AGENT",
    name: "Support Agent",
    description: "Customer support access limited by explicit support and resource scopes.",
    permissions: ["users:read", "orders:read", "support:read", "support:manage", "returns:manage"],
  },
  {
    key: "ADMIN",
    name: "Administrator",
    description: "Operational administration; grant only to approved staff.",
    permissions: [
      "users:read", "users:manage", "store:read", "store:manage", "catalog:read",
      "catalog:manage", "inventory:manage", "orders:read", "orders:manage",
      "payments:read", "payments:refund", "support:read", "support:manage", "returns:manage",
      "roles:read", "roles:assign", "audit:read",
    ],
  },
  {
    key: "SUPER_ADMIN",
    name: "Super Administrator",
    description: "Break-glass platform-wide administrator; never assign by default.",
    permissions: permissions.map((permission) => permission.key),
  },
];

const demoCategories = [
  {
    slug: "demo-home-living",
    name: "Home & Living",
    description: "Thoughtful pieces for everyday spaces.",
    imageUrl: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=960&q=80",
  },
  {
    slug: "demo-electronics",
    name: "Electronics",
    description: "Useful technology for work and play.",
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=960&q=80",
  },
  {
    slug: "demo-accessories",
    name: "Accessories",
    description: "Everyday essentials, made to last.",
    imageUrl: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=960&q=80",
  },
  {
    slug: "demo-wellness",
    name: "Wellness",
    description: "Small comforts for a calmer routine.",
    imageUrl: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=960&q=80",
  },
];

const demoBrands = [
  { slug: "demo-atelier-form", name: "Atelier Form", description: "Considered design for everyday living." },
  { slug: "demo-orbit-audio", name: "Orbit Audio", description: "Clear sound and practical technology." },
  { slug: "demo-northstar", name: "Northstar Goods", description: "Useful essentials with a thoughtful touch." },
];

const demoProducts = [
  {
    slug: "demo-ceramic-pour-over-set", name: "Ceramic Pour-Over Set",
    description: "A glazed ceramic dripper and matching cup for a slower morning ritual.",
    category: "demo-home-living", brand: "demo-atelier-form", sku: "DEMO-POUROVER-01",
    image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80",
    price: 4200, compareAt: 4800, stock: 18, weightGrams: 650,
  },
  {
    slug: "demo-linen-table-runner", name: "Linen Table Runner",
    description: "A softly textured natural linen runner for everyday tables.",
    category: "demo-home-living", brand: "demo-northstar", sku: "DEMO-LINEN-01",
    image: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80",
    price: 3600, compareAt: null, stock: 24, weightGrams: 400,
  },
  {
    slug: "demo-wireless-headphones", name: "Studio Wireless Headphones",
    description: "Comfortable over-ear listening with a clean, balanced sound.",
    category: "demo-electronics", brand: "demo-orbit-audio", sku: "DEMO-HEADPHONES-01",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=80",
    price: 8990, compareAt: 9990, stock: 12, weightGrams: 280,
  },
  {
    slug: "demo-portable-reading-lamp", name: "Portable Reading Lamp",
    description: "A rechargeable ambient lamp for a bedside table or reading nook.",
    category: "demo-electronics", brand: "demo-atelier-form", sku: "DEMO-LAMP-01",
    image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1200&q=80",
    price: 6450, compareAt: null, stock: 15, weightGrams: 520,
  },
  {
    slug: "demo-canvas-market-tote", name: "Canvas Market Tote",
    description: "A sturdy everyday carryall with reinforced handles.",
    category: "demo-accessories", brand: "demo-northstar", sku: "DEMO-TOTE-01",
    image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1200&q=80",
    price: 2900, compareAt: null, stock: 30, weightGrams: 300,
  },
  {
    slug: "demo-minimalist-watch", name: "Minimalist Analog Watch",
    description: "A clean dial and understated profile for everyday wear.",
    category: "demo-accessories", brand: "demo-orbit-audio", sku: "DEMO-WATCH-01",
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80",
    price: 7490, compareAt: 8290, stock: 9, weightGrams: 110,
  },
  {
    slug: "demo-botanical-hand-cream", name: "Botanical Hand Cream",
    description: "A lightweight daily hand cream with a fresh botanical scent.",
    category: "demo-wellness", brand: "demo-northstar", sku: "DEMO-HANDCREAM-01",
    image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=1200&q=80",
    price: 1450, compareAt: null, stock: 36, weightGrams: 90,
  },
  {
    slug: "demo-scented-candle", name: "Woodland Scented Candle",
    description: "A soy wax candle with warm cedar and soft herbal notes.",
    category: "demo-wellness", brand: "demo-atelier-form", sku: "DEMO-CANDLE-01",
    image: "https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=1200&q=80",
    price: 2200, compareAt: null, stock: 21, weightGrams: 340,
  },
];

async function seedDemoCatalog() {
  const storeSlug = "mtjr2-demo-marketplace";
  const publishedAt = new Date("2026-01-01T00:00:00.000Z");
  let storeId;
  let marketId;
  let warehouseId;

  await prisma.$transaction(async (tx) => {
    const country = await tx.country.upsert({
      where: { iso2: "NL" },
      create: { iso2: "NL", iso3: "NLD", name: "Netherlands", nativeName: "Nederland", phoneCallingCode: "+31", isActive: true },
      update: { name: "Netherlands", nativeName: "Nederland", phoneCallingCode: "+31", isActive: true },
    });
    const currency = await tx.currency.upsert({
      where: { code: "EUR" },
      create: { code: "EUR", name: "Euro", symbol: "€", minorUnit: 2, isActive: true },
      update: { name: "Euro", symbol: "€", minorUnit: 2, isActive: true },
    });
    const market = await tx.market.upsert({
      where: { code: "NL-DEMO" },
      create: { code: "NL-DEMO", name: "Netherlands Demo Market", countryId: country.id, defaultCurrencyCode: currency.code, status: "ACTIVE" },
      update: { name: "Netherlands Demo Market", countryId: country.id, defaultCurrencyCode: currency.code, status: "ACTIVE" },
    });
    marketId = market.id;
    await tx.marketCurrency.upsert({
      where: { marketId_currencyCode: { marketId: market.id, currencyCode: currency.code } },
      create: { marketId: market.id, currencyCode: currency.code, isEnabled: true },
      update: { isEnabled: true },
    });

    const owner = await tx.user.upsert({
      where: { emailNormalized: "demo-seller@mtjr2.local" },
      create: {
        email: "demo-seller@mtjr2.local",
        emailNormalized: "demo-seller@mtjr2.local",
        displayName: "Demo Marketplace Seller",
        status: "ACTIVE",
      },
      update: { displayName: "Demo Marketplace Seller", status: "ACTIVE" },
    });
    const seller = await tx.seller.upsert({
      where: { ownerId: owner.id },
      create: { ownerId: owner.id, status: "ACTIVE", displayName: "Northstar Demo Goods" },
      update: { status: "ACTIVE", displayName: "Northstar Demo Goods" },
    });
    const store = await tx.store.upsert({
      where: { slug: storeSlug },
      create: { sellerId: seller.id, slug: storeSlug, name: "Northstar Demo Goods", status: "ACTIVE" },
      update: { sellerId: seller.id, name: "Northstar Demo Goods", status: "ACTIVE" },
    });
    storeId = store.id;
    await tx.storeMarket.upsert({
      where: { storeId_marketId: { storeId: store.id, marketId: market.id } },
      create: { storeId: store.id, marketId: market.id, isEnabled: true },
      update: { isEnabled: true },
    });
    const warehouse = await tx.warehouse.upsert({
      where: { storeId_code: { storeId: store.id, code: "DEMO-NL" } },
      create: { storeId: store.id, code: "DEMO-NL", name: "Demo Netherlands Warehouse", isActive: true },
      update: { name: "Demo Netherlands Warehouse", isActive: true },
    });
    warehouseId = warehouse.id;

    const categories = new Map();
    for (const [index, item] of demoCategories.entries()) {
      const category = await tx.category.upsert({
        where: { slug: item.slug },
        create: { ...item, status: "ACTIVE", sortOrder: index },
        update: { name: item.name, description: item.description, imageUrl: item.imageUrl, status: "ACTIVE", sortOrder: index },
      });
      categories.set(item.slug, category);
      await tx.categoryTranslation.upsert({
        where: { categoryId_locale: { categoryId: category.id, locale: "en" } },
        create: { categoryId: category.id, locale: "en", name: item.name, description: item.description },
        update: { name: item.name, description: item.description },
      });
    }

    const brands = new Map();
    for (const item of demoBrands) {
      const brand = await tx.brand.upsert({
        where: { slug: item.slug },
        create: { ...item, status: "ACTIVE" },
        update: { name: item.name, description: item.description, status: "ACTIVE" },
      });
      brands.set(item.slug, brand);
      await tx.brandTranslation.upsert({
        where: { brandId_locale: { brandId: brand.id, locale: "en" } },
        create: { brandId: brand.id, locale: "en", name: item.name, description: item.description },
        update: { name: item.name, description: item.description },
      });
    }

    for (const item of demoProducts) {
      const category = categories.get(item.category);
      const brand = brands.get(item.brand);
      if (!category || !brand) throw new Error(`Unknown category or brand in demo product "${item.slug}".`);

      const product = await tx.product.upsert({
        where: { storeId_slug: { storeId: store.id, slug: item.slug } },
        create: {
          storeId: store.id, brandId: brand.id, slug: item.slug, name: item.name,
          description: item.description, status: "ACTIVE", approvalStatus: "APPROVED",
          approvedAt: publishedAt, publishedAt,
        },
        update: {
          brandId: brand.id, name: item.name, description: item.description,
          status: "ACTIVE", approvalStatus: "APPROVED", approvedAt: publishedAt, publishedAt,
        },
      });
      await tx.productTranslation.upsert({
        where: { productId_locale: { productId: product.id, locale: "en" } },
        create: { productId: product.id, locale: "en", name: item.name, description: item.description },
        update: { name: item.name, description: item.description },
      });
      await tx.productCategory.upsert({
        where: { productId_categoryId: { productId: product.id, categoryId: category.id } },
        create: { productId: product.id, categoryId: category.id, isPrimary: true, sortOrder: 0 },
        update: { isPrimary: true, sortOrder: 0 },
      });
      await tx.productMedia.upsert({
        where: { id: `seed-demo-${item.slug}-image` },
        create: {
          id: `seed-demo-${item.slug}-image`, productId: product.id, type: "IMAGE",
          url: item.image, altText: item.name, isPrimary: true, sortOrder: 0,
        },
        update: {
          productId: product.id, type: "IMAGE", url: item.image,
          altText: item.name, isPrimary: true, sortOrder: 0,
        },
      });
      const variant = await tx.productVariant.upsert({
        where: { sku: item.sku },
        create: {
          productId: product.id, sku: item.sku, name: "One size",
          optionValues: { size: "One size" }, weightGrams: item.weightGrams, isActive: true,
        },
        update: {
          productId: product.id, name: "One size", optionValues: { size: "One size" },
          weightGrams: item.weightGrams, isActive: true,
        },
      });
      await tx.productPrice.upsert({
        where: {
          variantId_marketId_currencyCode: {
            variantId: variant.id, marketId: market.id, currencyCode: currency.code,
          },
        },
        create: {
          variantId: variant.id, marketId: market.id, currencyCode: currency.code,
          amountMinor: BigInt(item.price), compareAtMinor: item.compareAt === null ? null : BigInt(item.compareAt),
        },
        update: {
          amountMinor: BigInt(item.price), compareAtMinor: item.compareAt === null ? null : BigInt(item.compareAt),
        },
      });
      await tx.inventory.upsert({
        where: { warehouseId_variantId: { warehouseId: warehouse.id, variantId: variant.id } },
        create: {
          warehouseId: warehouse.id, variantId: variant.id,
          quantityOnHand: item.stock, quantityReserved: 0, reorderPoint: 2,
        },
        update: { quantityOnHand: item.stock, quantityReserved: 0, reorderPoint: 2 },
      });
    }
  }, { maxWait: 10000, timeout: 30000 });

  const [completeProductCount, marketReady, storeReady] = await Promise.all([
    prisma.product.count({
      where: {
        storeId, status: "ACTIVE", approvalStatus: "APPROVED",
        media: { some: { type: "IMAGE", isPrimary: true } },
        variants: {
          some: {
            isActive: true,
            prices: { some: { marketId, currencyCode: "EUR" } },
            inventories: { some: { warehouseId, quantityOnHand: { gt: 0 } } },
          },
        },
      },
    }),
    prisma.market.count({
      where: {
        id: marketId, status: "ACTIVE", country: { isActive: true },
        currencies: { some: { currencyCode: "EUR", isEnabled: true, currency: { isActive: true } } },
      },
    }),
    prisma.store.count({ where: { id: storeId, status: "ACTIVE", seller: { status: "ACTIVE" } } }),
  ]);
  if (completeProductCount !== demoProducts.length || marketReady !== 1 || storeReady !== 1) {
    throw new Error(`Demo catalog verification failed (${completeProductCount}/${demoProducts.length} complete products).`);
  }
  console.log(`Demo catalog seed verified: ${completeProductCount} published products, 4 categories, 3 brands, EUR market and stocked variants.`);
}

async function main() {
  await prisma.$transaction(async (tx) => {
    const permissionRows = new Map();

    for (const permission of permissions) {
      const row = await tx.permission.upsert({
        where: { key: permission.key },
        create: permission,
        update: { description: permission.description },
      });
      permissionRows.set(permission.key, row);
    }

    for (const role of roles) {
      const row = await tx.role.upsert({
        where: { key: role.key },
        create: {
          key: role.key,
          name: role.name,
          description: role.description,
          isSystem: true,
        },
        update: {
          name: role.name,
          description: role.description,
          isSystem: true,
        },
      });

      for (const permissionKey of role.permissions) {
        const permission = permissionRows.get(permissionKey);
        if (!permission) {
          throw new Error(`Unknown permission "${permissionKey}" in role "${role.key}".`);
        }

        await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: row.id,
              permissionId: permission.id,
            },
          },
          create: { roleId: row.id, permissionId: permission.id },
          update: {},
        });
      }
    }
  });


  // Demo catalog requires two explicit opt-ins and is blocked in production.
  if (process.env.SEED_DEMO_CATALOG === "true") {
    if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEMO_CATALOG_SEED !== "true") {
      throw new Error("Demo catalog seeding is blocked in production and requires ALLOW_DEMO_CATALOG_SEED=true.");
    }
    await seedDemoCatalog();
  }

  const [roleCount, permissionCount, assignmentCount] = await Promise.all([
    prisma.role.count({ where: { isSystem: true } }),
    prisma.permission.count(),
    prisma.rolePermission.count(),
  ]);

  console.log(
    `Identity seed verified: ${roleCount} system roles, ${permissionCount} permissions, ${assignmentCount} role-permission links.`,
  );
}

main()
  .catch((error) => {
    console.error("Identity seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
