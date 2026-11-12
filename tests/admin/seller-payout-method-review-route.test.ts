import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
  review: vi.fn(),
  validateMutation: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/request-security", () => ({
  validateIdentityMutationRequest: mocks.validateMutation
}));
vi.mock("@/server/marketplace/seller-payout-methods", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/marketplace/seller-payout-methods")>()),
  reviewSellerPayoutMethod: mocks.review
}));

import { POST } from "@/app/api/admin/seller-payout-methods/[methodId]/review/route";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { MfaEnrollmentRequiredError, MfaVerificationRequiredError, StepUpRequiredError } from "@/server/identity/access-errors";
import {
  SellerPayoutMethodNotFoundError,
  SellerPayoutSelfVerificationError,
  SellerPayoutVerificationConflictError
} from "@/server/marketplace/seller-payout-methods";

const context = { params: Promise.resolve({ methodId: "payout-method-1" }) };
const request = (body: unknown = {
  decision: "VERIFIED",
  evidenceReference: "BANK-CHECK-2026-001",
  reason: "Account ownership independently confirmed."
}) => new Request("https://matjar.test/api/admin/seller-payout-methods/payout-method-1/review", {
  method: "POST",
  headers: { "Content-Type": "application/json", origin: "https://matjar.test" },
  body: JSON.stringify(body)
});

describe("admin seller payout destination review route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateMutation.mockReturnValue(null);
    mocks.review.mockResolvedValue({ id: "payout-method-1", status: "VERIFIED" });
  });

  it("records the review through the audited domain service", async () => {
    const input = {
      decision: "VERIFIED",
      evidenceReference: "BANK-CHECK-2026-001",
      reason: "Account ownership independently confirmed.",
      expectedSubmissionVersion: 1
    };
    const response = await POST(request(input), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ method: { id: "payout-method-1", status: "VERIFIED" } });
    expect(mocks.review).toHaveBeenCalledWith("payout-method-1", input);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });

  it("rejects an invalid origin before calling the review service", async () => {
    mocks.validateMutation.mockReturnValueOnce(Response.json({ error: "Request origin could not be verified." }, { status: 403 }));
    const response = await POST(request(), context);
    expect(response.status).toBe(403);
    expect(mocks.review).not.toHaveBeenCalled();
  });

  it.each([
    [new AuthenticationRequiredError(), 401],
    [new MfaEnrollmentRequiredError(), 428],
    [new MfaVerificationRequiredError(), 428],
    [new StepUpRequiredError(), 428],
    [new PermissionDeniedError("denied"), 403],
    [new SellerPayoutMethodNotFoundError(), 404],
    [new SellerPayoutSelfVerificationError(), 403],
    [new SellerPayoutVerificationConflictError(), 409],
    [new z.ZodError([]), 400],
    [new SyntaxError("invalid JSON"), 400]
  ])("maps %s to HTTP %i", async (error, status) => {
    mocks.review.mockRejectedValueOnce(error);
    const response = await POST(request(), context);
    expect(response.status).toBe(status);
  });

  it("does not leak unexpected internal errors", async () => {
    mocks.review.mockRejectedValueOnce(new Error("sensitive database details"));
    const response = await POST(request(), context);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unable to review seller bank destination." });
  });
});
