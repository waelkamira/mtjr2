"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

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
        if (!response.ok) throw new Error(result.error || "Payment list unavailable.");
        if (active) { setData(result); setError(""); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Payment list unavailable.");
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [page, query, provider, status]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = draftQuery.trim();
    if (query === q && page === 1) return;
    setLoading(true);
    setPage(1);
    setQuery(q);
  }

  return <main className="min-h-screen px-5 py-8 lg:px-8"><div className="mx-auto max-w-7xl">
    <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Financial operations</p>
    <div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-semibold text-[var(--color-forest-950)]">Payment transactions</h1><p className="mt-1 text-sm text-[var(--muted)]">Inspect payment attempts and verified webhook processing. This view does not initiate charges, refunds, or payouts.</p></div><p className="text-sm text-[var(--muted)]">{data?.total ?? 0} matching transactions</p></div>
    <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Accounting ledger, seller balances, payout requests, refunds, disputes, and settlement data are not available in the current data model; no financial totals or actions are fabricated here.</div>
    {data?.totalsByStatusCurrency.length ? <section aria-label="Payment attempts by status and currency" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data.totalsByStatusCurrency.map((total) => <article key={`${total.status}-${total.currencyCode}`} className="rounded-xl border border-[var(--border)] bg-white p-4"><p className="text-xs font-semibold text-[var(--muted)]">{total.status} · {total.currencyCode}</p><p className="mt-2 text-lg font-semibold">{total.paymentCount} attempts</p><p className="text-sm text-[var(--muted)]">{money(total.amountMinor, total.currencyCode, total.minorUnit)}</p></article>)}</section> : null}
    <form onSubmit={search} className="mt-5 grid gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 md:grid-cols-[1fr_180px_240px_auto]">
      <label className="text-xs font-medium text-[var(--muted)]">Search payment, order, provider or customer email<input value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} maxLength={120} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label>
      <label className="text-xs font-medium text-[var(--muted)]">Provider<input value={provider} onChange={(event) => { setLoading(true); setProvider(event.target.value.trim()); setPage(1); }} maxLength={64} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" placeholder="All providers" /></label>
      <label className="text-xs font-medium text-[var(--muted)]">Payment status<select value={status} onChange={(event) => { setLoading(true); setStatus(event.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"><option value="">All statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label>
      <button disabled={loading} className="self-end rounded-xl bg-[var(--color-forest-900)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Search</button>
    </form>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <div className="mt-5 overflow-x-auto rounded-2xl border border-[var(--border)] bg-white">
      {loading && !data ? <div className="h-48 animate-pulse bg-[var(--color-ivory-100)]" /> : <table className="w-full min-w-[900px] text-left text-sm">
        <thead><tr className="border-b border-[var(--border)] bg-[var(--color-ivory-100)] text-xs text-[var(--muted)]"><th className="px-4 py-3 font-medium">Payment</th><th className="px-4 py-3 font-medium">Order</th><th className="px-4 py-3 font-medium">Customer</th><th className="px-4 py-3 font-medium">Provider / status</th><th className="px-4 py-3 font-medium">Amount</th><th className="px-4 py-3 font-medium">Created</th><th /></tr></thead>
        <tbody>{data?.items.map((payment) => <tr key={payment.id} className="border-b border-[var(--border)] last:border-0"><td className="px-4 py-3">{payment.id}</td><td className="px-4 py-3"><Link href={`/admin/orders/${encodeURIComponent(payment.orderId)}`} className="font-semibold underline">{payment.order.orderNumber}</Link><span className="block text-xs text-[var(--muted)]">{payment.order.status}</span></td><td className="px-4 py-3">{payment.order.user?.displayName || payment.order.user?.email || "Guest checkout"}<span className="block text-xs text-[var(--muted)]">{payment.order.user?.email || ""}</span></td><td className="px-4 py-3">{payment.provider} · {payment.status}{payment.failureCode && <span className="block text-xs text-red-700">{payment.failureCode}</span>}</td><td className="px-4 py-3">{money(payment.amountMinor, payment.currencyCode, payment.currency.minorUnit)}</td><td className="px-4 py-3">{new Date(payment.createdAt).toLocaleString()}</td><td className="px-4 py-3"><Link href={`/admin/payments/${encodeURIComponent(payment.id)}`} className="font-semibold text-[var(--color-copper-600)] underline">Inspect</Link></td></tr>)}</tbody>
      </table>}
      {!loading && !data?.items.length && !error && <p className="p-8 text-center text-sm text-[var(--muted)]">No payment attempts match these filters.</p>}
    </div>
    {data && data.pageCount > 1 && <div className="mt-4 flex items-center justify-between"><button disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((current) => current - 1); }} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">Previous</button><span className="text-sm text-[var(--muted)]">Page {data.page} of {data.pageCount}</span><button disabled={page >= data.pageCount || loading} onClick={() => { setLoading(true); setPage((current) => current + 1); }} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">Next</button></div>}
  </div></main>;
}
