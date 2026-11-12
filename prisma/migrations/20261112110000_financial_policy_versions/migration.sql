-- Persist financial policy definitions as versioned, review-gated records.
-- Existing Country/Market/Currency data remains the source of truth; scope codes
-- intentionally avoid duplicating those master records or the existing tax tables.

CREATE TABLE "FinancialPolicyRule" (
  "id" TEXT NOT NULL,
  "key" VARCHAR(120) NOT NULL,
  "domain" VARCHAR(64) NOT NULL,
  "description" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialPolicyRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialPolicyRuleVersion" (
  "id" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "classification" VARCHAR(24) NOT NULL,
  "approvalStatus" VARCHAR(24) NOT NULL DEFAULT 'PENDING_REVIEW',
  "countryCode" CHAR(2),
  "subdivisionCode" VARCHAR(32),
  "marketCode" VARCHAR(32),
  "currencyCode" CHAR(3),
  "productClass" VARCHAR(80),
  "paymentProvider" VARCHAR(80),
  "sellerId" TEXT,
  "categoryId" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "value" JSONB NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveUntil" TIMESTAMP(3),
  "sourceReference" VARCHAR(2048),
  "reviewNotes" VARCHAR(2000),
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "approvedById" TEXT,
  "rejectionReason" VARCHAR(1000),
  "rejectedAt" TIMESTAMP(3),
  "rejectedById" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinancialPolicyRuleVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinancialPolicyRuleVersion_ruleId_fkey"
    FOREIGN KEY ("ruleId") REFERENCES "FinancialPolicyRule"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinancialPolicyRuleVersion_version_check" CHECK ("version" > 0),
  CONSTRAINT "FinancialPolicyRuleVersion_effective_window_check"
    CHECK ("effectiveUntil" IS NULL OR "effectiveUntil" > "effectiveFrom"),
  CONSTRAINT "FinancialPolicyRuleVersion_classification_check"
    CHECK ("classification" IN ('LEGAL', 'CONTRACTUAL', 'PLATFORM')),
  CONSTRAINT "FinancialPolicyRuleVersion_approval_check"
    CHECK ("approvalStatus" IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED')),
  CONSTRAINT "FinancialPolicyRuleVersion_legal_scope_check"
    CHECK ("classification" <> 'LEGAL' OR "countryCode" IS NOT NULL),
  CONSTRAINT "FinancialPolicyRuleVersion_approved_metadata_check"
    CHECK ("approvalStatus" <> 'APPROVED' OR ("approvedAt" IS NOT NULL AND "approvedById" IS NOT NULL)),
  CONSTRAINT "FinancialPolicyRuleVersion_rejected_metadata_check"
    CHECK ("approvalStatus" <> 'REJECTED' OR ("rejectedAt" IS NOT NULL AND "rejectedById" IS NOT NULL)),
  CONSTRAINT "FinancialPolicyRuleVersion_legal_review_check"
    CHECK ("approvalStatus" <> 'APPROVED' OR "classification" <> 'LEGAL' OR ("reviewedAt" IS NOT NULL AND "reviewedById" IS NOT NULL))
);

CREATE UNIQUE INDEX "FinancialPolicyRule_key_key"
  ON "FinancialPolicyRule"("key");
CREATE INDEX "FinancialPolicyRule_domain_createdAt_idx"
  ON "FinancialPolicyRule"("domain", "createdAt");
CREATE UNIQUE INDEX "FinancialPolicyRuleVersion_ruleId_version_key"
  ON "FinancialPolicyRuleVersion"("ruleId", "version");
CREATE INDEX "FinancialPolicyRuleVersion_approvalStatus_classification_effectiveFrom_effectiveUntil_idx"
  ON "FinancialPolicyRuleVersion"("approvalStatus", "classification", "effectiveFrom", "effectiveUntil");
CREATE INDEX "FinancialPolicyRuleVersion_countryCode_subdivisionCode_marketCode_idx"
  ON "FinancialPolicyRuleVersion"("countryCode", "subdivisionCode", "marketCode");
CREATE INDEX "FinancialPolicyRuleVersion_currencyCode_productClass_paymentProvider_idx"
  ON "FinancialPolicyRuleVersion"("currencyCode", "productClass", "paymentProvider");
CREATE INDEX "FinancialPolicyRuleVersion_sellerId_categoryId_idx"
  ON "FinancialPolicyRuleVersion"("sellerId", "categoryId");

-- Prevent editing or deleting the financial meaning of a version after creation.
-- Review/approval metadata may advance through the controlled workflow.
CREATE FUNCTION "protect_financial_policy_version_content"()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Financial policy versions cannot be deleted';
  END IF;

  IF ROW(
    NEW."ruleId", NEW."version", NEW."classification", NEW."countryCode",
    NEW."subdivisionCode", NEW."marketCode", NEW."currencyCode",
    NEW."productClass", NEW."paymentProvider", NEW."sellerId",
    NEW."categoryId", NEW."priority", NEW."value", NEW."effectiveFrom",
    NEW."effectiveUntil", NEW."sourceReference", NEW."createdById",
    NEW."createdAt"
  ) IS DISTINCT FROM ROW(
    OLD."ruleId", OLD."version", OLD."classification", OLD."countryCode",
    OLD."subdivisionCode", OLD."marketCode", OLD."currencyCode",
    OLD."productClass", OLD."paymentProvider", OLD."sellerId",
    OLD."categoryId", OLD."priority", OLD."value", OLD."effectiveFrom",
    OLD."effectiveUntil", OLD."sourceReference", OLD."createdById",
    OLD."createdAt"
  ) THEN
    RAISE EXCEPTION 'Financial policy version content is immutable; create a new version';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "FinancialPolicyRuleVersion_immutable_content"
BEFORE UPDATE OR DELETE ON "FinancialPolicyRuleVersion"
FOR EACH ROW EXECUTE FUNCTION "protect_financial_policy_version_content"();
