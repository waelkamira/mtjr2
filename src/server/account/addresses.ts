import "server-only";

import { Prisma } from "@prisma/client";
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

const addressSelect = { iso2: true, name: true } as const;

/** Serializes mutations to one customer's address book so concurrent writes cannot create multiple defaults. */
async function lockAddressBook(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`user-address-book:${userId}`}, 0))`);
}

/** Resolves the current user's saved addresses and flattens country data for the account UI. */
export async function listUserAddresses() {
  const session = await requireCurrentSession();
  const rows = await prisma.userAddress.findMany({
    where: { userId: session.userId },
    include: { country: { select: addressSelect } },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }, { id: "desc" }]
  });
  return rows.map(({ country, ...address }) => ({
    ...address,
    countryCode: country.iso2,
    countryName: country.name
  }));
}

/** Creates an address for the authenticated owner and atomically maintains a single default. */
export async function createUserAddress(input: unknown) {
  const session = await requireCurrentSession();
  const data = addressInput.parse(input);
  return prisma.$transaction(async (tx) => {
    await lockAddressBook(tx, session.userId);
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
      include: { country: { select: addressSelect } }
    });
    return { ...address, countryCode: address.country.iso2, countryName: address.country.name };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Updates only an address owned by the current user; country and default changes share one transaction. */
export async function updateUserAddress(addressIdInput: string, input: unknown) {
  const session = await requireCurrentSession();
  const addressId = z.string().trim().min(1).max(128).parse(addressIdInput);
  const data = addressInput.parse(input);
  return prisma.$transaction(async (tx) => {
    await lockAddressBook(tx, session.userId);
    const existing = await tx.userAddress.findFirst({
      where: { id: addressId, userId: session.userId },
      select: { id: true, isDefault: true }
    });
    if (!existing) throw new Error("Saved address not found.");
    const country = await tx.country.findFirst({
      where: { iso2: data.countryCode, isActive: true },
      select: { id: true, iso2: true, name: true }
    });
    if (!country) throw new Error("The selected country is not available for delivery.");

    const isDefault = data.isDefault || existing.isDefault;
    if (isDefault) {
      await tx.userAddress.updateMany({ where: { userId: session.userId, isDefault: true }, data: { isDefault: false } });
    }
    const changed = await tx.userAddress.updateMany({
      where: { id: addressId, userId: session.userId },
      data: {
        countryId: country.id, label: data.label || null, recipientName: data.recipientName,
        phone: data.phone, line1: data.line1, line2: data.line2 || null,
        city: data.city, region: data.region || null, postalCode: data.postalCode || null, isDefault
      }
    });
    if (changed.count !== 1) throw new Error("Saved address changed. Reload and try again.");
    const address = await tx.userAddress.findFirst({
      where: { id: addressId, userId: session.userId },
      include: { country: { select: addressSelect } }
    });
    if (!address) throw new Error("Saved address not found.");
    return { ...address, countryCode: address.country.iso2, countryName: address.country.name };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Marks one owned address as default and clears the previous default atomically. */
export async function setDefaultUserAddress(addressIdInput: string) {
  const session = await requireCurrentSession();
  const addressId = z.string().trim().min(1).max(128).parse(addressIdInput);
  return prisma.$transaction(async (tx) => {
    await lockAddressBook(tx, session.userId);
    const existing = await tx.userAddress.findFirst({
      where: { id: addressId, userId: session.userId },
      select: { id: true }
    });
    if (!existing) throw new Error("Saved address not found.");
    await tx.userAddress.updateMany({ where: { userId: session.userId, isDefault: true }, data: { isDefault: false } });
    const changed = await tx.userAddress.updateMany({
      where: { id: addressId, userId: session.userId },
      data: { isDefault: true }
    });
    if (changed.count !== 1) throw new Error("Saved address changed. Reload and try again.");
    return { id: addressId, isDefault: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Deletes only an owned address and promotes the newest remaining address if the default was removed. */
export async function deleteUserAddress(addressIdInput: string) {
  const session = await requireCurrentSession();
  const addressId = z.string().trim().min(1).max(128).parse(addressIdInput);
  return prisma.$transaction(async (tx) => {
    await lockAddressBook(tx, session.userId);
    const existing = await tx.userAddress.findFirst({
      where: { id: addressId, userId: session.userId },
      select: { id: true, isDefault: true }
    });
    if (!existing) throw new Error("Saved address not found.");
    const deleted = await tx.userAddress.deleteMany({ where: { id: addressId, userId: session.userId } });
    if (deleted.count !== 1) throw new Error("Saved address changed. Reload and try again.");

    let defaultAddressId: string | null = null;
    if (existing.isDefault) {
      const next = await tx.userAddress.findFirst({
        where: { userId: session.userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true }
      });
      if (next) {
        const promoted = await tx.userAddress.updateMany({
          where: { id: next.id, userId: session.userId },
          data: { isDefault: true }
        });
        if (promoted.count !== 1) throw new Error("Unable to select a new default address.");
        defaultAddressId = next.id;
      }
    }
    return { deleted: true, defaultAddressId };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
