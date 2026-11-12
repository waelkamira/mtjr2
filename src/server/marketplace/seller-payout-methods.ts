import "server-only";

import { AuditActorType, Prisma, SellerPayoutMethodStatus, SellerPayoutMethodType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";
import { PermissionDeniedError } from "@/server/identity/access-errors";
import { decryptSellerPayoutDetails, encryptSellerPayoutDetails, fingerprintSellerPayoutAccount } from "@/server/finance/seller-payout-encryption";
import { isValidSellerIban } from "@/server/finance/iban-validation";
import { requirePlatformManagement } from "@/server/identity/permission-guard";

const inputSchema = z.object({
  type: z.nativeEnum(SellerPayoutMethodType),
  accountHolderName: z.string().trim().min(2).max(160),
  bankName: z.string().trim().min(2).max(160),
  countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/).transform((value) => value.toUpperCase()),
  currencyCode: z.string().trim().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase()),
  accountIdentifier: z.string().trim().min(6).max(64),
  routingCode: z.string().trim().max(34).optional(),
  isDefault: z.boolean().default(false)
}).strict();

export class SellerPayoutValidationError extends Error {
  constructor(message: string) { super(message); this.name = "SellerPayoutValidationError"; }
}

export class SellerPayoutMethodNotFoundError extends Error {
  constructor() { super("Seller payout method not found."); this.name = "SellerPayoutMethodNotFoundError"; }
}

async function requireSellerOwner() {
  const actor = await requireCurrentSession();
  const seller = await prisma.seller.findUnique({
    where: { ownerId: actor.userId },
    select: { id: true, status: true }
  });
  if (!seller || seller.status !== "ACTIVE") throw new PermissionDeniedError("An active seller account is required to manage bank details.");
  return { actor, seller };
}

const safeSelect = {
  id: true, type: true, accountHolderName: true, bankName: true, countryCode: true,
  currencyCode: true, accountLast4: true, status: true, isDefault: true,
  submissionVersion: true, verifiedAt: true, createdAt: true, updatedAt: true
} as const;

/** Lists only the authenticated seller owner's non-disabled, masked payout destinations. */
export async function listSellerPayoutMethods() {
  const { seller } = await requireSellerOwner();
  const methods = await prisma.sellerPayoutMethod.findMany({
    where: { sellerId: seller.id, status: { not: SellerPayoutMethodStatus.DISABLED } },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: { ...safeSelect, encryptedDetails: true, encryptionKeyVersion: true }
  });
  return methods.map(({ encryptedDetails, encryptionKeyVersion, ...method }) => {
    let accountHolderName = "Protected account holder";
    try {
      accountHolderName = decryptSellerPayoutDetails(encryptedDetails, encryptionKeyVersion).accountHolderName;
    } catch {
      console.error("Unable to decrypt seller payout method", { id: method.id });
    }
    return { ...method, accountHolderName };
  });
}

/** Validates, fingerprints, encrypts and audit-logs a new seller bank destination. */
export async function createSellerPayoutMethod(input: unknown) {
  const data = inputSchema.parse(input);
  const { actor, seller } = await requireSellerOwner();
  const accountIdentifier = data.accountIdentifier.replace(/\s+/g, "").toUpperCase();
  if (data.type === SellerPayoutMethodType.LOCAL_BANK_ACCOUNT) {
    throw new SellerPayoutValidationError("Local bank account formats are not enabled until country-specific account and routing validation is implemented. Use an IBAN account for now.");
  }
  if (data.type === SellerPayoutMethodType.IBAN && !isValidSellerIban(accountIdentifier)) {
    throw new SellerPayoutValidationError("Enter a valid IBAN. The checksum did not pass validation.");
  }
  if (data.type === SellerPayoutMethodType.IBAN && accountIdentifier.slice(0, 2) !== data.countryCode) {
    throw new SellerPayoutValidationError("The IBAN country prefix must match the selected bank country.");
  }
  if (data.routingCode && !/^[A-Za-z0-9-]{3,34}$/.test(data.routingCode.trim())) {
    throw new SellerPayoutValidationError("Enter a valid bank routing or SWIFT/BIC code.");
  }
  const [country, currency] = await Promise.all([
    prisma.country.findUnique({ where: { iso2: data.countryCode }, select: { isActive: true } }),
    prisma.currency.findUnique({ where: { code: data.currencyCode }, select: { code: true, isActive: true } })
  ]);
  if (!country?.isActive) throw new SellerPayoutValidationError("Choose a valid active bank country.");
  if (!currency?.isActive) throw new SellerPayoutValidationError("Choose an active payout currency.");
  const fingerprint = fingerprintSellerPayoutAccount(seller.id, data.countryCode, accountIdentifier);
  const encrypted = encryptSellerPayoutDetails({
    accountIdentifier,
    accountHolderName: data.accountHolderName,
    ...(data.routingCode ? { routingCode: data.routingCode.trim().toUpperCase() } : {})
  });

  return prisma.$transaction(async (tx) => {
    const duplicate = await tx.sellerPayoutMethod.findUnique({
      where: { sellerId_currencyCode_fingerprint: { sellerId: seller.id, currencyCode: data.currencyCode, fingerprint } },
      select: { id: true, status: true }
    });
    if (duplicate && duplicate.status !== SellerPayoutMethodStatus.DISABLED) {
      throw new SellerPayoutValidationError("This bank account is already saved for your seller account.");
    }
    const existingCount = await tx.sellerPayoutMethod.count({
      where: { sellerId: seller.id, currencyCode: data.currencyCode, status: { not: SellerPayoutMethodStatus.DISABLED } }
    });
    const makeDefault = data.isDefault || existingCount === 0;
    if (makeDefault) {
      await tx.sellerPayoutMethod.updateMany({
        where: { sellerId: seller.id, currencyCode: data.currencyCode, isDefault: true },
        data: { isDefault: false }
      });
    }
    const methodData = {
      type: data.type,
      accountHolderName: "Protected account holder",
      bankName: data.bankName,
      countryCode: data.countryCode,
      currencyCode: data.currencyCode,
      encryptedDetails: encrypted.encryptedDetails,
      encryptionKeyVersion: encrypted.keyVersion,
      accountLast4: accountIdentifier.slice(-4),
      fingerprint,
      status: SellerPayoutMethodStatus.PENDING_VERIFICATION,
      verifiedAt: null,
      isDefault: makeDefault
    };
    const method = duplicate
      ? await tx.sellerPayoutMethod.update({
          where: { id: duplicate.id },
          data: { ...methodData, submissionVersion: { increment: 1 } },
          select: safeSelect
        })
      : await tx.sellerPayoutMethod.create({ data: { sellerId: seller.id, ...methodData }, select: safeSelect });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER,
        actorId: actor.userId,
        action: "SELLER_PAYOUT_METHOD_CREATED",
        resource: "SellerPayoutMethod",
        resourceId: method.id,
        scopeType: "SELLER",
        scopeId: seller.id,
        metadata: { type: method.type, countryCode: method.countryCode, currencyCode: method.currencyCode, accountLast4: method.accountLast4 }
      }
    });
    return { ...method, accountHolderName: data.accountHolderName };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Atomically selects an owned pending or verified bank destination as the default. */
export async function setSellerPayoutMethodDefault(methodIdInput: string) {
  const methodId = z.string().trim().min(1).max(128).parse(methodIdInput);
  const { actor, seller } = await requireSellerOwner();
  return prisma.$transaction(async (tx) => {
    const method = await tx.sellerPayoutMethod.findFirst({
      where: { id: methodId, sellerId: seller.id, status: { in: [SellerPayoutMethodStatus.PENDING_VERIFICATION, SellerPayoutMethodStatus.VERIFIED] } },
      select: { id: true, status: true, currencyCode: true }
    });
    if (!method) throw new SellerPayoutMethodNotFoundError();
    await tx.sellerPayoutMethod.updateMany({ where: { sellerId: seller.id, currencyCode: method.currencyCode, isDefault: true }, data: { isDefault: false } });
    const updated = await tx.sellerPayoutMethod.update({ where: { id: method.id }, data: { isDefault: true }, select: safeSelect });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId,
        action: "SELLER_PAYOUT_METHOD_DEFAULT_CHANGED", resource: "SellerPayoutMethod",
        resourceId: method.id, scopeType: "SELLER", scopeId: seller.id,
        metadata: { accountLast4: updated.accountLast4, status: updated.status }
      }
    });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Soft-disables an owned bank destination and clears its encrypted account details. */
export async function disableSellerPayoutMethod(methodIdInput: string) {
  const methodId = z.string().trim().min(1).max(128).parse(methodIdInput);
  const { actor, seller } = await requireSellerOwner();
  return prisma.$transaction(async (tx) => {
    const method = await tx.sellerPayoutMethod.findFirst({
      where: { id: methodId, sellerId: seller.id, status: { not: SellerPayoutMethodStatus.DISABLED } },
      select: { id: true, isDefault: true, accountLast4: true, currencyCode: true }
    });
    if (!method) throw new SellerPayoutMethodNotFoundError();
    const updated = await tx.sellerPayoutMethod.update({
      where: { id: method.id },
      data: { status: SellerPayoutMethodStatus.DISABLED, isDefault: false, encryptedDetails: "", accountHolderName: "Removed bank account", bankName: "Removed" },
      select: safeSelect
    });
    if (method.isDefault) {
      const replacement = await tx.sellerPayoutMethod.findFirst({
        where: { sellerId: seller.id, currencyCode: method.currencyCode, status: { in: [SellerPayoutMethodStatus.VERIFIED, SellerPayoutMethodStatus.PENDING_VERIFICATION] } },
        orderBy: [{ status: "desc" }, { createdAt: "asc" }],
        select: { id: true }
      });
      if (replacement) await tx.sellerPayoutMethod.update({ where: { id: replacement.id }, data: { isDefault: true } });
    }
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId,
        action: "SELLER_PAYOUT_METHOD_DISABLED", resource: "SellerPayoutMethod",
        resourceId: method.id, scopeType: "SELLER", scopeId: seller.id,
        metadata: { accountLast4: method.accountLast4 }
      }
    });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}


const payoutVerificationSchema = z.object({
  decision: z.enum(["VERIFIED", "REJECTED"]),
  evidenceReference: z.string().trim().min(6).max(180),
  reason: z.string().trim().min(10).max(500),
  expectedSubmissionVersion: z.number().int().positive().max(2147483647)
}).strict();

export class SellerPayoutVerificationConflictError extends Error {
  constructor() { super("This bank destination changed or was already reviewed. Refresh the queue and re-check the latest submission before deciding."); this.name = "SellerPayoutVerificationConflictError"; }
}

export class SellerPayoutSelfVerificationError extends Error {
  constructor() { super("A seller cannot verify their own bank destination."); this.name = "SellerPayoutSelfVerificationError"; }
}

/**
 * Records an out-of-band bank ownership review. This does not initiate or authorize a payout.
 * Platform-management permission includes the platform step-up/MFA policy.
 */
export async function reviewSellerPayoutMethod(methodIdInput: string, input: unknown) {
  const methodId = z.string().trim().min(1).max(128).parse(methodIdInput);
  const decision = payoutVerificationSchema.parse(input);
  const actor = await requirePlatformManagement();
  return prisma.$transaction(async (tx) => {
    const method = await tx.sellerPayoutMethod.findUnique({
      where: { id: methodId },
      select: {
        id: true, sellerId: true, accountLast4: true, currencyCode: true,
        status: true, isDefault: true, submissionVersion: true, seller: { select: { ownerId: true } }
      }
    });
    if (!method || method.status === SellerPayoutMethodStatus.DISABLED) throw new SellerPayoutMethodNotFoundError();
    if (method.seller.ownerId === actor.userId) throw new SellerPayoutSelfVerificationError();
    if (method.status !== SellerPayoutMethodStatus.PENDING_VERIFICATION) throw new SellerPayoutVerificationConflictError();
    // Bind the admin decision to the immutable submission generation they inspected.
    // Re-registering a disabled destination reuses its row ID but increments this version.
    if (method.submissionVersion !== decision.expectedSubmissionVersion) {
      throw new SellerPayoutVerificationConflictError();
    }

    const write = await tx.sellerPayoutMethod.updateMany({
      where: {
        id: method.id,
        status: SellerPayoutMethodStatus.PENDING_VERIFICATION,
        submissionVersion: decision.expectedSubmissionVersion
      },
      data: {
        status: decision.decision,
        verifiedAt: decision.decision === "VERIFIED" ? new Date() : null,
        ...(decision.decision === "REJECTED" ? { isDefault: false } : {})
      }
    });
    if (write.count !== 1) throw new SellerPayoutVerificationConflictError();
    const updated = await tx.sellerPayoutMethod.findUniqueOrThrow({
      where: { id: method.id },
      select: safeSelect
    });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER,
        actorId: actor.userId,
        action: decision.decision === "VERIFIED" ? "SELLER_PAYOUT_METHOD_VERIFIED" : "SELLER_PAYOUT_METHOD_REJECTED",
        resource: "SellerPayoutMethod",
        resourceId: method.id,
        scopeType: "SELLER",
        scopeId: method.sellerId,
        metadata: {
          decision: decision.decision,
          evidenceReference: decision.evidenceReference,
          reason: decision.reason,
          accountLast4: method.accountLast4,
          currencyCode: method.currencyCode
        }
      }
    });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
