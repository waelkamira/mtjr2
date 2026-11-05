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
const users = {
  requester: { email: `requester-${suffix}@example.test`, displayName: "Privilege requester" },
  target: { email: `target-${suffix}@example.test`, displayName: "Privilege target" },
  reviewer: { email: `reviewer-${suffix}@example.test`, displayName: "Independent reviewer" }
};
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

async function grantSuperAdmin(userId: string, roleId: string) {
  await prisma.userRoleAssignment.create({
    data: {
      userId,
      roleId,
      scopeType: "GLOBAL",
      scopeId: "GLOBAL"
    }
  });
}

describe("platform privilege approval PostgreSQL integration", () => {
  afterAll(async () => {
    if (userIds.length) {
      await prisma.platformPrivilegeRequest.deleteMany({
        where: { OR: [{ targetUserId: { in: userIds } }, { requestedById: { in: userIds } }, { reviewedById: { in: userIds } }] }
      });
      await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
      await prisma.userRoleAssignment.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  });

  it("requires a verified target and a reviewer independent from both requester and target", async () => {
    const [requester, target, reviewer] = await Promise.all([
      createActiveUser(users.requester.email, users.requester.displayName),
      createActiveUser(users.target.email, users.target.displayName),
      createActiveUser(users.reviewer.email, users.reviewer.displayName)
    ]);
    const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { key: "SUPER_ADMIN" } });
    await Promise.all([
      grantSuperAdmin(requester.id, superAdminRole.id),
      grantSuperAdmin(reviewer.id, superAdminRole.id)
    ]);

    auth.userId = requester.id;
    const created = await createPlatformPrivilegeRequest({
      email: target.email,
      reason: "The user requires platform-wide access to operate the global marketplace."
    });

    auth.userId = requester.id;
    await expect(decidePlatformPrivilegeRequest(created.id, { decision: "APPROVE" }))
      .rejects.toBeInstanceOf(PlatformPrivilegeRequestConflictError);

    auth.userId = target.id;
    await expect(decidePlatformPrivilegeRequest(created.id, { decision: "APPROVE" }))
      .rejects.toBeInstanceOf(PlatformPrivilegeRequestConflictError);

    auth.userId = reviewer.id;
    const decision = await decidePlatformPrivilegeRequest(created.id, {
      decision: "APPROVE",
      note: "Independently reviewed and approved."
    });
    expect(decision.status).toBe("APPROVED");

    const [assignment, audit] = await Promise.all([
      prisma.userRoleAssignment.findFirst({
        where: {
          userId: target.id,
          roleId: superAdminRole.id,
          scopeType: "GLOBAL",
          scopeId: "GLOBAL"
        }
      }),
      prisma.auditLog.findFirst({
        where: {
          actorId: reviewer.id,
          action: "platform.privilege_request.approved",
          resourceId: created.id
        }
      })
    ]);
    expect(assignment).not.toBeNull();
    expect(audit).not.toBeNull();
  });

  it("serializes concurrent pending requests for the same target", async () => {
    const [requester, target] = await Promise.all([
      createActiveUser(`requester-race-${suffix}@example.test`, "Race requester"),
      createActiveUser(`target-race-${suffix}@example.test`, "Race target")
    ]);
    const role = await prisma.role.findUniqueOrThrow({ where: { key: "SUPER_ADMIN" } });
    await grantSuperAdmin(requester.id, role.id);
    auth.userId = requester.id;

    const results = await Promise.allSettled([
      createPlatformPrivilegeRequest({ email: target.email, reason: "A concurrent request for platform access number one." }),
      createPlatformPrivilegeRequest({ email: target.email, reason: "A concurrent request for platform access number two." })
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
  });

  it("rejects an unverified target account", async () => {
    const requester = await createActiveUser(`requester-unverified-${suffix}@example.test`, "Verified requester");
    const target = await prisma.user.create({
      data: {
        email: `unverified-target-${suffix}@example.test`,
        emailNormalized: `unverified-target-${suffix}@example.test`,
        displayName: "Unverified target",
        status: "ACTIVE"
      },
      select: { id: true, email: true }
    });
    userIds.push(target.id);
    const role = await prisma.role.findUniqueOrThrow({ where: { key: "SUPER_ADMIN" } });
    await grantSuperAdmin(requester.id, role.id);
    auth.userId = requester.id;

    await expect(createPlatformPrivilegeRequest({
      email: target.email,
      reason: "An unverified account must not receive platform-wide access."
    })).rejects.toBeInstanceOf(PlatformPrivilegeRequestConflictError);
  });
});
