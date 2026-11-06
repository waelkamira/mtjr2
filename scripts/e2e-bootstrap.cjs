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
async function sessionFor(userId, mfa) {
  const token = randomBytes(32).toString("base64url");
  await prisma.userSession.create({ data: {
    userId, tokenHash: hash(token), ipAddress: "127.0.0.1", userAgent: "Playwright E2E",
    createdAt: now, lastSeenAt: now, expiresAt, mfaVerifiedAt: mfa ? now : null
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
  const product = await prisma.product.findFirst({
    where: { storeId: store.id, status: "ACTIVE", approvalStatus: "APPROVED", variants: { some: { isActive: true, prices: { some: { marketId: market.id, currencyCode: market.defaultCurrencyCode } } } } },
    select: { id: true }
  });
  if (!product) throw new Error("Demo seller store has no approved product with a market price.");
  await prisma.adCampaign.create({
    data: {
      storeId: store.id, productId: product.id, createdById: seller.id,
      marketId: market.id, currencyCode: market.defaultCurrencyCode,
      title: "E2E Sponsored Product", message: "Sponsored placement fixture",
      status: "ACTIVE", startsAt: new Date(now.getTime() - 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      budgetMinor: 50000n, dailyBudgetMinor: 10000n, cpcBidMinor: 100n
    }
  });
  const customer = await ensureUser("e2e-customer@mtjr2.test", "E2E Customer");
  await ensureRole(customer.id, "CUSTOMER");
  const admin = await ensureUser("e2e-superadmin@mtjr2.test", "E2E Super Admin");
  await ensureRole(admin.id, "SUPER_ADMIN");
  const sessions = {
    customer: await sessionFor(customer.id, false),
    seller: await sessionFor(seller.id, true),
    admin: await sessionFor(admin.id, true)
  };
  const target = path.join(process.cwd(), ".e2e-sessions.json");
  fs.writeFileSync(target, JSON.stringify(sessions), { mode: 0o600 });
  process.stdout.write("Created isolated customer, seller and Super Admin E2E sessions.\n");
}
main().catch((error) => { process.stderr.write(String(error.stack || error) + "\n"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
