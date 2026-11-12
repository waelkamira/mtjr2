/* eslint-disable @typescript-eslint/no-require-imports */
// CI-only fixture bootstrap. Creates ephemeral role-specific sessions in the isolated E2E database.
const { createHash, randomBytes } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const now = new Date();
const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
const hash = (value) => createHash("sha256").update(value, "utf8").digest("hex");

async function ensureRole(userId, key) {
  const role = await prisma.role.findUnique({ where: { key }, select: { id: true } });
  if (!role) throw new Error(`Required seeded role ${key} is missing.`);
  await prisma.userRoleAssignment.upsert({
    where: { userId_roleId_scopeType_scopeId: { userId, roleId: role.id, scopeType: "GLOBAL", scopeId: "GLOBAL" } },
    create: { userId, roleId: role.id, scopeType: "GLOBAL", scopeId: "GLOBAL" },
    update: { expiresAt: null }
  });
}
async function ensureUser(email, displayName) {
  return prisma.user.upsert({
    where: { emailNormalized: email.toLowerCase() },
    create: { email, emailNormalized: email.toLowerCase(), displayName, status: "ACTIVE", emailVerifiedAt: now },
    update: { displayName, status: "ACTIVE", emailVerifiedAt: now, anonymizedAt: null }
  });
}
async function sessionFor(userId, mfa, platformStepUp = false) {
  const token = randomBytes(32).toString("base64url");
  await prisma.userSession.create({ data: {
    userId, tokenHash: hash(token), ipAddress: "127.0.0.1", userAgent: "Playwright E2E",
    createdAt: now, lastSeenAt: now, expiresAt, mfaVerifiedAt: mfa ? now : null,
    stepUpVerifiedAt: platformStepUp ? now : null,
    stepUpExpiresAt: platformStepUp ? new Date(now.getTime() + 10 * 60 * 1000) : null
  }});
  if (mfa) await prisma.userTwoFactor.upsert({
    where: { userId },
    create: { userId, secretCiphertext: "e2e-fixture-not-used-for-totp", enabledAt: now },
    update: { enabledAt: now }
  });
  return token;
}
async function main() {
  const seller = await prisma.user.findUnique({ where: { emailNormalized: "electronics@demo.mtjr2.test" }, select: { id: true, sellerProfile: { select: { id: true, status: true } } } });
  if (!seller?.sellerProfile || seller.sellerProfile.status !== "ACTIVE") throw new Error("Demo seller fixture was not seeded.");
  await ensureRole(seller.id, "SELLER");
  const store = await prisma.store.findFirst({
    where: { sellerId: seller.sellerProfile.id, status: "ACTIVE" },
    include: { markets: { where: { isEnabled: true }, include: { market: true }, orderBy: { marketId: "asc" } } }
  });
  if (!store?.markets.length) throw new Error("Demo seller store has no enabled market.");
  const market = store.markets[0].market;
  const payoutCountry = await prisma.country.findUnique({
    where: { id: market.countryId },
    select: { iso2: true }
  });
  if (!payoutCountry) throw new Error("Demo seller market country is missing.");

  // Reuse the seeded market's default currency so the payout fixture always
  // satisfies the SellerPayoutMethod -> Currency foreign key.
  await prisma.sellerPayoutMethod.upsert({
    where: { id: "e2e-seller-payout-review" },
    create: {
      id: "e2e-seller-payout-review",
      sellerId: seller.sellerProfile.id,
      type: "IBAN",
      accountHolderName: "E2E Protected Placeholder",
      bankName: "E2E Demo Bank",
      countryCode: payoutCountry.iso2,
      currencyCode: market.defaultCurrencyCode,
      encryptedDetails: "e2e-fixture-encrypted-payload",
      encryptionKeyVersion: 1,
      accountLast4: "4242",
      fingerprint: hash("e2e-seller-payout-review-destination"),
      status: "PENDING_VERIFICATION",
      isDefault: false
    },
    update: {
      status: "PENDING_VERIFICATION",
      submissionVersion: { increment: 1 },
      verifiedAt: null,
      isDefault: false,
      bankName: "E2E Demo Bank",
      accountLast4: "4242",
      countryCode: payoutCountry.iso2,
      currencyCode: market.defaultCurrencyCode
    }
  });
  const product = await prisma.product.findFirst({
    where: { storeId: store.id, status: "ACTIVE", approvalStatus: "APPROVED", categories: { some: {} }, variants: { some: { isActive: true, prices: { some: { marketId: market.id, currencyCode: market.defaultCurrencyCode } } } } },
    select: { id: true, slug: true, categories: { take: 1, select: { category: { select: { slug: true } } } } }
  });
  if (!product) throw new Error("Demo seller store has no approved categorized product with a market price.");
  const detailProduct = await prisma.product.findFirst({
    where: { storeId: store.id, id: { not: product.id }, status: "ACTIVE", approvalStatus: "APPROVED", variants: { some: { isActive: true, prices: { some: { marketId: market.id, currencyCode: market.defaultCurrencyCode } } } } },
    select: { id: true, slug: true }
  });
  if (!detailProduct) throw new Error("Demo seller store needs a second approved product for product-detail sponsored placement tests.");

  // Keep one deterministic, purchasable product in the isolated E2E database.
  const warehouse = await prisma.warehouse.upsert({
    where: { storeId_code: { storeId: store.id, code: "E2E" } },
    create: { storeId: store.id, code: "E2E", name: "E2E Warehouse", isActive: true },
    update: { isActive: true }
  });
  const detailVariants = await prisma.productVariant.findMany({
    where: { productId: detailProduct.id, isActive: true, prices: { some: { marketId: market.id, currencyCode: market.defaultCurrencyCode } } },
    select: { id: true }
  });
  if (!detailVariants.length) throw new Error("E2E product has no active market-priced variant.");
  for (const variant of detailVariants) {
    await prisma.inventory.upsert({
      where: { warehouseId_variantId: { warehouseId: warehouse.id, variantId: variant.id } },
      create: { warehouseId: warehouse.id, variantId: variant.id, quantityOnHand: 100 },
      update: { quantityOnHand: 100, quantityQuarantined: 0, quantityReserved: 0 }
    });
  }

  const shippingRate = await prisma.storeShippingRate.findFirst({
    where: { storeId: store.id, marketId: market.id, name: "E2E Standard Shipping" },
    select: { id: true }
  });
  const shippingData = {
    currencyCode: market.defaultCurrencyCode, description: "Isolated checkout journey fixture",
    amountMinor: 500n, destinationRegion: null, minDeliveryDays: 2, maxDeliveryDays: 4,
    isActive: true, effectiveFrom: null, effectiveUntil: null, priority: 0
  };
  if (shippingRate) {
    await prisma.storeShippingRate.update({ where: { id: shippingRate.id }, data: shippingData });
  } else {
    await prisma.storeShippingRate.create({ data: { storeId: store.id, marketId: market.id, name: "E2E Standard Shipping", ...shippingData } });
  }

  const taxRate = await prisma.marketTaxRate.findFirst({
    where: { marketId: market.id, name: "E2E Market Tax" },
    select: { id: true }
  });
  const taxData = {
    destinationRegion: null, rateBasisPoints: 1000, isInclusive: false,
    appliesToShipping: true, isActive: true, effectiveFrom: null, effectiveUntil: null, priority: 0
  };
  if (taxRate) {
    await prisma.marketTaxRate.update({ where: { id: taxRate.id }, data: taxData });
  } else {
    await prisma.marketTaxRate.create({ data: { marketId: market.id, name: "E2E Market Tax", ...taxData } });
  }
  for (const [index, adProduct] of [product, detailProduct].entries()) {
    await prisma.adCampaign.create({
      data: {
        storeId: store.id, productId: adProduct.id, createdById: seller.id,
        marketId: market.id, currencyCode: market.defaultCurrencyCode,
        title: "E2E Sponsored Product " + (index + 1), message: "Sponsored placement fixture",
        status: "ACTIVE", startsAt: new Date(now.getTime() - 60 * 60 * 1000),
        endsAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        budgetMinor: 50000n, dailyBudgetMinor: 10000n, cpcBidMinor: 100n
      }
    });
  }
  const customer = await ensureUser("e2e-customer@mtjr2.test", "E2E Customer");
  await ensureRole(customer.id, "CUSTOMER");
  const unauthorizedCustomer = await ensureUser("e2e-unauthorized@mtjr2.test", "E2E Unauthorized Customer");
  await ensureRole(unauthorizedCustomer.id, "CUSTOMER");
  const buyer = await ensureUser("e2e-buyer@mtjr2.test", "E2E Buyer");
  await ensureRole(buyer.id, "CUSTOMER");
  const sellerApplicant = await ensureUser("e2e-seller-applicant@mtjr2.test", "E2E Seller Applicant");
  await ensureRole(sellerApplicant.id, "CUSTOMER");
  const admin = await ensureUser("e2e-superadmin@mtjr2.test", "E2E Super Admin");
  await ensureRole(admin.id, "SUPER_ADMIN");
  const adminReviewer = await ensureUser("e2e-superadmin-reviewer@mtjr2.test", "E2E Independent Reviewer");
  await ensureRole(adminReviewer.id, "SUPER_ADMIN");
  const privilegeTarget = await ensureUser("e2e-privilege-target@mtjr2.test", "E2E Privilege Target");
  await ensureRole(privilegeTarget.id, "CUSTOMER");
  const sessions = {
    customer: await sessionFor(customer.id, false),
    unauthorizedCustomer: await sessionFor(unauthorizedCustomer.id, false),
    buyer: await sessionFor(buyer.id, false),
    // Seller permissions require MFA; pre-enroll the applicant fixture so
    // the same session can exercise post-approval store creation.
    sellerApplicant: await sessionFor(sellerApplicant.id, true),
    seller: await sessionFor(seller.id, true),
    admin: await sessionFor(admin.id, true, true),
    adminReviewer: await sessionFor(adminReviewer.id, true, true),
    privilegeTarget: await sessionFor(privilegeTarget.id, false),
    privilegeTargetEmail: privilegeTarget.email,
    categorySlug: product.categories[0]?.category.slug,
    detailProductSlug: detailProduct.slug
  };
  const target = path.join(process.cwd(), ".e2e-sessions.json");
  fs.writeFileSync(target, JSON.stringify(sessions), { mode: 0o600 });
  process.stdout.write("Created isolated customer, seller and Super Admin E2E sessions.\n");
}
main().catch((error) => { process.stderr.write(String(error.stack || error) + "\n"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
