"use client";

import { useCallback, useEffect, useState } from "react";
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
  items: Array<{ id: string; productName: string; sku: string; orderedQuantity: number; returnQuantity: number; status: string; reviewNote: string | null }>;
};

export default function SellerReturnsPage() {
  const [items, setItems] = useState<SellerReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const response = await fetch("/api/seller/returns", { cache: "no-store" });
    const data = await response.json() as { items?: SellerReturn[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Seller returns could not be loaded.");
    setItems(data.items ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    load().catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Seller returns could not be loaded.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]);

  async function decide(item: SellerReturn, status: "APPROVED" | "REJECTED") {
    const key = item.id + ":" + item.storeId;
    setBusy(key); setError(""); setNotice("");
    try {
      const response = await fetch("/api/seller/returns/" + encodeURIComponent(item.id), {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: item.storeId, status, note: notes[key] || "" })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Return decision could not be saved.");
      setNotice(status === "APPROVED" ? "Your store's return items were approved." : "Your store's return items were rejected.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Return decision could not be saved.");
    } finally { setBusy(""); }
  }

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
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">Review only the return items belonging to each store you own or are authorized to manage. A decision never changes another store's items.</p>
        <p className="mt-3 rounded-xl border border-[var(--border)] bg-white p-4 text-sm text-[var(--muted)]">Approval or rejection records the seller's decision only. Return receipt, inventory restocking and payment refunds are separate workflows and are not performed here.</p>
        {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="mt-5 rounded-xl border border-[var(--border)] bg-white p-4 text-sm">{notice}</p>}
        {loading ? <div className="mt-6 h-40 animate-pulse rounded-3xl bg-[var(--color-ivory-100)]" /> : items.length ? (
          <div className="mt-6 space-y-4">
            {items.map((item) => {
              const key = item.id + ":" + item.storeId;
              const pending = item.items.some((product) => product.status === "REQUESTED");
              return (
                <article key={key} className="rounded-3xl border border-[var(--border)] bg-white p-6">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div><p className="text-xs text-[var(--muted)]">{item.returnNumber} · Order {item.orderNumber}</p><h2 className="mt-1 text-lg font-semibold">{item.storeName}</h2></div>
                    <div className="text-right"><p className="font-semibold">{item.status.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-[var(--muted)]">{new Date(item.requestedAt).toLocaleString()}</p></div>
                  </div>
                  <p className="mt-4 text-sm"><span className="font-medium">Reason:</span> {item.reasonCode.replaceAll("_", " ")}</p>
                  {item.reasonDetails && <p className="mt-1 text-sm text-[var(--muted)]">{item.reasonDetails}</p>}
                  <div className="mt-4 divide-y divide-[var(--border)] border-t border-[var(--border)]">
                    {item.items.map((product) => <div key={product.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                      <div><p className="font-medium">{product.productName}</p><p className="text-xs text-[var(--muted)]">{product.sku} · {product.status.replaceAll("_", " ")}</p>{product.reviewNote && <p className="mt-1 text-xs text-[var(--muted)]">{product.reviewNote}</p>}</div>
                      <p className="tabular-nums">Return {product.returnQuantity} / ordered {product.orderedQuantity}</p>
                    </div>)}
                  </div>
                  {pending && <div className="mt-4 border-t border-[var(--border)] pt-4">
                    <label className="grid gap-2 text-sm font-medium">Decision note (optional)
                      <textarea rows={2} maxLength={1000} value={notes[key] || ""} onChange={(event) => setNotes((current) => ({ ...current, [key]: event.target.value }))} className="rounded-xl border border-[var(--border)] p-3"/>
                    </label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button disabled={Boolean(busy)} onClick={() => void decide(item, "APPROVED")} className="rounded-xl bg-[var(--color-forest-900)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === key ? "Saving…" : "Approve my store's items"}</button>
                      <button disabled={Boolean(busy)} onClick={() => void decide(item, "REJECTED")} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Reject my store's items</button>
                    </div>
                  </div>}
                </article>
              );
            })}
          </div>
        ) : !error ? <div className="mt-6 rounded-3xl border border-[var(--border)] bg-white p-8 text-center text-sm text-[var(--muted)]">No return requests are associated with your authorized stores.</div> : null}
      </div>
    </main>
  );
}
