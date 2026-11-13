import AdminPaymentsPage from "@/features/admin/payments-page";
import { notFound } from "next/navigation";
import { requireCurrentSession } from "@/server/identity/current-session";
import { userHasPermission } from "@/server/identity/permission-repository";

export default async function AdminPaymentsRoute() {
  const session = await requireCurrentSession();
  const allowed = await userHasPermission(session.userId, { permissionKey: "payments:read" });
  if (!allowed) notFound();
  return <AdminPaymentsPage />;
}
