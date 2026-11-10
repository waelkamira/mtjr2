import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  factorFindUnique: vi.fn(),
  roleFindFirst: vi.fn(),
  sellerFindUnique: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    userTwoFactor: { findUnique: mocks.factorFindUnique },
    userRoleAssignment: { findFirst: mocks.roleFindFirst },
    seller: { findUnique: mocks.sellerFindUnique }
  }
}));

import { getMfaAccessState } from "@/server/identity/mfa";

describe("privileged account MFA policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.factorFindUnique.mockResolvedValue(null);
    mocks.roleFindFirst.mockResolvedValue(null);
    mocks.sellerFindUnique.mockResolvedValue(null);
  });

  it("requires MFA enrollment for an active seller profile", async () => {
    mocks.sellerFindUnique.mockResolvedValue({ status: "ACTIVE" });
    await expect(getMfaAccessState("seller-owner-1")).resolves.toMatchObject({
      enabled: false,
      required: true,
      platformRequired: false,
      privilegedAccountRequired: true,
      enrollmentRequired: true
    });
  });

  it("does not require MFA while a seller application is pending review", async () => {
    mocks.sellerFindUnique.mockResolvedValue({ status: "PENDING" });
    await expect(getMfaAccessState("seller-applicant-1")).resolves.toMatchObject({
      enabled: false,
      required: false,
      platformRequired: false,
      privilegedAccountRequired: false,
      enrollmentRequired: false
    });
  });

  it("requires MFA for users with administrator permissions", async () => {
    mocks.roleFindFirst.mockImplementation(async (args: { where: { role: { permissions: { some: { permission: { key: string } } } } } }) =>
      args.where.role.permissions.some.permission.key === "users:manage" ? { id: "admin-role" } : null
    );
    await expect(getMfaAccessState("admin-1")).resolves.toMatchObject({
      required: true,
      privilegedAccountRequired: true,
      enrollmentRequired: true
    });
  });

  it("keeps MFA optional for ordinary customer accounts", async () => {
    await expect(getMfaAccessState("customer-1")).resolves.toMatchObject({
      enabled: false,
      required: false,
      platformRequired: false,
      privilegedAccountRequired: false,
      enrollmentRequired: false
    });
  });
});
