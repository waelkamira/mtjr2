import AdminSupportPage from "@/features/admin/support-page";
import { notFound } from "next/navigation";
import { requireCurrentSession } from "@/server/identity/current-session";
import { userHasPermission } from "@/server/identity/permission-repository";

export default async function AdminSupportRoute() {
  const session = await requireCurrentSession();
  const allowed = await userHasPermission(session.userId, { permissionKey: "support:manage" });
  if (!allowed) notFound();
  return <AdminSupportPage />;
}
