"use client";

import { StatusBadge } from "@/components/status-badge";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate, translateStatus } from "@/lib/locale";

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
    setLoading(true);
    setError("");
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
    <main className="min-h-screen bg-[#f5f6f8] px-4 py-6 sm:px-6 lg:px-9">
      <div className="mx-auto max-w-[1600px]">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-[#d97706]">{translate(locale, "Identity administration", "إدارة الهوية")}</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-6">
          <div><h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{translate(locale, "Users", "المستخدمون")}</h1><p className="mt-1 text-sm text-[var(--muted)]">{translate(locale, "Search accounts, inspect security history, and apply audited account restrictions.", "ابحث عن الحسابات واستعرض سجل الأمان وطبّق قيود الحسابات المسجلة في التدقيق.")}</p></div>
          <p className="text-sm text-[var(--muted)]">{data?.total ?? 0} {translate(locale, "matching accounts", "حساب مطابق")}</p>
        </div>
        <form onSubmit={search} className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_220px_auto]">
          <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Search by name, email or exact user ID", "ابحث بالاسم أو البريد الإلكتروني أو معرّف المستخدم الكامل")}<input type="search" value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} maxLength={120} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100" /></label>
          <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Account status", "حالة الحساب")}<select value={filters.status} onChange={(event) => setStatus(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100"><option value="">{translate(locale, "All statuses", "جميع الحالات")}</option>{statuses.map((status) => <option key={status} value={status}>{translateStatus(locale, status)}</option>)}</select></label>
          <button disabled={loading} className="self-end rounded-lg bg-[#FF8C1C] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#F0780B] disabled:opacity-60">{translate(locale, "Search", "بحث")}</button>
        </form>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        <div aria-busy={loading} className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading && !data ? <div className="h-48 animate-pulse bg-[var(--color-ivory-100)]" /> : <table className="w-full min-w-[980px] text-start text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50"><tr className="border-b border-slate-200 text-xs font-semibold text-slate-500"><th className="px-4 py-3 font-medium">{translate(locale, "User", "المستخدم")}</th><th className="px-4 py-3 font-medium">{translate(locale, "Status", "الحالة")}</th><th className="px-4 py-3 font-medium">{translate(locale, "Joined", "تاريخ التسجيل")}</th><th className="px-4 py-3 font-medium">{translate(locale, "Last sign-in", "آخر تسجيل دخول")}</th><th className="px-4 py-3 font-medium">{translate(locale, "Orders", "الطلبات")}</th><th className="px-4 py-3 font-medium">{translate(locale, "Active sessions", "الجلسات النشطة")}</th><th className="px-4 py-3 font-medium">{translate(locale, "Roles", "الأدوار")}</th><th className="px-4 py-3 font-medium"></th></tr></thead>
            <tbody>{data?.items.map((user) => <tr key={user.id} className="border-b border-slate-100 last:border-0 transition-colors hover:bg-orange-50/40"><td className="px-4 py-3"><p className="font-semibold">{user.displayName || "—"}</p><p className="text-xs text-[var(--muted)]">{user.email}</p></td><td className="px-4 py-3"><StatusBadge locale={locale} status={user.status} /></td><td className="px-4 py-3 whitespace-nowrap">{new Date(user.createdAt).toLocaleDateString(locale === "ar" ? "ar-SY" : "en-GB")}</td><td className="px-4 py-3 whitespace-nowrap">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString(locale === "ar" ? "ar-SY" : "en-GB") : translate(locale, "Never", "أبدًا")}</td><td className="px-4 py-3 tabular-nums">{user.orderCount}</td><td className="px-4 py-3 tabular-nums">{user.sessionCount}</td><td className="px-4 py-3 tabular-nums">{user.roleCount}</td><td className="px-4 py-3"><Link href={`/admin/users/${encodeURIComponent(user.id)}`} className="font-semibold text-[#c65d0a] underline decoration-orange-200 underline-offset-4 hover:text-[#9a4300]">{translate(locale, "View account", "عرض الحساب")}</Link></td></tr>)}</tbody>
          </table>}
          {!loading && !data?.items.length && !error && <p className="p-8 text-center text-sm text-[var(--muted)]">{translate(locale, "No accounts match this search.", "لا توجد حسابات تطابق هذا البحث.")}</p>}
        </div>
        {data && data.pageCount > 1 && <div className="mt-4 flex items-center justify-between"><button disabled={filters.page <= 1 || loading} onClick={() => { setLoading(true); setFilters((current) => ({ ...current, page: current.page - 1 })); }} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">{translate(locale, "Previous", "السابق")}</button><span className="text-sm text-[var(--muted)]">{translate(locale, "Page", "صفحة")} {data.page} {translate(locale, "of", "من")} {data.pageCount}</span><button disabled={filters.page >= data.pageCount || loading} onClick={() => { setLoading(true); setFilters((current) => ({ ...current, page: current.page + 1 })); }} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">{translate(locale, "Next", "التالي")}</button></div>}
      </div>
    </main>
  );
}
