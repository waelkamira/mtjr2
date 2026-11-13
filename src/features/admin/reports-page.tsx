"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type ReportData = {
  filters: { from: string; to: string };
  metrics: {
    totalOrders: number; pendingOrders: number; processingOrders: number; completedOrders: number;
    successfulPayments: number; failedPayments: number; pendingPayments: number;
    pendingSellers: number; pendingProducts: number; requestedReturns: number; openSupportTickets: number;
    grossOrderValueByCurrency: Array<{ currencyCode: string; amountMinor: string }>;
    successfulPaymentAmountByCurrency: Array<{ currencyCode: string; amountMinor: string }>;
  };
  dailyOrders: Array<{ day: string; count: number }>;
  orderStatusCounts: Array<{ status: string; count: number }>;
  unavailableMetrics: Record<string, string>;
};

const fieldClass = "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100";

function csvCell(value: string | number): string {
  const text = String(value);
  const safe = /^[=+@\-\t\r]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}

function downloadCsv(data: ReportData) {
  const rows = [
    ["section", "metric", "value", "currency"],
    ...data.dailyOrders.map((item) => ["daily_orders", item.day, item.count, ""]),
    ...data.orderStatusCounts.map((item) => ["order_status", item.status, item.count, ""]),
    ...data.metrics.grossOrderValueByCurrency.map((item) => ["gross_order_value_minor", "non_cancelled_orders", item.amountMinor, item.currencyCode]),
    ...data.metrics.successfulPaymentAmountByCurrency.map((item) => ["successful_payment_amount_minor", "succeeded_payments", item.amountMinor, item.currencyCode])
  ];
  const content = "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `matjar-admin-report-${data.filters.from}-to-${data.filters.to}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AdminReportsPage() {
  const { locale } = useLocale();
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (start: string, end: string) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ from: start, to: end });
      const response = await fetch(`/api/admin/dashboard?${params}`, { cache: "no-store" });
      const result = await response.json() as ReportData & { error?: string };
      if (!response.ok) throw new Error(result.error || translate(locale, "Reports could not be loaded.", "تعذر تحميل التقارير."));
      setData(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate(locale, "Reports could not be loaded.", "تعذر تحميل التقارير."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(monthAgo, today); }, []);

  const cards = data ? [
    [translate(locale, "Total orders", "إجمالي الطلبات"), data.metrics.totalOrders],
    [translate(locale, "Awaiting payment", "بانتظار الدفع"), data.metrics.pendingOrders],
    [translate(locale, "Processing", "قيد المعالجة"), data.metrics.processingOrders],
    [translate(locale, "Completed", "مكتملة"), data.metrics.completedOrders],
    [translate(locale, "Successful payments", "المدفوعات الناجحة"), data.metrics.successfulPayments],
    [translate(locale, "Failed payments", "المدفوعات الفاشلة"), data.metrics.failedPayments],
    [translate(locale, "Pending sellers", "طلبات البائعين"), data.metrics.pendingSellers],
    [translate(locale, "Pending products", "المنتجات المعلقة"), data.metrics.pendingProducts],
    [translate(locale, "Return requests", "طلبات الإرجاع"), data.metrics.requestedReturns],
    [translate(locale, "Open support tickets", "تذاكر الدعم المفتوحة"), data.metrics.openSupportTickets]
  ] : [];

  return (
    <main aria-busy={loading} className="min-h-screen px-4 py-6 sm:px-6 lg:px-9">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-[#d97706]">{translate(locale, "Analytics · Reports", "التحليلات · التقارير")}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)] sm:text-3xl">{translate(locale, "Platform reports", "تقارير المنصة")}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">{translate(locale, "Operational counts and order activity from the protected PostgreSQL dashboard service.", "مؤشرات تشغيلية وحركة الطلبات من خدمة لوحة المعلومات المحمية والمتصلة بقاعدة البيانات.")}</p>
          </div>
          <button type="button" disabled={!data || loading} onClick={() => data && downloadCsv(data)} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:border-[#FF8C1C] disabled:opacity-50">{translate(locale, "Export CSV", "تصدير CSV")}</button>
        </div>

        <form onSubmit={(event) => { event.preventDefault(); void load(from, to); }} className="mt-5 grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-[1fr_1fr_auto]">
          <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "From", "من")}<input required type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={`mt-1 block w-full ${fieldClass}`} /></label>
          <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Through", "إلى")}<input required type="date" value={to} onChange={(event) => setTo(event.target.value)} className={`mt-1 block w-full ${fieldClass}`} /></label>
          <button type="submit" disabled={loading || from > to} className="self-end rounded-lg bg-[#FF8C1C] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#F0780B] disabled:opacity-50">{translate(locale, "Apply", "تطبيق")}</button>
        </form>

        {error ? <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
        {loading && !data ? <p className="py-12 text-center text-sm text-[var(--muted)]">{translate(locale, "Loading reports…", "جارٍ تحميل التقارير…")}</p> : null}
        {data ? <>
          <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {cards.map(([label, value]) => <article key={String(label)} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums text-[var(--foreground)]">{Number(value).toLocaleString(locale === "ar" ? "ar" : "en")}</p></article>)}
          </section>
          <section className="mt-5 grid gap-5 xl:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="font-semibold text-[var(--foreground)]">{translate(locale, "Daily orders", "الطلبات اليومية")}</h2>
              <div className="mt-3 max-h-[440px] overflow-auto">
                <table className="w-full text-sm"><thead className="sticky top-0 bg-[var(--surface)] text-xs text-[var(--muted)]"><tr><th className="py-2 text-start">{translate(locale, "Day", "اليوم")}</th><th className="py-2 text-end">{translate(locale, "Orders", "الطلبات")}</th></tr></thead>
                <tbody>{data.dailyOrders.map((item) => <tr key={item.day} className="border-t border-[var(--border)]"><td className="py-2 text-[var(--foreground)]">{item.day}</td><td className="py-2 text-end tabular-nums text-[var(--foreground)]">{item.count.toLocaleString()}</td></tr>)}</tbody></table>
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="font-semibold text-[var(--foreground)]">{translate(locale, "Order status breakdown", "توزيع حالات الطلبات")}</h2>
              <div className="mt-3 space-y-3">{data.orderStatusCounts.map((item) => <div key={item.status}><div className="flex justify-between gap-3 text-sm"><span className="text-[var(--foreground)]">{item.status}</span><strong className="tabular-nums text-[var(--foreground)]">{item.count.toLocaleString()}</strong></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]"><div className="h-full rounded-full bg-[#FF8C1C]" style={{ width: `${data.metrics.totalOrders ? item.count / data.metrics.totalOrders * 100 : 0}%` }} /></div></div>)}</div>
              <h3 className="mt-6 text-sm font-semibold text-[var(--foreground)]">{translate(locale, "Order value by currency (minor units)", "قيمة الطلبات حسب العملة (الوحدات الصغرى)")}</h3>
              <ul className="mt-2 space-y-2 text-sm">{data.metrics.grossOrderValueByCurrency.map((item) => <li key={item.currencyCode} className="flex justify-between gap-3"><span className="text-[var(--muted)]">{item.currencyCode}</span><strong className="tabular-nums text-[var(--foreground)]">{item.amountMinor}</strong></li>)}</ul>
              <p className="mt-3 text-xs leading-5 text-[var(--muted)]">{translate(locale, "Gross order values are displayed in stored minor units and are not combined across currencies. These are order values, not recognized platform revenue or seller payables.", "تعرض قيم الطلبات بالوحدات الصغرى المخزنة ولا تجمع العملات المختلفة. هذه قيم طلبات وليست إيرادات محققة للمنصة أو مستحقات للبائعين.")}</p>
            </div>
          </section>
          <section className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            {translate(locale, "Scope note: reports currently cover operational dashboard metrics and order activity. Recognized revenue, seller payables, refunds/disputes, and integration health are intentionally excluded until their source workflows are implemented and reconciled.", "نطاق التقرير: يغطي حالياً مؤشرات التشغيل وحركة الطلبات. تم استبعاد الإيرادات المحاسبية ومستحقات البائعين والاستردادات والنزاعات وصحة التكاملات إلى حين تنفيذ مصادرها ومطابقتها.")}
          </section>
        </> : null}
      </div>
    </main>
  );
}
