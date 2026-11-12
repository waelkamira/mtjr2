"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type Permission = { key: string; description: string | null };
type Role = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: Permission[];
  assignmentCount: number;
};
type Catalog = {
  roles: Role[];
  permissions: Array<Permission & { roleCount: number }>;
  generatedAt: string;
};

export default function PlatformAccessCatalogPage() {
  const { locale } = useLocale();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/control-panel/access-catalog", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as Catalog & { error?: string };
        if (!response.ok) throw new Error(data.error || "Unable to load access catalogue.");
        if (active) setCatalog(data);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load access catalogue.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const filteredRoles = useMemo(() => (catalog?.roles || []).filter((role) =>
    !normalizedQuery || [role.name, role.key, role.description || "", ...role.permissions.map((permission) => permission.key)]
      .some((value) => value.toLocaleLowerCase(locale).includes(normalizedQuery))
  ), [catalog, normalizedQuery, locale]);
  const filteredPermissions = useMemo(() => (catalog?.permissions || []).filter((permission) =>
    !normalizedQuery || [permission.key, permission.description || ""]
      .some((value) => value.toLocaleLowerCase(locale).includes(normalizedQuery))
  ), [catalog, normalizedQuery, locale]);

  return (
    <main aria-busy={loading} className="min-h-screen bg-[var(--background)] px-3 py-5 sm:px-5 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin/control-panel" className="text-sm font-medium text-[var(--color-copper-600)] hover:underline">{translate(locale, "← Platform control panel", "← لوحة التحكم الرئيسية للمنصة")}</Link>
        <header className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">{translate(locale, "Security & governance", "الأمن والحوكمة")}</p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">{translate(locale, "Roles & permissions", "الأدوار والصلاحيات")}</h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">{translate(locale, "Read-only inventory of platform roles, permission grants and current assignment counts. Changes remain disabled until a separately audited approval workflow is implemented.", "عرض للقراءة فقط لأدوار المنصة ومنح الصلاحيات وأعداد التعيينات الحالية. تظل التغييرات معطلة حتى تنفيذ إجراء موافقة يخضع لتدقيق مستقل.")}</p>
        </header>

        {catalog && <div className="mt-6 rounded-xl border border-[var(--border)] bg-white p-4"><label className="block text-xs font-semibold text-[var(--muted)]">{translate(locale, "Search roles and permissions", "ابحث في الأدوار والصلاحيات")}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={translate(locale, "Search by role, permission key or description…", "ابحث باسم الدور أو مفتاح الصلاحية أو الوصف…")} className="mt-2 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-slate-400 focus:border-orange-300 focus:outline-none focus:ring-4 focus:ring-orange-50" /></label><p className="mt-2 text-xs text-[var(--muted)]">{filteredRoles.length} {translate(locale, "roles shown", "أدوار معروضة")} · {filteredPermissions.length} {translate(locale, "permissions shown", "صلاحيات معروضة")}</p></div>}

        {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {loading && <p role="status" className="mt-6 rounded-xl border border-[var(--border)] bg-white p-5 text-sm text-[var(--muted)]">{translate(locale, "Loading access catalogue…", "جارٍ تحميل كتالوج الصلاحيات…")}</p>}
        {catalog && (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><p className="text-xs text-[var(--muted)]">{translate(locale, "Defined roles", "الأدوار المعرفة")}</p><p className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">{catalog.roles.length}</p></div>
              <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><p className="text-xs text-[var(--muted)]">{translate(locale, "Permission keys", "مفاتيح الصلاحيات")}</p><p className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">{catalog.permissions.length}</p></div>
              <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><p className="text-xs text-[var(--muted)]">{translate(locale, "Role assignments", "تعيينات الأدوار")}</p><p className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">{catalog.roles.reduce((sum, role) => sum + role.assignmentCount, 0)}</p></div>
            </div>

            <section className="mt-7 overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
              <div className="border-b border-[var(--border)] p-5"><h2 className="text-lg font-semibold text-[var(--color-forest-950)]">{translate(locale, "Role catalogue", "كتالوج الأدوار")}</h2><p className="mt-1 text-xs text-[var(--muted)]">{translate(locale, "System roles are marked; permission keys are listed exactly as stored.", "تُميز أدوار النظام، وتُعرض مفاتيح الصلاحيات كما هي مخزنة.")}</p></div>
              <div className="divide-y divide-[var(--border)]">
                {filteredRoles.length === 0 ? <p className="p-5 text-center text-sm text-[var(--muted)]">{translate(locale, "No roles match this search.", "لا توجد أدوار تطابق البحث.")}</p> : filteredRoles.map((role) => (
                  <article key={role.id} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[var(--color-forest-950)]">{role.name}</h3><code className="rounded bg-[var(--color-ivory-100)] px-2 py-1 text-xs">{role.key}</code>{role.isSystem && <span className="rounded-full border border-[var(--border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">{translate(locale, "System", "النظام")}</span>}</div>{role.description && <p className="mt-2 text-sm text-[var(--muted)]">{role.description}</p>}</div>
                      <span className="text-xs text-[var(--muted)]">{role.assignmentCount} {translate(locale, "assignments", "تعيين")}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {role.permissions.length ? role.permissions.map((permission) => <span key={permission.key} title={permission.description || undefined} className="rounded-lg border border-[var(--border)] bg-[var(--color-ivory-100)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--color-forest-950)]">{permission.key}</span>) : <span className="text-xs text-[var(--muted)]">{translate(locale, "No permissions assigned", "لا توجد صلاحيات مسندة")}</span>}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="mt-7 overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
              <div className="border-b border-[var(--border)] p-5"><h2 className="text-lg font-semibold text-[var(--color-forest-950)]">{translate(locale, "Permission catalogue", "كتالوج الصلاحيات")}</h2><p className="mt-1 text-xs text-[var(--muted)]">{translate(locale, "Number of roles containing each permission.", "عدد الأدوار التي تتضمن كل صلاحية.")}</p></div>
              <div className="grid gap-px bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-3">
                {filteredPermissions.length === 0 ? <p className="col-span-full bg-white p-5 text-center text-sm text-[var(--muted)]">{translate(locale, "No permissions match this search.", "لا توجد صلاحيات تطابق البحث.")}</p> : filteredPermissions.map((permission) => <article key={permission.key} className="bg-white p-4"><code className="text-xs font-semibold text-[var(--color-forest-950)]">{permission.key}</code><p className="mt-1 text-xs text-[var(--muted)]">{permission.description || translate(locale, "No description", "لا يوجد وصف")}</p><p className="mt-2 text-[11px] text-[var(--muted)]">{translate(locale, "Used by", "مستخدمة في")} {permission.roleCount} {translate(locale, "roles", "أدوار")}</p></article>)}
              </div>
            </section>
            <p className="mt-4 text-xs text-[var(--muted)]">{translate(locale, "Snapshot generated", "تم إنشاء اللقطة")} {new Date(catalog.generatedAt).toLocaleString(locale === "ar" ? "ar-SY" : "en-GB")}. {translate(locale, "This page is read-only; role mutations are intentionally unavailable here.", "هذه الصفحة للقراءة فقط؛ ولا تتوفر فيها تغييرات الأدوار.")}</p>
          </>
        )}
      </div>
    </main>
  );
}
