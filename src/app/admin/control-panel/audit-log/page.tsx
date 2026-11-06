import { notFound, redirect } from "next/navigation";
import {
  AuthenticationRequiredError,
  PermissionDeniedError,
  requirePlatformManagement
} from "@/server/identity/permission-guard";
import PlatformAuditLogPage from "@/features/admin/platform-audit-log-page";

export default async function PlatformAuditLogRoute() {
  try {
    await requirePlatformManagement();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/login?returnTo=%2Fadmin%2Fcontrol-panel%2Faudit-log");
    }
    if (error instanceof PermissionDeniedError) notFound();
    throw error;
  }
  return <PlatformAuditLogPage />;
}
