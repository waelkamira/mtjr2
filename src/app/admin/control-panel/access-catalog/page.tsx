import { requireSuperAdminPage } from "@/server/identity/super-admin-page-guard";
import PlatformAccessCatalogPage from "@/features/admin/platform-access-catalog-page";
export const dynamic = "force-dynamic";
export default async function Page() { await requireSuperAdminPage("/admin/control-panel/access-catalog"); return <PlatformAccessCatalogPage />; }
