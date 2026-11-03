"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type Quote = {
  id: string;
  status: "ACTIVE" | "EXPIRED" | "RELEASED" | "CONVERTED";
  market: { code: string; name: string };
  currency: { code: string; symbol: string | null; minorUnit: number };
  subtotalMinor: string;
  expiresAt: string;
  lines: Array<{ id: string; productName: string; storeName: string; sku: string; variantName: string | null; quantity: number; unitAmountMinor: string; lineTotalMinor: string }>;
};

function money(amountMinor: string, code: string, minorUnit: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(Number(amountMinor) / (10 ** minorUnit));
}

export default function CheckoutReviewPage() {
  const search = useSearchParams();
  const router = useRouter();
  const quoteId = search.get("quoteId");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!quoteId) {
      setError("A checkout quote is required. Return to your cart to review it.");
      setLoading(false);
      return;
    }
    fetch(`/api/checkout/quote/${encodeURIComponent(quoteId)}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { quote?: Quote; error?: string };
        if (!response.ok || !result.quote) throw new Error(result.error || "Checkout quote could not be loaded.");
        if (active) setQuote(result.quote);
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Checkout quote could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [quoteId]);

  async function releaseQuote() {
    if (!quote) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/checkout/quote/${encodeURIComponent(quote.id)}/release`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({})
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "The reservation could not be released.");
      router.push("/cart");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The reservation could not be released.");
    } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-white/80 px-5 py-5">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="text-xl font-semibold text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link>
          <Link href="/cart" className="text-sm text-[var(--color-forest-800)]">Back to cart</Link>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-5 py-10 md:py-14">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">Buying core · Step 2</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-forest-950)]">Review your order</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">This is a server-generated price quote. Available inventory is temporarily held while the quote is active.</p>
        {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-[var(--color-danger)]">{error}</p>}
        {loading ? <div className="mt-8 h-56 animate-pulse rounded-2xl bg-[var(--color-ivory-100)]" /> :
          quote ? <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
            <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
              <div className="border-b border-[var(--border)] bg-[var(--color-ivory-100)] px-5 py-4">
                <p className="font-semibold text-[var(--color-forest-950)]">{quote.market.name}</p>
                <p className="text-xs text-[var(--muted)]">Quote reference · {quote.id}</p>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {quote.lines.map((line) => <article key={line.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-5">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--color-forest-950)]">{line.productName}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">Sold by {line.storeName}{line.variantName ? ` · ${line.variantName}` : ""} · Qty {line.quantity}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">SKU {line.sku}</p>
                    <p className="mt-2 text-sm text-[var(--muted)]">{money(line.unitAmountMinor, quote.currency.code, quote.currency.minorUnit)} each</p>
                  </div>
                  <p className="font-semibold tabular-nums">{money(line.lineTotalMinor, quote.currency.code, quote.currency.minorUnit)}</p>
                </article>)}
              </div>
            </section>
            <aside className="h-fit rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-card)]">
              <p className="text-sm font-semibold text-[var(--color-forest-950)]">Quote summary</p>
              <div className="mt-5 flex justify-between gap-3 text-sm"><span className="text-[var(--muted)]">Items subtotal</span><span className="font-semibold tabular-nums">{money(quote.subtotalMinor, quote.currency.code, quote.currency.minorUnit)}</span></div>
              <div className="mt-4 border-t border-[var(--border)] pt-4"><p className="text-xs text-[var(--muted)]">Reservation status</p><p className={`mt-1 font-semibold ${quote.status === "ACTIVE" ? "text-[var(--color-forest-900)]" : "text-[var(--color-danger)]"}`}>{quote.status}</p><p className="mt-2 text-xs leading-5 text-[var(--muted)]">{quote.status === "ACTIVE" ? `Stock held until ${new Date(quote.expiresAt).toLocaleString()}.` : "This quote is no longer holding inventory. Return to your cart to create a fresh quote."}</p></div>
              <button type="button" disabled={busy || quote.status !== "ACTIVE"} onClick={() => void releaseQuote()} className="mt-6 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--color-forest-900)] disabled:opacity-50">{busy ? "Releasing…" : "Release reservation"}</button>
              <p className="mt-4 text-xs leading-5 text-[var(--muted)]">Shipping, tax, discounts, address collection and payment are not included yet. No order has been created and no payment has been taken.</p>
            </aside>
          </div> : <div className="mt-8 rounded-3xl border border-[var(--border)] bg-white p-8 text-center"><p className="font-semibold text-[var(--color-forest-950)]">Checkout quote unavailable</p><Link href="/cart" className="mt-4 inline-flex rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white">Return to cart</Link></div>
        }
      </div>
    </main>
  );
}
