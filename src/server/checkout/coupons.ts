import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/server/identity/permission-guard";

const couponInput = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{1,39}$/),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  value: z.string().regex(/^[1-9]\d{0,15}$/),
  currencyCode: z.string().trim().length(3).toUpperCase().optional(),
  maxRedemptions: z.number().int().min(1).max(10000000).optional().nullable(),
  startsAt: z.coerce.date().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable()
}).strict().superRefine((value, context) => {
  if (value.discountType === "FIXED_AMOUNT" && !value.currencyCode) {
    context.addIssue({ code: "custom", path: ["currencyCode"], message: "Fixed-amount coupons require a currency." });
  }
  if (value.discountType === "PERCENTAGE" && value.currencyCode) {
    context.addIssue({ code: "custom", path: ["currencyCode"], message: "Percentage coupons must not be restricted to one currency." });
  }
  if (value.discountType === "PERCENTAGE" && BigInt(value.value) > BigInt(10000)) {
    context.addIssue({ code: "custom", path: ["value"], message: "Percentage value is basis points and cannot exceed 10000." });
  }
  if (value.startsAt && value.expiresAt && value.expiresAt <= value.startsAt) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "Coupon expiry must be after its start date." });
  }
});

function serializeCoupon<T extends { value: bigint }>(coupon: T) {
  return {
    ...coupon,
    value: coupon.value.toString()
  };
}

export async function listCoupons() {
  await requirePermission({ permissionKey: "users:manage" });
  const coupons = await prisma.coupon.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: 500,
    include: { currency: { select: { code: true } }, _count: { select: { redemptions: true } } }
  });
  return coupons.map(serializeCoupon);
}

export async function createCoupon(input: unknown, now = new Date()) {
  const data = couponInput.parse(input);
  const actor = await requirePermission({ permissionKey: "users:manage", now });
  return prisma.$transaction(async (tx) => {
    if (data.currencyCode) {
      const currency = await tx.currency.findFirst({
        where: { code: data.currencyCode, isActive: true },
        select: { code: true }
      });
      if (!currency) throw new Error("Fixed-amount coupons require an active currency.");
    }
    const coupon = await tx.coupon.create({
      data: {
        code: data.code,
        discountType: data.discountType,
        value: BigInt(data.value),
        currencyCode: data.currencyCode,
        maxRedemptions: data.maxRedemptions,
        startsAt: data.startsAt,
        expiresAt: data.expiresAt,
        isActive: true
      },
      include: { currency: { select: { code: true } }, _count: { select: { redemptions: true } } }
    });
    await tx.auditLog.create({
      data: {
        actorType: "USER", actorId: actor.userId, action: "checkout.coupon.created",
        resource: "coupon", resourceId: coupon.id, occurredAt: now,
        metadata: { code: coupon.code, discountType: coupon.discountType, value: coupon.value.toString() }
      }
    });
    return serializeCoupon(coupon);
  });
}

export async function setCouponActive(id: string, isActive: boolean, now = new Date()) {
  const couponId = z.string().trim().min(1).parse(id);
  const active = z.boolean().parse(isActive);
  const actor = await requirePermission({ permissionKey: "users:manage", now });
  return prisma.$transaction(async (tx) => {
    const existing = await tx.coupon.findUnique({ where: { id: couponId }, select: { id: true, code: true, isActive: true } });
    if (!existing) throw new Error("Coupon was not found.");
    const coupon = await tx.coupon.update({
      where: { id: couponId },
      data: { isActive: active },
      include: { currency: { select: { code: true } }, _count: { select: { redemptions: true } } }
    });
    await tx.auditLog.create({
      data: {
        actorType: "USER", actorId: actor.userId,
        action: active ? "checkout.coupon.activated" : "checkout.coupon.deactivated",
        resource: "coupon", resourceId: coupon.id, occurredAt: now,
        metadata: { code: existing.code }
      }
    });
    return serializeCoupon(coupon);
  });
}
