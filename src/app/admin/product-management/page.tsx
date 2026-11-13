import AdminCatalogProductsManagementPage from "@/features/admin/catalog-products-management-page";
import { requireCurrentSession } from "@/server/identity/current-session";
import { userHasPermission } from "@/server/identity/permission-repository";

export default async function AdminCatalogProductsManagementRoute() {
  const session = await requireCurrentSession();
  const canManageCatalog = await userHasPermission(session.userId, { permissionKey: "catalog:manage" });
  return <AdminCatalogProductsManagementPage canManageCatalog={canManageCatalog} />;
}
