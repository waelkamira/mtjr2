import "server-only";

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

const minorAmount = z.string().regex(/^[1-9][0-9]{0,17}$/, "Amounts must be positive integer minor units.");

const journalSchema = z.object({
  idempotencyKey: z.string().trim().min(12).max(180),
  sourceType: z.string().trim().min(2).max(64),
  sourceId: z.string().trim().min(1).max(180),
  currencyCode: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  description: z.string().trim().min(3).max(500),
  occurredAt: z.coerce.date(),
  reversalOfId: z.string().trim().min(1).max(128).optional(),
  lines: z.array(z.object({
    accountId: z.string().trim().min(1).max(128),
    debitMinor: minorAmount.optional(),
    creditMinor: minorAmount.optional(),
    memo: z.string().trim().max(500).optional()
  }).strict().refine((line) => Boolean(line.debitMinor) !== Boolean(line.creditMinor), {
    message: "Each journal line must contain either a debit or a credit, never both."
  })).min(2).max(100)
}).strict();

type JournalInput = z.input<typeof journalSchema>;

function canonicalLines(lines: Array<{ accountId: string; debitMinor: bigint; creditMinor: bigint; memo: string | null }>) {
  return [...lines]
    .sort((a, b) => a.accountId.localeCompare(b.accountId) || a.debitMinor.toString().localeCompare(b.debitMinor.toString()) || a.creditMinor.toString().localeCompare(b.creditMinor.toString()))
    .map((line) => [line.accountId, line.debitMinor.toString(), line.creditMinor.toString(), line.memo ?? ""]);
}

/**
 * Posts a balanced, single-currency journal exactly once.
 * Journal entries and lines are database-enforced append-only; callers correct mistakes with reversals.
 * This primitive deliberately does not decide seller payable timing or account allocation policy.
 */
export async function postJournalEntry(input: JournalInput) {
  const data = journalSchema.parse(input);
  const lines = data.lines.map((line, index) => ({
    accountId: line.accountId,
    lineNumber: index + 1,
    debitMinor: line.debitMinor ? BigInt(line.debitMinor) : 0n,
    creditMinor: line.creditMinor ? BigInt(line.creditMinor) : 0n,
    memo: line.memo?.trim() || null
  }));
  const debitTotal = lines.reduce((sum, line) => sum + line.debitMinor, 0n);
  const creditTotal = lines.reduce((sum, line) => sum + line.creditMinor, 0n);
  if (debitTotal <= 0n || debitTotal !== creditTotal) {
    throw new Error("Journal entry is not balanced. Debit and credit totals must be equal and greater than zero.");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.journalEntry.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
      include: { lines: { orderBy: { lineNumber: "asc" } } }
    });
    if (existing) {
      const sameImmutableHeader = existing.sourceType === data.sourceType
        && existing.sourceId === data.sourceId
        && existing.currencyCode.trim() === data.currencyCode
        && existing.description === data.description
        && existing.occurredAt.getTime() === data.occurredAt.getTime()
        && (existing.reversalOfId ?? null) === (data.reversalOfId ?? null);
      const existingLines = canonicalLines(existing.lines);
      const requestedLines = canonicalLines(lines.map((line) => ({ ...line, memo: line.memo })));
      if (!sameImmutableHeader || JSON.stringify(existingLines) !== JSON.stringify(requestedLines)) {
        throw new Error("Idempotency key was already used for a different journal entry.");
      }
      return { id: existing.id, postedAt: existing.postedAt, alreadyPosted: true };
    }

    if (data.reversalOfId) {
      const original = await tx.journalEntry.findUnique({
        where: { id: data.reversalOfId },
        include: { lines: true }
      });
      if (!original || original.currencyCode.trim() !== data.currencyCode) {
        throw new Error("A reversal must reference an existing journal entry in the same currency.");
      }
      const expected = canonicalLines(original.lines.map((line) => ({
        accountId: line.accountId,
        debitMinor: line.creditMinor,
        creditMinor: line.debitMinor,
        memo: line.memo
      })));
      const actual = canonicalLines(lines.map((line) => ({ ...line, memo: line.memo })));
      if (JSON.stringify(expected) !== JSON.stringify(actual)) {
        throw new Error("A reversal must exactly negate every original journal line.");
      }
    }

    const accountIds = [...new Set(lines.map((line) => line.accountId))];
    const accounts = await tx.ledgerAccount.findMany({
      where: { id: { in: accountIds }, currencyCode: data.currencyCode, isActive: true },
      select: { id: true }
    });
    if (accounts.length !== accountIds.length) {
      throw new Error("Every journal account must exist, be active, and use the journal currency.");
    }

    const entry = await tx.journalEntry.create({
      data: {
        idempotencyKey: data.idempotencyKey,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        currencyCode: data.currencyCode,
        description: data.description,
        occurredAt: data.occurredAt,
        reversalOfId: data.reversalOfId,
        lines: { create: lines }
      },
      select: { id: true, postedAt: true }
    });
    return { ...entry, alreadyPosted: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Returns ledger activity for one account, without exposing mutable balance columns. */
export async function listLedgerAccountEntries(input: {
  accountId: string;
  take?: number;
  cursor?: string;
}) {
  const accountId = z.string().trim().min(1).max(128).parse(input.accountId);
  const take = z.number().int().min(1).max(100).default(50).parse(input.take);
  const cursor = input.cursor ? z.string().trim().min(1).max(128).parse(input.cursor) : undefined;
  const account = await prisma.ledgerAccount.findUnique({
    where: { id: accountId },
    select: { id: true, code: true, name: true, accountType: true, scopeType: true, scopeId: true, currencyCode: true, isActive: true, currency: { select: { minorUnit: true } } }
  });
  if (!account) throw new Error("Ledger account not found.");
  const totals = await prisma.journalLine.aggregate({
    where: { accountId },
    _sum: { debitMinor: true, creditMinor: true },
    _count: { _all: true }
  });
  const rows = await prisma.journalLine.findMany({
    where: { accountId },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ journalEntry: { postedAt: "desc" } }, { id: "desc" }],
    select: {
      id: true, lineNumber: true, debitMinor: true, creditMinor: true, memo: true,
      journalEntry: { select: { id: true, sourceType: true, sourceId: true, description: true, currencyCode: true, occurredAt: true, postedAt: true, reversalOfId: true } }
    }
  });
  const hasMore = rows.length > take;
  const items = rows.slice(0, take);
  return {
    account,
    totals: {
      debitMinor: (totals._sum.debitMinor ?? 0n).toString(),
      creditMinor: (totals._sum.creditMinor ?? 0n).toString(),
      lineCount: totals._count._all
    },
    items: items.map((line) => ({
      ...line,
      debitMinor: line.debitMinor.toString(),
      creditMinor: line.creditMinor.toString()
    })),
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null
  };
}


/** Lists ledger accounts for an authorized administrative read-only view. */
export async function listLedgerAccounts(input: {
  query?: string;
  currencyCode?: string;
  accountType?: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  isActive?: boolean;
  take?: number;
  cursor?: string;
}) {
  const schema = z.object({
    query: z.string().trim().max(120).optional(),
    currencyCode: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
    accountType: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]).optional(),
    isActive: z.boolean().optional(),
    take: z.number().int().min(1).max(100).default(100),
    cursor: z.string().trim().min(1).max(128).optional()
  }).strict();
  const data = schema.parse(input);
  const rows = await prisma.ledgerAccount.findMany({
    where: {
      ...(data.currencyCode ? { currencyCode: data.currencyCode } : {}),
      ...(data.accountType ? { accountType: data.accountType } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.query ? {
        OR: [
          { code: { contains: data.query, mode: "insensitive" } },
          { name: { contains: data.query, mode: "insensitive" } },
          { scopeId: { contains: data.query, mode: "insensitive" } }
        ]
      } : {})
    },
    take: data.take + 1,
    ...(data.cursor ? { cursor: { id: data.cursor }, skip: 1 } : {}),
    orderBy: [{ currencyCode: "asc" }, { code: "asc" }, { id: "asc" }],
    select: {
      id: true, code: true, name: true, accountType: true,
      scopeType: true, scopeId: true, currencyCode: true, isActive: true,
      currency: { select: { minorUnit: true } }
    }
  });
  const hasMore = rows.length > data.take;
  const items = rows.slice(0, data.take);
  return {
    items,
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null
  };
}
