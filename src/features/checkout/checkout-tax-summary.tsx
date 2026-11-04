"use client";

import { useState } from "react";

type TaxResult = {
  configured: boolean;
  requiresShippingSelection?: boolean;
  message?: string;
  rule?: { name: string; rateBasisPoints: number; isInclusive: boolean; includesShipping: boolean };
  subtotalMinor?: string;
  shippingMinor?: string;
  taxableAmountMinor?: string;
  taxAmountMinor?: string;
  amountDueMinor?: string;
  currencyCode?: string;
  minorUnit?: number;
};

export default function CheckoutTaxSummary({ quoteId, quoteStatus, currencyCode, minorUnit }: { quoteId: string; quoteStatus: string; currencyCode: string; minorUnit: number }) {
  const [result, setResult] = useState<TaxResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function money(value?: string) {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode }).format(Number(value || "0") / (10 ** minorUnit));
  }
  async function calculate() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/checkout/quote/${encodeURIComponent(quoteId)}/tax`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await response.json() as { tax?: TaxResult; error?: string };
      if (!response.ok || !data.tax) throw new Error(data.error || "Tax could not be calculated.");
      setResult(data.tax);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Tax could not be calculated."); }
    finally { setBusy(false); }
  }
  return <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-card)] md:p-6">
    <p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--color-copper-600)]">Checkout totals</p>
    <h2 className="mt-1 text-lg font-semibold text-[var(--color-forest-950)]">Tax calculation</h2>
    <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Tax is calculated from the configured market and destination rule after shipping is selected. No rate is assumed when none is configured.</p>
    <button type="button" disabled={quoteStatus !== "ACTIVE" || busy} onClick={() => void calculate()} className="mt-4 rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Calculating…" : "Calculate tax and total"}</button>
    {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {result && <div className="mt-4 border-t border-[var(--border)] pt-4">
      {!result.configured ? <p className="text-sm text-[var(--muted)]">{result.message}</p> : <>
        <p className="text-sm text-[var(--muted)]">{result.rule?.name} · {(Number(result.rule?.rateBasisPoints || 0) / 100).toFixed(2)}% · {result.rule?.isInclusive ? "Tax inclusive" : "Tax exclusive"}</p>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between"><span>Shipping</span><strong>{money(result.shippingMinor)}</strong></div>
          <div className="flex justify-between"><span>Tax</span><strong>{money(result.taxAmountMinor)}</strong></div>
          <div className="flex justify-between border-t border-[var(--border)] pt-3 text-base"><span className="font-semibold">Estimated total</span><strong>{money(result.amountDueMinor)}</strong></div>
        </div>
      </>}
    </div>}
  </section>;
}
