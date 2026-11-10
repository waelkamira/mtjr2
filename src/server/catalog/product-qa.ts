import "server-only";

import { AuditActorType, ProductAnswerStatus, ProductQuestionStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";
import { requirePermission } from "@/server/identity/permission-guard";

const questionSchema = z.object({ question: z.string().trim().min(10).max(2000) }).strict();
const answerSchema = z.object({ body: z.string().trim().min(3).max(4000) }).strict();
const idSchema = z.string().trim().min(1);

export async function listPublicProductQuestions(productId: string) {
  const id = idSchema.parse(productId);
  const product = await prisma.product.findFirst({
    where: { id, status: "ACTIVE", approvalStatus: "APPROVED", store: { status: "ACTIVE", seller: { status: "ACTIVE" } } },
    select: { id: true }
  });
  if (!product) throw new Error("Product not found.");
  const items = await prisma.productQuestion.findMany({
    where: { productId: id, status: ProductQuestionStatus.PUBLISHED },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50,
    select: {
      id: true, question: true, createdAt: true,
      user: { select: { displayName: true } },
      answers: {
        where: { status: ProductAnswerStatus.PUBLISHED },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, body: true, createdAt: true, user: { select: { displayName: true } } }
      }
    }
  });
  return items.map((item) => ({
    id: item.id, question: item.question, createdAt: item.createdAt.toISOString(),
    author: item.user.displayName || "Customer",
    answers: item.answers.map((answer) => ({
      id: answer.id, body: answer.body, createdAt: answer.createdAt.toISOString(),
      author: answer.user.displayName || "Store"
    }))
  }));
}

export async function createProductQuestion(productId: string, input: unknown, now = new Date()) {
  const id = idSchema.parse(productId);
  const data = questionSchema.parse(input);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id, status: "ACTIVE", approvalStatus: "APPROVED", store: { status: "ACTIVE", seller: { status: "ACTIVE" } } },
      select: { id: true, name: true, store: { select: { id: true, seller: { select: { ownerId: true } } } } }
    });
    if (!product) throw new Error("Product not found.");
    const question = await tx.productQuestion.create({
      data: { productId: id, userId: actor.userId, question: data.question, status: ProductQuestionStatus.PENDING },
      select: { id: true, question: true, status: true, createdAt: true }
    });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId, action: "product.question.submitted",
        resource: "product_question", resourceId: question.id, scopeType: "STORE", scopeId: product.store.id,
        occurredAt: now, metadata: { productId: id }
      }
    });
    return { ...question, createdAt: question.createdAt.toISOString() };
  });
}

export async function listMyProductQuestions(now = new Date()) {
  const actor = await requireCurrentSession(now);
  const items = await prisma.productQuestion.findMany({
    where: { userId: actor.userId }, orderBy: { createdAt: "desc" }, take: 100,
    select: {
      id: true, question: true, status: true, createdAt: true,
      product: { select: { id: true, name: true, slug: true } },
      answers: { orderBy: { createdAt: "asc" }, select: { id: true, body: true, status: true, createdAt: true, user: { select: { displayName: true } } } }
    }
  });
  return items.map((item) => ({
    ...item, createdAt: item.createdAt.toISOString(),
    answers: item.answers.map((answer) => ({ ...answer, createdAt: answer.createdAt.toISOString(), author: answer.user.displayName || "Store" }))
  }));
}

export async function listSellerProductQuestions(now = new Date()) {
  const actor = await requireCurrentSession(now);
  return prisma.productQuestion.findMany({
    where: { product: { store: { seller: { ownerId: actor.userId, status: "ACTIVE" }, status: "ACTIVE" } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100,
    select: {
      id: true, question: true, status: true, createdAt: true,
      product: { select: { id: true, name: true, slug: true, store: { select: { id: true, name: true } } } },
      user: { select: { displayName: true } },
      answers: { orderBy: { createdAt: "desc" }, take: 5, select: { id: true, body: true, status: true, createdAt: true } }
    }
  }).then((items) => items.map((item) => ({
    ...item, createdAt: item.createdAt.toISOString(),
    author: item.user.displayName || "Customer",
    answers: item.answers.map((answer) => ({ ...answer, createdAt: answer.createdAt.toISOString() }))
  })));
}

export async function createSellerProductAnswer(questionId: string, input: unknown, now = new Date()) {
  const id = idSchema.parse(questionId);
  const data = answerSchema.parse(input);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    const question = await tx.productQuestion.findFirst({
      where: {
        id, status: ProductQuestionStatus.PUBLISHED,
        product: { status: "ACTIVE", approvalStatus: "APPROVED", store: { status: "ACTIVE", seller: { ownerId: actor.userId, status: "ACTIVE" } } }
      },
      select: { id: true, productId: true, product: { select: { storeId: true } } }
    });
    if (!question) throw new Error("Published question not found for your active store.");
    const answer = await tx.productAnswer.create({
      data: { questionId: id, userId: actor.userId, body: data.body, status: ProductAnswerStatus.PENDING },
      select: { id: true, body: true, status: true, createdAt: true }
    });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId, action: "product.answer.submitted",
        resource: "product_answer", resourceId: answer.id, scopeType: "STORE", scopeId: question.product.storeId,
        occurredAt: now, metadata: { questionId: id, productId: question.productId }
      }
    });
    return { ...answer, createdAt: answer.createdAt.toISOString() };
  });
}

export async function listPendingProductQa(now = new Date()) {
  await requirePermission({ permissionKey: "users:manage", now });
  const [questions, answers] = await Promise.all([
    prisma.productQuestion.findMany({
      where: { status: ProductQuestionStatus.PENDING }, orderBy: { createdAt: "asc" }, take: 100,
      select: { id: true, question: true, createdAt: true, product: { select: { id: true, name: true, slug: true } }, user: { select: { displayName: true, email: true } } }
    }),
    prisma.productAnswer.findMany({
      where: { status: ProductAnswerStatus.PENDING }, orderBy: { createdAt: "asc" }, take: 100,
      select: { id: true, body: true, createdAt: true, question: { select: { id: true, question: true, product: { select: { id: true, name: true, slug: true } } } }, user: { select: { displayName: true, email: true } } }
    })
  ]);
  return {
    questions: questions.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), author: item.user.displayName || item.user.email })),
    answers: answers.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), author: item.user.displayName || item.user.email }))
  };
}

export async function moderateProductQa(type: "QUESTION" | "ANSWER", itemId: string, decision: "PUBLISH" | "REJECT" | "HIDE", reason?: string, now = new Date()) {
  const id = idSchema.parse(itemId);
  const actor = await requirePermission({ permissionKey: "users:manage", now });
  return prisma.$transaction(async (tx) => {
    if (type === "QUESTION") {
      const item = await tx.productQuestion.findUnique({
        where: { id }, select: { id: true, productId: true, userId: true, status: true, product: { select: { storeId: true, store: { select: { seller: { select: { ownerId: true } } } } } } }
      });
      if (!item) throw new Error("Product question not found.");
      if (item.status !== ProductQuestionStatus.PENDING && decision !== "HIDE") throw new Error("Only pending questions can be published or rejected.");
      const status = decision === "PUBLISH" ? ProductQuestionStatus.PUBLISHED : decision === "REJECT" ? ProductQuestionStatus.REJECTED : ProductQuestionStatus.HIDDEN;
      const changed = await tx.productQuestion.updateMany({ where: { id, status: item.status }, data: { status, moderatedAt: now, moderatedBy: actor.userId } });
      if (changed.count !== 1) throw new Error("Question was already moderated.");
      if (decision === "PUBLISH") {
        await tx.notification.create({ data: {
          userId: item.product.store.seller.ownerId, type: "PRODUCT_QUESTION",
          title: "A product question is published", message: "A customer has asked a question about one of your products.",
          resourceType: "product_question", resourceId: id, deduplicationKey: `product-question-published:${id}`
        } });
      }
      await tx.auditLog.create({ data: {
        actorType: AuditActorType.USER, actorId: actor.userId, action: `product.question.${decision.toLowerCase()}`,
        resource: "product_question", resourceId: id, scopeType: "STORE", scopeId: item.product.storeId,
        occurredAt: now, metadata: { previousStatus: item.status, status, reason: reason?.trim().slice(0, 500) ?? null }
      } });
      return { id, type, status };
    }
    const item = await tx.productAnswer.findUnique({
      where: { id }, select: { id: true, questionId: true, status: true, question: { select: { userId: true, product: { select: { storeId: true } } } } }
    });
    if (!item) throw new Error("Product answer not found.");
    if (item.status !== ProductAnswerStatus.PENDING && decision !== "HIDE") throw new Error("Only pending answers can be published or rejected.");
    const status = decision === "PUBLISH" ? ProductAnswerStatus.PUBLISHED : decision === "REJECT" ? ProductAnswerStatus.REJECTED : ProductAnswerStatus.HIDDEN;
    const changed = await tx.productAnswer.updateMany({ where: { id, status: item.status }, data: { status, moderatedAt: now, moderatedBy: actor.userId } });
    if (changed.count !== 1) throw new Error("Answer was already moderated.");
    if (decision === "PUBLISH") {
      await tx.notification.create({ data: {
        userId: item.question.userId, type: "PRODUCT_ANSWER",
        title: "Your product question has been answered", message: "A store has answered your product question.",
        resourceType: "product_question", resourceId: item.questionId, deduplicationKey: `product-answer-published:${id}`
      } });
    }
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId, action: `product.answer.${decision.toLowerCase()}`,
      resource: "product_answer", resourceId: id, scopeType: "STORE", scopeId: item.question.product.storeId,
      occurredAt: now, metadata: { previousStatus: item.status, status, reason: reason?.trim().slice(0, 500) ?? null }
    } });
    return { id, type, status };
  });
}
