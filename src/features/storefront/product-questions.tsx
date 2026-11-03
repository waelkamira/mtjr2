"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type Answer = { id: string; body: string; author: string; createdAt: string };
type Question = { id: string; question: string; author: string; createdAt: string; answers: Answer[] };

export default function ProductQuestions({ productId }: { productId: string }) {
  const [items, setItems] = useState<Question[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function load() {
    const response = await fetch(`/api/products/${encodeURIComponent(productId)}/questions`, { cache: "no-store" });
    const data = await response.json() as { items?: Question[] };
    if (!response.ok) throw new Error("Product questions could not be loaded.");
    setItems(data.items || []);
  }
  useEffect(() => {
    let active = true;
    fetch(`/api/products/${encodeURIComponent(productId)}/questions`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { items?: Question[] };
        if (!response.ok) throw new Error("Product questions could not be loaded.");
        if (active) setItems(data.items || []);
      }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Product questions could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}/questions`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Question could not be submitted.");
      setQuestion(""); setMessage("Your question was submitted and is awaiting moderation.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Question could not be submitted."); }
    finally { setBusy(false); }
  }
  return <section className="mx-auto max-w-6xl px-5 pb-12"><div className="border-t border-[var(--border)] pt-9">
    <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Before you buy</p><h2 className="mt-2 text-xl font-semibold text-[var(--color-forest-950)]">Questions and answers</h2>
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    {loading ? <div className="mt-5 h-24 animate-pulse rounded-2xl bg-[var(--color-ivory-100)]" /> : items.length ? <div className="mt-5 space-y-4">{items.map((item) => <article key={item.id} className="rounded-2xl border border-[var(--border)] bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold text-[var(--color-forest-950)]">Q: {item.question}</p><span className="text-xs text-[var(--muted)]">{item.author} · {new Date(item.createdAt).toLocaleDateString()}</span></div>{item.answers.map((answer) => <div key={answer.id} className="mt-4 border-l-2 border-[var(--color-copper-600)] pl-4"><p className="text-sm leading-6 text-[var(--muted)]">A: {answer.body}</p><p className="mt-1 text-xs text-[var(--muted)]">{answer.author} · {new Date(answer.createdAt).toLocaleDateString()}</p></div>)}</article>)}</div> : <p className="mt-5 text-sm text-[var(--muted)]">No published questions yet. Be the first to ask.</p>}
    <form onSubmit={submit} className="mt-6 rounded-2xl bg-[var(--color-ivory-100)] p-5"><label className="block text-sm font-semibold text-[var(--color-forest-950)]">Ask about this product<textarea required minLength={10} maxLength={2000} rows={3} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about size, compatibility, materials or delivery…" className="mt-2 block w-full rounded-xl border border-[var(--border)] bg-white px-3 py-3 font-normal" /></label>
      {message && <p role="status" className="mt-3 text-sm text-[var(--color-forest-800)]">{message}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[var(--muted)]">Questions appear publicly after moderation.</p><button disabled={busy} className="rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Submitting…" : "Submit question"}</button></div>
      {error.includes("Sign in") && <Link href="/login" className="mt-2 inline-block text-sm font-semibold underline">Sign in to continue</Link>}
    </form>
  </div></section>;
}
