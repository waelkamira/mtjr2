import AdminPaymentsPage from "@/features/admin/payments-page";
import { notFound } from "next/navigation";
import { requireCurrentSession } from "@/server/identity/current-session";
import { userHasAnyPermission } from "@/server/identity/permission-repository";

export default async function AdminPaymentsRoute() {
  const session = await requireCurrentSession();
  const allowed = await userHasAnyPermission(session.userId, [
    { permissionKey: "payments:read" },
    { permissionKey: "payments:refund" }
  ]);
  if (!allowed) notFound();
  return <AdminPaymentsPage />;
}
