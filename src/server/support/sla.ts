import "server-only";

import { AuditActorType, SupportTicketStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createInAppNotification } from "@/server/notifications/notifications";
import { nextSupportSlaPriority } from "@/server/support/sla-policy";

const activeStatuses = [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS, SupportTicketStatus.WAITING_CUSTOMER];

export async function processSupportSlaEscalations(now = new Date(), limit = 100) {
  const candidates = await prisma.supportTicket.findMany({
    where: {
      status: { in: activeStatuses },
      OR: [
        { firstResponseAt: null, firstResponseBreachedAt: null, firstResponseDueAt: { lte: now } },
        { resolutionBreachedAt: null, resolutionDueAt: { lte: now } }
      ]
    },
    orderBy: [{ resolutionDueAt: "asc" }, { firstResponseDueAt: "asc" }, { id: "asc" }],
    take: Math.max(1, Math.min(limit, 250)),
    select: { id: true, ticketNumber: true }
  });

  let firstResponseBreaches = 0;
  let resolutionBreaches = 0;
  let escalated = 0;

  for (const candidate of candidates) {
    const outcome = await prisma.$transaction(async (tx) => {
      const current = await tx.supportTicket.findUnique({
        where: { id: candidate.id },
        select: { status: true, priority: true, assignedToId: true, firstResponseAt: true, firstResponseDueAt: true, firstResponseBreachedAt: true, resolutionDueAt: true, resolutionBreachedAt: true, escalatedAt: true }
      });
      if (!current || current.status === SupportTicketStatus.RESOLVED || current.status === SupportTicketStatus.CLOSED) return null;

      const firstBreach = !current.firstResponseAt && !current.firstResponseBreachedAt && !!current.firstResponseDueAt && current.firstResponseDueAt <= now;
      const resolutionBreach = !current.resolutionBreachedAt && !!current.resolutionDueAt && current.resolutionDueAt <= now;
      if (!firstBreach && !resolutionBreach) return null;

      const nextPriority = resolutionBreach ? nextSupportSlaPriority(current.priority) : current.priority;
      const changed = await tx.supportTicket.updateMany({
        where: {
          id: candidate.id,
          status: { in: activeStatuses },
          priority: current.priority,
          assignedToId: current.assignedToId,
          firstResponseAt: current.firstResponseAt,
          firstResponseBreachedAt: current.firstResponseBreachedAt,
          resolutionBreachedAt: current.resolutionBreachedAt,
          escalatedAt: current.escalatedAt
        },
        data: {
          ...(firstBreach ? { firstResponseBreachedAt: now } : {}),
          ...(resolutionBreach ? { resolutionBreachedAt: now, escalatedAt: current.escalatedAt ?? now, priority: nextPriority } : {})
        }
      });
      if (changed.count !== 1) return null;

      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.SYSTEM,
          action: "support.ticket.sla_breached",
          resource: "support_ticket",
          resourceId: candidate.id,
          occurredAt: now,
          metadata: { firstResponseBreached: firstBreach, resolutionBreached: resolutionBreach, previousPriority: current.priority, priority: nextPriority }
        }
      });
      if (resolutionBreach && current.assignedToId) {
        await createInAppNotification(tx, { data: {
          userId: current.assignedToId,
          type: "SUPPORT_SLA_ESCALATION",
          title: "Support ticket SLA breached",
          message: `${candidate.ticketNumber} exceeded its resolution target and was escalated.`,
          resourceType: "support_ticket",
          resourceId: candidate.id,
          deduplicationKey: `support-sla-escalation:${candidate.id}`
        } });
      }
      return { firstBreach, resolutionBreach };
    });
    if (outcome?.firstBreach) firstResponseBreaches += 1;
    if (outcome?.resolutionBreach) { resolutionBreaches += 1; escalated += 1; }
  }

  return { scanned: candidates.length, firstResponseBreaches, resolutionBreaches, escalated, processedAt: now.toISOString() };
}
