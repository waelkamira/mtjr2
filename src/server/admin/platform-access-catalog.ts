import "server-only";

import { prisma } from "@/lib/db/prisma";
import { requirePlatformManagement } from "@/server/identity/permission-guard";

export async function getPlatformAccessCatalog(now = new Date()) {
  await requirePlatformManagement(now);
  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      orderBy: [{ isSystem: "desc" }, { key: "asc" }],
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        isSystem: true,
        permissions: {
          orderBy: { permission: { key: "asc" } },
          select: { permission: { select: { key: true, description: true } } }
        },
        _count: { select: { assignments: true } }
      }
    }),
    prisma.permission.findMany({
      orderBy: { key: "asc" },
      select: { key: true, description: true, _count: { select: { roles: true } } }
    })
  ]);

  return {
    roles: roles.map((role) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.permissions.map(({ permission }) => permission),
      assignmentCount: role._count.assignments
    })),
    permissions: permissions.map((permission) => ({
      key: permission.key,
      description: permission.description,
      roleCount: permission._count.roles
    })),
    generatedAt: now.toISOString()
  };
}
