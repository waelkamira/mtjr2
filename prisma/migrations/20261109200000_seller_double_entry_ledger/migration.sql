CREATE TYPE "LedgerAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

CREATE TABLE "LedgerAccount" (
  "id" TEXT NOT NULL,
  "code" VARCHAR(64) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "accountType" "LedgerAccountType" NOT NULL,
  "scopeType" VARCHAR(32) NOT NULL DEFAULT 'GLOBAL',
  "scopeId" VARCHAR(128) NOT NULL DEFAULT 'GLOBAL',
  "currencyCode" CHAR(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LedgerAccount_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "LedgerAccount_scopeType_scopeId_code_currencyCode_key"
  ON "LedgerAccount"("scopeType", "scopeId", "code", "currencyCode");
CREATE INDEX "LedgerAccount_currencyCode_accountType_scopeType_scopeId_idx"
  ON "LedgerAccount"("currencyCode", "accountType", "scopeType", "scopeId");
CREATE INDEX "LedgerAccount_isActive_code_idx" ON "LedgerAccount"("isActive", "code");

CREATE TABLE "JournalEntry" (
  "id" TEXT NOT NULL,
  "idempotencyKey" VARCHAR(180) NOT NULL,
  "sourceType" VARCHAR(64) NOT NULL,
  "sourceId" VARCHAR(180) NOT NULL,
  "currencyCode" CHAR(3) NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reversalOfId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JournalEntry_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "JournalEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "JournalEntry_idempotencyKey_key" ON "JournalEntry"("idempotencyKey");
CREATE UNIQUE INDEX "JournalEntry_reversalOfId_key" ON "JournalEntry"("reversalOfId");
CREATE INDEX "JournalEntry_sourceType_sourceId_idx" ON "JournalEntry"("sourceType", "sourceId");
CREATE INDEX "JournalEntry_currencyCode_postedAt_id_idx" ON "JournalEntry"("currencyCode", "postedAt", "id");

CREATE TABLE "JournalLine" (
  "id" TEXT NOT NULL,
  "journalEntryId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "lineNumber" INTEGER NOT NULL,
  "debitMinor" BIGINT NOT NULL DEFAULT 0,
  "creditMinor" BIGINT NOT NULL DEFAULT 0,
  "memo" VARCHAR(500),
  CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JournalLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "JournalLine_amounts_check" CHECK (
    "debitMinor" >= 0 AND "creditMinor" >= 0 AND
    (("debitMinor" > 0 AND "creditMinor" = 0) OR ("creditMinor" > 0 AND "debitMinor" = 0))
  )
);
CREATE UNIQUE INDEX "JournalLine_journalEntryId_lineNumber_key" ON "JournalLine"("journalEntryId", "lineNumber");
CREATE INDEX "JournalLine_accountId_journalEntryId_idx" ON "JournalLine"("accountId", "journalEntryId");

-- Journal entries are append-only: corrections must be represented by a separate reversing entry.
CREATE OR REPLACE FUNCTION prevent_journal_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Journal entries and lines are immutable; post a reversal instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "JournalEntry_immutable"
BEFORE UPDATE OR DELETE ON "JournalEntry"
FOR EACH ROW EXECUTE FUNCTION prevent_journal_mutation();

CREATE TRIGGER "JournalLine_immutable"
BEFORE UPDATE OR DELETE ON "JournalLine"
FOR EACH ROW EXECUTE FUNCTION prevent_journal_mutation();
