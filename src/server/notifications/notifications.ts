import "server-only";

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";

const preferenceDefinitions = [
  { type: "ORDER_PLACED", label: "Order updates", description: "Confirmation when your order is placed." },
  { type: "SELLER_ORDER_RECEIVED", label: "Seller order alerts", description: "New orders received by your store." },
  { type: "STORE_MESSAGE", label: "Store messages", description: "New messages in customer and seller conversations." },
  { type: "SUPPORT_REPLY", label: "Support replies", description: "Responses from the customer support team." },
  { type: "SUPPORT_SLA_ESCALATION", label: "Support SLA escalations", description: "Alerts when an assigned ticket breaches its response or resolution target." },
  { type: "PAYMENT_CONFIRMED", label: "Payment confirmations", description: "Confirmation when an order payment succeeds." },
  { type: "PAYMENT_FAILED", label: "Payment problems", description: "Updates when an order payment fails." },
  { type: "SHIPMENT_UPDATED", label: "Delivery updates", description: "Shipment and delivery progress when carrier tracking is connected." },
  { type: "ACCOUNT_SECURITY", label: "Account security", description: "Important account and sign-in security events." }
] as const;

const preferenceType = z.enum([
  "ORDER_PLACED", "SELLER_ORDER_RECEIVED", "STORE_MESSAGE", "SUPPORT_REPLY",
  "SUPPORT_SLA_ESCALATION", "PAYMENT_CONFIRMED", "PAYMENT_FAILED",
  "SHIPMENT_UPDATED", "ACCOUNT_SECURITY"
]);
const preferenceUpdateSchema = z.object({
  preferences: z.array(z.object({
    type: preferenceType,
    inAppEnabled: z.boolean(),
    emailEnabled: z.boolean()
  }).strict()).length(preferenceDefinitions.length)
    .refine((items) => new Set(items.map((item) => item.type)).size === preferenceDefinitions.length, "Each notification type must appear exactly once.")
}).strict();

export async function createInAppNotification(tx: Prisma.TransactionClient, input: { data: Prisma.NotificationUncheckedCreateInput }) {
  const data = input.data;
  const preference = await tx.notificationPreference.findUnique({
    where: { userId_type: { userId: data.userId, type: data.type } },
    select: { inAppEnabled: true, emailEnabled: true }
  });
  const inAppEnabled = preference?.inAppEnabled ?? true;
  const emailEnabled = preference?.emailEnabled ?? false;
  const user = emailEnabled
    ? await tx.user.findFirst({ where: { id: data.userId, status: "ACTIVE", emailVerifiedAt: { not: null } }, select: { id: true } })
    : null;
  const emailConsent = emailEnabled
    ? await tx.userConsent.findFirst({ where: { userId: data.userId, type: "NOTIFICATION_EMAIL" }, orderBy: { capturedAt: "desc" }, select: { granted: true } })
    : null;

  let notification: { id: string } | null = null;
  if (inAppEnabled) {
    notification = await tx.notification.create({ data, select: { id: true } });
  }
  if (emailEnabled && user && emailConsent?.granted) {
    await tx.notificationDelivery.createMany({
      data: [{
        userId: data.userId,
        notificationId: notification?.id ?? null,
        type: data.type,
        title: data.title,
        message: data.message,
        resourceType: data.resourceType ?? null,
        resourceId: data.resourceId ?? null,
        deduplicationKey: `email:${data.deduplicationKey}`
      }],
      skipDuplicates: true
    });
  }
  return notification;
}

export async function getMyNotificationPreferences(now = new Date()) {
  const session = await requireCurrentSession(now);
  const saved = await prisma.notificationPreference.findMany({
    where: { userId: session.userId },
    select: { type: true, inAppEnabled: true, emailEnabled: true }
  });
  const byType = new Map(saved.map((item) => [item.type, item]));
  return preferenceDefinitions.map((item) => ({
    ...item,
    inAppEnabled: byType.get(item.type)?.inAppEnabled ?? true,
    emailEnabled: byType.get(item.type)?.emailEnabled ?? false
  }));
}

export async function updateMyNotificationPreferences(input: unknown, now = new Date()) {
  const session = await requireCurrentSession(now);
  const data = preferenceUpdateSchema.parse(input);
  await prisma.$transaction(async (tx) => {
    await Promise.all(data.preferences.map((item) => tx.notificationPreference.upsert({
      where: { userId_type: { userId: session.userId, type: item.type } },
      create: { userId: session.userId, type: item.type, inAppEnabled: item.inAppEnabled, emailEnabled: item.emailEnabled },
      update: { inAppEnabled: item.inAppEnabled, emailEnabled: item.emailEnabled }
    })));
    await tx.userConsent.create({
      data: {
        userId: session.userId,
        type: "NOTIFICATION_EMAIL",
        version: "notification-email-v1",
        granted: data.preferences.some((item) => item.emailEnabled),
        source: "notification-preferences",
        capturedAt: now
      }
    });
  });
  return getMyNotificationPreferences(now);
}

export async function listMyNotifications(now = new Date()) {
  const session = await requireCurrentSession(now);
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, type: true, title: true, message: true, resourceType: true, resourceId: true, readAt: true, createdAt: true, deliveries: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, attempts: true, sentAt: true, lastError: true } } }
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
