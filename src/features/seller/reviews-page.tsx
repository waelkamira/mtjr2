"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Review = {
  id: string; rating: number; title: string; body: string; status: string; sellerResponse: string | null;
  sellerRespondedAt: string | null; createdAt: string; store: { id: string; name: string; slug: string };
  user: { displayName: string | null }; vendorOrder: { order: { orderNumber: string } };
};

export default function SellerReviewsPage() {
  const [items, setItems] = useState<Review[]>([]);
  const [responses, setResponses] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/seller/reviews", { cache: "no-store" });
    const data = await response.json() as { items?: Review[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Store reviews could not be loaded.");
    setItems(data.items || []);
  }, []);
  useEffect(() => {
    let active = true;
    load().catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Store reviews could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]);
  async function respond(event: FormEvent<HTMLFormElement>, review: Review) {
    event.preventDefault(); setBusyId(review.id); setError("");
    try {
      const response = await fetch(`/api/seller/reviews/${encodeURIComponent(review.id)}/response`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: responses[review.id] || review.sellerResponse || "" })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Seller response could not be saved.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Seller response could not be saved."); }
    finally { setBusyId(""); }
  }
  return <main className="min-h-screen bg-[var(--background)]"><header className="border-b border-[var(--border)] bg-white px-5 py-5"><div className="mx-auto flex max-w-5xl justify-between"><Link href="/" className="text-xl font-semibold text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link><Link href="/seller" className="text-sm">Seller workspace</Link></div></header>
    <div className="mx-auto max-w-5xl px-5 py-10"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Store reputation</p><h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">Customer reviews</h1>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {loading ? <div className="mt-6 h-40 animate-pulse rounded-3xl bg-[var(--color-ivory-100)]" /> : items.length ? <div className="mt-6 space-y-4">{items.map((review) => <article key={review.id} className="rounded-3xl border border-[var(--border)] bg-white p-6"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs text-[var(--muted)]">{review.store.name} · Order {review.vendorOrder.order.orderNumber}</p><h2 className="mt-1 font-semibold">{review.title}</h2></div><div className="text-right"><p className="text-[var(--color-copper-600)]">{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</p><p className="text-xs text-[var(--muted)]">{review.status.replaceAll("_"," ")}</p></div></div><p className="mt-3 whitespace-pre-line text-sm leading-6 text-[var(--muted)]">{review.body}</p><p className="mt-3 text-xs text-[var(--muted)]">By {review.user.displayName || "Verified buyer"} · {new Date(review.createdAt).toLocaleDateString()}</p>
        {review.status === "PUBLISHED" && <form onSubmit={(event) => void respond(event,review)} className="mt-5 border-t border-[var(--border)] pt-4"><label className="block text-sm font-medium">Your public response<textarea rows={3} maxLength={2000} minLength={3} value={responses[review.id] ?? review.sellerResponse ?? ""} onChange={(event) => setResponses((current) => ({ ...current, [review.id]: event.target.value }))} className="mt-2 block w-full rounded-xl border border-[var(--border)] px-3 py-2" /></label><button disabled={busyId === review.id} className="mt-3 rounded-xl bg-[var(--color-forest-900)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busyId === review.id ? "Saving…" : review.sellerResponse ? "Update response" : "Post response"}</button></form>}
      </article>)}</div> : !error ? <div className="mt-6 rounded-3xl border border-[var(--border)] bg-white p-8 text-center text-sm text-[var(--muted)]">No store reviews yet.</div> : null}
    </div>
  </main>;
}
