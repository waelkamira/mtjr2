import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { registerUser, verifyUserEmail } from "@/server/identity/registration";
import {
  createUserSession,
  resolveUserSession,
  revokeUserSession
} from "@/server/identity/session";
import { userHasPermission } from "@/server/identity/permission-repository";

const suffix = randomUUID();
const email = `integration-${suffix}@example.test`;
let userId: string | undefined;

describe("identity PostgreSQL integration", () => {
  afterAll(async () => {
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.$disconnect();
  });

  it("registers, verifies, scopes permissions, and revokes a real database session", async () => {
    const registration = await registerUser({
      email,
      password: "Correct-Horse-Battery-42!",
      displayName: "Integration Buyer",
      acceptedTerms: true,
      acceptedPrivacy: true
    });
    userId = registration.userId;

    const pending = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { consents: true, verificationTokens: true }
    });

    expect(pending.status).toBe("PENDING");
    expect(pending.consents).toHaveLength(2);
    expect(pending.verificationTokens).toHaveLength(1);
    expect(pending.verificationTokens[0].tokenHash).not.toBe(registration.verificationToken);

    await expect(verifyUserEmail(registration.verificationToken)).resolves.toBe(true);
    await expect(verifyUserEmail(registration.verificationToken)).resolves.toBe(false);

    const active = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(active.status).toBe("ACTIVE");
    expect(active.emailVerifiedAt).not.toBeNull();

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
});
