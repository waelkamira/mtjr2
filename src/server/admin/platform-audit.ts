import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requirePlatformManagement } from "@/server/identity/permission-guard";
import { sanitizeAuditMetadata } from "@/server/admin/audit-metadata";

const querySchema = z.object({
  action: z.string().trim().max(160).optional(),
  resource: z.string().trim().max(120).optional(),
  actorId: z.string().trim().max(128).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.string().trim().min(1).max(128).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
}).strict();

export async function getPlatformAuditEvents(input: unknown, now = new Date()) {
  await requirePlatformManagement(now);
  const query = querySchema.parse(input);
  const from = query.from ? new Date(query.from) : undefined;
  const to = query.to ? new Date(query.to) : undefined;
  if (from && to && from >= to) {
    throw new Error("The audit date range is invalid.");
  }

  const events = await prisma.auditLog.findMany({
    where: {
      ...(query.action ? { action: { contains: query.action, mode: "insensitive" as const } } : {}),
      ...(query.resource ? { resource: { contains: query.resource, mode: "insensitive" as const } } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(from || to ? { occurredAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {})
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      actorType: true,
      actorId: true,
      action: true,
      resource: true,
      resourceId: true,
      scopeType: true,
      scopeId: true,
      metadata: true,
      occurredAt: true,
      actor: { select: { displayName: true, email: true } }
    }
  });

  const hasMore = events.length > query.limit;
  const page = hasMore ? events.slice(0, query.limit) : events;
  return {
    events: page.map((event) => ({
      ...event,
      metadata: sanitizeAuditMetadata(event.metadata),
      occurredAt: event.occurredAt.toISOString(),
      actor: event.actor ? {
        displayName: event.actor.displayName,
        email: event.actor.email
      } : null
    })),
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
    limit: query.limit
  };
}
