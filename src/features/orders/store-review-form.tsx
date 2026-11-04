"use client";

import { FormEvent, useState } from "react";

export default function StoreReviewForm({ storeId, vendorOrderId, storeName }: { storeId: string; vendorOrderId: string; storeName: string }) {
  const [rating, setRating] = useState("5");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/stores/${encodeURIComponent(storeId)}/reviews`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorOrderId, rating: Number(rating), title, body })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Store review could not be submitted.");
      setMessage("Your store review is awaiting moderation."); setTitle(""); setBody("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Store review could not be submitted."); }
    finally { setBusy(false); }
  }
  return <div className="mt-5 border-t border-[var(--border)] pt-4">
    <h3 className="font-semibold text-[var(--color-forest-950)]">Review {storeName}</h3>
    {message ? <p role="status" className="mt-2 text-sm text-[var(--color-forest-800)]">{message}</p> : <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2">
      {error && <p role="alert" className="sm:col-span-2 text-sm text-red-700">{error}</p>}
      <label className="text-sm font-medium">Rating<select value={rating} onChange={(event) => setRating(event.target.value)} className="mt-1 block w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2">{[5,4,3,2,1].map((value) => <option key={value} value={value}>{value} out of 5</option>)}</select></label>
      <label className="text-sm font-medium">Title<input required minLength={3} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 block w-full rounded-xl border border-[var(--border)] px-3 py-2" /></label>
      <label className="text-sm font-medium sm:col-span-2">Your experience<textarea required minLength={20} maxLength={4000} rows={3} value={body} onChange={(event) => setBody(event.target.value)} className="mt-1 block w-full rounded-xl border border-[var(--border)] px-3 py-2" /></label>
      <button disabled={busy} className="rounded-xl bg-[var(--color-forest-900)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2">{busy ? "Submitting…" : "Submit store review"}</button>
    </form>}
  </div>;
}
