import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { postJournalEntry } from "@/server/finance/ledger";

const suffix = randomUUID().replaceAll("-", "").slice(0, 16);
const currencyCode = "EUR";

describe("ledger PostgreSQL integrity", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects journal-line inserts after the original posting transaction commits", async () => {
    await prisma.currency.findUniqueOrThrow({ where: { code: currencyCode } });
    const debitAccount = await prisma.ledgerAccount.create({
      data: {
        code: `TEST-CASH-${suffix}`,
        name: "Integration test cash",
        accountType: "ASSET",
        currencyCode
      }
    });
    const creditAccount = await prisma.ledgerAccount.create({
      data: {
        code: `TEST-REVENUE-${suffix}`,
        name: "Integration test revenue",
        accountType: "REVENUE",
        currencyCode
      }
    });

    const posted = await postJournalEntry({
      idempotencyKey: `ledger-test:${suffix}:capture`,
      sourceType: "INTEGRATION_TEST",
      sourceId: suffix,
      currencyCode,
      description: "Journal append-only integration test",
      occurredAt: new Date(),
      lines: [
        { accountId: debitAccount.id, debitMinor: "1000" },
        { accountId: creditAccount.id, creditMinor: "1000" }
      ]
    });

    await expect(prisma.journalLine.create({
      data: {
        journalEntryId: posted.id,
        accountId: debitAccount.id,
        lineNumber: 3,
        debitMinor: 100n
      }
    })).rejects.toThrow(/only be inserted in the transaction that creates/i);

    await expect(prisma.journalLine.count({
      where: { journalEntryId: posted.id }
    })).resolves.toBe(2);
  });

  it("rejects direct posting against an inactive account at database commit", async () => {
    await prisma.currency.findUniqueOrThrow({ where: { code: currencyCode } });
    const inactiveAccount = await prisma.ledgerAccount.create({
      data: {
        code: `TEST-INACTIVE-${suffix}`,
        name: "Integration test inactive account",
        accountType: "ASSET",
        currencyCode,
        isActive: false
      }
    });
    const activeAccount = await prisma.ledgerAccount.create({
      data: {
        code: `TEST-ACTIVE-${suffix}`,
        name: "Integration test active account",
        accountType: "REVENUE",
        currencyCode
      }
    });

    await expect(prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          idempotencyKey: `ledger-test:${suffix}:inactive`,
          sourceType: "INTEGRATION_TEST",
          sourceId: suffix,
          currencyCode,
          description: "Inactive account database guard",
          occurredAt: new Date()
        }
      });
      await tx.journalLine.createMany({
        data: [
          { journalEntryId: entry.id, accountId: inactiveAccount.id, lineNumber: 1, debitMinor: 500n },
          { journalEntryId: entry.id, accountId: activeAccount.id, lineNumber: 2, creditMinor: 500n }
        ]
      });
    })).rejects.toThrow(/active same-currency accounts/i);
  });
});
