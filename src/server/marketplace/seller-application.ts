import "server-only";

import { AuditActorType, Prisma, SellerStatus, StoreStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";
import { requirePermission } from "@/server/identity/permission-guard";

const httpsUrl = z.string().trim().max(2048).refine((value) => !value || (() => { try { return new URL(value).protocol === "https:"; } catch { return false; } })(), "Only HTTPS links are accepted.");
const sellerApplicationSchema = z.object({
  legalName: z.string().trim().min(2).max(160),
  displayName: z.string().trim().min(2).max(80),
  contactName: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phoneNumber: z.string().trim().min(7).max(25).regex(/^\+?[0-9\s().-]{7,25}$/),
  residence: z.string().trim().min(3).max(240),
  businessType: z.enum(["INDIVIDUAL", "STORE", "ARTISAN", "AGENCY", "OTHER"]),
  sellingCategories: z.string().trim().min(2).max(300),
  intendedProducts: z.string().trim().min(20).max(4000),
  description: z.string().trim().max(2000).optional().default(""),
  facebookUrl: httpsUrl.optional().default(""),
  youtubeUrl: httpsUrl.optional().default(""),
  twitterUrl: httpsUrl.optional().default(""),
  identityDocumentFileId: z.string().trim().max(255).optional().default(""),
  registrationCountryCode: z.string().trim().refine((value) => value === "" || /^[A-Za-z]{2}$/.test(value)).transform((value) => value.toUpperCase()).optional().default(""),
  registrationNumber: z.string().trim().max(120).optional().default(""),
  registrationAuthority: z.string().trim().max(160).optional().default(""),
  registrationDate: z.string().trim().max(10).optional().default(""),
  registeredAddress: z.string().trim().max(500).optional().default(""),
  taxIdentificationNumber: z.string().trim().max(120).optional().default(""),
  businessWebsite: httpsUrl.optional().default(""),
  businessRegistrationDocumentFileId: z.string().trim().max(255).optional().default(""),
  taxCertificateDocumentFileId: z.string().trim().max(255).optional().default(""),
  proofOfAddressDocumentFileId: z.string().trim().max(255).optional().default(""),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180)
});
const reviewSchema = z.object({
  sellerId: z.string().trim().min(1),
  decision: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().trim().max(500).optional()
});
const storeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160),
  marketIds: z.array(z.string().trim().min(1)).min(1).max(20)
});

export type SellerApplicationInput = z.input<typeof sellerApplicationSchema>;

export class SellerApplicationConflictError extends Error {
  constructor() {
    super("An active or suspended seller application already exists for this account.");
    this.name = "SellerApplicationConflictError";
  }
}

function isStoreSlugConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  return Array.isArray(target)
    ? target.some((field) => field === "slug" || field === "Store_slug_key")
    : typeof target === "string" && (target.includes("slug") || target.includes("Store_slug_key"));
}

function isMatchingStoreRequest(
  store: { sellerId: string; name: string; markets: Array<{ marketId: string }> },
  sellerId: string,
  name: string,
  marketIds: string[]
) {
  const existingMarketIds = store.markets.map(({ marketId }) => marketId).sort();
  const expectedMarketIds = [...marketIds].sort();
  return store.sellerId === sellerId &&
    store.name === name &&
    existingMarketIds.length === expectedMarketIds.length &&
    existingMarketIds.every((marketId, index) => marketId === expectedMarketIds[index]);
}

/** Authenticated user submits one pending seller application. */
export async function submitSellerApplication(input: SellerApplicationInput, now = new Date()) {
  const data = sellerApplicationSchema.parse(input);
  // Establish the authenticated, verified actor before returning business/KYC
  // validation details. Zod still rejects malformed input without a session.
  const actor = await requireCurrentSession(now);
  if (!actor.user.emailVerifiedAt) {
    throw new Error("Please verify your email before submitting a seller application.");
  }
  const isRegisteredEntity = data.businessType === "STORE" || data.businessType === "AGENCY";
  if (isRegisteredEntity && (!data.registrationCountryCode || !data.registrationNumber || !data.businessRegistrationDocumentFileId)) {
    throw new Error("Registered businesses must provide their registration country, number and certificate.");
  }
  if (data.registrationDate) {
    const parsedRegistrationDate = new Date(data.registrationDate + "T00:00:00.000Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.registrationDate) || Number.isNaN(parsedRegistrationDate.getTime()) || parsedRegistrationDate.toISOString().slice(0, 10) !== data.registrationDate) {
      throw new Error("Enter a valid business registration date.");
    }
  }
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY?.trim();
  const documentChecks = [
    [data.identityDocumentFileId, "matjar-seller-identity"],
    [data.businessRegistrationDocumentFileId, "matjar-seller-business-registration"],
    [data.taxCertificateDocumentFileId, "matjar-seller-tax-certificate"],
    [data.proofOfAddressDocumentFileId, "matjar-seller-proof-of-address"]
  ] as const;
  for (const [fileId, tag] of documentChecks) {
    if (!fileId) continue;
    if (!privateKey) throw new Error("Private seller document storage is not configured.");
    const response = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}/details`, {
      headers: { Authorization: `Basic ${Buffer.from(privateKey + ":").toString("base64")}` },
      signal: AbortSignal.timeout(10000),
      cache: "no-store"
    });
    if (!response.ok) throw new Error("A seller verification document could not be verified. Upload it again.");
    const details = await response.json() as { isPrivateFile?: boolean; tags?: string[] | null };
    if (!details.isPrivateFile || !(details.tags ?? []).includes(tag) || !(details.tags ?? []).includes(`user-${actor.userId}`)) {
      throw new Error("A seller verification document is not a private upload belonging to this account.");
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.seller.findUnique({ where: { ownerId: actor.userId }, select: { id: true, status: true } });
      if (existing) {
        if (existing.status === SellerStatus.PENDING) {
          return { sellerId: existing.id, status: existing.status, alreadySubmitted: true };
        }
        if (existing.status !== SellerStatus.REJECTED) throw new SellerApplicationConflictError();
        const updated = await tx.seller.updateMany({
          where: { id: existing.id, ownerId: actor.userId, status: SellerStatus.REJECTED },
          data: {
            legalName: data.legalName, displayName: data.displayName, contactName: data.contactName,
            contactEmail: data.contactEmail, phoneNumber: data.phoneNumber, residence: data.residence,
            businessType: data.businessType, sellingCategories: data.sellingCategories,
            intendedProducts: data.intendedProducts, description: data.description,
            facebookUrl: data.facebookUrl || null, youtubeUrl: data.youtubeUrl || null, twitterUrl: data.twitterUrl || null,
            identityDocumentFileId: data.identityDocumentFileId || null,
            registrationCountryCode: data.registrationCountryCode || null,
            registrationNumber: data.registrationNumber || null,
            registrationAuthority: data.registrationAuthority || null,
            registrationDate: data.registrationDate ? new Date(data.registrationDate + "T00:00:00.000Z") : null,
            registeredAddress: data.registeredAddress || null,
            taxIdentificationNumber: data.taxIdentificationNumber || null,
            businessWebsite: data.businessWebsite || null,
            businessRegistrationDocumentFileId: data.businessRegistrationDocumentFileId || null,
            taxCertificateDocumentFileId: data.taxCertificateDocumentFileId || null,
            proofOfAddressDocumentFileId: data.proofOfAddressDocumentFileId || null,
            latitude: data.latitude, longitude: data.longitude, status: SellerStatus.PENDING
          }
        });
        if (updated.count !== 1) throw new Error("The rejected application changed concurrently. Reload and try again.");
        await tx.auditLog.create({ data: {
          actorType: AuditActorType.USER, actorId: actor.userId, action: "seller.application.resubmitted",
          resource: "seller", resourceId: existing.id, occurredAt: now,
          metadata: { previousStatus: SellerStatus.REJECTED, status: SellerStatus.PENDING }
        }});
        return { sellerId: existing.id, status: SellerStatus.PENDING, alreadySubmitted: false, resubmitted: true };
      }
      const seller = await tx.seller.create({
        data: {
          ownerId: actor.userId, legalName: data.legalName, displayName: data.displayName,
          contactName: data.contactName, contactEmail: data.contactEmail, phoneNumber: data.phoneNumber,
          residence: data.residence, businessType: data.businessType, sellingCategories: data.sellingCategories,
          intendedProducts: data.intendedProducts, description: data.description,
          facebookUrl: data.facebookUrl || null, youtubeUrl: data.youtubeUrl || null, twitterUrl: data.twitterUrl || null,
          identityDocumentFileId: data.identityDocumentFileId || null,
          registrationCountryCode: data.registrationCountryCode || null,
          registrationNumber: data.registrationNumber || null,
          registrationAuthority: data.registrationAuthority || null,
          registrationDate: data.registrationDate ? new Date(data.registrationDate + "T00:00:00.000Z") : null,
          registeredAddress: data.registeredAddress || null,
          taxIdentificationNumber: data.taxIdentificationNumber || null,
          businessWebsite: data.businessWebsite || null,
          businessRegistrationDocumentFileId: data.businessRegistrationDocumentFileId || null,
          taxCertificateDocumentFileId: data.taxCertificateDocumentFileId || null,
          proofOfAddressDocumentFileId: data.proofOfAddressDocumentFileId || null,
          latitude: data.latitude, longitude: data.longitude, status: SellerStatus.PENDING
        },
        select: { id: true, status: true }
      });
      await tx.auditLog.create({ data: {
        actorType: AuditActorType.USER, actorId: actor.userId, action: "seller.application.submitted",
        resource: "seller", resourceId: seller.id, occurredAt: now, metadata: { status: seller.status }
      }});
      return { sellerId: seller.id, status: seller.status, alreadySubmitted: false };
    });
  } catch (error) {
    const existing = await prisma.seller.findUnique({ where: { ownerId: actor.userId }, select: { id: true, status: true } });
    if (existing?.status === SellerStatus.PENDING) return { sellerId: existing.id, status: existing.status, alreadySubmitted: true };
    throw error;
  }
}

/** Platform reviewer approves/rejects a pending seller; approval grants the seeded SELLER role atomically. */
export async function reviewSellerApplication(input: z.input<typeof reviewSchema>, now = new Date()) {
  const data = reviewSchema.parse(input);
  if (data.decision === "REJECT" && !data.reason) throw new Error("A rejection reason is required.");
  const actor = await requirePermission({ permissionKey: "users:manage", now });

  return prisma.$transaction(async (tx) => {
    const seller = await tx.seller.findUnique({
      where: { id: data.sellerId },
      select: { id: true, ownerId: true, status: true }
    });
    if (!seller) throw new Error("Seller application was not found.");
    if (seller.status !== SellerStatus.PENDING) throw new Error("Only pending seller applications can be reviewed.");

    const nextStatus = data.decision === "APPROVE" ? SellerStatus.ACTIVE : SellerStatus.REJECTED;
    const changed = await tx.seller.updateMany({
      where: { id: seller.id, status: SellerStatus.PENDING },
      data: { status: nextStatus }
    });
    if (changed.count !== 1) throw new Error("Seller application has already been reviewed.");

    if (data.decision === "APPROVE") {
      const role = await tx.role.findUnique({ where: { key: "SELLER" }, select: { id: true } });
      if (!role) throw new Error("SELLER role is missing; run the identity seed before approving sellers.");
      await tx.userRoleAssignment.upsert({
        where: { userId_roleId_scopeType_scopeId: { userId: seller.ownerId, roleId: role.id, scopeType: "GLOBAL", scopeId: "GLOBAL" } },
        create: { userId: seller.ownerId, roleId: role.id, scopeType: "GLOBAL", scopeId: "GLOBAL", assignedBy: actor.userId },
        update: {}
      });
    }

    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId,
      action: data.decision === "APPROVE" ? "seller.application.approved" : "seller.application.rejected",
      resource: "seller", resourceId: seller.id, occurredAt: now,
      metadata: { previousStatus: SellerStatus.PENDING, status: nextStatus, reason: data.reason ?? null }
    }});
    return { sellerId: seller.id, status: nextStatus };
  });
}

/** Creates a draft store for the authenticated active seller and enables only active markets. */
export async function createSellerStore(input: z.input<typeof storeSchema>, now = new Date()) {
  const data = storeSchema.parse(input);
  const actor = await requirePermission({ permissionKey: "store:manage", now });
  const marketIds = [...new Set(data.marketIds)];

  let sellerId: string | null = null;
  try {
    return await prisma.$transaction(async (tx) => {
      const seller = await tx.seller.findUnique({
        where: { ownerId: actor.userId },
        select: { id: true, status: true }
      });
      if (!seller || seller.status !== SellerStatus.ACTIVE) throw new Error("An approved seller account is required to create a store.");
      sellerId = seller.id;

      // Serialize store creation per seller even when two requests arrive at once.
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${seller.id}, 0))`);
      const ownedStore = await tx.store.findFirst({
        where: { sellerId: seller.id },
        select: {
          id: true, sellerId: true, storeNumber: true, name: true, slug: true, status: true,
          markets: { where: { isEnabled: true }, select: { marketId: true } }
        }
      });
      if (ownedStore) {
        if (ownedStore.slug !== data.slug || !isMatchingStoreRequest(ownedStore, seller.id, data.name, marketIds)) {
          throw new Error("Each seller can own only one store. Update the existing store instead of creating another.");
        }
        return {
          id: ownedStore.id, storeNumber: ownedStore.storeNumber.toString(), name: ownedStore.name,
          slug: ownedStore.slug, status: ownedStore.status, alreadyCreated: true
        };
      }

      const existing = await tx.store.findUnique({
        where: { slug: data.slug },
        select: {
          id: true, sellerId: true, storeNumber: true, name: true, slug: true, status: true,
          markets: { where: { isEnabled: true }, select: { marketId: true } }
        }
      });
      if (existing) {
        if (!isMatchingStoreRequest(existing, seller.id, data.name, marketIds)) {
          throw new Error("This store URL is already in use or its setup details differ.");
        }
        return {
          id: existing.id, storeNumber: existing.storeNumber.toString(), name: existing.name,
          slug: existing.slug, status: existing.status, alreadyCreated: true
        };
      }

      const markets = await tx.market.findMany({
        where: { id: { in: marketIds }, status: "ACTIVE", country: { isActive: true }, defaultCurrency: { isActive: true } },
        select: {
          id: true,
          defaultCurrencyCode: true,
          currencies: { where: { isEnabled: true, currency: { isActive: true } }, select: { currencyCode: true } }
        }
      });
      if (markets.length !== marketIds.length ||
        markets.some((market) => !market.currencies.some((currency) => currency.currencyCode === market.defaultCurrencyCode))) {
        throw new Error("Every selected market must be active and have its default currency enabled.");
      }

      const store = await tx.store.create({
        data: {
          sellerId: seller.id, name: data.name, slug: data.slug, status: StoreStatus.DRAFT,
          markets: { create: marketIds.map((marketId) => ({ marketId, isEnabled: true })) }
        },
        select: { id: true, storeNumber: true, name: true, slug: true, status: true }
      });
      await tx.auditLog.create({ data: {
        actorType: AuditActorType.USER, actorId: actor.userId, action: "store.created",
        resource: "store", resourceId: store.id, scopeType: "STORE", scopeId: store.id,
        occurredAt: now, metadata: { slug: store.slug, marketIds }
      }});
      return { ...store, storeNumber: store.storeNumber.toString(), alreadyCreated: false };
    });
  } catch (error) {
    if (!isStoreSlugConflict(error) || !sellerId) throw error;

    const existing = await prisma.store.findUnique({
      where: { slug: data.slug },
      select: {
        id: true, sellerId: true, storeNumber: true, name: true, slug: true, status: true,
        markets: { where: { isEnabled: true }, select: { marketId: true } }
      }
    });
    if (!existing) throw error;
    if (!isMatchingStoreRequest(existing, sellerId, data.name, marketIds)) {
      throw new Error("This store URL is already in use or its setup details differ.");
    }
    return {
      id: existing.id, storeNumber: existing.storeNumber.toString(), name: existing.name, slug: existing.slug, status: existing.status,
      alreadyCreated: true
    };
  }
}


/** Returns only stores owned by the current seller or explicitly joined as active staff. */
export async function getSellerWorkspace(now = new Date()) {
  const actor = await requireCurrentSession(now);
  const seller = await prisma.seller.findUnique({
    where: { ownerId: actor.userId },
    select: {
      id: true, status: true, legalName: true, displayName: true, contactName: true, contactEmail: true,
      phoneNumber: true, residence: true, businessType: true, sellingCategories: true, intendedProducts: true,
      description: true, facebookUrl: true, youtubeUrl: true, twitterUrl: true, latitude: true, longitude: true,
      registrationCountryCode: true, registrationNumber: true, registrationAuthority: true, registrationDate: true,
      registeredAddress: true, taxIdentificationNumber: true, businessWebsite: true,
      businessRegistrationDocumentFileId: true, taxCertificateDocumentFileId: true, proofOfAddressDocumentFileId: true,
      createdAt: true
    }
  });
  const latestRejection = seller?.status === SellerStatus.REJECTED
    ? await prisma.auditLog.findFirst({
        where: {
          resource: "seller",
          resourceId: seller.id,
          action: "seller.application.rejected",
          actorType: AuditActorType.USER
        },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        select: { occurredAt: true, metadata: true }
      })
    : null;
  const rejectionMetadata = latestRejection?.metadata && typeof latestRejection.metadata === "object" && !Array.isArray(latestRejection.metadata)
    ? latestRejection.metadata as Prisma.JsonObject
    : null;
  const rejectionReason = typeof rejectionMetadata?.reason === "string" ? rejectionMetadata.reason : null;
  const stores = await prisma.store.findMany({
    where: {
      OR: [
        { seller: { ownerId: actor.userId } },
        { staff: { some: { userId: actor.userId, status: "ACTIVE" } } }
      ]
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, storeNumber: true, name: true, slug: true, status: true,
      description: true, publicPhone: true, publicAddress: true, logoUrl: true, bannerUrl: true, logoStorageKey: true, bannerStorageKey: true,
      shippingPolicy: true, returnsPolicy: true, privacyPolicy: true, termsOfSale: true,
      shippingContactName: true, shippingPhone: true, shippingAddressLine1: true, shippingAddressLine2: true,
      shippingCity: true, shippingRegion: true, shippingPostalCode: true, shippingCountryCode: true, shippingInstructions: true,
      mediaAssets: { orderBy: { createdAt: "desc" }, take: 100, select: { id: true, url: true, storageKey: true, mimeType: true, width: true, height: true, createdAt: true } },
      seller: { select: { ownerId: true } },
      markets: { where: { isEnabled: true }, select: { market: { select: { id: true, code: true, name: true, defaultCurrencyCode: true } } } },
      warehouses: {
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        select: { id: true, code: true, name: true, isActive: true, _count: { select: { inventories: true } } }
      }
    }
  });
  const sellerView = seller ? (({
    businessRegistrationDocumentFileId, taxCertificateDocumentFileId, proofOfAddressDocumentFileId, ...profile
  }) => ({
    ...profile,
    hasBusinessRegistrationDocument: Boolean(businessRegistrationDocumentFileId),
    hasTaxCertificateDocument: Boolean(taxCertificateDocumentFileId),
    hasProofOfAddressDocument: Boolean(proofOfAddressDocumentFileId),
    rejectionReason,
    reviewedAt: latestRejection?.occurredAt ?? null
  }))(seller) : null;
  return {
    seller: sellerView,
    stores: stores.map(({ seller: storeSeller, ...store }) => ({
      ...store,
      storeNumber: store.storeNumber.toString(),
      isOwner: storeSeller.ownerId === actor.userId
    }))
  };
}


/** Platform-only queue of seller applications awaiting review. */
export async function listPendingSellerApplications(now = new Date()) {
  await requirePermission({ permissionKey: "users:manage", now });
  return prisma.seller.findMany({
    where: { status: SellerStatus.PENDING },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 100,
    select: { id: true, legalName: true, displayName: true, createdAt: true, owner: { select: { id: true, email: true, displayName: true } } }
  });
}
