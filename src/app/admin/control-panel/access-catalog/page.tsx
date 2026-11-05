import { notFound, redirect } from "next/navigation";
import { AuthenticationRequiredError, PermissionDeniedError, requirePlatformManagement } from "@/server/identity/permission-guard";
async function guardSuperAdmin(returnTo: string) {
  try { await requirePlatformManagement(); }
  catch (error) {
    if (error instanceof AuthenticationRequiredError) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    if (error instanceof PermissionDeniedError) notFound();
    throw error;
  }
}

import PlatformAccessCatalogPage from "@/features/admin/platform-access-catalog-page";
export const dynamic = "force-dynamic";
export default async function Page() { await guardSuperAdmin("/admin/control-panel/access-catalog"); return <PlatformAccessCatalogPage />; }
