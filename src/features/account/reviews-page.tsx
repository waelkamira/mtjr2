"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Review = {
  id: string; rating: number; title: string; body: string; status: string; createdAt: string;
  product: { id: string; name: string; slug: string; media: Array<{ url: string }> };
};

export default function AccountReviewsPage() {
  const [items, setItems] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/account/reviews", { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as { items?: Review[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Your reviews could not be loaded.");
      if (active) setItems(data.items || []);
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Your reviews could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <main className="min-h-screen bg-[var(--background)]"><header className="border-b border-[var(--border)] bg-white px-5 py-5"><div className="mx-auto flex max-w-4xl justify-between"><Link href="/" className="text-xl font-semibold text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link><Link href="/account/orders" className="text-sm">My orders</Link></div></header>
    <div className="mx-auto max-w-4xl px-5 py-10"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Your activity</p><h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">My reviews</h1>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {loading ? <div className="mt-6 h-40 animate-pulse rounded-3xl bg-[var(--color-ivory-100)]" /> : items.length ? <div className="mt-6 space-y-3">{items.map((item) => <article key={item.id} className="flex gap-4 rounded-2xl border border-[var(--border)] bg-white p-5">{item.product.media[0]?.url && <img src={item.product.media[0].url} alt="" className="h-20 w-20 rounded-xl object-cover" />}<div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><Link href={`/products/${encodeURIComponent(item.product.slug)}`} className="font-semibold text-[var(--color-forest-900)] underline">{item.product.name}</Link><span className="text-xs font-semibold">{item.status.replaceAll("_"," ")}</span></div><p className="mt-1 text-sm text-[var(--color-copper-600)]">{"★".repeat(item.rating)}{"☆".repeat(5-item.rating)}</p><h2 className="mt-2 text-sm font-semibold">{item.title}</h2><p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{item.body}</p><p className="mt-2 text-xs text-[var(--muted)]">{new Date(item.createdAt).toLocaleDateString()}</p></div></article>)}</div> : !error ? <div className="mt-6 rounded-3xl border border-[var(--border)] bg-white p-8 text-center text-sm text-[var(--muted)]">You have not submitted any product reviews yet.</div> : null}
    </div>
  </main>;
}
