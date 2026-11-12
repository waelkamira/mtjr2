"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate, translateStatus } from "@/lib/locale";
import { StatusBadge } from "@/components/status-badge";

type PaymentRow = {
  id: string;
  orderId: string;
  provider: string;
  status: string;
  amountMinor: string;
  currencyCode: string;
  currency: { minorUnit: number };
  failureCode: string | null;
  createdAt: string;
  succeededAt: string | null;
  order: { orderNumber: string; status: string; user: { email: string; displayName: string | null } | null };
};
type Totals = { status: string; currencyCode: string; minorUnit: number; paymentCount: number; amountMinor: string };
type Result = { items: PaymentRow[]; totalsByStatusCurrency: Totals[]; page: number; pageCount: number; total: number };
const statuses = ["INITIATING", "REQUIRES_ACTION", "PROCESSING", "SUCCEEDED", "FAILED", "CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED", "DISPUTED"];

function money(amount: string, currency: string, minorUnit: number) {
  const value = BigInt(amount);
  const divisor = BigInt(10) ** BigInt(minorUnit);
  const whole = value / divisor;
  const fraction = minorUnit ? `.${(value % divisor).toString().padStart(minorUnit, "0")}` : "";
  return `${currency} ${new Intl.NumberFormat().format(whole)}${fraction}`;
}

export default function AdminPaymentsPage() {
  const { locale } = useLocale();
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (query) params.set("q", query);
    if (provider) params.set("provider", provider);
    if (status) params.set("status", status);
    void Promise.resolve().then(async () => {
      try {
        const response = await fetch(`/api/admin/payments?${params}`, { cache: "no-store" });
        const result = await response.json() as Result & { error?: string };
        if (!response.ok) throw new Error(result.error || translate(locale, "Payment list unavailable.", "قائمة المدفوعات غير متاحة."));
        if (active) { setData(result); setError(""); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : translate(locale, "Payment list unavailable.", "قائمة المدفوعات غير متاحة."));
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [locale, page, query, provider, status]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = draftQuery.trim();
    if (query === q && page === 1) return;
    setLoading(true);
    setPage(1);
    setQuery(q);
  }

  return <main className="min-h-screen px-3 py-5 sm:px-5 sm:py-8 lg:px-8"><div className="mx-auto max-w-7xl">
    <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">{translate(locale, "Financial operations", "العمليات المالية")}</p>
    <div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-semibold text-[var(--color-forest-950)]">{translate(locale, "Payment transactions", "معاملات الدفع")}</h1><p className="mt-1 text-sm text-[var(--muted)]">{translate(locale, "Inspect payment attempts and verified webhook processing. This view does not initiate charges, refunds, or payouts.", "استعرض محاولات الدفع ومعالجة إشعارات Webhook الموثقة. لا يبدأ هذا العرض عمليات الدفع أو الاسترداد أو التحويلات.")}</p></div><p className="text-sm text-[var(--muted)]">{data?.total ?? 0} {translate(locale, "matching transactions", "معاملة مطابقة")}</p></div>
    <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{translate(locale, "Accounting ledger, seller balances, payout requests, refunds, disputes, and settlement data are not available in the current data model; no financial totals or actions are fabricated here.", "دفتر الحسابات وأرصدة البائعين وطلبات التحويل والمبالغ المستردة والنزاعات وبيانات التسوية غير متاحة في نموذج البيانات الحالي؛ ولا يتم اختلاق إجماليات أو إجراءات مالية هنا.")}</div>
    {data?.totalsByStatusCurrency.length ? <section aria-label={translate(locale, "Payment attempts by status and currency", "محاولات الدفع حسب الحالة والعملة")} className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data.totalsByStatusCurrency.map((total) => <article key={`${total.status}-${total.currencyCode}`} className="rounded-xl border border-[var(--border)] bg-white p-4"><p className="text-xs font-semibold text-[var(--muted)]"><StatusBadge locale={locale} status={total.status} /> · {total.currencyCode}</p><p className="mt-2 text-lg font-semibold">{total.paymentCount} {translate(locale, "attempts", "محاولة")}</p><p className="text-sm text-[var(--muted)]">{money(total.amountMinor, total.currencyCode, total.minorUnit)}</p></article>)}</section> : null}
    <form onSubmit={search} className="mt-5 grid gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 md:grid-cols-[1fr_180px_240px_auto]">
      <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Search payment, order, provider or customer email", "ابحث عن الدفع أو الطلب أو مزود الخدمة أو بريد العميل")}<input value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} maxLength={120} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label>
      <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Provider", "مزود الخدمة")}<input value={provider} onChange={(event) => { setLoading(true); setProvider(event.target.value.trim()); setPage(1); }} maxLength={64} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" placeholder={translate(locale, "All providers", "جميع المزودين")} /></label>
      <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Payment status", "حالة الدفع")}<select value={status} onChange={(event) => { setLoading(true); setStatus(event.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"><option value="">{translate(locale, "All statuses", "جميع الحالات")}</option>{statuses.map((item) => <option key={item} value={item}>{translateStatus(locale, item)}</option>)}</select></label>
      <button disabled={loading} className="self-end rounded-xl bg-[var(--color-forest-900)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{translate(locale, "Search", "بحث")}</button>
    </form>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <div className="mt-5 overflow-x-auto rounded-2xl border border-[var(--border)] bg-white">
      {loading && !data ? <div className="h-48 animate-pulse bg-[var(--color-ivory-100)]" /> : <table className="w-full min-w-[900px] text-left text-sm">
        <thead><tr className="border-b border-[var(--border)] bg-[var(--color-ivory-100)] text-xs text-[var(--muted)]"><th className="px-4 py-3 font-medium">{translate(locale, "Payment", "الدفع")}</th><th className="px-4 py-3 font-medium">{translate(locale, "Order", "الطلب")}</th><th className="px-4 py-3 font-medium">{translate(locale, "Customer", "العميل")}</th><th className="px-4 py-3 font-medium">{translate(locale, "Provider / status", "المزود / الحالة")}</th><th className="px-4 py-3 font-medium">{translate(locale, "Amount", "المبلغ")}</th><th className="px-4 py-3 font-medium">{translate(locale, "Created", "تاريخ الإنشاء")}</th><th /></tr></thead>
        <tbody>{data?.items.map((payment) => <tr key={payment.id} className="border-b border-[var(--border)] last:border-0"><td className="px-4 py-3">{payment.id}</td><td className="px-4 py-3"><Link href={`/admin/orders/${encodeURIComponent(payment.orderId)}`} className="font-semibold underline">{payment.order.orderNumber}</Link><span className="mt-1 block"><StatusBadge locale={locale} status={payment.order.status} /></span></td><td className="px-4 py-3">{payment.order.user?.displayName || payment.order.user?.email || translate(locale, "Guest checkout", "شراء كضيف")}<span className="block text-xs text-[var(--muted)]">{payment.order.user?.email || ""}</span></td><td className="px-4 py-3">{payment.provider} · <StatusBadge locale={locale} status={payment.status} />{payment.failureCode && <span className="block text-xs text-red-700">{payment.failureCode}</span>}</td><td className="px-4 py-3">{money(payment.amountMinor, payment.currencyCode, payment.currency.minorUnit)}</td><td className="px-4 py-3">{new Date(payment.createdAt).toLocaleString()}</td><td className="px-4 py-3"><Link href={`/admin/payments/${encodeURIComponent(payment.id)}`} className="font-semibold text-[var(--color-copper-600)] underline">{translate(locale, "Inspect", "عرض التفاصيل")}</Link></td></tr>)}</tbody>
      </table>}
      {!loading && !data?.items.length && !error && <p className="p-8 text-center text-sm text-[var(--muted)]">{translate(locale, "No payment attempts match these filters.", "لا توجد محاولات دفع تطابق عوامل التصفية هذه.")}</p>}
    </div>
    {data && data.pageCount > 1 && <div className="mt-4 flex items-center justify-between"><button disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((current) => current - 1); }} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">{translate(locale, "Previous", "السابق")}</button><span className="text-sm text-[var(--muted)]">{translate(locale, "Page", "صفحة")} {data.page} {translate(locale, "of", "من")} {data.pageCount}</span><button disabled={page >= data.pageCount || loading} onClick={() => { setLoading(true); setPage((current) => current + 1); }} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">{translate(locale, "Next", "التالي")}</button></div>}
  </div></main>;
}
