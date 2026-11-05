"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

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
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (query) params.set("q", query);
    if (status) params.set("status", status);
    void Promise.resolve().then(async () => {
      try {
        const response = await fetch(`/api/admin/orders?${params}`, { cache: "no-store" });
        const result = await response.json() as Result & { error?: string };
        if (!response.ok) throw new Error(result.error || "Order list unavailable.");
        if (active) { setData(result); setError(""); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Order list unavailable.");
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [page, query, status]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = draftQuery.trim();
    if (query === q && page === 1) return;
    setLoading(true);
    setPage(1);
    setQuery(q);
  }

  return <main className="min-h-screen px-5 py-8 lg:px-8"><div className="mx-auto max-w-7xl">
    <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Order operations</p>
    <div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-semibold text-[var(--color-forest-950)]">Orders</h1><p className="mt-1 text-sm text-[var(--muted)]">Inspect order snapshots, payment status, vendor splits, and shipment history. State changes are not enabled here.</p></div><p className="text-sm text-[var(--muted)]">{data?.total ?? 0} matching orders</p></div>
    <form onSubmit={search} className="mt-6 grid gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 sm:grid-cols-[1fr_240px_auto]">
      <label className="text-xs font-medium text-[var(--muted)]">Search order number, ID, customer email or store<input value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} maxLength={120} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label>
      <label className="text-xs font-medium text-[var(--muted)]">Order status<select value={status} onChange={(event) => { setLoading(true); setStatus(event.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"><option value="">All statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label>
      <button disabled={loading} className="self-end rounded-xl bg-[var(--color-forest-900)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Search</button>
    </form>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <div className="mt-5 overflow-x-auto rounded-2xl border border-[var(--border)] bg-white">
      {loading && !data ? <div className="h-48 animate-pulse bg-[var(--color-ivory-100)]" /> : <table className="w-full min-w-[780px] text-left text-sm">
        <thead><tr className="border-b border-[var(--border)] bg-[var(--color-ivory-100)] text-xs text-[var(--muted)]"><th className="px-4 py-3 font-medium">Order</th><th className="px-4 py-3 font-medium">Customer</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Total</th><th className="px-4 py-3 font-medium">Stores</th><th className="px-4 py-3 font-medium">Payments</th><th className="px-4 py-3 font-medium">Placed</th><th /></tr></thead>
        <tbody>{data?.items.map((order) => <tr key={order.id} className="border-b border-[var(--border)] last:border-0"><td className="px-4 py-3 font-semibold">{order.orderNumber}</td><td className="px-4 py-3">{order.user ? <><span>{order.user.displayName || order.user.email}</span><span className="block text-xs text-[var(--muted)]">{order.user.email}</span></> : "Guest checkout"}</td><td className="px-4 py-3">{order.status}</td><td className="px-4 py-3">{money(order.totalMinor, order.currencyCode, order.currency.minorUnit)}</td><td className="px-4 py-3">{order.vendorOrderCount}</td><td className="px-4 py-3">{order.paymentCount}</td><td className="px-4 py-3">{new Date(order.placedAt).toLocaleString()}</td><td className="px-4 py-3"><Link href={`/admin/orders/${encodeURIComponent(order.id)}`} className="font-semibold text-[var(--color-copper-600)] underline">Inspect</Link></td></tr>)}</tbody>
      </table>}
      {!loading && !data?.items.length && !error && <p className="p-8 text-center text-sm text-[var(--muted)]">No orders match these filters.</p>}
    </div>
    {data && data.pageCount > 1 && <div className="mt-4 flex items-center justify-between"><button disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((current) => current - 1); }} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">Previous</button><span className="text-sm text-[var(--muted)]">Page {data.page} of {data.pageCount}</span><button disabled={page >= data.pageCount || loading} onClick={() => { setLoading(true); setPage((current) => current + 1); }} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">Next</button></div>}
  </div></main>;
}
