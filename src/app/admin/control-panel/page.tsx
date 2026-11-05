import { notFound, redirect } from "next/navigation";
import AdminDashboardPage from "@/features/admin/dashboard-page";
import {
  AuthenticationRequiredError,
  PermissionDeniedError,
  requirePlatformManagement
} from "@/server/identity/permission-guard";

export default async function AdminControlPanelRoute() {
  try {
    await requirePlatformManagement();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/login?returnTo=%2Fadmin%2Fcontrol-panel");
    }
    if (error instanceof PermissionDeniedError) notFound();
    throw error;
  }

  return <AdminDashboardPage />;
}
