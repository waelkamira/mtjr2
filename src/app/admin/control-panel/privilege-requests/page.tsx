import { requireSuperAdminPage } from "@/server/identity/super-admin-page-guard";
import PlatformPrivilegeRequestsPage from "@/features/admin/platform-privilege-requests-page";
export const dynamic = "force-dynamic";
export default async function Page() { await requireSuperAdminPage("/admin/control-panel/privilege-requests"); return <PlatformPrivilegeRequestsPage />; }
