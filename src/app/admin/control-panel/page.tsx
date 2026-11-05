import { notFound, redirect } from "next/navigation";
import AdminDashboardPage from "@/features/admin/dashboard-page";
import Link from "next/link";
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

  return (
    <>
      <section className="border-b border-[var(--border)] bg-white px-5 py-5 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Restricted platform access</p>
            <h1 className="mt-1 text-xl font-semibold text-[var(--color-forest-950)]">Super Admin control center</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/control-panel/access-catalog" className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-forest-950)] hover:bg-[var(--color-ivory-100)]">
              Roles & permissions
            </Link>
            <Link href="/admin/control-panel/audit-log" className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-forest-950)] hover:bg-[var(--color-ivory-100)]">
              Platform audit log
            </Link>
          </div>
        </div>
      </section>
      <AdminDashboardPage />
    </>
  );
}
