// One-time, explicitly targeted bootstrap for the first Super Admin.
// Never run this against a database unless the expected host and database have
// been independently confirmed by the operator.
// Load .env when present; deployment environments may inject variables directly.
// Node 22 provides this without another package.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("node:fs");
if (fs.existsSync(".env")) process.loadEnvFile(".env");

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client");

function readBootstrapTarget() {
  if (process.env.ALLOW_SUPER_ADMIN_BOOTSTRAP !== "true") {
    throw new Error("Set ALLOW_SUPER_ADMIN_BOOTSTRAP=true to explicitly enable this one-time operation.");
  }
  if (process.env.BOOTSTRAP_SUPER_ADMIN_CONFIRM !== "CREATE_FIRST_SUPER_ADMIN") {
    throw new Error("Set BOOTSTRAP_SUPER_ADMIN_CONFIRM=CREATE_FIRST_SUPER_ADMIN to confirm the operation.");
  }

  const email = (process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
  const expectedHost = (process.env.BOOTSTRAP_SUPER_ADMIN_EXPECTED_HOST || "").trim().toLowerCase();
  const expectedDatabase = (process.env.BOOTSTRAP_SUPER_ADMIN_EXPECTED_DATABASE || "").trim();

  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("BOOTSTRAP_SUPER_ADMIN_EMAIL must be a valid, existing account email.");
  }
  if (!expectedHost || !expectedDatabase) {
    throw new Error("Expected database host and name are both required; no target is inferred.");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  let parsed;
  try { parsed = new URL(databaseUrl); } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
  }
  const actualDatabase = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error("Super Admin bootstrap only supports PostgreSQL.");
  }
  if (parsed.hostname.toLowerCase() !== expectedHost || actualDatabase !== expectedDatabase) {
    throw new Error("DATABASE_URL does not match the explicitly confirmed host and database name.");
  }

  return { email, host: parsed.hostname, database: actualDatabase };
}

async function main() {
  const target = readBootstrapTarget();
  const prisma = new PrismaClient();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Serialize bootstrap attempts, including attempts from separate machines.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(74192831, 20261105)`;

      const existing = await tx.userRoleAssignment.findFirst({
        where: { role: { key: "SUPER_ADMIN" } },
        select: { id: true }
      });
      if (existing) {
        throw new Error("A SUPER_ADMIN assignment already exists. Bootstrap is permanently closed for this database.");
      }

      const [user, role] = await Promise.all([
        tx.user.findUnique({
          where: { emailNormalized: target.email },
          select: { id: true, status: true, emailVerifiedAt: true }
        }),
        tx.role.findUnique({
          where: { key: "SUPER_ADMIN" },
          select: {
            id: true,
            permissions: {
              where: { permission: { key: "platform:manage" } },
              select: { permission: { select: { key: true } } }
            }
          }
        })
      ]);

      if (!user || user.status !== "ACTIVE" || !user.emailVerifiedAt) {
        throw new Error("The target must be an existing, active account with a verified email address.");
      }
      if (!role || !role.permissions.some(({ permission }) => permission.key === "platform:manage")) {
        throw new Error("The SUPER_ADMIN role or its platform:manage permission is missing. Run the identity seed first.");
      }

      const assignment = await tx.userRoleAssignment.create({
        data: {
          userId: user.id,
          roleId: role.id,
          scopeType: "GLOBAL",
          scopeId: "GLOBAL",
          assignedBy: null
        },
        select: { id: true }
      });

      await tx.auditLog.create({
        data: {
          actorType: "SYSTEM",
          actorId: null,
          action: "identity.super_admin.first_bootstrap",
          resource: "user",
          resourceId: user.id,
          scopeType: "GLOBAL",
          scopeId: "GLOBAL",
          metadata: {
            assignmentId: assignment.id,
            roleKey: "SUPER_ADMIN",
            permissionKey: "platform:manage",
            bootstrapHost: target.host,
            bootstrapDatabase: target.database
          }
        }
      });

      return { userId: user.id, assignmentId: assignment.id };
    }, { isolationLevel: "Serializable" });

    console.log("First Super Admin successfully assigned.");
    console.log(`Database target: ${target.host}/${target.database}`);
    console.log(`User ID: ${result.userId}`);
    console.log(`Assignment ID: ${result.assignmentId}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Super Admin bootstrap failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
