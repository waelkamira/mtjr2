import AdminAdvertisingPage from "@/features/admin/advertising-page";
import { notFound } from "next/navigation";
import { requireCurrentSession } from "@/server/identity/current-session";
import { userHasPermission } from "@/server/identity/permission-repository";

export default async function AdminAdvertisingRoute() {
  const session = await requireCurrentSession();
  const canModerateAdvertising = await userHasPermission(session.userId, { permissionKey: "ads:moderate" });
  if (!canModerateAdvertising) notFound();
  return <AdminAdvertisingPage />;
}
