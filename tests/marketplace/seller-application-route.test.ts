import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  submitSellerApplication: vi.fn(),
  validateIdentityMutationRequest: vi.fn()
}));

vi.mock("@/server/identity/request-security", () => ({
  validateIdentityMutationRequest: mocks.validateIdentityMutationRequest
}));
vi.mock("@/server/identity/current-session", () => ({
  AuthenticationRequiredError: class extends Error {},
  MfaEnrollmentRequiredError: class extends Error {},
  MfaVerificationRequiredError: class extends Error {}
}));
vi.mock("@/server/marketplace/seller-application", () => ({
  SellerApplicationConflictError: class extends Error {},
  submitSellerApplication: mocks.submitSellerApplication
}));

import {
  AuthenticationRequiredError,
  MfaEnrollmentRequiredError
} from "@/server/identity/current-session";
import { SellerApplicationConflictError } from "@/server/marketplace/seller-application";
import { POST } from "@/app/api/seller/applications/route";

describe("POST /api/seller/applications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateIdentityMutationRequest.mockReturnValue(null);
  });

  function request(body: unknown = { legalName: "Example Trading BV", displayName: "Example Store" }) {
    return new Request("http://localhost/api/seller/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  it("returns 201 when creating a seller application", async () => {
    mocks.submitSellerApplication.mockResolvedValue({
      sellerId: "seller-1", status: "PENDING", alreadySubmitted: false
    });

    const response = await POST(request());

    expect(response.status).toBe(201);
  });

  it("returns 200 when replaying an existing pending application", async () => {
    mocks.submitSellerApplication.mockResolvedValue({
      sellerId: "seller-1", status: "PENDING", alreadySubmitted: true
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
  });

  it("returns 400 for invalid application details", async () => {
    const response = await POST(request({ legalName: " ", displayName: "Example Store" }));

    expect(response.status).toBe(400);
    expect(mocks.submitSellerApplication).not.toHaveBeenCalled();
  });

  it("does not call the service when request security rejects the mutation", async () => {
    mocks.validateIdentityMutationRequest.mockReturnValue(Response.json({ error: "Request rejected." }, { status: 403 }));

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(mocks.submitSellerApplication).not.toHaveBeenCalled();
  });

  it("returns 401 when authentication is required", async () => {
    mocks.submitSellerApplication.mockRejectedValue(new AuthenticationRequiredError());

    const response = await POST(request());

    expect(response.status).toBe(401);
  });

  it("returns 403 when multi-factor authentication is required", async () => {
    mocks.submitSellerApplication.mockRejectedValue(new MfaEnrollmentRequiredError());

    const response = await POST(request());

    expect(response.status).toBe(403);
  });

  it("returns 409 when an account already has a non-pending application", async () => {
    mocks.submitSellerApplication.mockRejectedValue(new SellerApplicationConflictError());

    const response = await POST(request());

    expect(response.status).toBe(409);
  });

  it("returns 500 for unexpected service failures without exposing internal details", async () => {
    mocks.submitSellerApplication.mockRejectedValue(new Error("Database connection string"));

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unable to submit seller application." });
  });
});
