import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  journalFindUnique: vi.fn(),
  journalCreate: vi.fn(),
  accountFindMany: vi.fn(),
  ledgerAccountFindMany: vi.fn(),
  ledgerAccountFindUnique: vi.fn(),
  journalLineFindMany: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    ledgerAccount: { findMany: mocks.ledgerAccountFindMany, findUnique: mocks.ledgerAccountFindUnique },
    journalLine: { findMany: mocks.journalLineFindMany }
  }
}));

import { listLedgerAccounts, postJournalEntry } from "@/server/finance/ledger";

const occurredAt = new Date("2026-11-12T10:00:00.000Z");
const baseInput = {
  idempotencyKey: "payment-capture:payment-123",
  sourceType: "PAYMENT_CAPTURE",
  sourceId: "payment-123",
  currencyCode: "EUR",
  description: "Captured payment",
  occurredAt,
  lines: [
    { accountId: "cash-eur", debitMinor: "12500", memo: "Provider clearing" },
    { accountId: "sales-eur", creditMinor: "12500", memo: "Gross sales" }
  ]
};

function existingEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "journal-1",
    postedAt: new Date("2026-11-12T10:01:00.000Z"),
    sourceType: baseInput.sourceType,
    sourceId: baseInput.sourceId,
    currencyCode: "EUR",
    description: baseInput.description,
    occurredAt,
    reversalOfId: null,
    lines: [
      { accountId: "cash-eur", debitMinor: 12500n, creditMinor: 0n, memo: "Provider clearing" },
      { accountId: "sales-eur", debitMinor: 0n, creditMinor: 12500n, memo: "Gross sales" }
    ],
    ...overrides
  };
}

describe("double-entry journal posting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.journalFindUnique.mockResolvedValue(null);
    mocks.journalCreate.mockResolvedValue({
      id: "journal-new",
      postedAt: new Date("2026-11-12T10:02:00.000Z")
    });
    mocks.accountFindMany.mockResolvedValue([{ id: "cash-eur" }, { id: "sales-eur" }]);
    mocks.ledgerAccountFindMany.mockResolvedValue([]);
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      journalEntry: {
        findUnique: mocks.journalFindUnique,
        create: mocks.journalCreate
      },
      ledgerAccount: { findMany: mocks.accountFindMany }
    }));
  });

  it("posts balanced same-currency lines in a serializable transaction", async () => {
    const result = await postJournalEntry(baseInput);

    expect(result.alreadyPosted).toBe(false);
    expect(result.id).toBe("journal-new");
    expect(mocks.accountFindMany).toHaveBeenCalledWith({
      where: { id: { in: ["cash-eur", "sales-eur"] }, currencyCode: "EUR", isActive: true },
      select: { id: true }
    });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable"
    });
  });

  it("returns the original journal for an identical retry", async () => {
    mocks.journalFindUnique.mockResolvedValue(existingEntry());

    const result = await postJournalEntry(baseInput);

    expect(result).toEqual({
      id: "journal-1",
      postedAt: existingEntry().postedAt,
      alreadyPosted: true
    });
    expect(mocks.journalCreate).not.toHaveBeenCalled();
    expect(mocks.accountFindMany).not.toHaveBeenCalled();
  });

  it("treats reordered duplicate-account lines with distinct memos as the same idempotent payload", async () => {
    const input = {
      ...baseInput,
      idempotencyKey: "payment-capture:payment-duplicate-lines",
      lines: [
        { accountId: "cash-eur", debitMinor: "5000", memo: "First allocation" },
        { accountId: "cash-eur", debitMinor: "7500", memo: "Second allocation" },
        { accountId: "sales-eur", creditMinor: "12500", memo: "Gross sales" }
      ]
    };
    const original = existingEntry({
      id: "journal-duplicate-lines",
      lines: [
        { accountId: "cash-eur", debitMinor: 5000n, creditMinor: 0n, memo: "First allocation" },
        { accountId: "cash-eur", debitMinor: 7500n, creditMinor: 0n, memo: "Second allocation" },
        { accountId: "sales-eur", debitMinor: 0n, creditMinor: 12500n, memo: "Gross sales" }
      ]
    });
    mocks.journalFindUnique.mockResolvedValue(original);

    const result = await postJournalEntry({
      ...input,
      lines: [...input.lines].reverse()
    });

    expect(result).toMatchObject({ id: "journal-duplicate-lines", alreadyPosted: true });
    expect(mocks.journalCreate).not.toHaveBeenCalled();
  });

  it.each([
    ["description", { description: "Different description" }],
    ["occurredAt", { occurredAt: new Date("2026-11-12T10:00:01.000Z") }],
    ["reversal reference", { reversalOfId: "original-journal" }],
    ["source reference", { sourceId: "different-payment" }],
    ["line allocation", {
      lines: [
        { accountId: "cash-eur", debitMinor: "11000", memo: "Provider clearing" },
        { accountId: "sales-eur", creditMinor: "11000", memo: "Gross sales" }
      ]
    }]
  ])("rejects an idempotency-key retry with a changed %s", async (_field, changed) => {
    mocks.journalFindUnique.mockResolvedValue(existingEntry());

    await expect(postJournalEntry({ ...baseInput, ...changed })).rejects.toThrow(
      "Idempotency key was already used for a different journal entry."
    );
    expect(mocks.journalCreate).not.toHaveBeenCalled();
  });

  it("rejects unbalanced amounts before opening a database transaction", async () => {
    await expect(postJournalEntry({
      ...baseInput,
      lines: [
        { accountId: "cash-eur", debitMinor: "12500" },
        { accountId: "sales-eur", creditMinor: "12499" }
      ]
    })).rejects.toThrow("Journal entry is not balanced.");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects inactive, missing, or wrong-currency accounts", async () => {
    mocks.accountFindMany.mockResolvedValue([{ id: "cash-eur" }]);

    await expect(postJournalEntry(baseInput)).rejects.toThrow(
      "Every journal account must exist, be active, and use the journal currency."
    );
    expect(mocks.journalCreate).not.toHaveBeenCalled();
  });

  it("requires an exact inverse when posting a reversal", async () => {
    mocks.journalFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingEntry());

    await expect(postJournalEntry({
      ...baseInput,
      idempotencyKey: "reversal:journal-1",
      sourceType: "JOURNAL_REVERSAL",
      sourceId: "journal-1",
      description: "Reverse captured payment",
      reversalOfId: "journal-1",
      lines: [
        { accountId: "cash-eur", creditMinor: "12500", memo: "Provider clearing" },
        { accountId: "sales-eur", debitMinor: "12500", memo: "Gross sales" }
      ]
    })).resolves.toMatchObject({ id: "journal-new", alreadyPosted: false });

    expect(mocks.journalCreate).toHaveBeenCalled();
  });
});

describe("read-only ledger account listing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ledgerAccountFindMany.mockResolvedValue([
      { id: "cash-usd", code: "1000", name: "Cash", accountType: "ASSET", scopeType: "GLOBAL", scopeId: "GLOBAL", currencyCode: "USD", isActive: true, currency: { minorUnit: 2 } }
    ]);
  });

  it("applies validated currency, account type and active filters", async () => {
    const result = await listLedgerAccounts({
      query: "cash",
      currencyCode: "usd",
      accountType: "ASSET",
      isActive: true,
      take: 25
    });

    expect(result.items).toHaveLength(1);
    expect(mocks.ledgerAccountFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        currencyCode: "USD",
        accountType: "ASSET",
        isActive: true,
        OR: [
          { code: { contains: "cash", mode: "insensitive" } },
          { name: { contains: "cash", mode: "insensitive" } },
          { scopeId: { contains: "cash", mode: "insensitive" } }
        ]
      }),
      take: 26,
      orderBy: [{ currencyCode: "asc" }, { code: "asc" }, { id: "asc" }]
    }));
  });

  it("rejects invalid currency and unbounded page sizes before querying", async () => {
    await expect(listLedgerAccounts({ currencyCode: "US" })).rejects.toThrow();
    await expect(listLedgerAccounts({ take: 101 })).rejects.toThrow();
    expect(mocks.ledgerAccountFindMany).not.toHaveBeenCalled();
  });
});
