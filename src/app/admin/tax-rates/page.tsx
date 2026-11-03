"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type Market = { id: string; code: string; name: string };
type TaxRate = { id: string; market: Market; name: string; destinationRegion: string | null; rateBasisPoints: number; isInclusive: boolean; appliesToShipping: boolean; isActive: boolean };

async function json(response: Response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

export default function AdminTaxRatesPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [rates, setRates] = useState<TaxRate[]>([]);
  const [marketId, setMarketId] = useState("");
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [percent, setPercent] = useState("0");
  const [inclusive, setInclusive] = useState(false);
  const [shipping, setShipping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const [marketData, rateData] = await Promise.all([
      json(await fetch("/api/markets", { cache: "no-store" })),
      json(await fetch("/api/admin/tax-rates", { cache: "no-store" }))
    ]);
    setMarkets(marketData.markets || []);
    setRates(rateData.rates || []);
    if (!marketId && marketData.markets?.[0]) setMarketId(marketData.markets[0].id);
  }

  useEffect(() => { void load().catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load tax rules.")); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const value = Number(percent);
      if (!Number.isFinite(value) || value < 0 || value > 1000) throw new Error("Enter a tax rate from 0% to 1000%.");
      await json(await fetch("/api/admin/tax-rates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId, name, destinationRegion: region || null, rateBasisPoints: Math.round(value * 100), isInclusive: inclusive, appliesToShipping: shipping })
      }));
      setMessage("Tax rule created."); setName(""); setRegion(""); setPercent("0");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create tax rule."); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[var(--background)]">
    <header className="border-b border-[var(--border)] bg-white px-5 py-5"><div className="mx-auto flex max-w-5xl justify-between"><Link href="/" className="text-xl font-semibold text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link><Link href="/admin/review" className="text-sm">Admin</Link></div></header>
    <div className="mx-auto max-w-5xl px-5 py-10">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Platform administration</p>
      <h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">Market tax rules</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Configure a market-wide tax rate, optionally narrowed to a destination region. These are explicit platform rules, not automatically sourced statutory rates.</p>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="mt-5 rounded-xl bg-[var(--color-sage-100)] p-3 text-sm">{message}</p>}
      <form onSubmit={submit} className="mt-7 grid gap-4 rounded-3xl border border-[var(--border)] bg-white p-6 md:grid-cols-2">
        <label className="grid gap-2 text-sm">Market<select required value={marketId} onChange={(e) => setMarketId(e.target.value)} className="rounded-xl border border-[var(--border)] p-3">{markets.map((market) => <option key={market.id} value={market.id}>{market.name} · {market.code}</option>)}</select></label>
        <label className="grid gap-2 text-sm">Rule name<input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl border border-[var(--border)] p-3" placeholder="Standard VAT" /></label>
        <label className="grid gap-2 text-sm">Destination region (optional)<input maxLength={120} value={region} onChange={(e) => setRegion(e.target.value)} className="rounded-xl border border-[var(--border)] p-3" placeholder="Region/state exactly as entered in address" /></label>
        <label className="grid gap-2 text-sm">Rate (%)<input required type="number" min="0" max="1000" step="0.01" value={percent} onChange={(e) => setPercent(e.target.value)} className="rounded-xl border border-[var(--border)] p-3" /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={inclusive} onChange={(e) => setInclusive(e.target.checked)} /> Tax is included in listed prices</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={shipping} onChange={(e) => setShipping(e.target.checked)} /> Apply tax to shipping</label>
        <button disabled={busy || !marketId} className="rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 md:col-span-2">{busy ? "Saving…" : "Create tax rule"}</button>
      </form>
      <section className="mt-8 rounded-3xl border border-[var(--border)] bg-white p-6">
        <h2 className="text-lg font-semibold">Configured rules</h2>
        <div className="mt-4 divide-y divide-[var(--border)]">{rates.map((rate) => <article key={rate.id} className="flex flex-wrap justify-between gap-3 py-4 first:pt-0"><div><p className="font-semibold">{rate.name} · {rate.market.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{rate.destinationRegion || "All regions"} · {rate.isInclusive ? "Inclusive" : "Exclusive"} · {rate.appliesToShipping ? "Shipping taxable" : "Items only"}</p></div><p className="font-semibold tabular-nums">{(rate.rateBasisPoints / 100).toFixed(2)}%</p></article>)}
          {!rates.length && <p className="py-5 text-sm text-[var(--muted)]">No tax rules configured.</p>}</div>
      </section>
    </div>
  </main>;
}
