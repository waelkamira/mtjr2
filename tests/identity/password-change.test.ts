import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, txMock, hashPasswordMock, verifyPasswordMock } = vi.hoisted(() => {
  const tx = {
    user: { updateMany: vi.fn() },
    userSession: { updateMany: vi.fn() },
    passwordResetToken: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() }
  };
  return {
    txMock: tx,
    hashPasswordMock: vi.fn(),
    verifyPasswordMock: vi.fn(),
    prismaMock: {
      user: { findUnique: vi.fn() },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx))
    }
  };
});

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/identity/password", () => ({
  hashPassword: hashPasswordMock,
  verifyPassword: verifyPasswordMock
}));

import { changePassword } from "../../src/server/identity/password-change";

const now = new Date("2026-11-04T12:00:00.000Z");
const input = {
  userId: "user-1",
  currentSessionId: "session-current",
  currentPassword: "old password",
  newPassword: "a different password"
};

describe("authenticated password change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      (callback: (client: typeof txMock) => unknown) => callback(txMock)
    );
    prismaMock.user.findUnique.mockResolvedValue({
      id: input.userId,
      passwordHash: "old-hash",
      status: "ACTIVE",
      emailVerifiedAt: now
    });
    verifyPasswordMock.mockResolvedValue(true);
    hashPasswordMock.mockResolvedValue("new-hash");
    txMock.user.updateMany.mockResolvedValue({ count: 1 });
    txMock.userSession.updateMany.mockResolvedValue({ count: 2 });
    txMock.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
    txMock.auditLog.create.mockResolvedValue({});
  });

  it("atomically updates the password and revokes other sessions and reset links", async () => {
    await expect(changePassword(input, now)).resolves.toBe("UPDATED");

    expect(txMock.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: input.userId,
        status: "ACTIVE",
        emailVerifiedAt: { not: null },
        passwordHash: "old-hash"
      },
      data: { passwordHash: "new-hash" }
    });
    expect(txMock.userSession.updateMany).toHaveBeenCalledWith({
      where: {
        userId: input.userId,
        id: { not: input.currentSessionId },
        revokedAt: null
      },
      data: { revokedAt: now }
    });
    expect(txMock.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { userId: input.userId, consumedAt: null },
      data: { consumedAt: now }
    });
    expect(txMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "identity.password.changed",
        actorId: input.userId,
        resourceId: input.userId
      })
    });
  });

  it("does not change account state when the current password is incorrect", async () => {
    verifyPasswordMock.mockResolvedValue(false);

    await expect(changePassword(input, now)).resolves.toBe("INVALID_CURRENT_PASSWORD");
    expect(hashPasswordMock).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("does not allow a password to be changed without an existing password", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: input.userId,
      passwordHash: null,
      status: "ACTIVE",
      emailVerifiedAt: now
    });

    await expect(changePassword(input, now)).resolves.toBe("PASSWORD_NOT_SET");
    expect(verifyPasswordMock).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("does not revoke sessions if another password update wins the race", async () => {
    txMock.user.updateMany.mockResolvedValue({ count: 0 });

    await expect(changePassword(input, now)).resolves.toBe("CONCURRENT_CHANGE");
    expect(txMock.userSession.updateMany).not.toHaveBeenCalled();
    expect(txMock.auditLog.create).not.toHaveBeenCalled();
  });
});
