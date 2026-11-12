// Local-only, idempotent seller demo data for the Syria launch market.
// Run with ALLOW_SYRIA_SELLER_SEED=true and a local DATABASE_URL.
// This creates clearly marked demo orders; it never creates payment or ledger entries.

const { prisma, demoCategories, demoSubcategories, demoBrands, upsertTranslation } = require("./seed.cjs");

const SELLER_EMAIL = (process.env.SYRIA_SEED_SELLER_EMAIL || "ramondm4@gmail.com").trim().toLowerCase();
const USD_TO_SYP = Number(process.env.SYRIA_SEED_USD_TO_SYP || "147");
const PREFIX = "RAMOND-SY";

function assertSafeTarget() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data in production.");
  if (process.env.ALLOW_SYRIA_SELLER_SEED !== "true") {
    throw new Error("Set ALLOW_SYRIA_SELLER_SEED=true to explicitly allow local seller demo data.");
  }
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required.");
  let url;
  try { url = new URL(raw); } catch { throw new Error("DATABASE_URL is not a valid PostgreSQL URL."); }
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "host.docker.internal"]);
  if (!localHosts.has(url.hostname)) {
    throw new Error("Safety check: DATABASE_URL must point to a local PostgreSQL host (localhost/127.0.0.1/::1/host.docker.internal).");
  }
  if (!Number.isFinite(USD_TO_SYP) || USD_TO_SYP <= 0) throw new Error("SYRIA_SEED_USD_TO_SYP must be a positive number.");
}

async function upsertDemoCustomer(index) {
  const email = "ramond-demo-customer-" + String(index + 1).padStart(2, "0") + "@mtjr2.test";
  const displayName = "عميل تجريبي " + (index + 1);
  return prisma.user.upsert({
    where: { email },
    create: { email, emailNormalized: email, displayName, status: "ACTIVE", emailVerifiedAt: new Date() },
    update: { emailNormalized: email, displayName, status: "ACTIVE" },
  });
}

async function seedSellerIdentityAndStore() {
  const owner = await prisma.user.findFirst({
    where: { OR: [{ email: SELLER_EMAIL }, { emailNormalized: SELLER_EMAIL }] },
  });
  if (!owner) {
    throw new Error("Seller account " + SELLER_EMAIL + " was not found. Register/sign in with this email first; the seed will not create a passwordless owner account.");
  }
  const seller = await prisma.seller.upsert({
    where: { ownerId: owner.id },
    create: {
      ownerId: owner.id, status: "ACTIVE", legalName: owner.displayName || "Ramond",
      displayName: "Ramond Syria Store", contactName: owner.displayName || "Ramond",
      contactEmail: SELLER_EMAIL, registrationCountryCode: "SY",
      residence: "Damascus, Syria", sellingCategories: "Electronics, fashion, home, beauty, sports, books and automotive",
    },
    update: {
      status: "ACTIVE", displayName: "Ramond Syria Store", contactEmail: SELLER_EMAIL,
      registrationCountryCode: "SY", residence: "Damascus, Syria",
    },
  });

  let store = await prisma.store.findUnique({ where: { sellerId: seller.id } });
  if (!store) {
    store = await prisma.store.create({
      data: {
        sellerId: seller.id, slug: "ramond-syria-store", name: "Ramond Syria Store",
        description: "متجر راموند — منتجات متنوعة للسوق السورية",
        publicPhone: "+963 11 000 0000", publicAddress: "Damascus, Syria",
        status: "ACTIVE", shippingContactName: owner.displayName || "Ramond",
        shippingPhone: "+963 11 000 0000", shippingAddressLine1: "Demo fulfillment address",
        shippingCity: "Damascus", shippingRegion: "Damascus Governorate",
        shippingCountryCode: "SY",
        shippingInstructions: "بيانات شحن تجريبية؛ يرجى استبدالها بعنوان المتجر الفعلي.",
        shippingPolicy: "بيانات سياسة شحن تجريبية قابلة للتعديل من لوحة البائع.",
        returnsPolicy: "بيانات سياسة إرجاع تجريبية قابلة للتعديل من لوحة البائع.",
      },
    });
  } else {
    store = await prisma.store.update({
      where: { id: store.id },
      data: {
        name: "Ramond Syria Store", status: "ACTIVE",
        description: store.description || "متجر راموند — منتجات متنوعة للسوق السورية",
        publicPhone: store.publicPhone || "+963 11 000 0000",
        publicAddress: store.publicAddress || "Damascus, Syria",
        shippingContactName: store.shippingContactName || "Ramond",
        shippingPhone: store.shippingPhone || "+963 11 000 0000",
        shippingAddressLine1: store.shippingAddressLine1 || "Demo fulfillment address",
        shippingCity: store.shippingCity || "Damascus",
        shippingRegion: store.shippingRegion || "Damascus Governorate",
        shippingCountryCode: "SY",
        shippingInstructions: store.shippingInstructions || "بيانات شحن تجريبية؛ يرجى استبدالها بعنوان المتجر الفعلي.",
        shippingPolicy: store.shippingPolicy || "بيانات سياسة شحن تجريبية قابلة للتعديل من لوحة البائع.",
        returnsPolicy: store.returnsPolicy || "بيانات سياسة إرجاع تجريبية قابلة للتعديل من لوحة البائع.",
      },
    });
  }

  const sellerRole = await prisma.role.findUnique({ where: { key: "SELLER" } });
  if (sellerRole) {
    await prisma.userRoleAssignment.upsert({
      where: { userId_roleId_scopeType_scopeId: {
        userId: owner.id, roleId: sellerRole.id, scopeType: "STORE", scopeId: store.id,
      } },
      create: { userId: owner.id, roleId: sellerRole.id, scopeType: "STORE", scopeId: store.id },
      update: { expiresAt: null },
    });
  }
  return { owner, seller, store };
}

async function seedSyriaMarket(store) {
  const country = await prisma.country.upsert({
    where: { iso2: "SY" },
    create: { iso2: "SY", iso3: "SYR", name: "Syria", nativeName: "سوريا", phoneCallingCode: "+963", isActive: true },
    update: { iso3: "SYR", name: "Syria", nativeName: "سوريا", phoneCallingCode: "+963", isActive: true },
  });
  const syp = await prisma.currency.upsert({
    where: { code: "SYP" },
    create: { code: "SYP", name: "Syrian Pound", symbol: "ل.س", minorUnit: 2, isActive: true },
    update: { name: "Syrian Pound", symbol: "ل.س", minorUnit: 2, isActive: true },
  });
  const usd = await prisma.currency.upsert({
    where: { code: "USD" },
    create: { code: "USD", name: "US Dollar", symbol: "$", minorUnit: 2, isActive: true },
    update: { name: "US Dollar", symbol: "$", minorUnit: 2, isActive: true },
  });
  const market = await prisma.market.upsert({
    where: { code: "SY-SYR" },
    create: { code: "SY-SYR", name: "Syria", countryId: country.id, defaultCurrencyCode: "SYP", status: "ACTIVE" },
    update: { name: "Syria", countryId: country.id, defaultCurrencyCode: "SYP", status: "ACTIVE" },
  });
  for (const currency of [syp, usd]) {
    await prisma.marketCurrency.upsert({
      where: { marketId_currencyCode: { marketId: market.id, currencyCode: currency.code } },
      create: { marketId: market.id, currencyCode: currency.code, isEnabled: true },
      update: { isEnabled: true },
    });
  }
  await prisma.storeMarket.upsert({
    where: { storeId_marketId: { storeId: store.id, marketId: market.id } },
    create: { storeId: store.id, marketId: market.id, isEnabled: true },
    update: { isEnabled: true },
  });
  await prisma.storeMarket.updateMany({
    where: { storeId: store.id, marketId: { not: market.id } },
    data: { isEnabled: false },
  });
  const warehouse = await prisma.warehouse.upsert({
    where: { storeId_code: { storeId: store.id, code: "RAMOND-MAIN" } },
    create: { storeId: store.id, code: "RAMOND-MAIN", name: "مستودع راموند الرئيسي — دمشق", isActive: true },
    update: { name: "مستودع راموند الرئيسي — دمشق", isActive: true },
  });
  const shipping = await prisma.storeShippingRate.findFirst({
    where: { storeId: store.id, marketId: market.id, name: "توصيل محلي تجريبي — دمشق" },
  });
  if (shipping) {
    await prisma.storeShippingRate.update({ where: { id: shipping.id }, data: { isActive: true, amountMinor: 300n * 100n } });
  } else {
    await prisma.storeShippingRate.create({
      data: {
        storeId: store.id, marketId: market.id, currencyCode: "USD",
        name: "توصيل محلي تجريبي — دمشق", description: "سعر توصيل تجريبي قابل للتعديل",
        amountMinor: 300n * 100n, destinationRegion: "Damascus",
        minDeliveryDays: 1, maxDeliveryDays: 3, isActive: true, priority: 1,
      },
    });
  }
  return { market, syp, usd, warehouse };
}

async function seedCatalog(store, warehouse, market, syp, usd) {
  const now = new Date();
  const categories = new Map();
  const subcategories = new Map();
  for (const [index, definition] of demoCategories.entries()) {
    const category = await prisma.category.upsert({
      where: { slug: definition.slug },
      create: {
        slug: definition.slug, name: definition.name, description: definition.description,
        imageUrl: definition.images[0], status: "ACTIVE", sortOrder: index + 1,
      },
      update: {
        name: definition.name, description: definition.description,
        imageUrl: definition.images[0], status: "ACTIVE", sortOrder: index + 1,
      },
    });
    categories.set(definition.slug, category);
    for (const [locale, name] of [["ar", definition.ar], ["en", definition.name]]) {
      await upsertTranslation(prisma.categoryTranslation,
        { categoryId_locale: { categoryId: category.id, locale } },
        { categoryId: category.id, locale, name, description: definition.description },
        { name, description: definition.description });
    }
    for (const [childIndex, childDefinition] of (demoSubcategories[definition.slug] || []).entries()) {
      const child = await prisma.category.upsert({
        where: { slug: childDefinition.slug },
        create: {
          slug: childDefinition.slug, parentId: category.id, name: childDefinition.name,
          description: definition.description,
          imageUrl: definition.images[childIndex % definition.images.length],
          status: "ACTIVE", sortOrder: childIndex + 1,
        },
        update: {
          parentId: category.id, name: childDefinition.name, description: definition.description,
          imageUrl: definition.images[childIndex % definition.images.length],
          status: "ACTIVE", sortOrder: childIndex + 1,
        },
      });
      subcategories.set(childDefinition.slug, child);
      for (const [locale, name] of [["ar", childDefinition.ar], ["en", childDefinition.name]]) {
        await upsertTranslation(prisma.categoryTranslation,
          { categoryId_locale: { categoryId: child.id, locale } },
          { categoryId: child.id, locale, name, description: definition.description },
          { name, description: definition.description });
      }
    }
  }

  const brands = new Map();
  for (const brandDefinition of demoBrands) {
    const brand = await prisma.brand.upsert({
      where: { slug: brandDefinition.slug },
      create: {
        slug: brandDefinition.slug, name: brandDefinition.name,
        description: "علامة تجارية تجريبية ضمن بيانات متجر راموند.",
        status: "ACTIVE",
      },
      update: { name: brandDefinition.name, status: "ACTIVE" },
    });
    brands.set(brandDefinition.slug, brand);
    for (const [locale, name] of [["ar", brandDefinition.ar], ["en", brandDefinition.name]]) {
      await upsertTranslation(prisma.brandTranslation,
        { brandId_locale: { brandId: brand.id, locale } },
        { brandId: brand.id, locale, name },
        { name });
    }
  }

  const products = [];
  for (const [categoryIndex, definition] of demoCategories.entries()) {
    const category = categories.get(definition.slug);
    const brand = brands.get(demoBrands[categoryIndex % demoBrands.length].slug);
    for (let index = 0; index < 20; index += 1) {
      const sourceIndex = index % definition.products.length;
      const [baseName, baseNameAr, baseDescription, baseDescriptionAr, usdPrice] = definition.products[sourceIndex];
      const plusEdition = index >= definition.products.length;
      const name = plusEdition ? baseName + " — Plus Edition" : baseName;
      const nameAr = plusEdition ? baseNameAr + " — إصدار بلس" : baseNameAr;
      const description = baseDescription + (plusEdition ? " Enhanced Plus edition for the Syria demo catalog." : "");
      const descriptionAr = baseDescriptionAr + (plusEdition ? " إصدار بلس محسّن ضمن كتالوج سوريا التجريبي." : "");
      const slug = "ramond-" + definition.slug + "-" + String(index + 1).padStart(2, "0");
      const product = await prisma.product.upsert({
        where: { storeId_slug: { storeId: store.id, slug } },
        create: {
          storeId: store.id, brandId: brand.id, slug, name, description,
          specifications: {
            condition: "NEW", origin: "Syria demo catalog", demoData: true,
            edition: plusEdition ? "PLUS" : "STANDARD",
          },
          city: "Damascus", district: "Damascus",
          status: "ACTIVE", approvalStatus: "APPROVED", approvedAt: now, publishedAt: now,
        },
        update: {
          brandId: brand.id, name, description,
          specifications: {
            condition: "NEW", origin: "Syria demo catalog", demoData: true,
            edition: plusEdition ? "PLUS" : "STANDARD",
          },
          city: "Damascus", district: "Damascus",
          status: "ACTIVE", approvalStatus: "APPROVED", approvedAt: now, publishedAt: now,
        },
      });
      for (const [locale, localizedName, localizedDescription] of [
        ["ar", nameAr, descriptionAr], ["en", name, description],
      ]) {
        await upsertTranslation(prisma.productTranslation,
          { productId_locale: { productId: product.id, locale } },
          { productId: product.id, locale, name: localizedName, description: localizedDescription },
          { name: localizedName, description: localizedDescription });
      }
      await prisma.productCategory.upsert({
        where: { productId_categoryId: { productId: product.id, categoryId: category.id } },
        create: { productId: product.id, categoryId: category.id, isPrimary: true, sortOrder: index },
        update: { isPrimary: true, sortOrder: index },
      });
      for (const childDefinition of demoSubcategories[definition.slug] || []) {
        if (!childDefinition.productIndexes.includes(sourceIndex)) continue;
        const child = subcategories.get(childDefinition.slug);
        await prisma.productCategory.upsert({
          where: { productId_categoryId: { productId: product.id, categoryId: child.id } },
          create: { productId: product.id, categoryId: child.id, isPrimary: false, sortOrder: index },
          update: { isPrimary: false, sortOrder: index },
        });
      }

      const imageUrl = definition.images[sourceIndex % definition.images.length];
      const media = await prisma.productMedia.findFirst({ where: { productId: product.id, url: imageUrl } });
      if (!media) {
        await prisma.productMedia.create({
          data: {
            productId: product.id, type: "IMAGE", url: imageUrl,
            altText: name, sortOrder: 0, isPrimary: true,
          },
        });
      } else if (!media.isPrimary) {
        await prisma.productMedia.update({ where: { id: media.id }, data: { isPrimary: true } });
      }

      const sku = PREFIX + "-" + definition.slug.toUpperCase() + "-" + String(index + 1).padStart(3, "0");
      const variant = await prisma.productVariant.upsert({
        where: { sku },
        create: {
          productId: product.id, sku, name: "Standard",
          optionValues: { option: "Standard", demoData: true }, isActive: true,
        },
        update: { productId: product.id, name: "Standard", isActive: true },
      });
      const usdMinor = BigInt(Math.round(usdPrice * (plusEdition ? 1.08 : 1))) * 100n;
      const sypMinor = BigInt(Math.round(Number(usdMinor) / 100 * USD_TO_SYP)) * 100n;
      for (const [currency, amountMinor] of [[usd, usdMinor], [syp, sypMinor]]) {
        await prisma.productPrice.upsert({
          where: { variantId_marketId_currencyCode: {
            variantId: variant.id, marketId: market.id, currencyCode: currency.code,
          } },
          create: {
            variantId: variant.id, marketId: market.id, currencyCode: currency.code,
            amountMinor, compareAtMinor: amountMinor + amountMinor / 5n,
          },
          update: { amountMinor, compareAtMinor: amountMinor + amountMinor / 5n },
        });
      }

      const existingInventory = await prisma.inventory.findUnique({
        where: { warehouseId_variantId: { warehouseId: warehouse.id, variantId: variant.id } },
      });
      if (!existingInventory) {
        const quantity = index % 8 === 0 ? 2 : index % 9 === 0 ? 4 : 12 + (index % 25);
        const inventory = await prisma.inventory.create({
          data: {
            warehouseId: warehouse.id, variantId: variant.id,
            quantityOnHand: quantity, quantityReserved: 0,
            quantityQuarantined: 0, reorderPoint: 5,
          },
        });
        await prisma.inventoryMovement.create({
          data: {
            inventoryId: inventory.id, type: "RECEIPT", quantityDelta: quantity,
            referenceType: "SYRIA_SELLER_DEMO_SEED", referenceId: sku,
            idempotencyKey: "syria-seller-seed:stock:" + sku,
            note: "رصيد افتتاحي تجريبي — يمكن تعديله من إدارة المخزون.",
          },
        });
      }
      products.push({ product, variant, sku, usdMinor, sypMinor, category, usdPrice });
    }
  }
  return { products, categories, brands };
}

async function seedOrdersAndEngagement(owner, store, market, usd, products) {
  const now = new Date();
  const customers = [];
  for (let i = 0; i < 10; i += 1) customers.push(await upsertDemoCustomer(i));

  const orderStates = [
    ["CONFIRMED", "CONFIRMED"], ["PROCESSING", "PROCESSING"],
    ["PROCESSING", "PROCESSING"], ["PROCESSING", "READY_TO_SHIP"],
    ["PROCESSING", "SHIPPED"], ["COMPLETED", "DELIVERED"],
    ["COMPLETED", "DELIVERED"], ["CONFIRMED", "CONFIRMED"],
    ["COMPLETED", "DELIVERED"], ["PROCESSING", "PROCESSING"],
  ];
  const createdOrders = [];
  for (let i = 0; i < orderStates.length; i += 1) {
    const orderNumber = "DEMO-SYR-" + String(i + 1).padStart(5, "0");
    const existing = await prisma.order.findUnique({
      where: { orderNumber },
      include: { vendorOrders: { include: { items: true } } },
    });
    if (existing) {
      if (!existing.vendorOrders[0] || !existing.vendorOrders[0].items[0]) {
        throw new Error("Existing demo order " + orderNumber + " is incomplete. Review it before rerunning the seed.");
      }
      createdOrders.push({
        order: existing, vendorOrder: existing.vendorOrders[0],
        item: existing.vendorOrders[0].items[0], customer: customers[i],
      });
      continue;
    }
    const customer = customers[i];
    const productEntry = products[(i * 13 + 4) % products.length];
    const quantity = i % 3 === 0 ? 2 : 1;
    const unitAmountMinor = productEntry.usdMinor;
    const subtotalMinor = unitAmountMinor * BigInt(quantity);
    const shippingMinor = 300n * 100n;
    const totalMinor = subtotalMinor + shippingMinor;
    const cart = await prisma.cart.findFirst({
      where: { userId: customer.id, marketId: market.id, currencyCode: usd.code, status: "ACTIVE" },
    }) || await prisma.cart.create({
      data: { userId: customer.id, marketId: market.id, currencyCode: usd.code, status: "ACTIVE" },
    });
    await prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId: productEntry.variant.id } },
      create: { cartId: cart.id, variantId: productEntry.variant.id, quantity },
      update: { quantity },
    });
    const quoteKey = "syria-demo-quote-" + String(i + 1).padStart(4, "0");
    const quote = await prisma.checkoutQuote.upsert({
      where: { idempotencyKey: quoteKey },
      create: {
        cartId: cart.id, userId: customer.id, marketId: market.id,
        currencyCode: usd.code, status: "ACTIVE", subtotalMinor,
        idempotencyKey: quoteKey,
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      },
      update: { subtotalMinor, status: "ACTIVE" },
    });
    await prisma.checkoutQuoteLine.upsert({
      where: { quoteId_variantId: { quoteId: quote.id, variantId: productEntry.variant.id } },
      create: {
        quoteId: quote.id, variantId: productEntry.variant.id, storeId: store.id,
        productName: productEntry.product.name, storeName: store.name,
        sku: productEntry.sku, variantName: "Standard", quantity,
        unitAmountMinor, lineTotalMinor: subtotalMinor,
      },
      update: { productName: productEntry.product.name, quantity, unitAmountMinor, lineTotalMinor: subtotalMinor },
    });
    const [orderStatus, vendorStatus] = orderStates[i];
    const placedAt = new Date(now.getTime() - (i + 1) * 24 * 60 * 60 * 1000);
    const order = await prisma.order.create({
      data: {
        orderNumber, quoteId: quote.id, userId: customer.id,
        marketId: market.id, currencyCode: usd.code,
        status: orderStatus, subtotalMinor, discountMinor: 0n,
        shippingMinor, taxMinor: 0n, taxRuleName: "Demo data — no tax charged",
        taxRateBasisPoints: 0, taxInclusive: false, taxIncludesShipping: false,
        totalMinor, idempotencyKey: "syria-demo-order-" + String(i + 1).padStart(4, "0"),
        placedAt, createdAt: placedAt,
      },
    });
    await prisma.checkoutQuote.update({ where: { id: quote.id }, data: { status: "CONVERTED" } });
    await prisma.cart.update({ where: { id: cart.id }, data: { status: "CHECKED_OUT" } });
    await prisma.orderAddress.create({
      data: {
        orderId: order.id, recipientName: customer.displayName || "Demo Customer",
        phone: "+963 900 000 000", countryCode: "SY", countryName: "Syria",
        line1: "عنوان تجريبي — يستبدل بعنوان العميل الفعلي",
        city: ["دمشق", "حلب", "حمص", "اللاذقية"][i % 4], region: "Syria",
      },
    });
    const vendorOrder = await prisma.vendorOrder.create({
      data: {
        orderId: order.id, storeId: store.id, status: vendorStatus,
        subtotalMinor, discountMinor: 0n, shippingMinor, taxMinor: 0n,
        taxInclusive: false, shippingServiceName: "توصيل محلي تجريبي",
        shippingDestinationRegion: "Syria", minDeliveryDays: 1, maxDeliveryDays: 3,
        totalMinor,
      },
    });
    const item = await prisma.orderItem.create({
      data: {
        vendorOrderId: vendorOrder.id, productId: productEntry.product.id,
        variantId: productEntry.variant.id, productName: productEntry.product.name,
        sku: productEntry.sku, variantName: "Standard", quantity,
        unitAmountMinor, lineTotalMinor: subtotalMinor,
      },
    });
    await prisma.orderStatusHistory.create({
      data: { orderId: order.id, status: orderStatus, note: "سجل طلب تجريبي قابل للإدارة من لوحة البائع." },
    });
    await prisma.vendorOrderStatusHistory.create({
      data: { vendorOrderId: vendorOrder.id, status: vendorStatus, note: "سجل حالة تجريبي." },
    });
    if (vendorStatus === "SHIPPED" || vendorStatus === "DELIVERED") {
      const shipment = await prisma.shipment.create({
        data: {
          vendorOrderId: vendorOrder.id, carrierName: "Demo Syria Delivery",
          trackingNumber: "DEMO-SYR-TRACK-" + String(i + 1).padStart(4, "0"),
          status: vendorStatus === "DELIVERED" ? "DELIVERED" : "IN_TRANSIT",
          shippedAt: placedAt,
          deliveredAt: vendorStatus === "DELIVERED" ? new Date(placedAt.getTime() + 24 * 60 * 60 * 1000) : null,
        },
      });
      await prisma.shipmentTrackingEvent.create({
        data: {
          shipmentId: shipment.id,
          status: vendorStatus === "DELIVERED" ? "DELIVERED" : "IN_TRANSIT",
          description: "حدث تتبع تجريبي — ليس شحنة حقيقية.",
          location: "Damascus, Syria", occurredAt: placedAt,
        },
      });
    }
    createdOrders.push({ order, vendorOrder, item, customer });
  }

  const returnOrderIndexes = [5, 6, 8];
  for (let index = 0; index < returnOrderIndexes.length; index += 1) {
    const orderEntry = createdOrders[returnOrderIndexes[index]];
    if (!orderEntry || !orderEntry.item) continue;
    const returnNumber = "DEMO-SYR-RET-" + String(index + 1).padStart(4, "0");
    const returnRequest = await prisma.returnRequest.upsert({
      where: { returnNumber },
      create: {
        returnNumber, orderId: orderEntry.order.id, customerId: orderEntry.customer.id,
        status: "REQUESTED", reasonCode: ["DAMAGED", "NOT_AS_DESCRIBED", "CHANGED_MIND"][index],
        reasonDetails: "طلب إرجاع تجريبي لاختبار المراجعة وسير العمل.",
      },
      update: {},
    });
    await prisma.returnItem.upsert({
      where: { returnRequestId_orderItemId: {
        returnRequestId: returnRequest.id, orderItemId: orderEntry.item.id,
      } },
      create: {
        returnRequestId: returnRequest.id, orderItemId: orderEntry.item.id,
        quantity: 1, status: "REQUESTED",
      },
      update: { status: "REQUESTED" },
    });
  }

  for (const [index, orderEntry] of createdOrders.entries()) {
    if (!orderEntry || !orderEntry.item || orderEntry.vendorOrder.status !== "DELIVERED") continue;
    const rating = index % 4 === 0 ? 4 : 5;
    await prisma.storeReview.upsert({
      where: { vendorOrderId: orderEntry.vendorOrder.id },
      create: {
        storeId: store.id, userId: orderEntry.customer.id,
        vendorOrderId: orderEntry.vendorOrder.id, rating,
        title: rating === 5 ? "تجربة شراء ممتازة" : "تجربة جيدة",
        body: "تقييم تجريبي لاختبار عرض تقييمات المتجر والرد عليها.",
        status: "PUBLISHED",
      },
      update: { status: "PUBLISHED", rating },
    });
    await prisma.productReview.upsert({
      where: { orderItemId: orderEntry.item.id },
      create: {
        productId: orderEntry.item.productId, userId: orderEntry.customer.id,
        orderItemId: orderEntry.item.id, rating,
        title: "تقييم منتج تجريبي",
        body: "مراجعة تجريبية لاختبار تقييمات المنتجات.",
        status: "PUBLISHED",
      },
      update: { status: "PUBLISHED", rating },
    });
  }

  const questionProducts = products.filter((_, index) => index % 31 === 0).slice(0, 6);
  for (let index = 0; index < questionProducts.length; index += 1) {
    const entry = questionProducts[index];
    const customer = customers[index];
    const questionText = "هل المنتج متوفر حالياً في دمشق؟ هذا سؤال تجريبي لاختبار لوحة الأسئلة.";
    let question = await prisma.productQuestion.findFirst({
      where: { productId: entry.product.id, userId: customer.id, question: questionText },
    });
    if (!question) {
      question = await prisma.productQuestion.create({
        data: {
          productId: entry.product.id, userId: customer.id,
          question: questionText, status: index < 3 ? "PENDING" : "PUBLISHED",
        },
      });
    }
    if (index >= 3) {
      const answerText = "نعم، هذه إجابة تجريبية من المتجر ويمكن تعديلها من لوحة البائع.";
      const answer = await prisma.productAnswer.findFirst({
        where: { questionId: question.id, userId: owner.id, body: answerText },
      });
      if (!answer) {
        await prisma.productAnswer.create({
          data: { questionId: question.id, userId: owner.id, body: answerText, status: "PUBLISHED" },
        });
      }
    }
  }
  return { createdOrders, customers };
}


async function seedSellerCommunications(owner, store, market, usd, products, customers) {
  const now = new Date();

  // In-app notifications: no email delivery records are created by demo data.
  const notificationRows = [
    ["ORDER_RECEIVED", "طلب جديد بانتظار المعالجة", "لديك طلب تجريبي جديد يحتاج إلى مراجعة.", "VendorOrder", "DEMO-SYR-00001"],
    ["RETURN_REQUESTED", "طلب إرجاع جديد", "يوجد طلب إرجاع تجريبي بانتظار المراجعة.", "ReturnRequest", "DEMO-SYR-RET-0001"],
    ["LOW_STOCK", "تنبيه مخزون منخفض", "أحد المنتجات التجريبية وصل إلى حد إعادة الطلب.", "Inventory", "RAMOND-SY-LOW-STOCK"],
    ["PRODUCT_QUESTION", "سؤال جديد عن منتج", "يوجد سؤال تجريبي جديد من أحد العملاء.", "ProductQuestion", "RAMOND-SY-QUESTION"],
    ["STORE_REVIEW", "تقييم جديد للمتجر", "تمت إضافة تقييم تجريبي إلى متجرك.", "StoreReview", "RAMOND-SY-REVIEW"],
  ];
  for (let index = 0; index < notificationRows.length; index += 1) {
    const [type, title, message, resourceType, resourceId] = notificationRows[index];
    const key = "syria-seller-demo:notification:" + String(index + 1).padStart(3, "0");
    await prisma.notification.upsert({
      where: { deduplicationKey: key },
      create: {
        userId: owner.id, type, title, message, resourceType, resourceId,
        deduplicationKey: key,
        readAt: index === 0 ? null : new Date(now.getTime() - index * 60 * 60 * 1000),
      },
      update: { title, message, resourceType, resourceId },
    });
  }
  for (const type of ["ORDER", "INVENTORY", "RETURNS", "REVIEWS", "QUESTIONS", "MESSAGES", "SYSTEM"]) {
    await prisma.notificationPreference.upsert({
      where: { userId_type: { userId: owner.id, type } },
      create: { userId: owner.id, type, inAppEnabled: true, emailEnabled: false },
      update: { inAppEnabled: true },
    });
  }

  // Seller/customer conversations for the store inbox.
  const conversationDefinitions = [
    { customer: customers[0], subject: "استفسار تجريبي عن موعد توصيل الطلب", body: "مرحباً، هل يمكن تأكيد موعد التوصيل؟ هذه محادثة تجريبية." },
    { customer: customers[1], subject: "سؤال تجريبي عن توفر منتج", body: "هل يتوفر المنتج بلون آخر؟ هذه رسالة تجريبية." },
    { customer: customers[2], subject: "متابعة تجريبية لطلب سابق", body: "أرغب بمتابعة حالة طلبي التجريبي." },
  ];
  for (const [index, definition] of conversationDefinitions.entries()) {
    let conversation = await prisma.storeConversation.findFirst({
      where: { customerId: definition.customer.id, storeId: store.id, subject: definition.subject },
    });
    if (!conversation) {
      conversation = await prisma.storeConversation.create({
        data: {
          customerId: definition.customer.id, storeId: store.id, subject: definition.subject,
          lastMessageAt: new Date(now.getTime() - index * 45 * 60 * 1000),
        },
      });
    }
    const customerMessage = await prisma.storeMessage.findFirst({
      where: { conversationId: conversation.id, senderId: definition.customer.id, body: definition.body },
    });
    if (!customerMessage) {
      await prisma.storeMessage.create({
        data: { conversationId: conversation.id, senderId: definition.customer.id, body: definition.body },
      });
    }
    if (index !== 1) {
      const reply = "أهلاً بك، شكراً لتواصلك مع متجر راموند. هذه إجابة تجريبية يمكنك تعديلها.";
      const sellerMessage = await prisma.storeMessage.findFirst({
        where: { conversationId: conversation.id, senderId: owner.id, body: reply },
      });
      if (!sellerMessage) {
        await prisma.storeMessage.create({
          data: { conversationId: conversation.id, senderId: owner.id, body: reply },
        });
      }
    }
  }

  // Support tickets are customer support examples, not real incidents.
  const supportDefinitions = [
    { status: "OPEN", priority: "HIGH", category: "ORDER", subject: "تأخر تحديث حالة طلب تجريبي", customer: customers[3] },
    { status: "IN_PROGRESS", priority: "NORMAL", category: "PRODUCT", subject: "استفسار حول مواصفات منتج", customer: customers[4] },
    { status: "WAITING_CUSTOMER", priority: "LOW", category: "OTHER", subject: "طلب توضيح بيانات التوصيل", customer: customers[5] },
  ];
  for (const [index, definition] of supportDefinitions.entries()) {
    const ticketNumber = "DEMO-SYR-SUP-" + String(index + 1).padStart(4, "0");
    let ticket = await prisma.supportTicket.findUnique({ where: { ticketNumber } });
    if (!ticket) {
      ticket = await prisma.supportTicket.create({
        data: {
          ticketNumber, customerId: definition.customer.id, assignedToId: owner.id,
          subject: definition.subject, category: definition.category,
          status: definition.status, priority: definition.priority,
          lastMessageAt: new Date(now.getTime() - index * 2 * 60 * 60 * 1000),
        },
      });
    }
    const customerBody = "مرحباً، أحتاج إلى المساعدة بخصوص هذا الموضوع. هذه تذكرة دعم تجريبية.";
    if (!(await prisma.supportMessage.findFirst({ where: { ticketId: ticket.id, senderId: definition.customer.id, body: customerBody } }))) {
      await prisma.supportMessage.create({ data: { ticketId: ticket.id, senderId: definition.customer.id, body: customerBody } });
    }
    if (definition.status !== "OPEN") {
      const reply = "تم استلام طلبك، ويجري التعامل معه ضمن بيانات الدعم التجريبية.";
      if (!(await prisma.supportMessage.findFirst({ where: { ticketId: ticket.id, senderId: owner.id, body: reply } }))) {
        await prisma.supportMessage.create({ data: { ticketId: ticket.id, senderId: owner.id, body: reply } });
      }
    }
  }

  // Draft campaigns are editable examples only. No impressions, clicks, spend,
  // invoices, payment records, or advertising ledger entries are fabricated.
  const campaignProducts = products.slice(0, 2);
  for (const [index, entry] of campaignProducts.entries()) {
    const title = index === 0 ? "حملة تجريبية — إبراز المنتجات" : "حملة تجريبية — عروض المتجر";
    const existing = await prisma.adCampaign.findFirst({
      where: { storeId: store.id, title },
    });
    const data = {
      storeId: store.id, productId: entry.product.id, createdById: owner.id,
      marketId: market.id, currencyCode: usd.code,
      targetCategoryId: entry.category.id, targetKeywords: ["سوريا", "متجر راموند", "عرض تجريبي"],
      budgetMinor: 2500n * 100n, dailyBudgetMinor: 250n * 100n, cpcBidMinor: 10n * 100n,
      spentMinor: 0n, impressionCount: 0n, clickCount: 0n,
      title, message: "مسودة تجريبية قابلة للتعديل قبل الإرسال للمراجعة.",
      status: "DRAFT", startsAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000),
    };
    if (!existing) await prisma.adCampaign.create({ data });
  }

  return {
    notifications: await prisma.notification.count({ where: { userId: owner.id, deduplicationKey: { startsWith: "syria-seller-demo:" } } }),
    conversations: await prisma.storeConversation.count({ where: { storeId: store.id, subject: { contains: "تجريبي" } } }),
    supportTickets: await prisma.supportTicket.count({ where: { ticketNumber: { startsWith: "DEMO-SYR-SUP-" } } }),
    campaigns: await prisma.adCampaign.count({ where: { storeId: store.id, title: { startsWith: "حملة تجريبية" } } }),
  };
}

async function main() {
  assertSafeTarget();
  const { owner, store } = await seedSellerIdentityAndStore();
  const { market, syp, usd, warehouse } = await seedSyriaMarket(store);
  const { products, categories } = await seedCatalog(store, warehouse, market, syp, usd);
  const { createdOrders, customers } = await seedOrdersAndEngagement(owner, store, market, usd, products);
  const communications = await seedSellerCommunications(owner, store, market, usd, products, customers);

  const categoryCounts = [];
  for (const [slug, category] of categories) {
    const count = await prisma.product.count({
      where: {
        storeId: store.id, status: "ACTIVE", approvalStatus: "APPROVED",
        categories: { some: { categoryId: category.id, isPrimary: true } },
      },
    });
    categoryCounts.push({ slug, count });
    if (count < 20) throw new Error("Expected at least 20 active products for " + slug + ", found " + count + ".");
  }

  const [productCount, brandCount, orderCount, returnCount, lowStockCount, storeReviewCount, productReviewCount, questionCount, inventoryMovementCount] = await Promise.all([
    prisma.product.count({ where: { storeId: store.id, status: "ACTIVE", approvalStatus: "APPROVED" } }),
    prisma.brand.count({ where: { status: "ACTIVE" } }),
    prisma.vendorOrder.count({ where: { storeId: store.id, order: { orderNumber: { startsWith: "DEMO-SYR-" } } } }),
    prisma.returnRequest.count({ where: { returnNumber: { startsWith: "DEMO-SYR-RET-" }, status: "REQUESTED" } }),
    prisma.inventory.count({ where: { warehouse: { storeId: store.id }, quantityOnHand: { lte: 5 } } }),
    prisma.storeReview.count({ where: { storeId: store.id } }),
    prisma.productReview.count({ where: { product: { storeId: store.id } } }),
    prisma.productQuestion.count({ where: { product: { storeId: store.id } } }),
    prisma.inventoryMovement.count({ where: { inventory: { warehouse: { storeId: store.id } }, referenceType: "SYRIA_SELLER_DEMO_SEED" } }),
  ]);
  if (orderCount !== 10) throw new Error("Expected 10 demo orders for the seller, found " + orderCount + ".");
  if (returnCount !== 3) throw new Error("Expected 3 pending demo returns, found " + returnCount + ".");
  if (lowStockCount < 8) throw new Error("Expected low-stock demo variants, found " + lowStockCount + ".");
  if (storeReviewCount < 3 || productReviewCount < 3) throw new Error("Expected store and product review records.");
  if (questionCount < 6) throw new Error("Expected at least 6 product questions.");
  if (communications.notifications < 5 || communications.conversations < 3 || communications.supportTickets < 3 || communications.campaigns < 2) {
    throw new Error("Expected demo notifications, store conversations, support tickets, and ad campaigns.");
  }

  console.log(JSON.stringify({
    status: "verified", seller: SELLER_EMAIL, store: store.slug, market: "SY-SYR",
    exchangeRateUsed: "1 USD = " + USD_TO_SYP + " SYP (seed reference only)",
    activeBrands: brandCount, activeProducts: productCount, productsPerCategory: categoryCounts,
    demoOrders: orderCount, pendingReturns: returnCount, lowStockVariants: lowStockCount,
    storeReviews: storeReviewCount, productQuestions: questionCount,
    demoOrderRecordsCreatedThisRun: createdOrders.length,
    communications,
    note: "All DEMO-SYR orders, customers, reviews, questions and shipping records are test data. No payment, refund, payout or ledger records were created.",
  }, null, 2));
}

main()
  .catch((error) => {
    console.error("Syria seller demo seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
