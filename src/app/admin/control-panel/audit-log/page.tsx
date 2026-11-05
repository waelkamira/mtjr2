import { requireSuperAdminPage } from "@/server/identity/super-admin-page-guard";
import PlatformAuditLogPage from "@/features/admin/platform-audit-log-page";
export const dynamic = "force-dynamic";
export default async function Page() { await requireSuperAdminPage("/admin/control-panel/audit-log"); return <PlatformAuditLogPage />; }
