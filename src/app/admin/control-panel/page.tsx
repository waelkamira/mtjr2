import { notFound, redirect } from "next/navigation";
import { MfaEnrollmentRequiredError, MfaVerificationRequiredError, StepUpRequiredError } from "@/server/identity/access-errors";
import AdminDashboardPage from "@/features/admin/dashboard-page";
import Link from "next/link";
import { getPreferredLocale } from "@/server/locale";
import { translate } from "@/lib/locale";
import {
  AuthenticationRequiredError,
  PermissionDeniedError,
  requirePlatformManagement
} from "@/server/identity/permission-guard";

export default async function AdminControlPanelRoute() {
  const locale = await getPreferredLocale();
  try {
    await requirePlatformManagement();
  } catch (error) {
    if (error instanceof MfaEnrollmentRequiredError) redirect("/account/security?mfa=setup&returnTo=%2Fadmin%2Fcontrol-panel");
    if (error instanceof MfaVerificationRequiredError) redirect("/account/security?mfa=verify&returnTo=%2Fadmin%2Fcontrol-panel");
    if (error instanceof StepUpRequiredError) redirect("/mfa/verify?returnTo=%2Fadmin%2Fcontrol-panel");
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
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">{translate(locale, "Restricted platform access", "وصول مقيّد للمنصة")}</p>
            <h1 className="mt-1 text-xl font-semibold text-[var(--color-forest-950)]">{translate(locale, "Super Admin control center", "مركز تحكم المشرف الأعلى")}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/control-panel/access-catalog" className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#D96500]">
              {translate(locale, "Roles & permissions", "الأدوار والصلاحيات")}
            </Link>
            <Link href="/admin/control-panel/privilege-requests" className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-forest-950)] hover:bg-[var(--color-ivory-100)]">
              {translate(locale, "Privilege approvals", "الموافقة على الامتيازات")}
            </Link>
            <Link href="/admin/payment-providers" className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-forest-950)] hover:bg-[var(--color-ivory-100)]">\n              {translate(locale, "Payment providers", "مزودو الدفع")}\n            </Link>\n            <Link href="/admin/control-panel/ai-assistant" className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-forest-950)] hover:bg-[var(--color-ivory-100)]">
              {translate(locale, "AI assistant", "المساعد الذكي")}
            </Link>
            <Link href="/admin/control-panel/audit-log" className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-forest-950)] hover:bg-[var(--color-ivory-100)]">
              {translate(locale, "Platform audit log", "سجل تدقيق المنصة")}
            </Link>
          </div>
        </div>
      </section>
      <AdminDashboardPage />
    </>
  );
}
