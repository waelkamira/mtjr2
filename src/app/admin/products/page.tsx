import AdminProductsPage from "@/features/admin/products-page";
import { requireCurrentSession } from "@/server/identity/current-session";
import { userHasPermission } from "@/server/identity/permission-repository";

export default async function AdminProductsRoute() {
  const session = await requireCurrentSession();
  const canManageCatalog = await userHasPermission(session.userId, { permissionKey: "catalog:manage" });
  return <AdminProductsPage canManageCatalog={canManageCatalog} />;
}
