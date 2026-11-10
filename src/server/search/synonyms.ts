import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/server/identity/permission-guard";

const synonymInput = z.object({
  locale: z.string().trim().min(2).max(16).regex(/^[a-zA-Z0-9-]+$/),
  term: z.string().trim().min(2).max(160).transform((value) => value.toLowerCase()),
  synonym: z.string().trim().min(2).max(160).transform((value) => value.toLowerCase())
}).strict().refine((value) => value.term.toLocaleLowerCase() !== value.synonym.toLocaleLowerCase(), {
  message: "A term cannot be its own synonym."
});

export async function listSearchSynonyms() {
  await requirePermission({ permissionKey: "users:manage" });
  return prisma.searchSynonym.findMany({
    orderBy: [{ locale: "asc" }, { term: "asc" }, { synonym: "asc" }],
    take: 1000,
    select: { id: true, locale: true, term: true, synonym: true, isActive: true, createdAt: true, updatedAt: true }
  });
}

export async function createSearchSynonym(input: unknown, now = new Date()) {
  const data = synonymInput.parse(input);
  const actor = await requirePermission({ permissionKey: "users:manage", now });
  return prisma.$transaction(async (tx) => {
    const existing = await tx.searchSynonym.findFirst({
      where: { locale: data.locale, term: { equals: data.term, mode: "insensitive" }, synonym: { equals: data.synonym, mode: "insensitive" } },
      select: { id: true }
    });
    if (existing) throw new Error("This synonym mapping already exists.");
    const item = await tx.searchSynonym.create({
      data: { ...data, isActive: true },
      select: { id: true, locale: true, term: true, synonym: true, isActive: true, createdAt: true, updatedAt: true }
    });
    await tx.auditLog.create({ data: {
      actorType: "USER",
      actorId: actor.userId,
      action: "search.synonym.created",
      resource: "search_synonym",
      resourceId: item.id,
      occurredAt: now,
      metadata: { locale: item.locale, term: item.term, synonym: item.synonym }
    } });
    return item;
  });
}

export async function updateSearchSynonym(id: string, input: unknown, now = new Date()) {
  const key = z.string().trim().min(1).parse(id);
  const data = z.object({ isActive: z.boolean() }).strict().parse(input);
  const actor = await requirePermission({ permissionKey: "users:manage", now });
  return prisma.$transaction(async (tx) => {
    const existing = await tx.searchSynonym.findUnique({ where: { id: key }, select: { id: true, locale: true, term: true, synonym: true, isActive: true } });
    if (!existing) throw new Error("Search synonym was not found.");
    const item = await tx.searchSynonym.update({
      where: { id: key },
      data: { isActive: data.isActive },
      select: { id: true, locale: true, term: true, synonym: true, isActive: true, createdAt: true, updatedAt: true }
    });
    await tx.auditLog.create({ data: {
      actorType: "USER",
      actorId: actor.userId,
      action: data.isActive ? "search.synonym.activated" : "search.synonym.deactivated",
      resource: "search_synonym",
      resourceId: item.id,
      occurredAt: now,
      metadata: { locale: existing.locale, term: existing.term, synonym: existing.synonym }
    } });
    return item;
  });
}

export async function deleteSearchSynonym(id: string, now = new Date()) {
  const key = z.string().trim().min(1).parse(id);
  const actor = await requirePermission({ permissionKey: "users:manage", now });
  return prisma.$transaction(async (tx) => {
    const existing = await tx.searchSynonym.findUnique({ where: { id: key }, select: { id: true, locale: true, term: true, synonym: true } });
    if (!existing) throw new Error("Search synonym was not found.");
    await tx.searchSynonym.delete({ where: { id: key } });
    await tx.auditLog.create({ data: {
      actorType: "USER",
      actorId: actor.userId,
      action: "search.synonym.deleted",
      resource: "search_synonym",
      resourceId: existing.id,
      occurredAt: now,
      metadata: { locale: existing.locale, term: existing.term, synonym: existing.synonym }
    } });
    return { id: existing.id, deleted: true };
  });
}
