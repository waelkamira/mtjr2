"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate, translateStatus } from "@/lib/locale";
import { StatusBadge } from "@/components/status-badge";

type ShipmentRow = {
  id: string; carrierName: string; trackingNumber: string; trackingUrl: string | null; status: string;
  shippedAt: string; deliveredAt: string | null;
  vendorOrder: { id: string; status: string; store: { id: string; name: string; slug: string }; order: { id: string; orderNumber: string; status: string; placedAt: string; currencyCode: string; address: { countryCode: string; countryName: string } | null } };
  events: Array<{ status: string; description: string | null; location: string | null; occurredAt: string }>;
};
type Result = { items: ShipmentRow[]; page: number; pageCount: number; total: number };
const statuses = ["SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "EXCEPTION"];

export default function AdminLogisticsPage() {
  const { locale } = useLocale();
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (query) params.set("q", query);
    if (status) params.set("status", status);
    void Promise.resolve().then(async () => {
      try {
        const response = await fetch(`/api/admin/shipments?${params}`, { cache: "no-store" });
        const result = await response.json() as Result & { error?: string };
        if (!response.ok) throw new Error(result.error || translate(locale, "Shipment list unavailable.", "قائمة الشحنات غير متاحة."));
        if (active) { setData(result); setError(""); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : translate(locale, "Shipment list unavailable.", "قائمة الشحنات غير متاحة."));
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [locale, page, query, status, refreshToken]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = draftQuery.trim();
    if (query === q && page === 1) return;
    setLoading(true);
    setPage(1);
    setQuery(q);
  }

  return <main className="min-h-screen bg-[var(--background)] px-4 py-6 sm:px-6 lg:px-9"><div className="mx-auto max-w-[1600px]">
    <p className="text-xs font-bold uppercase tracking-[.14em] text-[#d97706]">{translate(locale, "Shipping operations", "عمليات الشحن")}</p>
    <div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink-950)] sm:text-3xl">{translate(locale, "Shipments", "الشحنات")}</h1><p className="mt-1 text-sm text-[var(--muted)]">{translate(locale, "Browse recorded shipments and carrier events. No shipping records or tracking events are generated here.", "استعرض الشحنات المسجلة وأحداث شركات النقل. لا يتم إنشاء سجلات شحن أو تتبع هنا.")}</p></div><div className="flex items-center gap-3"><p className="text-sm text-[var(--muted)]">{data?.total ?? 0} {translate(locale, "recorded shipments", "شحنة مسجلة")}</p><button type="button" disabled={loading} onClick={() => { setLoading(true); setError(""); setRefreshToken((value) => value + 1); }} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:border-[#FF8C1C] hover:text-[#C65D0A] disabled:opacity-50">{translate(locale, "Refresh", "تحديث")}</button></div></div>
    <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{translate(locale, "Carrier integrations, shipping-zone administration, delivery-delay automation, and loss/damage workflows are not configured. This page displays only persisted marketplace shipment records.", "لم يتم إعداد تكامل شركات النقل أو إدارة مناطق الشحن أو أتمتة تأخير التسليم أو إجراءات الفقد والتلف. تعرض هذه الصفحة سجلات الشحن المحفوظة في السوق فقط.")}</p>
    <form onSubmit={search} className="mt-5 grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm md:grid-cols-[1fr_240px_auto]">
      <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Search tracking number, carrier, order or store", "ابحث برقم التتبع أو شركة النقل أو الطلب أو المتجر")}<input type="search" value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} maxLength={120} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100" /></label>
      <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Tracking status", "حالة التتبع")}<select value={status} onChange={(event) => { setLoading(true); setStatus(event.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100"><option value="">{translate(locale, "All statuses", "جميع الحالات")}</option>{statuses.map((item) => <option key={item} value={item}>{translateStatus(locale, item)}</option>)}</select></label>
      <button disabled={loading} className="self-end rounded-xl bg-[#FF8C1C] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#E9780B] disabled:opacity-60">{translate(locale, "Search", "بحث")}</button>
    </form>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <div aria-busy={loading} className="mt-5 space-y-3">{loading && !data ? <div className="h-48 animate-pulse rounded-2xl bg-[var(--surface-soft)]" /> : data?.items.map((shipment) => <article key={shipment.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-[var(--muted)]">{shipment.carrierName} · {translate(locale, "Tracking", "التتبع")} {shipment.trackingNumber}</p><h2 className="mt-1 text-lg font-semibold"><StatusBadge locale={locale} status={shipment.status} /></h2><p className="mt-1 text-sm"><Link href={`/admin/orders/${encodeURIComponent(shipment.vendorOrder.order.id)}`} className="font-semibold underline">{shipment.vendorOrder.order.orderNumber}</Link> · {shipment.vendorOrder.store.name} · <StatusBadge locale={locale} status={shipment.vendorOrder.status} /></p><p className="text-xs text-[var(--muted)]">{translate(locale, "Shipped", "تم الشحن")} {new Date(shipment.shippedAt).toLocaleString(locale === "ar" ? "ar-SY" : "en-GB")}{shipment.deliveredAt ? ` · ${translate(locale, "Delivered", "تم التسليم")} ${new Date(shipment.deliveredAt).toLocaleString(locale === "ar" ? "ar-SY" : "en-GB")}` : ""}{shipment.vendorOrder.order.address ? ` · ${shipment.vendorOrder.order.address.countryName}` : ""}</p></div><Link href={`/admin/logistics/${encodeURIComponent(shipment.id)}`} className="text-sm font-semibold text-[#C65D0A] underline underline-offset-4">{translate(locale, "View tracking events", "عرض أحداث التتبع")}</Link></div>
      {shipment.events.length ? <ul className="mt-3 space-y-1 border-t border-[var(--border)] pt-3">{shipment.events.map((event, index) => <li key={`${event.occurredAt}-${index}`} className="text-xs text-[var(--muted)]"><StatusBadge locale={locale} status={event.status} /> · {new Date(event.occurredAt).toLocaleString(locale === "ar" ? "ar-SY" : "en-GB")}{event.location ? ` · ${event.location}` : ""}{event.description ? ` · ${event.description}` : ""}</li>)}</ul> : <p className="mt-3 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">{translate(locale, "No tracking events recorded.", "لا توجد أحداث تتبع مسجلة.")}</p>}
    </article>)}
      {!loading && !data?.items.length && !error && <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">{translate(locale, "No recorded shipments match these filters.", "لا توجد شحنات مسجلة تطابق عوامل التصفية هذه.")}</p>}
    </div>
    {data && data.pageCount > 1 && <div className="mt-4 flex items-center justify-between"><button disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((current) => current - 1); }} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">{translate(locale, "Previous", "السابق")}</button><span className="text-sm text-[var(--muted)]">{translate(locale, "Page", "صفحة")} {data.page} {translate(locale, "of", "من")} {data.pageCount}</span><button disabled={page >= data.pageCount || loading} onClick={() => { setLoading(true); setPage((current) => current + 1); }} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">{translate(locale, "Next", "التالي")}</button></div>}
  </div></main>;
}
