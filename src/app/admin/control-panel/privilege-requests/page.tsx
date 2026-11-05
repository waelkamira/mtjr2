import { notFound, redirect } from "next/navigation";
import {
  AuthenticationRequiredError,
  PermissionDeniedError,
  requirePlatformManagement
} from "@/server/identity/permission-guard";
import PlatformPrivilegeRequestsPage from "@/features/admin/platform-privilege-requests-page";

export default async function PlatformPrivilegeRequestsRoute() {
  try {
    await requirePlatformManagement();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/login?returnTo=%2Fadmin%2Fcontrol-panel%2Fprivilege-requests");
    }
    if (error instanceof PermissionDeniedError) notFound();
    throw error;
  }
  return <PlatformPrivilegeRequestsPage />;
}
