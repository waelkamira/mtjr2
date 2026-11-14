import AdminProductQaPage from "@/features/admin/product-qa-page";
import { notFound } from "next/navigation";
import { requireCurrentSession } from "@/server/identity/current-session";
import { userHasPermission } from "@/server/identity/permission-repository";

export default async function AdminProductQaRoute() {
  const session = await requireCurrentSession();
  const allowed = await userHasPermission(session.userId, { permissionKey: "users:manage" });
  if (!allowed) notFound();
  return <AdminProductQaPage />;
}
