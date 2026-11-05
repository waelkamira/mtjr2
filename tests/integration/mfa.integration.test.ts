import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  confirmMfaEnrollment, createMfaEnrollment, getMfaStatus,
  generateTotpCode, verifyMfaStepUp
} from "@/server/identity/mfa";
import { createUserSession, hashSessionToken } from "@/server/identity/session";
import { hashPassword } from "@/server/identity/password";

const suffix = randomUUID();
const createdUsers: string[] = [];

describe("MFA PostgreSQL integration", () => {
  afterAll(async () => {
    if (createdUsers.length) {
      await prisma.userMfaAuthenticator.deleteMany({ where: { userId: { in: createdUsers } } });
      await prisma.mfaRecoveryCode.deleteMany({ where: { userId: { in: createdUsers } } });
      await prisma.userSession.deleteMany({ where: { userId: { in: createdUsers } } });
      await prisma.auditLog.deleteMany({ where: { actorId: { in: createdUsers } } });
      await prisma.userRoleAssignment.deleteMany({ where: { userId: { in: createdUsers } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    }
    await prisma.$disconnect();
  });

  it("encrypts the secret, enables TOTP, rejects replay, and consumes recovery codes once", async () => {
    const email = `mfa-${suffix}@example.test`;
    const user = await prisma.user.create({
      data: {
        email,
        emailNormalized: email,
        displayName: "MFA Integration",
        passwordHash: await hashPassword("Correct-Horse-Battery-42!"),
        status: "ACTIVE",
        emailVerifiedAt: new Date()
      },
      select: { id: true }
    });
    createdUsers.push(user.id);
    const session = await createUserSession(user.id);
    const sessionRow = await prisma.userSession.findUniqueOrThrow({
      where: { tokenHash: hashSessionToken(session.token) },
      select: { id: true }
    });

    await expect(createMfaEnrollment(user.id, "Incorrect-Password-000!")).rejects.toThrow(/current password/i);
    const enrollment = await createMfaEnrollment(user.id, "Correct-Horse-Battery-42!");
    expect(enrollment.secret).toBeTruthy();
    const pending = await prisma.userMfaAuthenticator.findUniqueOrThrow({ where: { userId: user.id } });
    expect(pending.secretCiphertext).not.toContain(enrollment.secret);
    expect(pending.enabledAt).toBeNull();

    const enrollmentStep = Math.floor(Date.now() / 30_000);
    const enrollmentTime = new Date(enrollmentStep * 30_000);
    const enabled = await confirmMfaEnrollment(
      user.id,
      generateTotpCode(enrollment.secret, enrollmentStep),
      enrollmentTime
    );
    expect(enabled.enabled).toBe(true);
    expect(enabled.recoveryCodes).toHaveLength(10);
    await expect(getMfaStatus(user.id)).resolves.toMatchObject({
      enabled: true,
      recoveryCodesRemaining: 10
    });

    const stepUpStep = enrollmentStep + 1;
    const stepUpTime = new Date(stepUpStep * 30_000);
    const totp = generateTotpCode(enrollment.secret, stepUpStep);
    await expect(verifyMfaStepUp(sessionRow.id, user.id, totp, stepUpTime)).resolves.toBe(true);
    await expect(verifyMfaStepUp(sessionRow.id, user.id, totp, stepUpTime)).resolves.toBe(false);

    const recovery = enabled.recoveryCodes[0];
    await expect(verifyMfaStepUp(sessionRow.id, user.id, recovery, new Date((stepUpStep + 1) * 30_000))).resolves.toBe(true);
    await expect(verifyMfaStepUp(sessionRow.id, user.id, recovery, new Date((stepUpStep + 2) * 30_000))).resolves.toBe(false);
    await expect(getMfaStatus(user.id)).resolves.toMatchObject({ enabled: true, recoveryCodesRemaining: 9 });

    const storedCodes = await prisma.mfaRecoveryCode.findMany({ where: { userId: user.id } });
    expect(storedCodes.every(code => !enabled.recoveryCodes.includes(code.codeHash))).toBe(true);
    expect(storedCodes.filter(code => code.usedAt !== null)).toHaveLength(1);
    const updatedSession = await prisma.userSession.findUniqueOrThrow({
      where: { id: sessionRow.id },
      select: { stepUpVerifiedAt: true, stepUpExpiresAt: true }
    });
    expect(updatedSession.stepUpVerifiedAt).not.toBeNull();
    expect(updatedSession.stepUpExpiresAt).not.toBeNull();
  });
});
