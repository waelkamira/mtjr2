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

async function createActiveUser(label: string) {
  const email = `privilege-${label}-${suffix}@example.test`;
  const user = await prisma.user.create({
    data: {
      email,
      emailNormalized: email.toLowerCase(),
      displayName: `Privilege ${label}`,
      status: "ACTIVE"
    },
    select: { id: true, email: true }
  });
  userIds.push(user.id);
  return user;
}

async function grantSuperAdmin(userId: string, roleId: string) {
  await prisma.userRoleAssignment.create({
    data: { userId, roleId, scopeType: "GLOBAL", scopeId: "GLOBAL" }
  });
}

describe("platform privilege approval PostgreSQL integration", () => {
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

  it("rejects requester and target self-approval, then grants only after independent review", async () => {
    const [requester, target, reviewer] = await Promise.all([
      createActiveUser("requester"),
      createActiveUser("target"),
      createActiveUser("reviewer")
    ]);
    const role = await prisma.role.findUniqueOrThrow({
      where: { key: "SUPER_ADMIN" },
      select: { id: true }
    });
    await Promise.all([
      grantSuperAdmin(requester.id, role.id),
      grantSuperAdmin(reviewer.id, role.id)
    ]);

    auth.userId = requester.id;
    const request = await createPlatformPrivilegeRequest({
      email: target.email,
      reason: "Independent PostgreSQL integration verification of platform access."
    });

    auth.userId = requester.id;
    await expect(
      decidePlatformPrivilegeRequest(request.id, { decision: "APPROVE" })
    ).rejects.toBeInstanceOf(PlatformPrivilegeRequestConflictError);

    auth.userId = target.id;
    await expect(
      decidePlatformPrivilegeRequest(request.id, { decision: "APPROVE" })
    ).rejects.toBeInstanceOf(PlatformPrivilegeRequestConflictError);

    auth.userId = reviewer.id;
    const decision = await decidePlatformPrivilegeRequest(request.id, {
      decision: "APPROVE",
      note: "Approved by an independent reviewer."
    });
    expect(decision.status).toBe("APPROVED");

    const assignment = await prisma.userRoleAssignment.findFirst({
      where: {
        userId: target.id,
        scopeType: "GLOBAL",
        scopeId: "GLOBAL",
        role: { key: "SUPER_ADMIN" }
      },
      select: { id: true }
    });
    expect(assignment).not.toBeNull();
  });
});
