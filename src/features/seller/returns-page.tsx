"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SellerReturn = {
  id: string;
  returnNumber: string;
  orderNumber: string;
  status: string;
  reasonCode: string;
  reasonDetails: string | null;
  reviewNote: string | null;
  requestedAt: string;
  storeId: string;
  storeName: string;
  items: Array<{ productName: string; sku: string; orderedQuantity: number; returnQuantity: number }>;
};

export default function SellerReturnsPage() {
  const [items, setItems] = useState<SellerReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/seller/returns", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { items?: SellerReturn[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Seller returns could not be loaded.");
        if (active) setItems(data.items ?? []);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Seller returns could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-white px-5 py-5">
        <div className="mx-auto flex max-w-6xl justify-between">
          <Link href="/" className="text-xl font-semibold text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link>
          <div className="flex gap-4 text-sm"><Link href="/seller/orders">Orders</Link><Link href="/seller">Seller workspace</Link></div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-10">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Seller operations</p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">Store returns</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">Requests are separated by store. You only see products belonging to stores you own or are authorized to manage.</p>
        <p className="mt-4 rounded-xl border border-[var(--border)] bg-white p-4 text-sm text-[var(--muted)]">This is a read-only seller view. Approval, rejection, return shipping, receipt confirmation and refunds are not enabled in this workflow yet.</p>
        {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {loading ? <div className="mt-6 h-40 animate-pulse rounded-3xl bg-[var(--color-ivory-100)]" /> : items.length ? (
          <div className="mt-6 space-y-4">
            {items.map((item) => (
              <article key={item.id + ":" + item.storeId} className="rounded-3xl border border-[var(--border)] bg-white p-6">
                <div className="flex flex-wrap justify-between gap-3">
                  <div><p className="text-xs text-[var(--muted)]">{item.returnNumber} · Order {item.orderNumber}</p><h2 className="mt-1 text-lg font-semibold">{item.storeName}</h2></div>
                  <div className="text-right"><p className="font-semibold">{item.status.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-[var(--muted)]">{new Date(item.requestedAt).toLocaleString()}</p></div>
                </div>
                <p className="mt-4 text-sm"><span className="font-medium">Reason:</span> {item.reasonCode.replaceAll("_", " ")}</p>
                {item.reasonDetails && <p className="mt-1 text-sm text-[var(--muted)]">{item.reasonDetails}</p>}
                <div className="mt-4 divide-y divide-[var(--border)] border-t border-[var(--border)]">
                  {item.items.map((product, index) => <div key={product.sku + ":" + index} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><div><p className="font-medium">{product.productName}</p><p className="text-xs text-[var(--muted)]">{product.sku}</p></div><p className="tabular-nums">Return {product.returnQuantity} / ordered {product.orderedQuantity}</p></div>)}
                </div>
                {item.reviewNote && <p className="mt-3 rounded-xl bg-[var(--color-ivory-100)] p-3 text-sm">Platform review note: {item.reviewNote}</p>}
              </article>
            ))}
          </div>
        ) : !error ? <div className="mt-6 rounded-3xl border border-[var(--border)] bg-white p-8 text-center text-sm text-[var(--muted)]">No return requests are associated with your authorized stores.</div> : null}
      </div>
    </main>
  );
}
