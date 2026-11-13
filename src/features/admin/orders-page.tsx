"use client";

import { StatusBadge } from "@/components/status-badge";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate, translateStatus } from "@/lib/locale";

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  currencyCode: string;
  currency: { minorUnit: number };
  totalMinor: string;
  placedAt: string;
  user: { id: string; email: string; displayName: string | null } | null;
  vendorOrderCount: number;
  paymentCount: number;
};
type Result = { items: OrderRow[]; page: number; pageCount: number; total: number };
const statuses = ["PENDING_PAYMENT", "CONFIRMED", "PROCESSING", "PARTIALLY_FULFILLED", "FULFILLED", "CANCELLED", "COMPLETED"];

function money(amount: string, currency: string, minorUnit: number) {
  const value = BigInt(amount);
  const divisor = BigInt(10) ** BigInt(minorUnit);
  const whole = value / divisor;
  const fraction = minorUnit ? `.${(value % divisor).toString().padStart(minorUnit, "0")}` : "";
  return `${currency} ${new Intl.NumberFormat().format(whole)}${fraction}`;
}

export default function AdminOrdersPage() {
  const { locale } = useLocale();
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (query) params.set("q", query);
    if (status) params.set("status", status);
    void Promise.resolve().then(async () => {
      try {
        const response = await fetch(`/api/admin/orders?${params}`, { cache: "no-store" });
        const result = await response.json() as Result & { error?: string };
        if (!response.ok) throw new Error(result.error || translate(locale, "Order list unavailable.", "قائمة الطلبات غير متاحة."));
        if (active) { setData(result); setError(""); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : translate(locale, "Order list unavailable.", "قائمة الطلبات غير متاحة."));
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [locale, page, query, status]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = draftQuery.trim();
    if (query === q && page === 1) return;
    setLoading(true);
    setPage(1);
    setQuery(q);
  }

  return <main className="min-h-screen bg-[#f5f6f8] px-4 py-6 sm:px-6 lg:px-9"><div className="mx-auto max-w-[1600px]">
    <p className="text-xs font-bold uppercase tracking-[.14em] text-[#d97706]">{translate(locale, "Order operations", "عمليات الطلبات")}</p>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-6"><div><h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{translate(locale, "Orders", "الطلبات")}</h1><p className="mt-1 text-sm text-[var(--muted)]">{translate(locale, "Inspect order snapshots, payment status, vendor splits, and shipment history. State changes are not enabled here.", "استعرض ملخصات الطلبات وحالة الدفع وتقسيمات البائعين وسجل الشحن. تغيير الحالات غير متاح هنا.")}</p></div><p className="text-sm text-[var(--muted)]">{data?.total ?? 0} {translate(locale, "matching orders", "طلب مطابق")}</p></div>
    <form onSubmit={search} className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_240px_auto]">
      <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Search order number, ID, customer email or store", "ابحث برقم الطلب أو المعرّف أو بريد العميل أو المتجر")}<input type="search" value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} maxLength={120} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100" /></label>
      <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Order status", "حالة الطلب")}<select value={status} onChange={(event) => { setLoading(true); setStatus(event.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100"><option value="">{translate(locale, "All statuses", "جميع الحالات")}</option>{statuses.map((item) => <option key={item} value={item}>{translateStatus(locale, item)}</option>)}</select></label>
      <button disabled={loading} className="self-end rounded-lg bg-[#FF8C1C] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#F0780B] disabled:opacity-60">{translate(locale, "Search", "بحث")}</button>
    </form>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <div aria-busy={loading} className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      {loading && !data ? <div className="h-48 animate-pulse bg-[var(--color-ivory-100)]" /> : <table className="w-full min-w-[820px] text-start text-sm">
        <thead className="sticky top-0 z-10 bg-slate-50"><tr className="border-b border-slate-200 text-xs font-semibold text-slate-500"><th className="px-4 py-3 font-medium">{translate(locale, "Order", "الطلب")}</th><th className="px-4 py-3 font-medium">{translate(locale, "Customer", "العميل")}</th><th className="px-4 py-3 font-medium">{translate(locale, "Status", "الحالة")}</th><th className="px-4 py-3 font-medium">{translate(locale, "Total", "الإجمالي")}</th><th className="px-4 py-3 font-medium">{translate(locale, "Stores", "المتاجر")}</th><th className="px-4 py-3 font-medium">{translate(locale, "Payments", "المدفوعات")}</th><th className="px-4 py-3 font-medium">{translate(locale, "Placed", "تاريخ الإنشاء")}</th><th /></tr></thead>
        <tbody>{data?.items.map((order) => <tr key={order.id} className="border-b border-slate-100 last:border-0 transition-colors hover:bg-orange-50/40"><td className="px-4 py-3 font-semibold">{order.orderNumber}</td><td className="px-4 py-3">{order.user ? <><span>{order.user.displayName || order.user.email}</span><span className="block text-xs text-[var(--muted)]">{order.user.email}</span></> : translate(locale, "Guest checkout", "شراء كضيف")}</td><td className="px-4 py-3"><StatusBadge locale={locale} status={order.status} /></td><td className="px-4 py-3">{money(order.totalMinor, order.currencyCode, order.currency.minorUnit)}</td><td className="px-4 py-3">{order.vendorOrderCount}</td><td className="px-4 py-3">{order.paymentCount}</td><td className="px-4 py-3">{new Date(order.placedAt).toLocaleString(locale === "ar" ? "ar-SY" : "en-GB")}</td><td className="px-4 py-3"><Link href={`/admin/orders/${encodeURIComponent(order.id)}`} className="font-semibold text-[#c65d0a] underline decoration-orange-200 underline-offset-4 hover:text-[#9a4300]">{translate(locale, "Inspect", "عرض التفاصيل")}</Link></td></tr>)}</tbody>
      </table>}
      {!loading && !data?.items.length && !error && <p className="p-8 text-center text-sm text-[var(--muted)]">{translate(locale, "No orders match these filters.", "لا توجد طلبات تطابق عوامل التصفية هذه.")}</p>}
    </div>
    {data && data.pageCount > 1 && <div className="mt-4 flex items-center justify-between"><button disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((current) => current - 1); }} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">{translate(locale, "Previous", "السابق")}</button><span className="text-sm text-[var(--muted)]">{translate(locale, "Page", "صفحة")} {data.page} {translate(locale, "of", "من")} {data.pageCount}</span><button disabled={page >= data.pageCount || loading} onClick={() => { setLoading(true); setPage((current) => current + 1); }} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">{translate(locale, "Next", "التالي")}</button></div>}
  </div></main>;
}
