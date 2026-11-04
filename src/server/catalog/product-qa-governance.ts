import "server-only";

import { AuditActorType, ProductAnswerStatus, ProductQuestionReportStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";
import { requirePermission } from "@/server/identity/permission-guard";

const reportSchema = z.object({
  answerId: z.string().trim().min(1).optional(),
  reason: z.enum(["SPAM", "HARASSMENT", "PERSONAL_INFO", "MISLEADING", "OTHER"]),
  details: z.string().trim().max(1000).optional()
}).strict();

export async function reportProductQuestion(questionId: string, input: unknown, now = new Date()) {
  const id = z.string().trim().min(1).parse(questionId);
  const data = reportSchema.parse(input);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    const question = await tx.productQuestion.findFirst({
      where: { id, status: "PUBLISHED" },
      select: { id: true, product: { select: { storeId: true } } }
    });
    if (!question) throw new Error("Published question not found.");
    if (data.answerId) {
      const answer = await tx.productAnswer.findFirst({
        where: { id: data.answerId, questionId: id, status: ProductAnswerStatus.PUBLISHED },
        select: { id: true }
      });
      if (!answer) throw new Error("Published answer not found for this question.");
    }
    const report = await tx.productQuestionReport.create({
      data: { questionId: id, answerId: data.answerId, reporterId: actor.userId, reason: data.reason, details: data.details || null },
      select: { id: true, status: true, createdAt: true }
    });
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId, action: "product.qa.reported",
      resource: "product_question_report", resourceId: report.id, scopeType: "STORE",
      scopeId: question.product.storeId, occurredAt: now, metadata: { questionId: id, answerId: data.answerId ?? null, reason: data.reason }
    }});
    return { ...report, createdAt: report.createdAt.toISOString() };
  });
}

export async function listProductQaReports(now = new Date()) {
  await requirePermission({ permissionKey: "users:manage", now });
  const items = await prisma.productQuestionReport.findMany({
    where: { status: ProductQuestionReportStatus.OPEN },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 100,
    select: {
      id: true, reason: true, details: true, createdAt: true,
      question: { select: { id: true, question: true, product: { select: { id: true, name: true } } } },
      answer: { select: { id: true, body: true } },
      reporter: { select: { displayName: true, email: true } }
    }
  });
  return items.map((item) => ({
    ...item, createdAt: item.createdAt.toISOString(),
    reporter: item.reporter.displayName || item.reporter.email
  }));
}

export async function moderateProductQaReport(reportId: string, decision: "REVIEW" | "DISMISS", reason?: string, now = new Date()) {
  const id = z.string().trim().min(1).parse(reportId);
  const actor = await requirePermission({ permissionKey: "users:manage", now });
  return prisma.$transaction(async (tx) => {
    const report = await tx.productQuestionReport.findUnique({
      where: { id }, select: { id: true, status: true, question: { select: { product: { select: { storeId: true } } } } }
    });
    if (!report) throw new Error("Report not found.");
    if (report.status !== ProductQuestionReportStatus.OPEN) throw new Error("Report has already been reviewed.");
    const status = decision === "REVIEW" ? ProductQuestionReportStatus.REVIEWED : ProductQuestionReportStatus.DISMISSED;
    const changed = await tx.productQuestionReport.updateMany({
      where: { id, status: ProductQuestionReportStatus.OPEN },
      data: { status, reviewedAt: now, reviewedBy: actor.userId }
    });
    if (changed.count !== 1) throw new Error("Report has already been reviewed.");
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId, action: `product.qa.report.${decision.toLowerCase()}`,
      resource: "product_question_report", resourceId: id, scopeType: "STORE",
      scopeId: report.question.product.storeId, occurredAt: now,
      metadata: { previousStatus: report.status, status, reason: reason?.trim().slice(0, 500) ?? null }
    }});
    return { id, status };
  });
}

export async function editSellerProductAnswer(answerId: string, body: unknown, now = new Date()) {
  const id = z.string().trim().min(1).parse(answerId);
  const data = z.object({ body: z.string().trim().min(3).max(4000) }).strict().parse(body);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    const answer = await tx.productAnswer.findFirst({
      where: { id, userId: actor.userId, question: { status: "PUBLISHED", product: { store: { status: "ACTIVE", seller: { status: "ACTIVE" } } } } },
      select: { id: true, body: true, status: true, question: { select: { product: { select: { storeId: true } } } } }
    });
    if (!answer) throw new Error("Only your own answer to an active store question can be edited.");
    await tx.productAnswerRevision.create({ data: { answerId: id, editorId: actor.userId, body: answer.body } });
    const updated = await tx.productAnswer.update({
      where: { id },
      data: { body: data.body, status: ProductAnswerStatus.PENDING, moderatedAt: null, moderatedBy: null },
      select: { id: true, body: true, status: true, updatedAt: true }
    });
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId, action: "product.answer.edited",
      resource: "product_answer", resourceId: id, scopeType: "STORE",
      scopeId: answer.question.product.storeId, occurredAt: now,
      metadata: { previousStatus: answer.status, status: updated.status, revisionStored: true }
    }});
    return { ...updated, updatedAt: updated.updatedAt.toISOString() };
  });
}

export async function listSellerAnswerHistory(answerId: string, now = new Date()) {
  const id = z.string().trim().min(1).parse(answerId);
  const actor = await requireCurrentSession(now);
  const answer = await prisma.productAnswer.findFirst({
    where: { id, userId: actor.userId },
    select: { id: true, body: true, revisions: { orderBy: { createdAt: "desc" }, take: 20, select: { id: true, body: true, createdAt: true } } }
  });
  if (!answer) throw new Error("Answer not found.");
  return { current: answer.body, revisions: answer.revisions.map((revision) => ({ ...revision, createdAt: revision.createdAt.toISOString() })) };
}
