import AdminRefundsPage from "@/features/admin/refunds-page";
import { notFound } from "next/navigation";
import { requireCurrentSession } from "@/server/identity/current-session";
import { userHasPermission } from "@/server/identity/permission-repository";

export default async function AdminRefundsRoute() {
  const session = await requireCurrentSession();
  const allowed = await userHasPermission(session.userId, { permissionKey: "payments:refund" });
  if (!allowed) notFound();
  return <AdminRefundsPage />;
}
