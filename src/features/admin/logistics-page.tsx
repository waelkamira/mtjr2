"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type ShipmentRow = {
  id: string; carrierName: string; trackingNumber: string; trackingUrl: string | null; status: string;
  shippedAt: string; deliveredAt: string | null;
  vendorOrder: { id: string; status: string; store: { id: string; name: string; slug: string }; order: { id: string; orderNumber: string; status: string; placedAt: string; currencyCode: string; address: { countryCode: string; countryName: string } | null } };
  events: Array<{ status: string; description: string | null; location: string | null; occurredAt: string }>;
};
type Result = { items: ShipmentRow[]; page: number; pageCount: number; total: number };
const statuses = ["SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "EXCEPTION"];

export default function AdminLogisticsPage() {
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
        const response = await fetch(`/api/admin/shipments?${params}`, { cache: "no-store" });
        const result = await response.json() as Result & { error?: string };
        if (!response.ok) throw new Error(result.error || "Shipment list unavailable.");
        if (active) { setData(result); setError(""); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Shipment list unavailable.");
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
    <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Shipping operations</p>
    <div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-semibold text-[var(--color-forest-950)]">Shipments</h1><p className="mt-1 text-sm text-[var(--muted)]">Browse recorded shipments and carrier events. No shipping records or tracking events are generated here.</p></div><p className="text-sm text-[var(--muted)]">{data?.total ?? 0} recorded shipments</p></div>
    <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Carrier integrations, shipping-zone administration, delivery-delay automation, and loss/damage workflows are not configured. This page displays only persisted marketplace shipment records.</p>
    <form onSubmit={search} className="mt-5 grid gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 md:grid-cols-[1fr_240px_auto]">
      <label className="text-xs font-medium text-[var(--muted)]">Search tracking number, carrier, order or store<input value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} maxLength={120} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label>
      <label className="text-xs font-medium text-[var(--muted)]">Tracking status<select value={status} onChange={(event) => { setLoading(true); setStatus(event.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"><option value="">All statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label>
      <button disabled={loading} className="self-end rounded-xl bg-[var(--color-forest-900)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Search</button>
    </form>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <div className="mt-5 space-y-3">{loading && !data ? <div className="h-48 animate-pulse rounded-2xl bg-[var(--color-ivory-100)]" /> : data?.items.map((shipment) => <article key={shipment.id} className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-[var(--muted)]">{shipment.carrierName} · Tracking {shipment.trackingNumber}</p><h2 className="mt-1 text-lg font-semibold">{shipment.status}</h2><p className="mt-1 text-sm"><Link href={`/admin/orders/${encodeURIComponent(shipment.vendorOrder.order.id)}`} className="font-semibold underline">{shipment.vendorOrder.order.orderNumber}</Link> · {shipment.vendorOrder.store.name} · {shipment.vendorOrder.status}</p><p className="text-xs text-[var(--muted)]">Shipped {new Date(shipment.shippedAt).toLocaleString()}{shipment.deliveredAt ? ` · Delivered ${new Date(shipment.deliveredAt).toLocaleString()}` : ""}{shipment.vendorOrder.order.address ? ` · ${shipment.vendorOrder.order.address.countryName}` : ""}</p></div><Link href={`/admin/logistics/${encodeURIComponent(shipment.id)}`} className="text-sm font-semibold text-[var(--color-copper-600)] underline">View tracking events</Link></div>
      {shipment.events.length ? <ul className="mt-3 space-y-1 border-t border-[var(--border)] pt-3">{shipment.events.map((event, index) => <li key={`${event.occurredAt}-${index}`} className="text-xs text-[var(--muted)]">{event.status} · {new Date(event.occurredAt).toLocaleString()}{event.location ? ` · ${event.location}` : ""}{event.description ? ` · ${event.description}` : ""}</li>)}</ul> : <p className="mt-3 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">No tracking events recorded.</p>}
    </article>)}
      {!loading && !data?.items.length && !error && <p className="rounded-2xl border border-[var(--border)] bg-white p-8 text-center text-sm text-[var(--muted)]">No recorded shipments match these filters.</p>}
    </div>
    {data && data.pageCount > 1 && <div className="mt-4 flex items-center justify-between"><button disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((current) => current - 1); }} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">Previous</button><span className="text-sm text-[var(--muted)]">Page {data.page} of {data.pageCount}</span><button disabled={page >= data.pageCount || loading} onClick={() => { setLoading(true); setPage((current) => current + 1); }} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">Next</button></div>}
  </div></main>;
}
