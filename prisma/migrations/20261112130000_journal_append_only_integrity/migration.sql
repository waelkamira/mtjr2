-- Prevent adding balanced-looking lines to a journal after its posting transaction committed.
-- The journal service creates the entry and all lines in one database transaction.
ALTER TABLE "JournalEntry"
  ADD COLUMN "createdTransactionId" BIGINT NOT NULL DEFAULT txid_current();

CREATE OR REPLACE FUNCTION prevent_journal_line_append() RETURNS trigger AS $$
DECLARE
  parent_transaction_id BIGINT;
BEGIN
  SELECT "createdTransactionId"
    INTO parent_transaction_id
  FROM "JournalEntry"
  WHERE "id" = NEW."journalEntryId";

  IF parent_transaction_id IS NULL OR parent_transaction_id <> txid_current() THEN
    RAISE EXCEPTION 'Journal lines can only be inserted in the transaction that creates their journal entry.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "JournalLine_same_transaction_insert"
BEFORE INSERT ON "JournalLine"
FOR EACH ROW EXECUTE FUNCTION prevent_journal_line_append();

-- Database-level posting integrity also rejects inactive accounts, including callers
-- that bypass the TypeScript posting service.
CREATE OR REPLACE FUNCTION enforce_journal_entry_integrity() RETURNS trigger AS $$
DECLARE
  target_entry_id TEXT;
  entry_currency CHAR(3);
  debit_total NUMERIC(38, 0);
  credit_total NUMERIC(38, 0);
  line_count BIGINT;
  mismatched_accounts BIGINT;
  inactive_accounts BIGINT;
BEGIN
  IF TG_TABLE_NAME = 'JournalEntry' THEN
    target_entry_id := NEW."id";
  ELSE
    target_entry_id := NEW."journalEntryId";
  END IF;

  SELECT "currencyCode" INTO entry_currency
  FROM "JournalEntry" WHERE "id" = target_entry_id;

  SELECT
    COALESCE(SUM("debitMinor"), 0),
    COALESCE(SUM("creditMinor"), 0),
    COUNT(*)
  INTO debit_total, credit_total, line_count
  FROM "JournalLine" WHERE "journalEntryId" = target_entry_id;

  SELECT
    COUNT(*) FILTER (WHERE la."currencyCode" <> entry_currency),
    COUNT(*) FILTER (WHERE la."isActive" = FALSE)
  INTO mismatched_accounts, inactive_accounts
  FROM "JournalLine" jl
  JOIN "LedgerAccount" la ON la."id" = jl."accountId"
  WHERE jl."journalEntryId" = target_entry_id;

  IF line_count < 2 OR debit_total <= 0 OR debit_total <> credit_total
    OR mismatched_accounts > 0 OR inactive_accounts > 0 THEN
    RAISE EXCEPTION 'Journal entry % must contain at least two balanced lines using active same-currency accounts.', target_entry_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;



-- A ledger account's accounting identity cannot be rewritten after it has been used.
-- Deactivation remains allowed; changing the code, type, scope or currency does not.
CREATE OR REPLACE FUNCTION prevent_used_ledger_account_identity_change() RETURNS trigger AS $$
BEGIN
  IF (
    NEW."code" IS DISTINCT FROM OLD."code" OR
    NEW."accountType" IS DISTINCT FROM OLD."accountType" OR
    NEW."scopeType" IS DISTINCT FROM OLD."scopeType" OR
    NEW."scopeId" IS DISTINCT FROM OLD."scopeId" OR
    NEW."currencyCode" IS DISTINCT FROM OLD."currencyCode"
  ) AND EXISTS (
    SELECT 1 FROM "JournalLine" WHERE "accountId" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'A ledger account identity cannot change after it has been used; deactivate it and create a replacement account.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "LedgerAccount_used_identity_immutable"
BEFORE UPDATE ON "LedgerAccount"
FOR EACH ROW EXECUTE FUNCTION prevent_used_ledger_account_identity_change();
