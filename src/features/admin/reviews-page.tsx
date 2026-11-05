"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type PendingReview = {
  id: string; rating: number; title: string; body: string; createdAt: string;
  product: { id: string; name: string; slug: string };
  user: { id: string; displayName: string | null; email: string };
  orderItem: { id: string; sku: string; quantity: number; vendorOrder: { order: { orderNumber: string } } };
};

export default function AdminReviewsPage() {
  const [items, setItems] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/reviews", { cache: "no-store" });
    const data = await response.json() as { items?: PendingReview[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Review queue could not be loaded.");
    setItems(data.items || []);
  }, []);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(load).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Review queue unavailable."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]);
  async function moderate(item: PendingReview, decision: "PUBLISH" | "REJECT") {
    setBusyId(item.id); setError("");
    try {
      const response = await fetch(`/api/admin/reviews/${encodeURIComponent(item.id)}/moderate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason: reasons[item.id] || undefined })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Review could not be moderated.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Review could not be moderated."); }
    finally { setBusyId(""); }
  }
  return <main className="min-h-screen bg-[var(--background)]">
    <header className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-5"><div className="mx-auto flex max-w-6xl justify-between"><Link href="/" className="text-xl font-semibold text-[var(--color-ink-950)]">mtjr<span className="text-[var(--color-lavender-600)]">.</span></Link><div className="flex items-center gap-4"><Link href="/admin/store-reviews" className="text-sm">Store reviews</Link><Link href="/admin/questions" className="text-sm">Product Q&A</Link><Link href="/seller" className="text-sm">Workspace</Link></div></div></header>
    <div className="mx-auto max-w-6xl px-5 py-10"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-lavender-600)]">Marketplace quality</p><div className="mt-2 flex flex-wrap items-end justify-between gap-3"><h1 className="text-3xl font-semibold text-[var(--color-ink-950)]">Product review moderation</h1><p className="text-sm text-[var(--muted)]">{items.length} pending</p></div>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {loading ? <div className="mt-6 h-48 animate-pulse rounded-3xl bg-[var(--surface-soft)]" /> : items.length ? <div className="mt-6 space-y-4">{items.map((item) => <article key={item.id} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="flex flex-wrap justify-between gap-4"><div><p className="text-xs text-[var(--muted)]">Product</p><Link href={`/products/${encodeURIComponent(item.product.slug)}`} className="mt-1 font-semibold text-[var(--color-ink-800)] underline">{item.product.name}</Link><p className="mt-1 text-xs text-[var(--muted)]">Order {item.orderItem.vendorOrder.order.orderNumber} · SKU {item.orderItem.sku}</p></div><div className="text-right"><p className="text-lg text-[var(--color-lavender-600)]">{"★".repeat(item.rating)}{"☆".repeat(5-item.rating)}</p><p className="text-xs text-[var(--muted)]">{new Date(item.createdAt).toLocaleString()}</p></div></div>
        <h2 className="mt-5 text-lg font-semibold">{item.title}</h2><p className="mt-2 whitespace-pre-line text-sm leading-6 text-[var(--muted)]">{item.body}</p><p className="mt-4 text-xs text-[var(--muted)]">Submitted by {item.user.displayName || item.user.email}</p>
        <label className="mt-5 block text-sm font-medium">Moderation note (optional)<textarea rows={2} maxLength={500} value={reasons[item.id] || ""} onChange={(event) => setReasons((current) => ({ ...current, [item.id]: event.target.value }))} className="mt-2 block w-full rounded-xl border border-[var(--border)] px-3 py-2" /></label>
        <div className="mt-4 flex flex-wrap gap-3"><button disabled={busyId === item.id} onClick={() => void moderate(item,"PUBLISH")} className="rounded-xl bg-[var(--color-ink-800)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busyId === item.id ? "Saving…" : "Publish review"}</button><button disabled={busyId === item.id} onClick={() => void moderate(item,"REJECT")} className="rounded-xl border border-[var(--border)] px-5 py-3 text-sm font-semibold disabled:opacity-50">Reject</button></div>
      </article>)}</div> : !error ? <div className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">No product reviews are awaiting moderation.</div> : null}
    </div>
  </main>;
}
