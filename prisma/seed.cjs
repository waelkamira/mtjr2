// CommonJS is intentional: this seed is executed directly by Node via `db:seed`.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const permissions = [
  { key: "account:read:own", description: "Read the authenticated user's own account." },
  { key: "account:update:own", description: "Update the authenticated user's own account." },
  { key: "orders:read:own", description: "Read orders belonging to the authenticated user." },
  { key: "store:read", description: "Read a store within the granted scope." },
  { key: "store:manage", description: "Manage a store within the granted scope." },
  { key: "store:staff:manage", description: "Manage staff assignments within the granted store scope." },
  { key: "catalog:read", description: "Read catalog products within the granted scope." },
  { key: "catalog:manage", description: "Create and manage catalog products within the granted scope." },
  { key: "inventory:manage", description: "Manage inventory within the granted scope." },
  { key: "orders:read", description: "Read orders within the granted scope." },
  { key: "orders:manage", description: "Manage orders within the granted scope." },
  { key: "users:read", description: "Read user records for authorized support or administration." },
  { key: "users:manage", description: "Manage user accounts and account status." },
  { key: "payments:read", description: "Read payment records within the granted scope." },
  { key: "payments:refund", description: "Initiate or approve refunds within the granted scope." },
  { key: "support:read", description: "Read customer support cases." },
  { key: "support:manage", description: "Manage customer support cases." },
  { key: "returns:manage", description: "Review and manage customer return requests." },
  { key: "messages:manage", description: "Read and reply to customer conversations within the granted store scope." },
  { key: "roles:read", description: "Read role and permission definitions." },
  { key: "roles:assign", description: "Assign roles within authorized scopes." },
  { key: "audit:read", description: "Read security and administrative audit events." },
  { key: "platform:manage", description: "Manage platform-wide configuration and operations." },
];

const roles = [
  {
    key: "CUSTOMER",
    name: "Customer",
    description: "Default buyer account role.",
    permissions: ["account:read:own", "account:update:own", "orders:read:own"],
  },
  {
    key: "SELLER",
    name: "Seller",
    description: "Seller account with store-scoped catalog, inventory, and order capabilities.",
    permissions: [
      "account:read:own", "account:update:own", "store:read", "store:manage",
      "catalog:read", "catalog:manage", "inventory:manage", "orders:read", "orders:manage", "messages:manage",
    ],
  },
  {
    key: "STORE_MANAGER",
    name: "Store Manager",
    description: "Delegated store operations role; assignments must be store-scoped.",
    permissions: [
      "store:read", "store:manage", "store:staff:manage", "catalog:read",
      "catalog:manage", "inventory:manage", "orders:read", "orders:manage", "messages:manage",
    ],
  },
  {
    key: "SUPPORT_AGENT",
    name: "Support Agent",
    description: "Customer support access limited by explicit support and resource scopes.",
    permissions: ["users:read", "orders:read", "support:read", "support:manage", "returns:manage"],
  },
  {
    key: "ADMIN",
    name: "Administrator",
    description: "Operational administration; grant only to approved staff.",
    permissions: [
      "users:read", "users:manage", "store:read", "store:manage", "catalog:read",
      "catalog:manage", "inventory:manage", "orders:read", "orders:manage",
      "payments:read", "payments:refund", "support:read", "support:manage", "returns:manage",
      "roles:read", "roles:assign", "audit:read",
    ],
  },
  {
    key: "SUPER_ADMIN",
    name: "Super Administrator",
    description: "Break-glass platform-wide administrator; never assign by default.",
    permissions: permissions.map((permission) => permission.key),
  },
];

async function main() {
  await prisma.$transaction(async (tx) => {
    const permissionRows = new Map();

    for (const permission of permissions) {
      const row = await tx.permission.upsert({
        where: { key: permission.key },
        create: permission,
        update: { description: permission.description },
      });
      permissionRows.set(permission.key, row);
    }

    for (const role of roles) {
      const row = await tx.role.upsert({
        where: { key: role.key },
        create: {
          key: role.key,
          name: role.name,
          description: role.description,
          isSystem: true,
        },
        update: {
          name: role.name,
          description: role.description,
          isSystem: true,
        },
      });

      for (const permissionKey of role.permissions) {
        const permission = permissionRows.get(permissionKey);
        if (!permission) {
          throw new Error(`Unknown permission "${permissionKey}" in role "${role.key}".`);
        }

        await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: row.id,
              permissionId: permission.id,
            },
          },
          create: { roleId: row.id, permissionId: permission.id },
          update: {},
        });
      }
    }
  });


  // Demo catalog requires two explicit opt-ins and is blocked in production.
  if (process.env.SEED_DEMO_CATALOG === "true") {
    if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEMO_CATALOG_SEED !== "true") {
      throw new Error("Demo catalog seeding is blocked in production and requires ALLOW_DEMO_CATALOG_SEED=true.");
    }
    await seedDemoCatalog();
  }

  const [roleCount, permissionCount, assignmentCount] = await Promise.all([
    prisma.role.count({ where: { isSystem: true } }),
    prisma.permission.count(),
    prisma.rolePermission.count(),
  ]);

  console.log(
    `Identity seed verified: ${roleCount} system roles, ${permissionCount} permissions, ${assignmentCount} role-permission links.`,
  );
}

main()
  .catch((error) => {
    console.error("Identity seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
