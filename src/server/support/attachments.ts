import "server-only";

import { MessageAttachmentStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";
import { userHasPermission } from "@/server/identity/permission-repository";
import {
  createR2DownloadUrl, createR2UploadUrl, inspectR2Object, newAttachmentObjectKey,
  scanR2Object, validateAttachmentMetadata
} from "@/server/storage/r2";

const startSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024)
}).strict();
const idSchema = z.string().trim().min(1).max(128);

async function canManageTicket(userId: string, ticket: { customerId: string }, now: Date) {
  if (ticket.customerId === userId) return true;
  return userHasPermission(userId, { permissionKey: "support:manage", now });
}

export async function startSupportAttachmentUpload(ticketIdInput: string, input: unknown, now = new Date()) {
  const ticketId = idSchema.parse(ticketIdInput);
  const metadata = validateAttachmentMetadata(startSchema.parse(input));
  const actor = await requireCurrentSession(now);
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId }, select: { id: true, customerId: true, status: true } });
  if (!ticket || !(await canManageTicket(actor.userId, ticket, now))) throw new Error("Support ticket not found.");
  if (ticket.status === "CLOSED" || ticket.status === "RESOLVED") throw new Error("Attachments cannot be added to a closed ticket.");
  const objectKey = newAttachmentObjectKey("support", ticket.id);
  const attachment = await prisma.supportAttachment.create({
    data: { ticketId, uploadedById: actor.userId, objectKey, ...metadata },
    select: { id: true, fileName: true, contentType: true, sizeBytes: true, status: true }
  });
  return { attachment, upload: createR2UploadUrl(objectKey, metadata.contentType, now) };
}

export async function finalizeSupportAttachmentUpload(ticketIdInput: string, attachmentIdInput: string, now = new Date()) {
  const ticketId = idSchema.parse(ticketIdInput);
  const attachmentId = idSchema.parse(attachmentIdInput);
  const actor = await requireCurrentSession(now);
  const attachment = await prisma.supportAttachment.findFirst({
    where: { id: attachmentId, ticketId },
    select: { id: true, objectKey: true, contentType: true, sizeBytes: true, status: true, ticket: { select: { customerId: true } } }
  });
  if (!attachment || !(await canManageTicket(actor.userId, attachment.ticket, now))) throw new Error("Support attachment not found.");
  if (attachment.status !== MessageAttachmentStatus.PENDING_SCAN) throw new Error("Attachment has already been processed.");
  const stored = await inspectR2Object(attachment.objectKey);
  if (stored.sizeBytes !== attachment.sizeBytes || stored.contentType !== attachment.contentType) {
    await prisma.supportAttachment.update({ where: { id: attachment.id }, data: { status: MessageAttachmentStatus.REJECTED, scanError: "Uploaded metadata did not match the declared file." } });
    throw new Error("Uploaded file metadata did not match the declared file.");
  }
  const clean = await scanR2Object(attachment.objectKey, { contentType: stored.contentType, sizeBytes: stored.sizeBytes });
  const updated = await prisma.supportAttachment.update({
    where: { id: attachment.id },
    data: { status: clean ? MessageAttachmentStatus.CLEAN : MessageAttachmentStatus.REJECTED, scannedAt: now, scanError: clean ? null : "Malware scanner rejected this file." },
    select: { id: true, fileName: true, contentType: true, sizeBytes: true, status: true }
  });
  if (!clean) throw new Error("The attachment was rejected by the malware scanner.");
  return { attachment: updated, download: createR2DownloadUrl(attachment.objectKey, now) };
}
