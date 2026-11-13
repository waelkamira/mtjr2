import "server-only";

import { AuditActorType, CatalogEntityStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/server/identity/permission-guard";
import { isSafeCatalogMediaUrl } from "@/server/catalog/media-url";

const productListSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.nativeEnum(CatalogEntityStatus).optional(),
  storeId: z.string().trim().min(1).max(128).optional(),
  ownerId: z.string().trim().min(1).max(128).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50)
}).strict();

export async function listAdminCatalogProducts(input: unknown, now = new Date()) {
  const filters = productListSchema.parse(input);
  await requirePermission({ permissionKey: "catalog:read", now });
  const q = filters.q || undefined;
  const where: Prisma.ProductWhereInput = {
    status: filters.status ?? { not: CatalogEntityStatus.ARCHIVED },
    ...(filters.storeId ? { storeId: filters.storeId } : {}),
    ...(filters.ownerId ? { store: { seller: { ownerId: filters.ownerId } } } : {}),
    ...(q ? {
      OR: [
        { id: q },
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { store: { name: { contains: q, mode: "insensitive" } } },
        { store: { seller: { owner: { email: { contains: q, mode: "insensitive" } } } } },
        { store: { seller: { owner: { displayName: { contains: q, mode: "insensitive" } } } } }
      ]
    } : {})
  };
  const [total, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        approvalStatus: true,
        createdAt: true,
        updatedAt: true,
        store: {
          select: {
            id: true,
            name: true,
            seller: { select: { ownerId: true, displayName: true, owner: { select: { email: true } } } }
          }
        },
        _count: { select: { orderItems: true } }
      }
    })
  ]);
  return {
    items: items.map(({ _count, ...item }) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      orderItemCount: _count.orderItems
    })),
    page: filters.page,
    limit: filters.limit,
    total,
    pageCount: Math.ceil(total / filters.limit)
  };
}

const archiveProductsSchema = z.object({
  productIds: z.array(z.string().trim().min(1).max(128)).min(1).max(100).optional(),
  storeId: z.string().trim().min(1).max(128).optional(),
  ownerId: z.string().trim().min(1).max(128).optional(),
  reason: z.string().trim().min(5).max(500)
}).strict().refine((value) =>
  Number(Boolean(value.productIds)) + Number(Boolean(value.storeId)) + Number(Boolean(value.ownerId)) === 1,
  { message: "Choose product IDs, one store, or one store owner." }
).refine((value) => !value.productIds || new Set(value.productIds).size === value.productIds.length, {
  message: "Product IDs must be unique."
});

export async function archiveAdminProducts(input: unknown, now = new Date()) {
  const data = archiveProductsSchema.parse(input);
  const actor = await requirePermission({ permissionKey: "catalog:manage", now });

  return prisma.$transaction(async (tx) => {
    let where: Prisma.ProductWhereInput;
    if (data.productIds) {
      const selectedCount = await tx.product.count({ where: { id: { in: data.productIds } } });
      if (selectedCount !== data.productIds.length) throw new Error("One or more selected products were not found.");
      where = { id: { in: data.productIds }, status: { not: CatalogEntityStatus.ARCHIVED } };
    } else if (data.storeId) {
      const store = await tx.store.findUnique({ where: { id: data.storeId }, select: { id: true } });
      if (!store) throw new Error("Store was not found.");
      where = { storeId: data.storeId, status: { not: CatalogEntityStatus.ARCHIVED } };
    } else {
      const seller = await tx.seller.findUnique({ where: { ownerId: data.ownerId }, select: { id: true } });
      if (!seller) throw new Error("Store owner was not found.");
      where = { store: { seller: { ownerId: data.ownerId } }, status: { not: CatalogEntityStatus.ARCHIVED } };
    }

    const matches = await tx.product.findMany({
      where,
      orderBy: { id: "asc" },
      take: 501,
      select: { id: true, status: true, storeId: true }
    });
    if (matches.length > 500) throw new Error("Archive at most 500 products per action. Narrow the selection and retry.");
    if (!matches.length) return { archived: 0 };

    const ids = matches.map(({ id }) => id);
    const result = await tx.product.updateMany({
      where: { id: { in: ids }, status: { not: CatalogEntityStatus.ARCHIVED } },
      data: { status: CatalogEntityStatus.ARCHIVED }
    });
    await tx.auditLog.createMany({
      data: ids.map((productId) => ({
        actorType: AuditActorType.USER,
        actorId: actor.userId,
        action: "catalog.product.archived",
        resource: "product",
        resourceId: productId,
        scopeType: "PRODUCT",
        scopeId: productId,
        occurredAt: now,
        metadata: {
          reason: data.reason,
          bulk: ids.length > 1,
          scope: data.storeId ? { type: "STORE", id: data.storeId }
            : data.ownerId ? { type: "SELLER_OWNER", id: data.ownerId }
              : { type: "SELECTION", count: ids.length }
        }
      }))
    });
    return { archived: result.count };
  });
}

const categorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(2000).nullable().optional(),
  imageUrl: z.string().trim().url().max(2048).nullable().optional(),
  parentId: z.string().trim().min(1).max(128).nullable().optional(),
  status: z.enum([CatalogEntityStatus.DRAFT, CatalogEntityStatus.ACTIVE]),
  sortOrder: z.number().int().min(-10_000).max(10_000)
}).strict();

export async function listAdminCategories(now = new Date()) {
  await requirePermission({ permissionKey: "catalog:read", now });
  return prisma.category.findMany({
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      parentId: true,
      slug: true,
      name: true,
      description: true,
      imageUrl: true,
      status: true,
      sortOrder: true,
      _count: { select: { productLinks: true, children: true } }
    }
  }).then((items) => items.map(({ _count, ...item }) => ({
    ...item,
    productCount: _count.productLinks,
    childCount: _count.children
  })));
}

async function assertValidParent(
  tx: Prisma.TransactionClient,
  parentId: string | null | undefined,
  categoryId?: string,
  requireActiveAncestors = false
) {
  let cursor = parentId ?? null;
  const visited = new Set<string>();
  while (cursor) {
    if (cursor === categoryId || visited.has(cursor)) throw new Error("Category parent would create a cycle.");
    if (visited.size >= 100) throw new Error("Category hierarchy exceeds the supported depth.");
    visited.add(cursor);
    const parent = await tx.category.findUnique({
      where: { id: cursor },
      select: { id: true, parentId: true, status: true }
    });
    if (!parent) throw new Error("Parent category was not found.");
    if (requireActiveAncestors && parent.status !== CatalogEntityStatus.ACTIVE) {
      throw new Error("An active category must have only active ancestors.");
    }
    cursor = parent.parentId;
  }
}

export async function saveAdminCategory(input: unknown, categoryId?: string, now = new Date()) {
  const data = categorySchema.parse(input);
  const actor = await requirePermission({ permissionKey: "catalog:manage", now });
  if (data.imageUrl && !isSafeCatalogMediaUrl(data.imageUrl)) throw new Error("Category image URL is not allowed.");
  const id = categoryId ? z.string().trim().min(1).max(128).parse(categoryId) : undefined;

  return prisma.$transaction(async (tx) => {
    const previous = id
      ? await tx.category.findUnique({ where: { id }, select: { id: true, status: true, slug: true } })
      : null;
    if (id && !previous) throw new Error("Category was not found.");
    await assertValidParent(tx, data.parentId, id, data.status === CatalogEntityStatus.ACTIVE);
    const category = id
      ? await tx.category.update({
        where: { id },
        data: {
          name: data.name,
          slug: data.slug,
          description: data.description ?? null,
          imageUrl: data.imageUrl ?? null,
          parentId: data.parentId ?? null,
          status: data.status,
          sortOrder: data.sortOrder
        },
        select: { id: true, status: true, slug: true }
      })
      : await tx.category.create({
        data: {
          name: data.name,
          slug: data.slug,
          description: data.description ?? null,
          imageUrl: data.imageUrl ?? null,
          parentId: data.parentId ?? null,
          status: data.status,
          sortOrder: data.sortOrder
        },
        select: { id: true, status: true, slug: true }
      });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER,
        actorId: actor.userId,
        action: id ? "catalog.category.updated" : "catalog.category.created",
        resource: "category",
        resourceId: category.id,
        occurredAt: now,
        metadata: {
          previousStatus: previous?.status ?? null,
          previousSlug: previous?.slug ?? null,
          status: category.status,
          slug: category.slug
        }
      }
    });
    return category;
  });
}

export async function archiveAdminCategory(categoryId: string, reason: string, now = new Date()) {
  const id = z.string().trim().min(1).max(128).parse(categoryId);
  const note = z.string().trim().min(5).max(500).parse(reason);
  const actor = await requirePermission({ permissionKey: "catalog:manage", now });
  return prisma.$transaction(async (tx) => {
    const category = await tx.category.findUnique({
      where: { id },
      select: { id: true, status: true, slug: true }
    });
    if (!category) throw new Error("Category was not found.");
    if (category.status === CatalogEntityStatus.ARCHIVED) throw new Error("Category is already archived.");
    const activeChildren = await tx.category.count({
      where: { parentId: id, status: CatalogEntityStatus.ACTIVE }
    });
    if (activeChildren) throw new Error("Archive active child categories first.");
    const updated = await tx.category.updateMany({
      where: { id, status: category.status },
      data: { status: CatalogEntityStatus.ARCHIVED }
    });
    if (updated.count !== 1) throw new Error("The category changed concurrently. Reload and retry.");
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER,
        actorId: actor.userId,
        action: "catalog.category.archived",
        resource: "category",
        resourceId: id,
        occurredAt: now,
        metadata: { slug: category.slug, previousStatus: category.status, reason: note }
      }
    });
    return { categoryId: id, status: CatalogEntityStatus.ARCHIVED };
  });
}


const brandSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(2000).nullable().optional(),
  logoUrl: z.string().trim().url().max(2048).nullable().optional(),
  websiteUrl: z.string().trim().url().max(2048).nullable().optional(),
  status: z.enum([CatalogEntityStatus.DRAFT, CatalogEntityStatus.ACTIVE])
}).strict();

export async function listAdminBrands(now = new Date()) {
  await requirePermission({ permissionKey: "catalog:read", now });
  return prisma.brand.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }, { id: "asc" }],
    select: {
      id: true, name: true, slug: true, description: true, logoUrl: true,
      websiteUrl: true, status: true, updatedAt: true,
      _count: { select: { products: true } }
    }
  }).then((items) => items.map(({ _count, ...item }) => ({
    ...item, productCount: _count.products, updatedAt: item.updatedAt.toISOString()
  })));
}

export async function saveAdminBrand(input: unknown, brandId?: string, now = new Date()) {
  const data = brandSchema.parse(input);
  const actor = await requirePermission({ permissionKey: "catalog:manage", now });
  if (data.logoUrl && !isSafeCatalogMediaUrl(data.logoUrl)) throw new Error("Brand logo URL is not allowed.");
  if (data.websiteUrl && !["http:", "https:"].includes(new URL(data.websiteUrl).protocol)) throw new Error("Brand website URL is not allowed.");
  const id = brandId ? z.string().trim().min(1).max(128).parse(brandId) : undefined;

  return prisma.$transaction(async (tx) => {
    const previous = id
      ? await tx.brand.findUnique({ where: { id }, select: { id: true, status: true, slug: true } })
      : null;
    if (id && !previous) throw new Error("Brand was not found.");
    const brand = id
      ? await tx.brand.update({
        where: { id },
        data: {
          name: data.name, slug: data.slug, description: data.description ?? null,
          logoUrl: data.logoUrl ?? null, websiteUrl: data.websiteUrl ?? null, status: data.status
        },
        select: { id: true, status: true, slug: true }
      })
      : await tx.brand.create({
        data: {
          name: data.name, slug: data.slug, description: data.description ?? null,
          logoUrl: data.logoUrl ?? null, websiteUrl: data.websiteUrl ?? null, status: data.status
        },
        select: { id: true, status: true, slug: true }
      });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId,
        action: id ? "catalog.brand.updated" : "catalog.brand.created",
        resource: "brand", resourceId: brand.id, occurredAt: now,
        metadata: {
          previousStatus: previous?.status ?? null, previousSlug: previous?.slug ?? null,
          status: brand.status, slug: brand.slug
        }
      }
    });
    return brand;
  });
}

export async function archiveAdminBrand(brandId: string, reason: string, now = new Date()) {
  const id = z.string().trim().min(1).max(128).parse(brandId);
  const note = z.string().trim().min(5).max(500).parse(reason);
  const actor = await requirePermission({ permissionKey: "catalog:manage", now });
  return prisma.$transaction(async (tx) => {
    const brand = await tx.brand.findUnique({
      where: { id }, select: { id: true, status: true, slug: true }
    });
    if (!brand) throw new Error("Brand was not found.");
    if (brand.status === CatalogEntityStatus.ARCHIVED) throw new Error("Brand is already archived.");
    const updated = await tx.brand.updateMany({
      where: { id, status: brand.status },
      data: { status: CatalogEntityStatus.ARCHIVED }
    });
    if (updated.count !== 1) throw new Error("The brand changed concurrently. Reload and retry.");
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId,
        action: "catalog.brand.archived", resource: "brand", resourceId: id,
        occurredAt: now, metadata: { slug: brand.slug, previousStatus: brand.status, reason: note }
      }
    });
    return { brandId: id, status: CatalogEntityStatus.ARCHIVED };
  });
}
