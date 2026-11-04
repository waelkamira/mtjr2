"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const GUEST_WISHLIST_KEY = "mtjr:guest-wishlist:v1";
function readGuestIds(): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(GUEST_WISHLIST_KEY) ?? "[]");
    return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))].slice(0, 100) : [];
  } catch { return []; }
}
type Recommendation = { id: string; slug: string; name: string; image: { url: string; altText: string | null } | null; store: { name: string; slug: string }; reason: string };
type Favorite = {
  id: string; createdAt: string;
  product: {
    id: string; name: string; slug: string; image: { url: string; altText: string | null } | null;
    store: { name: string; slug: string };
  };
};

export default function WishlistPage() {
  const [items, setItems] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const load = useCallback(async () => {
    const response = await fetch("/api/favorites", { cache: "no-store" });
    const data = await response.json() as { items?: Favorite[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Wishlist could not be loaded.");
    setItems(data.items || []);
  }, []);
  useEffect(() => {
    let active = true;
    async function initialize() {
      const guestIds = readGuestIds();
      if (guestIds.length) {
        const merge = await fetch("/api/favorites/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds: guestIds })
        });
        if (merge.ok) {
          try { window.localStorage.removeItem(GUEST_WISHLIST_KEY); } catch { /* Retain cache if storage is restricted. */ }
        } else if (merge.status !== 401) {
          const result = await merge.json().catch(() => ({})) as { error?: string };
          throw new Error(result.error || "Guest wishlist could not be merged.");
        }
      }
      await load();
      const response = await fetch("/api/recommendations", { cache: "no-store" });
      if (response.ok) {
        const result = await response.json() as { items?: Recommendation[] };
        if (active) setRecommendations(result.items ?? []);
      }
    }
    void initialize().catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Wishlist could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]);
  async function remove(productId: string) {
    setBusyId(productId); setError("");
    try {
      const response = await fetch(`/api/favorites/${encodeURIComponent(productId)}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Favorite could not be removed.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Favorite could not be removed."); }
    finally { setBusyId(""); }
  }
  return <main className="min-h-screen bg-[var(--background)]"><header className="border-b border-[var(--border)] bg-white px-5 py-5"><div className="mx-auto flex max-w-5xl justify-between"><Link href="/" className="text-xl font-semibold text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link><Link href="/account/orders" className="text-sm">My orders</Link></div></header>
    <div className="mx-auto max-w-5xl px-5 py-10"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Saved items</p><div className="mt-2 flex items-end justify-between gap-3"><h1 className="text-3xl font-semibold text-[var(--color-forest-950)]">My wishlist</h1><p className="text-sm text-[var(--muted)]">{items.length} saved</p></div>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error} {error.toLowerCase().includes("sign in") && <Link href="/login" className="ml-1 font-semibold underline">Sign in</Link>}</p>}
      {loading ? <div className="mt-6 h-48 animate-pulse rounded-3xl bg-[var(--color-ivory-100)]" /> : items.length ? <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <article key={item.id} className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white"><Link href={`/products/${encodeURIComponent(item.product.slug)}`} className="block">{item.product.image ? <img src={item.product.image.url} alt={item.product.image.altText || item.product.name} className="aspect-square w-full object-cover" /> : <div className="aspect-square bg-[var(--color-ivory-100)]" />}<div className="p-5"><p className="text-xs text-[var(--muted)]">{item.product.store.name}</p><h2 className="mt-1 font-semibold text-[var(--color-forest-950)]">{item.product.name}</h2><p className="mt-3 text-lg font-semibold">Select a market to view pricing</p></div></Link><div className="px-5 pb-5"><button disabled={busyId===item.product.id} onClick={() => void remove(item.product.id)} className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold disabled:opacity-50">{busyId===item.product.id ? "Removing…" : "Remove from wishlist"}</button></div></article>)}</div> : !error ? <div className="mt-6 rounded-3xl border border-[var(--border)] bg-white p-8 text-center"><p className="font-semibold text-[var(--color-forest-950)]">Your wishlist is empty</p><p className="mt-2 text-sm text-[var(--muted)]">Save products to keep them close while you browse.</p><Link href="/" className="mt-5 inline-flex rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white">Explore marketplace</Link></div> : null}
    </div>
  </main>;
}
