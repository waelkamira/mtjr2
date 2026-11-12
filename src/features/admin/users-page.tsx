"use client";

import { StatusBadge } from "@/components/status-badge";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type UserRow = {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  orderCount: number;
  sessionCount: number;
  roleCount: number;
};

type Result = { items: UserRow[]; page: number; pageCount: number; total: number };
type Filters = { q: string; status: string; page: number };
const statuses = ["PENDING", "ACTIVE", "SUSPENDED", "DISABLED"];

export default function AdminUsersPage() {
  const { locale } = useLocale();
  const [filters, setFilters] = useState<Filters>({ q: "", status: "", page: 1 });
  const [draftQuery, setDraftQuery] = useState("");
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(filters.page), limit: "25" });
    if (filters.q) params.set("q", filters.q);
    if (filters.status) params.set("status", filters.status);
    void Promise.resolve().then(async () => {
      try {
        const response = await fetch(`/api/admin/users?${params}`, { cache: "no-store" });
        const result = await response.json() as Result & { error?: string };
        if (!response.ok) throw new Error(result.error || translate(locale, "User list unavailable.", "قائمة المستخدمين غير متاحة."));
        if (active) { setData(result); setError(""); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : translate(locale, "User list unavailable.", "قائمة المستخدمين غير متاحة."));
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [filters, locale]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = draftQuery.trim();
    if (filters.q === q && filters.page === 1) return;
    setLoading(true);
    setFilters((current) => ({ ...current, q, page: 1 }));
  }

  function setStatus(status: string) {
    if (filters.status === status && filters.page === 1) return;
    setLoading(true);
    setFilters((current) => ({ ...current, status, page: 1 }));
  }

  return (
    <main className="min-h-screen px-3 py-5 sm:px-5 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">{translate(locale, "Identity administration", "إدارة الهوية")}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div><h1 className="text-3xl font-semibold text-[var(--color-forest-950)]">{translate(locale, "Users", "المستخدمون")}</h1><p className="mt-1 text-sm text-[var(--muted)]">{translate(locale, "Search accounts, inspect security history, and apply audited account restrictions.", "ابحث عن الحسابات واستعرض سجل الأمان وطبّق قيود الحسابات المسجلة في التدقيق.")}</p></div>
          <p className="text-sm text-[var(--muted)]">{data?.total ?? 0} {translate(locale, "matching accounts", "حساب مطابق")}</p>
        </div>
        <form onSubmit={search} className="mt-6 grid gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 sm:grid-cols-[1fr_220px_auto]">
          <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Search by name, email or exact user ID", "ابحث بالاسم أو البريد الإلكتروني أو معرّف المستخدم الكامل")}<input value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} maxLength={120} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label>
          <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Account status", "حالة الحساب")}<select value={filters.status} onChange={(event) => setStatus(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"><option value="">{translate(locale, "All statuses", "جميع الحالات")}</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
          <button disabled={loading} className="self-end rounded-xl bg-[var(--color-forest-900)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{translate(locale, "Search", "بحث")}</button>
        </form>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        <div className="mt-5 overflow-x-auto rounded-2xl border border-[var(--border)] bg-white">
          {loading && !data ? <div className="h-48 animate-pulse bg-[var(--color-ivory-100)]" /> : <table className="w-full min-w-[760px] text-left text-sm">
            <thead><tr className="border-b border-[var(--border)] bg-[var(--color-ivory-100)] text-xs text-[var(--muted)]"><th className="px-4 py-3 font-medium">{translate(locale, "User", "المستخدم")}</th><th className="px-4 py-3 font-medium">{translate(locale, "Status", "الحالة")}</th><th className="px-4 py-3 font-medium">{translate(locale, "Last sign-in", "آخر تسجيل دخول")}</th><th className="px-4 py-3 font-medium">{translate(locale, "Orders", "الطلبات")}</th><th className="px-4 py-3 font-medium">{translate(locale, "Roles", "الأدوار")}</th><th className="px-4 py-3 font-medium"></th></tr></thead>
            <tbody>{data?.items.map((user) => <tr key={user.id} className="border-b border-[var(--border)] last:border-0"><td className="px-4 py-3"><p className="font-semibold">{user.displayName || "—"}</p><p className="text-xs text-[var(--muted)]">{user.email}</p></td><td className="px-4 py-3"><StatusBadge locale={locale} status={user.status} /></td><td className="px-4 py-3">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : translate(locale, "Never", "أبدًا")}</td><td className="px-4 py-3">{user.orderCount}</td><td className="px-4 py-3">{user.roleCount}</td><td className="px-4 py-3"><Link href={`/admin/users/${encodeURIComponent(user.id)}`} className="font-semibold text-[var(--color-copper-600)] underline">{translate(locale, "View account", "عرض الحساب")}</Link></td></tr>)}</tbody>
          </table>}
          {!loading && !data?.items.length && !error && <p className="p-8 text-center text-sm text-[var(--muted)]">{translate(locale, "No accounts match this search.", "لا توجد حسابات تطابق هذا البحث.")}</p>}
        </div>
        {data && data.pageCount > 1 && <div className="mt-4 flex items-center justify-between"><button disabled={filters.page <= 1 || loading} onClick={() => { setLoading(true); setFilters((current) => ({ ...current, page: current.page - 1 })); }} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">{translate(locale, "Previous", "السابق")}</button><span className="text-sm text-[var(--muted)]">{translate(locale, "Page", "صفحة")} {data.page} {translate(locale, "of", "من")} {data.pageCount}</span><button disabled={filters.page >= data.pageCount || loading} onClick={() => { setLoading(true); setFilters((current) => ({ ...current, page: current.page + 1 })); }} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">{translate(locale, "Next", "التالي")}</button></div>}
      </div>
    </main>
  );
}
