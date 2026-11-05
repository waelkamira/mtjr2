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

import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function SuperAdminControlPanelPage() {
  await guardSuperAdmin("/admin/control-panel");
  const items = [
    ["/admin/control-panel/access-catalog","Roles & permissions","Inspect system roles and effective permission definitions."],
    ["/admin/control-panel/privilege-requests","Privilege approvals","Review platform privilege requests with independent approval."],
    ["/admin/control-panel/audit-log","Platform audit log","Inspect privileged and security-sensitive events."]
  ];
  return <main className="min-h-screen bg-[var(--background)] px-5 py-10 lg:px-8"><div className="mx-auto max-w-6xl">
    <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Restricted platform access</p>
    <h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">Super Admin control center</h1>
    <p className="mt-3 max-w-3xl text-sm text-[var(--muted)]">Platform-wide governance tools. Every operation is authorized again on the server.</p>
    <div className="mt-8 grid gap-4 md:grid-cols-3">{items.map(([href,title,description])=><Link key={href} href={href} className="rounded-2xl border border-[var(--border)] bg-white p-6 hover:shadow-lg"><h2 className="font-semibold text-[var(--color-forest-950)]">{title}</h2><p className="mt-2 text-sm text-[var(--muted)]">{description}</p></Link>)}</div>
    <p className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">MFA/step-up verification is a mandatory release gate for privileged operations.</p>
  </div></main>;
}
