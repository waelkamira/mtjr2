import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueVerificationEmailChallenge } from "@/server/identity/verification-email";

const { prismaMock, txMock } = vi.hoisted(() => {
  const tx = {
    verificationToken: { updateMany: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() }
  };
  return {
    txMock: tx,
    prismaMock: {
      user: { findFirst: vi.fn() },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx))
    }
  };
});

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

const now = new Date("2026-11-08T12:00:00.000Z");

describe("verification email challenge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findFirst.mockResolvedValue({ id: "user-1", email: "buyer@example.com" });
    txMock.verificationToken.updateMany.mockResolvedValue({ count: 1 });
    txMock.verificationToken.create.mockResolvedValue({ id: "verification-2" });
    txMock.auditLog.create.mockResolvedValue({ id: "audit-1" });
    prismaMock.$transaction.mockImplementation((callback: (client: typeof txMock) => unknown) => callback(txMock));
  });

  it("rotates outstanding challenges and stores only a digest of the new token", async () => {
    const result = await issueVerificationEmailChallenge(" Buyer@Example.COM ", now);

    expect(result?.email).toBe("buyer@example.com");
    expect(result?.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { emailNormalized: "buyer@example.com", status: "PENDING", emailVerifiedAt: null },
      select: { id: true, email: true }
    });
    expect(txMock.verificationToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", purpose: "EMAIL_VERIFICATION", consumedAt: null },
      data: { consumedAt: now }
    });
    const createCall = txMock.verificationToken.create.mock.calls[0][0];
    expect(createCall.data.tokenHash).toBe(createHash("sha256").update(result!.token, "utf8").digest("hex"));
    expect(createCall.data.tokenHash).not.toBe(result!.token);
    expect(createCall.data.expiresAt).toEqual(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  });

  it("does not create or disclose a challenge for ineligible accounts", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    await expect(issueVerificationEmailChallenge("buyer@example.com", now)).resolves.toBeNull();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(txMock.verificationToken.create).not.toHaveBeenCalled();
  });
});
