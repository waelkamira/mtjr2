import "server-only";

import { CatalogEntityStatus, ProductApprovalStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";

export async function listMyFavorites(now = new Date()) {
  const actor = await requireCurrentSession(now);
  const favorites = await prisma.favorite.findMany({
    where: { userId: actor.userId, product: { status: CatalogEntityStatus.ACTIVE, approvalStatus: ProductApprovalStatus.APPROVED, store: { status: "ACTIVE", seller: { status: "ACTIVE" } } } },
    orderBy: { createdAt: "desc" }, take: 100,
    select: {
      id: true, createdAt: true,
      product: {
        select: {
          id: true, name: true, slug: true,
          media: { where: { isPrimary: true }, take: 1, select: { url: true, altText: true } },
          store: { select: { name: true, slug: true } }
        }
      }
    }
  });
  return favorites.map((favorite) => ({
    id: favorite.id, createdAt: favorite.createdAt.toISOString(),
    product: { ...favorite.product, image: favorite.product.media[0] ?? null }
  }));
}

export async function getFavoriteStatus(productId: string, now = new Date()) {
  const id = z.string().trim().min(1).parse(productId);
  const actor = await requireCurrentSession(now);
  const favorite = await prisma.favorite.findUnique({
    where: { userId_productId: { userId: actor.userId, productId: id } },
    select: { id: true }
  });
  return { isFavorite: Boolean(favorite) };
}

export async function addFavorite(productId: string, now = new Date()) {
  const id = z.string().trim().min(1).parse(productId);
  const actor = await requireCurrentSession(now);
  const product = await prisma.product.findFirst({
    where: { id, status: CatalogEntityStatus.ACTIVE, approvalStatus: ProductApprovalStatus.APPROVED, store: { status: "ACTIVE", seller: { status: "ACTIVE" } } },
    select: { id: true }
  });
  if (!product) throw new Error("Product not found.");
  const favorite = await prisma.favorite.upsert({
    where: { userId_productId: { userId: actor.userId, productId: id } },
    create: { userId: actor.userId, productId: id },
    update: {},
    select: { id: true, createdAt: true }
  });
  return { id: favorite.id, createdAt: favorite.createdAt.toISOString(), isFavorite: true };
}

export async function removeFavorite(productId: string, now = new Date()) {
  const id = z.string().trim().min(1).parse(productId);
  const actor = await requireCurrentSession(now);
  await prisma.favorite.deleteMany({ where: { userId: actor.userId, productId: id } });
  return { productId: id, isFavorite: false };
}

export async function mergeGuestFavorites(productIds: string[], now = new Date()) {
  const actor = await requireCurrentSession(now);
  const uniqueIds = [...new Set(productIds)].slice(0, 100);
  if (!uniqueIds.length) return { merged: 0, ignored: 0 };
  const eligible = await prisma.product.findMany({
    where: {
      id: { in: uniqueIds },
      status: CatalogEntityStatus.ACTIVE,
      approvalStatus: ProductApprovalStatus.APPROVED,
      store: { status: "ACTIVE", seller: { status: "ACTIVE" } }
    },
    select: { id: true }
  });
  const eligibleIds = eligible.map((item) => item.id);
  const result = await prisma.favorite.createMany({
    data: eligibleIds.map((productId) => ({ userId: actor.userId, productId })),
    skipDuplicates: true
  });
  return { merged: result.count, ignored: uniqueIds.length - result.count };
}
