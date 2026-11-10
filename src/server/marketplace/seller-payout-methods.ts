import "server-only";

import { AuditActorType, Prisma, SellerPayoutMethodStatus, SellerPayoutMethodType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";
import { PermissionDeniedError } from "@/server/identity/access-errors";
import { encryptSellerPayoutDetails, fingerprintSellerPayoutAccount } from "@/server/finance/seller-payout-encryption";

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

export class SellerPayoutMethodNotFoundError extends Error {
  constructor() { super("Seller payout method not found."); this.name = "SellerPayoutMethodNotFoundError"; }
}

function validIban(value: string) {
  const iban = value.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const character of rearranged) {
    const digits = character >= "A" && character <= "Z" ? String(character.charCodeAt(0) - 55) : character;
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
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
  verifiedAt: true, createdAt: true, updatedAt: true
} as const;

/** Lists only the authenticated seller owner's non-disabled, masked payout destinations. */
export async function listSellerPayoutMethods() {
  const { seller } = await requireSellerOwner();
  return prisma.sellerPayoutMethod.findMany({
    where: { sellerId: seller.id, status: { not: SellerPayoutMethodStatus.DISABLED } },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: safeSelect
  });
}

/** Validates, fingerprints, encrypts and audit-logs a new seller bank destination. */
export async function createSellerPayoutMethod(input: unknown) {
  const data = inputSchema.parse(input);
  const { actor, seller } = await requireSellerOwner();
  const accountIdentifier = data.accountIdentifier.replace(/\s+/g, "").toUpperCase();
  if (data.type === SellerPayoutMethodType.IBAN && !validIban(accountIdentifier)) {
    throw new Error("Enter a valid IBAN. The checksum did not pass validation.");
  }
  if (data.type === SellerPayoutMethodType.IBAN && accountIdentifier.slice(0, 2) !== data.countryCode) {
    throw new Error("The IBAN country prefix must match the selected bank country.");
  }
  if (data.type === SellerPayoutMethodType.LOCAL_BANK_ACCOUNT && !/^[A-Z0-9-]{6,34}$/.test(accountIdentifier)) {
    throw new Error("Enter a valid local bank account number.");
  }
  if (data.routingCode && !/^[A-Za-z0-9-]{3,34}$/.test(data.routingCode.trim())) {
    throw new Error("Enter a valid bank routing or SWIFT/BIC code.");
  }
  const currency = await prisma.currency.findUnique({
    where: { code: data.currencyCode },
    select: { code: true, isActive: true }
  });
  if (!currency?.isActive) throw new Error("Choose an active payout currency.");
  const fingerprint = fingerprintSellerPayoutAccount(seller.id, data.countryCode, accountIdentifier);
  const encrypted = encryptSellerPayoutDetails({
    accountIdentifier,
    ...(data.routingCode ? { routingCode: data.routingCode.trim().toUpperCase() } : {})
  });

  return prisma.$transaction(async (tx) => {
    const duplicate = await tx.sellerPayoutMethod.findUnique({
      where: { sellerId_fingerprint: { sellerId: seller.id, fingerprint } },
      select: { id: true, status: true }
    });
    if (duplicate && duplicate.status !== SellerPayoutMethodStatus.DISABLED) {
      throw new Error("This bank account is already saved for your seller account.");
    }
    const existingCount = await tx.sellerPayoutMethod.count({
      where: { sellerId: seller.id, status: { not: SellerPayoutMethodStatus.DISABLED } }
    });
    const makeDefault = data.isDefault || existingCount === 0;
    if (makeDefault) {
      await tx.sellerPayoutMethod.updateMany({
        where: { sellerId: seller.id, isDefault: true },
        data: { isDefault: false }
      });
    }
    const methodData = {
      type: data.type,
      accountHolderName: data.accountHolderName,
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
      ? await tx.sellerPayoutMethod.update({ where: { id: duplicate.id }, data: methodData, select: safeSelect })
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
    return method;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Atomically selects an owned pending or verified bank destination as the default. */
export async function setSellerPayoutMethodDefault(methodIdInput: string) {
  const methodId = z.string().trim().min(1).max(128).parse(methodIdInput);
  const { actor, seller } = await requireSellerOwner();
  return prisma.$transaction(async (tx) => {
    const method = await tx.sellerPayoutMethod.findFirst({
      where: { id: methodId, sellerId: seller.id, status: { in: [SellerPayoutMethodStatus.PENDING_VERIFICATION, SellerPayoutMethodStatus.VERIFIED] } },
      select: { id: true, status: true }
    });
    if (!method) throw new SellerPayoutMethodNotFoundError();
    await tx.sellerPayoutMethod.updateMany({ where: { sellerId: seller.id, isDefault: true }, data: { isDefault: false } });
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
      select: { id: true, isDefault: true, accountLast4: true }
    });
    if (!method) throw new SellerPayoutMethodNotFoundError();
    const updated = await tx.sellerPayoutMethod.update({
      where: { id: method.id },
      data: { status: SellerPayoutMethodStatus.DISABLED, isDefault: false, encryptedDetails: "", accountHolderName: "Removed bank account", bankName: "Removed" },
      select: safeSelect
    });
    if (method.isDefault) {
      const replacement = await tx.sellerPayoutMethod.findFirst({
        where: { sellerId: seller.id, status: SellerPayoutMethodStatus.VERIFIED },
        orderBy: { createdAt: "asc" },
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
