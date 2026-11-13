import AdminDashboardPage from "@/features/admin/dashboard-page";
import { requirePermission } from "@/server/identity/permission-guard";
import { getUserAuthorizationGrants } from "@/server/identity/permission-repository";

export default async function AdminDashboardRoute() {
  const session = await requirePermission({ permissionKey: "users:manage" });
  const grants = await getUserAuthorizationGrants(session.userId);
  const permissions = [...new Set(grants
    .filter((grant) => grant.scopeType === "GLOBAL" && grant.scopeId === "GLOBAL")
    .map((grant) => grant.permissionKey))];

  return <AdminDashboardPage permissions={permissions} />;
}
