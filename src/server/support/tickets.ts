import "server-only";

import { randomBytes } from "node:crypto";
import { AuditActorType, SupportTicketPriority, SupportTicketStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";
import { requirePermission } from "@/server/identity/permission-guard";

const idSchema = z.string().trim().min(1).max(128);
const createSchema = z.object({
  subject: z.string().trim().min(5).max(180),
  category: z.enum(["GENERAL", "ORDER", "PAYMENT", "DELIVERY", "ACCOUNT", "SELLER"]),
  message: z.string().trim().min(2).max(8000)
}).strict();
const replySchema = z.object({ body: z.string().trim().min(2).max(8000), internal: z.boolean().optional() }).strict();
const updateSchema = z.object({
  status: z.nativeEnum(SupportTicketStatus).optional(),
  priority: z.nativeEnum(SupportTicketPriority).optional(),
  assignToMe: z.boolean().optional()
}).strict().refine((value) => Object.keys(value).length > 0);

const ticketSelect = {
  id: true, ticketNumber: true, subject: true, category: true, status: true, priority: true,
  assignedToId: true, lastMessageAt: true, createdAt: true, updatedAt: true, resolvedAt: true, closedAt: true,
  customerReadAt: true, agentReadAt: true, firstResponseAt: true
} as const;

function serializeTicket<T extends { lastMessageAt: Date; createdAt: Date; updatedAt: Date; resolvedAt: Date | null; closedAt: Date | null }>(ticket: T) {
  return { ...ticket, lastMessageAt: ticket.lastMessageAt.toISOString(), createdAt: ticket.createdAt.toISOString(), updatedAt: ticket.updatedAt.toISOString(), resolvedAt: ticket.resolvedAt?.toISOString() ?? null, closedAt: ticket.closedAt?.toISOString() ?? null,
    customerReadAt: ticket.customerReadAt?.toISOString() ?? null, agentReadAt: ticket.agentReadAt?.toISOString() ?? null, firstResponseAt: ticket.firstResponseAt?.toISOString() ?? null };
}

export async function createSupportTicket(input: unknown, now = new Date()) {
  const data = createSchema.parse(input);
  const actor = await requireCurrentSession(now);
  const ticketNumber = `SUP-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(4).toString("hex").toUpperCase()}`;
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.create({
      data: {
        ticketNumber, customerId: actor.userId, subject: data.subject, category: data.category,
        status: SupportTicketStatus.OPEN, priority: SupportTicketPriority.NORMAL, lastMessageAt: now, customerReadAt: now,
        messages: { create: { senderId: actor.userId, body: data.message } }
      },
      select: ticketSelect
    });
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId, action: "support.ticket.created",
      resource: "support_ticket", resourceId: ticket.id, occurredAt: now,
      metadata: { ticketNumber, category: data.category }
    } });
    return serializeTicket(ticket);
  });
}

export async function listMySupportTickets(now = new Date()) {
  const actor = await requireCurrentSession(now);
  const items = await prisma.supportTicket.findMany({
    where: { customerId: actor.userId }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 100,
    select: { ...ticketSelect, _count: { select: { messages: true } } }
  });
  return items.map((item) => ({ ...serializeTicket(item), messageCount: item._count.messages }));
}

export async function getMySupportTicket(ticketId: string, now = new Date()) {
  const id = idSchema.parse(ticketId);
  const actor = await requireCurrentSession(now);
  const ticket = await prisma.supportTicket.findFirst({
    where: { id, customerId: actor.userId },
    select: { ...ticketSelect, messages: { where: { isInternal: false }, orderBy: { createdAt: "asc" }, take: 200, select: { id: true, body: true, createdAt: true, senderId: true, sender: { select: { displayName: true } } } } }
  });
  if (!ticket) throw new Error("Support ticket not found.");
  await prisma.supportTicket.updateMany({ where: { id, customerId: actor.userId }, data: { customerReadAt: now } });
  return { ...serializeTicket(ticket), messages: ticket.messages.map((message) => ({ id: message.id, body: message.body, createdAt: message.createdAt.toISOString(), senderId: message.senderId, author: message.sender.displayName || "Support" })) };
}

export async function replyToMySupportTicket(ticketId: string, input: unknown, now = new Date()) {
  const id = idSchema.parse(ticketId);
  const data = replySchema.parse(input);
  if (data.internal) throw new Error("Customers cannot create internal notes.");
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.findFirst({ where: { id, customerId: actor.userId }, select: { id: true, status: true } });
    if (!ticket) throw new Error("Support ticket not found.");
    if (ticket.status === SupportTicketStatus.CLOSED || ticket.status === SupportTicketStatus.RESOLVED) throw new Error("This ticket is closed. Open a new ticket for further help.");
    const message = await tx.supportMessage.create({ data: { ticketId: id, senderId: actor.userId, body: data.body }, select: { id: true, body: true, createdAt: true } });
    await tx.supportTicket.update({ where: { id }, data: { status: SupportTicketStatus.OPEN, lastMessageAt: now, customerReadAt: now } });
    await tx.auditLog.create({ data: { actorType: AuditActorType.USER, actorId: actor.userId, action: "support.ticket.customer_replied", resource: "support_ticket", resourceId: id, occurredAt: now } });
    return { ...message, createdAt: message.createdAt.toISOString() };
  });
}

export async function listSupportQueue(now = new Date()) {
  await requirePermission({ permissionKey: "users:manage", now });
  const items = await prisma.supportTicket.findMany({
    orderBy: [{ priority: "desc" }, { lastMessageAt: "asc" }, { id: "asc" }], take: 200,
    select: { ...ticketSelect, customer: { select: { displayName: true, email: true } }, assignedTo: { select: { displayName: true, email: true } }, _count: { select: { messages: true } } }
  });
  return items.map((item) => ({ ...serializeTicket(item), customer: item.customer.displayName || item.customer.email, assignee: item.assignedTo?.displayName || item.assignedTo?.email || null, messageCount: item._count.messages }));
}

export async function getAdminSupportTicket(ticketId: string, now = new Date()) {
  const id = idSchema.parse(ticketId);
  await requirePermission({ permissionKey: "users:manage", now });
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: { ...ticketSelect, customer: { select: { id: true, displayName: true, email: true } }, messages: { orderBy: { createdAt: "asc" }, take: 300, select: { id: true, body: true, isInternal: true, createdAt: true, senderId: true, sender: { select: { displayName: true, email: true } } } } }
  });
  if (!ticket) throw new Error("Support ticket not found.");
  await prisma.supportTicket.updateMany({ where: { id }, data: { agentReadAt: now } });
  return { ...serializeTicket(ticket), customer: ticket.customer, messages: ticket.messages.map((message) => ({ id: message.id, body: message.body, internal: message.isInternal, createdAt: message.createdAt.toISOString(), senderId: message.senderId, author: message.sender.displayName || message.sender.email })) };
}

export async function adminReplyToSupportTicket(ticketId: string, input: unknown, now = new Date()) {
  const id = idSchema.parse(ticketId);
  const data = replySchema.parse(input);
  const actor = await requirePermission({ permissionKey: "users:manage", now });
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.findUnique({ where: { id }, select: { id: true, customerId: true, status: true } });
    if (!ticket) throw new Error("Support ticket not found.");
    if (ticket.status === SupportTicketStatus.CLOSED) throw new Error("Closed tickets cannot receive replies.");
    const message = await tx.supportMessage.create({ data: { ticketId: id, senderId: actor.userId, body: data.body, isInternal: data.internal ?? false }, select: { id: true, body: true, isInternal: true, createdAt: true } });
    await tx.supportTicket.update({ where: { id }, data: { status: data.internal ? ticket.status : SupportTicketStatus.WAITING_CUSTOMER, lastMessageAt: now, agentReadAt: now, ...(!data.internal && !ticket.status ? { firstResponseAt: now } : {}) } });
    if (!data.internal) await tx.notification.create({ data: {
      userId: ticket.customerId, type: "SUPPORT_REPLY", title: "Support replied to your ticket",
      message: "There is a new response to your support request.", resourceType: "support_ticket",
      resourceId: id, deduplicationKey: `support-reply:${message.id}`
    } });
    await tx.auditLog.create({ data: { actorType: AuditActorType.USER, actorId: actor.userId, action: data.internal ? "support.ticket.internal_note" : "support.ticket.agent_replied", resource: "support_ticket", resourceId: id, occurredAt: now } });
    return { ...message, createdAt: message.createdAt.toISOString() };
  });
}

export async function updateSupportTicket(ticketId: string, input: unknown, now = new Date()) {
  const id = idSchema.parse(ticketId);
  const data = updateSchema.parse(input);
  const actor = await requirePermission({ permissionKey: "users:manage", now });
  return prisma.$transaction(async (tx) => {
    const current = await tx.supportTicket.findUnique({ where: { id }, select: { id: true, status: true, priority: true, assignedToId: true } });
    if (!current) throw new Error("Support ticket not found.");
    const status = data.status ?? current.status;
    const assignedToId = data.assignToMe ? actor.userId : current.assignedToId;
    const changed = await tx.supportTicket.updateMany({
      where: { id, status: current.status, priority: current.priority, assignedToId: current.assignedToId },
      data: {
        ...(data.status ? { status, resolvedAt: status === SupportTicketStatus.RESOLVED ? now : status === SupportTicketStatus.CLOSED ? current.status === SupportTicketStatus.RESOLVED ? now : null : null, closedAt: status === SupportTicketStatus.CLOSED ? now : null } : {}),
        ...(data.priority ? { priority: data.priority } : {}),
        ...(data.assignToMe ? { assignedToId } : {})
      }
    });
    if (changed.count !== 1) throw new Error("Ticket changed concurrently. Refresh and retry.");
    await tx.auditLog.create({ data: { actorType: AuditActorType.USER, actorId: actor.userId, action: "support.ticket.updated", resource: "support_ticket", resourceId: id, occurredAt: now, metadata: { previousStatus: current.status, status, priority: data.priority ?? current.priority, assignedToId } } });
    return { id, status, priority: data.priority ?? current.priority, assignedToId };
  });
}
