"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Review = {
  id: string; rating: number; title: string; body: string; createdAt: string;
  store: { id: string; name: string; slug: string };
  user: { id: string; displayName: string | null; email: string };
  vendorOrder: { id: string; order: { orderNumber: string } };
  media: Array<{ id: string; url: string; altText: string | null }>;
};

export default function AdminStoreReviewsPage() {
  const [items, setItems] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/store-reviews", { cache: "no-store" });
    const data = await response.json() as { items?: Review[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Store review queue could not be loaded.");
    setItems(data.items || []);
  }, []);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(load).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Store review queue unavailable."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]);
  async function moderate(review: Review, decision: "PUBLISH" | "REJECT") {
    setBusyId(review.id); setError("");
    try {
      const response = await fetch(`/api/admin/store-reviews/${encodeURIComponent(review.id)}/moderate`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Store review could not be moderated.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Store review could not be moderated."); }
    finally { setBusyId(""); }
  }
  return <main className="min-h-screen bg-[var(--background)]"><header className="border-b border-[var(--border)] bg-white px-5 py-5"><div className="mx-auto flex max-w-6xl justify-between"><Link href="/" className="text-xl font-semibold text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link><div className="flex items-center gap-4"><Link href="/admin/reviews" className="text-sm">Product reviews</Link><Link href="/admin/questions" className="text-sm">Product Q&A</Link></div></div></header>
    <div className="mx-auto max-w-6xl px-5 py-10"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Marketplace quality</p><h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">Store review moderation</h1>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {loading ? <div className="mt-6 h-40 animate-pulse rounded-3xl bg-[var(--color-ivory-100)]" /> : items.length ? <div className="mt-6 space-y-4">{items.map((item) => <article key={item.id} className="rounded-3xl border border-[var(--border)] bg-white p-6"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs text-[var(--muted)]">Store</p><h2 className="font-semibold">{item.store.name}</h2><p className="mt-1 text-xs text-[var(--muted)]">Order {item.vendorOrder.order.orderNumber}</p></div><div className="text-right"><p className="text-[var(--color-copper-600)]">{"★".repeat(item.rating)}{"☆".repeat(5-item.rating)}</p><p className="text-xs text-[var(--muted)]">{new Date(item.createdAt).toLocaleString()}</p></div></div><h3 className="mt-5 font-semibold">{item.title}</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-[var(--muted)]">{item.body}</p>{item.media.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{item.media.map((image) => <a key={image.id} href={image.url} target="_blank" rel="noreferrer" aria-label="Open customer review image"><img src={image.url} alt={image.altText || "Customer review image"} loading="lazy" referrerPolicy="no-referrer" className="h-16 w-16 rounded-lg object-cover" /></a>)}</div>}<p className="mt-3 text-xs text-[var(--muted)]">By {item.user.displayName || item.user.email}</p><div className="mt-5 flex flex-wrap gap-3"><button disabled={busyId===item.id} onClick={() => void moderate(item,"PUBLISH")} className="rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Publish</button><button disabled={busyId===item.id} onClick={() => void moderate(item,"REJECT")} className="rounded-xl border border-[var(--border)] px-5 py-3 text-sm font-semibold disabled:opacity-50">Reject</button></div></article>)}</div> : !error ? <div className="mt-6 rounded-3xl border border-[var(--border)] bg-white p-8 text-center text-sm text-[var(--muted)]">No store reviews are awaiting moderation.</div> : null}
    </div>
  </main>;
}
