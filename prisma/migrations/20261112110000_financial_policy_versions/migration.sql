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
    CHECK ("approvalStatus" <> 'APPROVED' OR "classification" <> 'LEGAL' OR ("reviewedAt" IS NOT NULL AND "reviewedById" IS NOT NULL)),
  CONSTRAINT "FinancialPolicyRuleVersion_review_metadata_pair_check"
    CHECK (("reviewedAt" IS NULL) = ("reviewedById" IS NULL)),
  CONSTRAINT "FinancialPolicyRuleVersion_decision_exclusivity_check"
    CHECK (NOT ("approvedAt" IS NOT NULL AND "rejectedAt" IS NOT NULL)),
  CONSTRAINT "FinancialPolicyRuleVersion_pending_metadata_check"
    CHECK ("approvalStatus" <> 'PENDING_REVIEW' OR ("approvedAt" IS NULL AND "rejectedAt" IS NULL)),
  CONSTRAINT "FinancialPolicyRuleVersion_approved_rejection_check"
    CHECK ("approvalStatus" <> 'APPROVED' OR "rejectedAt" IS NULL),
  CONSTRAINT "FinancialPolicyRuleVersion_rejected_approval_check"
    CHECK ("approvalStatus" <> 'REJECTED' OR "approvedAt" IS NULL),
  CONSTRAINT "FinancialPolicyRuleVersion_legal_source_check"
    CHECK ("classification" <> 'LEGAL' OR ("sourceReference" IS NOT NULL AND length(trim("sourceReference")) > 0)),
  CONSTRAINT "FinancialPolicyRuleVersion_legal_review_notes_check"
    CHECK ("classification" <> 'LEGAL' OR ("reviewNotes" IS NOT NULL AND length(trim("reviewNotes")) > 0)),
  CONSTRAINT "FinancialPolicyRuleVersion_review_author_separation_check"
    CHECK ("reviewedById" IS NULL OR "createdById" IS NULL OR "reviewedById" <> "createdById"),
  CONSTRAINT "FinancialPolicyRuleVersion_approval_author_separation_check"
    CHECK ("approvalStatus" <> 'APPROVED' OR "createdById" IS NULL OR "approvedById" <> "createdById"),
  CONSTRAINT "FinancialPolicyRuleVersion_rejection_author_separation_check"
    CHECK ("approvalStatus" <> 'REJECTED' OR "createdById" IS NULL OR "rejectedById" <> "createdById"),
  CONSTRAINT "FinancialPolicyRuleVersion_legal_reviewer_approver_separation_check"
    CHECK ("approvalStatus" <> 'APPROVED' OR "classification" <> 'LEGAL' OR "reviewedById" <> "approvedById"),
  CONSTRAINT "FinancialPolicyRuleVersion_rejection_reason_check"
    CHECK ("approvalStatus" <> 'REJECTED' OR ("rejectionReason" IS NOT NULL AND length(trim("rejectionReason")) >= 5))
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

  IF OLD."approvalStatus" <> 'PENDING_REVIEW' AND (
    NEW."approvalStatus" IS DISTINCT FROM OLD."approvalStatus" OR
    NEW."reviewedAt" IS DISTINCT FROM OLD."reviewedAt" OR
    NEW."reviewedById" IS DISTINCT FROM OLD."reviewedById" OR
    NEW."approvedAt" IS DISTINCT FROM OLD."approvedAt" OR
    NEW."approvedById" IS DISTINCT FROM OLD."approvedById" OR
    NEW."rejectedAt" IS DISTINCT FROM OLD."rejectedAt" OR
    NEW."rejectedById" IS DISTINCT FROM OLD."rejectedById" OR
    NEW."rejectionReason" IS DISTINCT FROM OLD."rejectionReason" OR
    NEW."reviewNotes" IS DISTINCT FROM OLD."reviewNotes"
  ) THEN
    RAISE EXCEPTION 'Financial policy decisions are terminal; create a new version to change policy status';
  END IF;

  IF OLD."reviewedAt" IS NOT NULL AND (
    NEW."reviewedAt" IS DISTINCT FROM OLD."reviewedAt" OR
    NEW."reviewedById" IS DISTINCT FROM OLD."reviewedById" OR
    NEW."reviewNotes" IS DISTINCT FROM OLD."reviewNotes"
  ) THEN
    RAISE EXCEPTION 'Financial policy review evidence cannot be overwritten';
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
