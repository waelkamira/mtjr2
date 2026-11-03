import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";

export async function listMyNotifications(now = new Date()) {
  const session = await requireCurrentSession(now);
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, type: true, title: true, message: true, resourceType: true, resourceId: true, readAt: true, createdAt: true }
    }),
    prisma.notification.count({ where: { userId: session.userId, readAt: null } })
  ]);
  return { items, unreadCount };
}

export async function markMyNotificationRead(notificationId: string, now = new Date()) {
  const session = await requireCurrentSession(now);
  const id = z.string().trim().min(1).parse(notificationId);
  const updated = await prisma.notification.updateMany({
    where: { id, userId: session.userId, readAt: null },
    data: { readAt: now }
  });
  const item = await prisma.notification.findFirst({
    where: { id, userId: session.userId },
    select: { id: true, readAt: true }
  });
  if (!item) throw new Error("Notification not found.");
  return { ...item, changed: updated.count === 1 };
}
