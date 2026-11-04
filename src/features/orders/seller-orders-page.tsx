"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type VendorOrder = {
  id: string; status: string; store: { id: string; name: string; slug: string }; shippingServiceName: string; shippingDestinationRegion: string | null; minDeliveryDays: number | null; maxDeliveryDays: number | null;
  order: { id: string; orderNumber: string; status: string; currencyCode: string; placedAt: string; currency: { minorUnit: number } };
  subtotalMinor: string; shippingMinor: string; taxMinor: string; totalMinor: string;
  items: Array<{ id: string; productName: string; sku: string; variantName: string | null; quantity: number; lineTotalMinor: string }>;
};
function money(value: string, code: string, unit: number) { return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(Number(value) / (10 ** unit)); }

export default function SellerOrdersPage() {
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => { setLoading(true); const params = new URLSearchParams(); if (query.trim()) params.set("q", query.trim());
    fetch(`/api/seller/orders?${params.toString()}`, { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as { orders?: VendorOrder[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Seller orders could not be loaded.");
      if (active) setOrders(data.orders || []);
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Seller orders could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);
  return <main className="min-h-screen bg-[var(--background)]"><header className="border-b border-[var(--border)] bg-white px-5 py-5"><div className="mx-auto flex max-w-6xl justify-between"><Link href="/" className="text-xl font-semibold text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link><Link href="/seller" className="text-sm">Seller workspace</Link></div></header>
    <div className="mx-auto max-w-6xl px-5 py-10"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Seller operations</p><h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">Seller orders</h1><p className="mt-2 text-sm text-[var(--muted)]">Orders are separated by store. Payment and fulfillment remain locked until their respective workflows are enabled.</p>
      {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      <label className="mt-6 block max-w-xl text-xs font-medium">Search orders<input value={query} onChange={event=>setQuery(event.target.value)} maxLength={120} placeholder="Order number, product, SKU or store" className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm"/></label>
      {loading ? <div className="mt-6 h-48 animate-pulse rounded-3xl bg-[var(--color-ivory-100)]" /> : orders.length ? <div className="mt-6 space-y-4">{orders.map((vendor) => <article key={vendor.id} className="rounded-3xl border border-[var(--border)] bg-white p-6">
        <div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs text-[var(--muted)]">{vendor.order.orderNumber} · {new Date(vendor.order.placedAt).toLocaleString()}</p><h2 className="mt-1 text-lg font-semibold">{vendor.store.name}</h2></div><div className="text-right"><p className="font-semibold">{vendor.status.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-[var(--muted)]">{vendor.shippingServiceName}</p><p className="mt-1 text-sm tabular-nums">{money(vendor.totalMinor, vendor.order.currencyCode, vendor.order.currency.minorUnit)}</p></div></div>
        <div className="mt-4 divide-y divide-[var(--border)]">{vendor.items.map((item) => <div key={item.id} className="flex justify-between gap-4 py-3 text-sm"><div><p className="font-medium">{item.productName}</p><p className="mt-1 text-xs text-[var(--muted)]">{item.sku}{item.variantName ? ` · ${item.variantName}` : ""} · Qty {item.quantity}</p></div><strong className="tabular-nums">{money(item.lineTotalMinor, vendor.order.currencyCode, vendor.order.currency.minorUnit)}</strong></div>)}</div>
        <p className="mt-4 border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">Marketplace payment state: {vendor.order.status.replaceAll("_", " ")}. No fulfillment action is available until payment is confirmed.</p>
      </article>)}</div> : !error ? <div className="mt-6 rounded-3xl border border-[var(--border)] bg-white p-8 text-center text-sm text-[var(--muted)]">{query ? "No orders match this search." : "No seller orders yet."}</div> : null}
    </div>
  </main>;
}
