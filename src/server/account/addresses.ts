import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";

const addressInput = z.object({
  label: z.string().trim().max(80).optional().nullable(),
  recipientName: z.string().trim().min(2).max(160),
  phone: z.string().trim().regex(/^\+[1-9]\d{7,14}$/, "Use an international phone number, e.g. +31612345678."),
  countryCode: z.string().trim().length(2).toUpperCase(),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(2).max(120),
  region: z.string().trim().max(120).optional().nullable(),
  postalCode: z.string().trim().max(32).optional().nullable(),
  isDefault: z.boolean().optional().default(false)
}).strict();

export async function listUserAddresses() {
  const session = await requireCurrentSession();
  const rows = await prisma.userAddress.findMany({
    where: { userId: session.userId },
    include: { country: { select: { iso2: true, name: true } } },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
  });
  return rows.map(({ country, ...address }) => ({
    ...address,
    countryCode: country.iso2,
    countryName: country.name
  }));
}

export async function createUserAddress(input: unknown) {
  const session = await requireCurrentSession();
  const data = addressInput.parse(input);
  return prisma.$transaction(async (tx) => {
    const country = await tx.country.findFirst({
      where: { iso2: data.countryCode, isActive: true },
      select: { id: true, iso2: true, name: true }
    });
    if (!country) throw new Error("The selected country is not available for delivery.");

    const hasDefault = await tx.userAddress.findFirst({
      where: { userId: session.userId, isDefault: true },
      select: { id: true }
    });
    const isDefault = data.isDefault || !hasDefault;
    if (isDefault) {
      await tx.userAddress.updateMany({ where: { userId: session.userId, isDefault: true }, data: { isDefault: false } });
    }
    const address = await tx.userAddress.create({
      data: {
        userId: session.userId, countryId: country.id, label: data.label || null,
        recipientName: data.recipientName, phone: data.phone, line1: data.line1,
        line2: data.line2 || null, city: data.city, region: data.region || null,
        postalCode: data.postalCode || null, isDefault
      },
      include: { country: { select: { iso2: true, name: true } } }
    });
    return { ...address, countryCode: address.country.iso2, countryName: address.country.name };
  });
}
