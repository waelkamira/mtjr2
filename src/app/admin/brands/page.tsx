import AdminBrandsPage from "@/features/admin/brands-page";
import { requireCurrentSession } from "@/server/identity/current-session";
import { userHasPermission } from "@/server/identity/permission-repository";

export default async function AdminBrandsRoute() {
  const session = await requireCurrentSession();
  const canManageCatalog = await userHasPermission(session.userId, { permissionKey: "catalog:manage" });
  return <AdminBrandsPage canManageCatalog={canManageCatalog} />;
}
