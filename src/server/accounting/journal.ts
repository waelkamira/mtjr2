/**
 * Pure accounting invariants shared by journal creation and reversal workflows.
 * Persistence must call these checks inside the same DB transaction that posts
 * the journal; this module deliberately performs no I/O.
 */
export type JournalSide = "DEBIT" | "CREDIT";

export type JournalLineInput = {
  accountId: string;
  side: JournalSide;
  amountMinor: bigint;
  currencyCode: string;
  memo?: string | null;
};

export type ValidatedJournal = {
  currencyCode: string;
  debitTotalMinor: bigint;
  creditTotalMinor: bigint;
  lines: readonly JournalLineInput[];
};

export function validateJournalLines(lines: readonly JournalLineInput[]): ValidatedJournal {
  if (lines.length < 2) throw new Error("A journal entry requires at least two lines.");

  const currencyCode = lines[0]?.currencyCode;
  if (!currencyCode || !/^[A-Z]{3}$/.test(currencyCode)) {
    throw new Error("Journal currency must be a three-letter uppercase ISO code.");
  }

  let debitTotalMinor = BigInt(0);
  let creditTotalMinor = BigInt(0);

  for (const [index, line] of lines.entries()) {
    if (!line.accountId.trim()) throw new Error(`Journal line ${index + 1} requires an account.`);
    if (line.currencyCode !== currencyCode) {
      throw new Error("A journal entry cannot mix currencies.");
    }
    if (line.amountMinor <= BigInt(0)) {
      throw new Error("Journal line amounts must be positive integer minor units.");
    }
    if (line.side === "DEBIT") debitTotalMinor += line.amountMinor;
    else if (line.side === "CREDIT") creditTotalMinor += line.amountMinor;
    else throw new Error("Journal line side must be DEBIT or CREDIT.");
  }

  if (debitTotalMinor !== creditTotalMinor) {
    throw new Error("Journal entry is not balanced: debits must equal credits.");
  }

  return { currencyCode, debitTotalMinor, creditTotalMinor, lines };
}

/** Reversals are new postings; the original posted journal remains immutable. */
export function buildReversalLines(lines: readonly JournalLineInput[]): JournalLineInput[] {
  validateJournalLines(lines);
  return lines.map((line) => ({
    ...line,
    side: line.side === "DEBIT" ? "CREDIT" : "DEBIT",
    memo: line.memo ? `Reversal: ${line.memo}` : "Reversal"
  }));
}
