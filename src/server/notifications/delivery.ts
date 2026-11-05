import "server-only";

import { NotificationDeliveryStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { sendNotificationEmail } from "@/server/email/resend";
import { notificationRetryDelayMs } from "@/server/notifications/delivery-policy";

const BATCH_SIZE = 25;
export async function processNotificationDeliveries(now = new Date()) {
  const staleLock = new Date(now.getTime() - 5 * 60 * 1000);
  const candidates = await prisma.notificationDelivery.findMany({
    where: {
      OR: [
        { status: { in: [NotificationDeliveryStatus.PENDING, NotificationDeliveryStatus.RETRY] }, nextAttemptAt: { lte: now } },
        { status: NotificationDeliveryStatus.PROCESSING, lockedAt: { lt: staleLock } }
      ]
    },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
    take: BATCH_SIZE,
    select: { id: true, type: true, status: true, lockedAt: true }
  });

  let sent = 0;
  let retried = 0;
  let failed = 0;
  for (const candidate of candidates) {
    const claimWhere: Prisma.NotificationDeliveryWhereInput = candidate.status === NotificationDeliveryStatus.PROCESSING
      ? { id: candidate.id, status: NotificationDeliveryStatus.PROCESSING, lockedAt: { lt: staleLock } }
      : { id: candidate.id, status: candidate.status, nextAttemptAt: { lte: now } };
    const claimed = await prisma.notificationDelivery.updateMany({
      where: claimWhere,
      data: { status: NotificationDeliveryStatus.PROCESSING, lockedAt: now, attempts: { increment: 1 } }
    });
    if (claimed.count !== 1) continue;

    const delivery = await prisma.notificationDelivery.findUnique({
      where: { id: candidate.id },
      select: {
        id: true, type: true, title: true, message: true, attempts: true, maxAttempts: true,
        user: {
          select: {
            email: true, status: true,
            consents: { where: { type: "NOTIFICATION_EMAIL" }, orderBy: { capturedAt: "desc" }, take: 1, select: { granted: true } },
            notificationPreferences: { where: { type: candidate.type }, select: { emailEnabled: true } }
          }
        }
      }
    });
    if (!delivery) continue;

    if (!delivery.user.notificationPreferences[0]?.emailEnabled || !delivery.user.consents[0]?.granted) {
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: NotificationDeliveryStatus.CANCELLED, lockedAt: null, lastError: "Email preference or consent was withdrawn before delivery." }
      });
      continue;
    }

    try {
      if (delivery.user.status !== "ACTIVE") {
        throw new Error("Recipient account is inactive.");
      }
      const providerMessageId = await sendNotificationEmail({
        to: delivery.user.email,
        title: delivery.title,
        message: delivery.message,
        deliveryId: delivery.id
      });
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: NotificationDeliveryStatus.SENT, sentAt: now, lockedAt: null, providerMessageId, lastError: null }
      });
      sent += 1;
    } catch (error) {
      const exhausted = delivery.attempts >= delivery.maxAttempts;
      const delay = notificationRetryDelayMs(delivery.attempts);
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: exhausted ? NotificationDeliveryStatus.FAILED : NotificationDeliveryStatus.RETRY,
          nextAttemptAt: new Date(now.getTime() + delay),
          lockedAt: null,
          lastError: error instanceof Error ? error.message.slice(0, 500) : "Email delivery failed."
        }
      });
      if (exhausted) failed += 1;
      else retried += 1;
    }
  }
  return { inspected: candidates.length, sent, retried, failed };
}
