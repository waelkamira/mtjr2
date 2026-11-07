import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/server/identity/permission-guard", () => ({
  requirePlatformManagement: async () => ({ userId: auth.userId })
}));

import { prisma } from "@/lib/db/prisma";
import {
  createPlatformPrivilegeRequest,
  decidePlatformPrivilegeRequest,
  PlatformPrivilegeRequestConflictError
} from "@/server/admin/platform-privilege-requests";

const suffix = randomUUID();
const userIds: string[] = [];

async function createActiveUser(email: string, displayName: string) {
  const user = await prisma.user.create({
    data: {
      email,
      emailNormalized: email.toLowerCase(),
      displayName,
      status: "ACTIVE",
      emailVerifiedAt: new Date()
    },
    select: { id: true, email: true }
  });
  userIds.push(user.id);
  return user;
}

describe("platform privilege reviewer independence PostgreSQL integration", () => {
  afterAll(async () => {
    if (userIds.length) {
      await prisma.platformPrivilegeRequest.deleteMany({
        where: {
          OR: [
            { targetUserId: { in: userIds } },
            { requestedById: { in: userIds } },
            { reviewedById: { in: userIds } }
          ]
        }
      });
      await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
      await prisma.userRoleAssignment.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  });

  it("rejects both requester and target as reviewers, then accepts an independent reviewer", async () => {
    const [requester, target, reviewer] = await Promise.all([
      createActiveUser(`requester-${suffix}@example.test`, "Privilege requester"),
      createActiveUser(`target-${suffix}@example.test`, "Privilege target"),
      createActiveUser(`reviewer-${suffix}@example.test`, "Independent reviewer")
    ]);
    const role = await prisma.role.findUniqueOrThrow({ where: { key: "SUPER_ADMIN" } });
    await prisma.userRoleAssignment.createMany({
      data: [requester.id, reviewer.id].map(userId => ({
        userId,
        roleId: role.id,
        scopeType: "GLOBAL" as const,
        scopeId: "GLOBAL"
      }))
    });

    auth.userId = requester.id;
    const request = await createPlatformPrivilegeRequest({
      email: target.email,
      reason: "The target requires platform-wide access for controlled operations."
    });

    auth.userId = requester.id;
    await expect(
      decidePlatformPrivilegeRequest(request.id, { decision: "APPROVE" })
    ).rejects.toBeInstanceOf(PlatformPrivilegeRequestConflictError);

    auth.userId = target.id;
    await expect(
      decidePlatformPrivilegeRequest(request.id, { decision: "APPROVE" })
    ).rejects.toBeInstanceOf(PlatformPrivilegeRequestConflictError);

    await expect(
      prisma.userRoleAssignment.count({ where: { userId: target.id, roleId: role.id } })
    ).resolves.toBe(0);

    auth.userId = reviewer.id;
    await expect(
      decidePlatformPrivilegeRequest(request.id, {
        decision: "APPROVE",
        note: "Independently reviewed."
      })
    ).resolves.toMatchObject({ status: "APPROVED" });

    await expect(
      prisma.userRoleAssignment.count({
        where: {
          userId: target.id,
          roleId: role.id,
          scopeType: "GLOBAL",
          scopeId: "GLOBAL"
        }
      })
    ).resolves.toBe(1);
    await expect(
      prisma.auditLog.findFirst({
        where: {
          actorId: reviewer.id,
          action: "platform.privilege_request.approved",
          resourceId: request.id
        }
      })
    ).resolves.not.toBeNull();
  });
});
