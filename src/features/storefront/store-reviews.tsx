"use client";

import { useEffect, useState } from "react";

type StoreReview = {
  id: string; rating: number; title: string; body: string; author: string;
  sellerResponse: string | null; sellerRespondedAt: string | null; createdAt: string;
};

export default function StoreReviews({ storeId, storeName }: { storeId: string; storeName: string }) {
  const [items, setItems] = useState<StoreReview[]>([]);
  const [summary, setSummary] = useState({ averageRating: 0, reviewCount: 0 });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    fetch(`/api/stores/${encodeURIComponent(storeId)}/reviews?limit=5`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { items?: StoreReview[]; summary?: { averageRating: number; reviewCount: number } };
        if (!response.ok) throw new Error("Store reviews unavailable.");
        if (active) { setItems(data.items || []); setSummary(data.summary || { averageRating: 0, reviewCount: 0 }); }
      }).catch(() => { if (active) setItems([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [storeId]);
  return <section className="mx-auto max-w-6xl px-5 pb-12">
    <div className="border-t border-[var(--border)] pt-9"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Seller reputation</p><h2 className="mt-2 text-xl font-semibold text-[var(--color-forest-950)]">{storeName} reviews</h2></div><p className="text-sm text-[var(--muted)]">{summary.reviewCount ? `${summary.averageRating.toFixed(1)} / 5 · ${summary.reviewCount} reviews` : "No published reviews"}</p></div>
      {loading ? <div className="mt-5 h-24 animate-pulse rounded-2xl bg-[var(--color-ivory-100)]" /> : items.length ? <div className="mt-5 grid gap-3 md:grid-cols-2">{items.map((item) => <article key={item.id} className="rounded-2xl border border-[var(--border)] bg-white p-5"><div className="flex justify-between gap-3"><h3 className="font-semibold">{item.title}</h3><span className="text-sm text-[var(--color-copper-600)]">{"★".repeat(item.rating)}{"☆".repeat(5-item.rating)}</span></div><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.body}</p><p className="mt-3 text-xs text-[var(--muted)]">{item.author} · Verified purchase · {new Date(item.createdAt).toLocaleDateString()}</p>{item.sellerResponse && <div className="mt-4 rounded-xl bg-[var(--color-ivory-100)] p-3"><p className="text-xs font-semibold text-[var(--color-forest-900)]">Seller response</p><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{item.sellerResponse}</p></div>}</article>)}</div> : <p className="mt-5 rounded-2xl border border-dashed border-[var(--border)] p-5 text-sm text-[var(--muted)]">This store has no published reviews yet.</p>}
    </div>
  </section>;
}
