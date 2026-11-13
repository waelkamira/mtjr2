import AdminReviewPage from "@/features/admin/review-page";
import { notFound } from "next/navigation";
import { requireCurrentSession } from "@/server/identity/current-session";
import { userHasPermission } from "@/server/identity/permission-repository";

export default async function AdminReviewRoute() {
  const session = await requireCurrentSession();
  const allowed = await userHasPermission(session.userId, { permissionKey: "users:manage" });
  if (!allowed) notFound();
  return <AdminReviewPage />;
}
