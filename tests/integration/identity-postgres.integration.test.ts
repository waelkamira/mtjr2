import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { IdentityConflictError, registerUser } from "@/server/identity/registration";
import { loginWithPassword } from "@/server/identity/login";
import { createPasswordResetChallenge, completePasswordReset } from "@/server/identity/password-reset";
import { verifyPassword } from "@/server/identity/password";
import {
  createUserSession,
  resolveUserSession,
  revokeUserSession
} from "@/server/identity/session";
import { userHasPermission } from "@/server/identity/permission-repository";
import {
  clearLoginThrottle,
  consumeLoginAttempt
} from "@/server/identity/login-throttle";

const suffix = randomUUID();
const email = `integration-${suffix}@example.test`;
let userId: string | undefined;
const createdUserIds = new Set<string>();

describe("identity PostgreSQL integration", () => {
  afterAll(async () => {
    if (createdUserIds.size) {
      await prisma.user.deleteMany({ where: { id: { in: [...createdUserIds] } } });
    }
    await prisma.$disconnect();
  });

  it("registers an active account, scopes permissions, and revokes a real database session", async () => {
    const registration = await registerUser({
      email,
      password: "Correct-Horse-Battery-42!",
      displayName: "Integration Buyer",
      accountType: "CUSTOMER",
      acceptedTerms: true,
      acceptedPrivacy: true
    });
    userId = registration.userId;
    createdUserIds.add(registration.userId);

    await expect(registerUser({
      email: email.toUpperCase(),
      password: "Another-Correct-Horse-42!",
      accountType: "CUSTOMER",
      acceptedTerms: true,
      acceptedPrivacy: true
    })).rejects.toBeInstanceOf(IdentityConflictError);
    await expect(prisma.user.count({ where: { emailNormalized: email } })).resolves.toBe(1);

    const active = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { consents: true }
    });

    expect(active.status).toBe("ACTIVE");
    expect(active.emailVerifiedAt).toBeNull();
    expect(active.consents).toHaveLength(2);

    const role = await prisma.role.findUniqueOrThrow({
      where: { key: "STORE_MANAGER" }
    });
    const permission = await prisma.permission.findUniqueOrThrow({
      where: { key: "catalog:manage" }
    });

    await prisma.userRoleAssignment.create({
      data: {
        userId,
        roleId: role.id,
        scopeType: "STORE",
        scopeId: `store-${suffix}`
      }
    });

    await expect(
      userHasPermission(userId, {
        permissionKey: "catalog:manage",
        scope: { type: "STORE", id: `store-${suffix}` }
      })
    ).resolves.toBe(true);

    await expect(
      userHasPermission(userId, {
        permissionKey: "catalog:manage",
        scope: { type: "STORE", id: "another-store" }
      })
    ).resolves.toBe(false);

    await expect(
      prisma.userRoleAssignment.create({
        data: {
          userId,
          roleId: role.id,
          scopeType: "STORE",
          scopeId: `store-${suffix}`
        }
      })
    ).rejects.toMatchObject({ code: "P2002" });

    expect(permission.key).toBe("catalog:manage");

    const createdSession = await createUserSession(userId);
    await expect(resolveUserSession(createdSession.token)).resolves.toMatchObject({
      userId
    });

    await expect(revokeUserSession(createdSession.token)).resolves.toBe(true);
    await expect(resolveUserSession(createdSession.token)).resolves.toBeNull();
  });

  it("allows only one account when duplicate registrations race", async () => {
    const duplicateEmail = `duplicate-${suffix}@example.test`;
    const results = await Promise.allSettled([
      registerUser({
        email: duplicateEmail,
        password: "Correct-Horse-Battery-42!",
        accountType: "CUSTOMER",
        acceptedTerms: true,
        acceptedPrivacy: true
      }),
      registerUser({
        email: duplicateEmail.toUpperCase(),
        password: "Another-Correct-Horse-42!",
        accountType: "CUSTOMER",
        acceptedTerms: true,
        acceptedPrivacy: true
      })
    ]);

    const accepted = results.filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof registerUser>>> =>
        result.status === "fulfilled"
    );
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    for (const result of accepted) createdUserIds.add(result.value.userId);

    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(IdentityConflictError);
    await expect(prisma.user.count({ where: { emailNormalized: duplicateEmail } })).resolves.toBe(1);
  });

  it("enforces persistent login throttling under concurrent PostgreSQL requests", async () => {
    const throttleEmail = `throttle-${suffix}@example.test`;
    const ipHex = suffix.replaceAll("-", "");
    const trustedIpAddress = `2001:db8:${ipHex.slice(0, 4)}:${ipHex.slice(4, 8)}:${ipHex.slice(8, 12)}:${ipHex.slice(12, 16)}:${ipHex.slice(16, 20)}:${ipHex.slice(20, 24)}`;

    const attempts = await Promise.all(
      Array.from({ length: 8 }, () =>
        consumeLoginAttempt(
          { identifier: throttleEmail, trustedIpAddress },
          new Date("2026-11-03T12:00:00.000Z")
        )
      )
    );

    expect(attempts).toHaveLength(8);
    expect(attempts.some((attempt) => attempt.blocked)).toBe(true);

    await expect(
      consumeLoginAttempt(
        { identifier: throttleEmail, trustedIpAddress },
        new Date("2026-11-03T12:00:01.000Z")
      )
    ).resolves.toEqual({ blocked: true });

    // Successful authentication clears only the identifier/IP pair bucket.
    await clearLoginThrottle(throttleEmail, trustedIpAddress);
    await expect(
      consumeLoginAttempt(
        { identifier: throttleEmail, trustedIpAddress },
        new Date("2026-11-03T12:00:02.000Z")
      )
    ).resolves.toEqual({ blocked: false });
  });

  it("authenticates an active user, records attempts, and persists a digest-only session", async () => {
    const loginEmail = `login-${suffix}@example.test`;
    const trustedIpAddress = "2001:db8:abcd:1234::42";
    const registration = await registerUser({
      email: loginEmail,
      password: "Correct-Horse-Battery-42!",
      displayName: "Login Integration",
      accountType: "CUSTOMER",
      acceptedTerms: true,
      acceptedPrivacy: true
    });
    createdUserIds.add(registration.userId);

    const failed = await loginWithPassword({
      email: loginEmail,
      password: "Wrong-Password-000!",
      trustedIpAddress
    });
    expect(failed).toMatchObject({
      authenticated: false,
      reason: "INVALID_PASSWORD"
    });

    const authenticated = await loginWithPassword({
      email: loginEmail,
      password: "Correct-Horse-Battery-42!",
      trustedIpAddress,
      userAgent: "mtjr2-postgres-integration"
    });
    expect(authenticated.authenticated).toBe(true);
    if (!authenticated.authenticated) throw new Error("Expected successful login.");

    expect(authenticated.userId).toBe(registration.userId);
    const [attempts, sessions, audit] = await Promise.all([
      prisma.loginAttempt.findMany({
        where: { userId: registration.userId },
        orderBy: { attemptedAt: "asc" }
      }),
      prisma.userSession.findMany({
        where: { userId: registration.userId }
      }),
      prisma.auditLog.findMany({
        where: {
          actorId: registration.userId,
          action: "identity.login.succeeded"
        }
      })
    ]);

    expect(attempts).toHaveLength(2);
    expect(attempts.map((attempt) => attempt.succeeded)).toEqual([false, true]);
    expect(attempts.every((attempt) => attempt.identifierHash !== loginEmail)).toBe(true);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tokenHash).not.toBe(authenticated.session.token);
    expect(sessions[0].tokenHash).toHaveLength(64);
    expect(audit).toHaveLength(1);

    await expect(resolveUserSession(authenticated.session.token)).resolves.toMatchObject({
      userId: registration.userId
    });
    await expect(revokeUserSession(authenticated.session.token)).resolves.toBe(true);
  });

  it("consumes a password reset token once, changes the password, and revokes sessions", async () => {
    const resetEmail = `reset-${suffix}@example.test`;
    const oldPassword = "Correct-Horse-Battery-42!";
    const newPassword = "New-Correct-Horse-Battery-73!";
    const registration = await registerUser({
      email: resetEmail,
      password: oldPassword,
      displayName: "Password Reset Integration",
      accountType: "CUSTOMER",
      acceptedTerms: true,
      acceptedPrivacy: true
    });
    createdUserIds.add(registration.userId);

    const activeSession = await createUserSession(registration.userId);
    const challenge = await createPasswordResetChallenge(resetEmail);
    expect(challenge).not.toBeNull();
    if (!challenge) throw new Error("Expected a password reset challenge.");

    const storedToken = await prisma.passwordResetToken.findFirstOrThrow({
      where: { userId: registration.userId },
      orderBy: { createdAt: "desc" }
    });
    expect(storedToken.tokenHash).not.toBe(challenge.token);
    expect(storedToken.tokenHash).toHaveLength(64);
    await prisma.passwordResetToken.create({
      data: {
        userId: registration.userId,
        tokenHash: randomUUID().replaceAll("-", "").repeat(2),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000)
      }
    });

    await expect(completePasswordReset(challenge.token, newPassword)).resolves.toBe(true);
    await expect(completePasswordReset(challenge.token, newPassword)).resolves.toBe(false);
    await expect(resolveUserSession(activeSession.token)).resolves.toBeNull();
    await expect(
      prisma.passwordResetToken.count({ where: { userId: registration.userId, consumedAt: null } })
    ).resolves.toBe(0);

    const updatedUser = await prisma.user.findUniqueOrThrow({
      where: { id: registration.userId },
      select: { passwordHash: true }
    });
    expect(updatedUser.passwordHash).not.toBeNull();
    await expect(verifyPassword(newPassword, updatedUser.passwordHash!)).resolves.toBe(true);
    await expect(verifyPassword(oldPassword, updatedUser.passwordHash!)).resolves.toBe(false);

    await expect(
      prisma.auditLog.findFirst({
        where: {
          actorId: registration.userId,
          action: "identity.password_reset.completed"
        }
      })
    ).resolves.not.toBeNull();
  });

});
