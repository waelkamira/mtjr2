import AdminCategoriesPage from "@/features/admin/categories-page";
import { requireCurrentSession } from "@/server/identity/current-session";
import { userHasPermission } from "@/server/identity/permission-repository";

export default async function AdminCategoriesRoute() {
  const session = await requireCurrentSession();
  const canManageCatalog = await userHasPermission(session.userId, { permissionKey: "catalog:manage" });
  return <AdminCategoriesPage canManageCatalog={canManageCatalog} />;
}
