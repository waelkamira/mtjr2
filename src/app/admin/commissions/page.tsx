import CommissionsPage from "@/features/admin/commissions-page";
import { notFound, redirect } from "next/navigation";
import {
  AuthenticationRequiredError,
  PermissionDeniedError,
  requirePlatformManagement
} from "@/server/identity/permission-guard";

export default async function AdminCommissionsRoute() {
  try {
    await requirePlatformManagement();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) redirect("/login?returnTo=%2Fadmin%2Fcommissions");
    if (error instanceof PermissionDeniedError) notFound();
    throw error;
  }
  return <CommissionsPage />;
}
