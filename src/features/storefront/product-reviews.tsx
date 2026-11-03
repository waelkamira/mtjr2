"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Review = { id: string; rating: number; title: string; body: string; author: string; createdAt: string; verifiedPurchase: true };
type ReviewableItem = { id: string; productName: string; sku: string; quantity: number; orderNumber: string; purchasedAt: string };

export default function ProductReviews({ productId }: { productId: string }) {
  const [items, setItems] = useState<Review[]>([]);
  const [summary, setSummary] = useState({ averageRating: 0, reviewCount: 0 });
  const [eligible, setEligible] = useState<ReviewableItem[]>([]);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [rating, setRating] = useState("5");
  const [orderItemId, setOrderItemId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadReviews = useCallback(async () => {
    const response = await fetch(`/api/products/${encodeURIComponent(productId)}/reviews?limit=20`, { cache: "no-store" });
    const data = await response.json() as { items?: Review[]; summary?: { averageRating: number; reviewCount: number }; error?: string };
    if (!response.ok) throw new Error(data.error || "Reviews could not be loaded.");
    setItems(data.items || []);
    setSummary(data.summary || { averageRating: 0, reviewCount: 0 });
  }, [productId]);

  const loadEligible = useCallback(async () => {
    const response = await fetch(`/api/account/reviewable-items?productId=${encodeURIComponent(productId)}`, { cache: "no-store" });
    if (response.status === 401) { setNeedsSignIn(true); setEligible([]); return; }
    const data = await response.json() as { items?: ReviewableItem[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Eligible purchases could not be loaded.");
    setNeedsSignIn(false);
    setEligible(data.items || []);
    setOrderItemId((current) => current || data.items?.[0]?.id || "");
  }, [productId]);

  useEffect(() => {
    let active = true;
    Promise.all([loadReviews(), loadEligible()])
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Reviews are unavailable."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadReviews, loadEligible]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orderItemId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}/reviews`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderItemId, rating: Number(rating), title, body })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Review could not be submitted.");
      setMessage("Your review was submitted and is awaiting moderation.");
      setTitle(""); setBody("");
      await Promise.all([loadReviews(), loadEligible()]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Review could not be submitted."); }
    finally { setBusy(false); }
  }

  return <section className="mx-auto max-w-6xl px-5 pb-16">
    <div className="border-t border-[var(--border)] pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Customer feedback</p><h2 className="mt-2 text-2xl font-semibold text-[var(--color-forest-950)]">Product reviews</h2></div>
        <div className="text-right"><p className="text-2xl font-semibold text-[var(--color-forest-950)]">{summary.reviewCount ? summary.averageRating.toFixed(1) : "—"} <span className="text-[var(--color-copper-600)]">★</span></p><p className="text-xs text-[var(--muted)]">{summary.reviewCount} published reviews</p></div>
      </div>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="mt-5 rounded-xl bg-[var(--color-ivory-100)] p-3 text-sm text-[var(--color-forest-900)]">{message}</p>}
      <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {loading ? <div className="h-36 animate-pulse rounded-2xl bg-[var(--color-ivory-100)]" /> : items.length ? items.map((review) => <article key={review.id} className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold text-[var(--color-forest-950)]">{review.title}</h3><span aria-label={`${review.rating} out of 5 stars`} className="text-sm tracking-wider text-[var(--color-copper-600)]">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span></div>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[var(--muted)]">{review.body}</p>
            <p className="mt-4 text-xs text-[var(--muted)]">{review.author} · Verified purchase · {new Date(review.createdAt).toLocaleDateString()}</p>
          </article>) : <div className="rounded-2xl border border-dashed border-[var(--border)] p-7 text-center text-sm text-[var(--muted)]">No published reviews yet. Be the first verified buyer to share feedback.</div>}
        </div>
        <aside className="h-fit rounded-2xl border border-[var(--border)] bg-white p-5">
          <h3 className="font-semibold text-[var(--color-forest-950)]">Write a review</h3>
          {needsSignIn ? <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Sign in with the account used for your purchase. Reviews are available after delivery.</p> :
            eligible.length ? <form onSubmit={submit} className="mt-4 space-y-3">
              <label className="block text-sm font-medium">Delivered purchase<select required value={orderItemId} onChange={(event) => setOrderItemId(event.target.value)} className="mt-1 block w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2">{eligible.map((item) => <option key={item.id} value={item.id}>{item.orderNumber} · {item.sku} · Qty {item.quantity}</option>)}</select></label>
              <label className="block text-sm font-medium">Rating<select value={rating} onChange={(event) => setRating(event.target.value)} className="mt-1 block w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2">{[5,4,3,2,1].map((value) => <option key={value} value={value}>{value} out of 5</option>)}</select></label>
              <label className="block text-sm font-medium">Title<input required minLength={3} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 block w-full rounded-xl border border-[var(--border)] px-3 py-2" /></label>
              <label className="block text-sm font-medium">Your experience<textarea required minLength={20} maxLength={4000} rows={5} value={body} onChange={(event) => setBody(event.target.value)} className="mt-1 block w-full rounded-xl border border-[var(--border)] px-3 py-2" /></label>
              <button disabled={busy || !orderItemId} className="w-full rounded-xl bg-[var(--color-forest-900)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Submitting…" : "Submit review"}</button>
            </form> : <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Only customers with a delivered purchase can review this product. Reviews are limited to one per customer and product.</p>}
          {needsSignIn && <Link href="/login" className="mt-4 inline-flex rounded-xl bg-[var(--color-forest-900)] px-4 py-2 text-sm font-semibold text-white">Sign in</Link>}
        </aside>
      </div>
    </div>
  </section>;
}
