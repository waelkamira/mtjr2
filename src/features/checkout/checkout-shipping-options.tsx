"use client";

import { useState } from "react";

type Option = { id: string; name: string; description: string | null; amountMinor: string; minDeliveryDays: number | null; maxDeliveryDays: number | null; selected: boolean };
type Group = { storeId: string; storeName: string; options: Option[]; selected: { shippingRateId: string | null; serviceName: string; amountMinor: string; currencyCode: string } | null };

export default function CheckoutShippingOptions({ quoteId, currencyCode, minorUnit, quoteStatus }: { quoteId: string; currencyCode: string; minorUnit: number; quoteStatus: string }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function money(amount: string) {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode }).format(Number(amount) / (10 ** minorUnit));
  }

  async function load() {
    setBusy("load"); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/checkout/quote/${encodeURIComponent(quoteId)}/shipping`, { cache: "no-store" });
      const data = await response.json() as { groups?: Group[]; error?: string };
      if (!response.ok || !data.groups) throw new Error(data.error || "Shipping options could not be loaded.");
      setGroups(data.groups); setLoaded(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Shipping options could not be loaded."); }
    finally { setBusy(""); }
  }

  async function choose(storeId: string, shippingRateId: string) {
    setBusy(storeId); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/checkout/quote/${encodeURIComponent(quoteId)}/shipping`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, shippingRateId })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Shipping option could not be selected.");
      setMessage("Shipping selection saved for this store.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Shipping option could not be selected."); }
    finally { setBusy(""); }
  }

  return <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-card)] md:p-6">
    <p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--color-copper-600)]">Delivery method</p>
    <h2 className="mt-1 text-lg font-semibold text-[var(--color-forest-950)]">Shipping options by seller</h2>
    <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Each seller's service is selected separately. Only currently configured rates for the delivery market and region are shown.</p>
    {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="mt-3 rounded-xl bg-[var(--color-sage-100)] p-3 text-sm text-[var(--color-forest-900)]">{message}</p>}
    {!loaded ? <button type="button" onClick={() => void load()} disabled={quoteStatus !== "ACTIVE" || busy !== ""} className="mt-4 rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy === "load" ? "Loading…" : "Load shipping options"}</button> :
      <div className="mt-4 space-y-5">
        {groups.map((group) => <div key={group.storeId} className="border-t border-[var(--border)] pt-4 first:border-0 first:pt-0">
          <h3 className="font-semibold text-[var(--color-forest-950)]">{group.storeName}</h3>
          {!group.options.length ? <p className="mt-2 rounded-xl bg-[var(--color-ivory-100)] p-3 text-sm text-[var(--muted)]">This seller has not configured an eligible shipping service for your destination.</p> :
            <div className="mt-3 grid gap-2">{group.options.map((option) => <div key={option.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-3">
              <div><p className="font-medium">{option.name}</p>{option.description && <p className="mt-1 text-xs text-[var(--muted)]">{option.description}</p>}<p className="mt-1 text-xs text-[var(--muted)]">{option.minDeliveryDays ?? "—"}–{option.maxDeliveryDays ?? "—"} days</p></div>
              <div className="flex items-center gap-3"><span className="font-semibold tabular-nums">{money(option.amountMinor)}</span><button type="button" disabled={quoteStatus !== "ACTIVE" || busy !== "" || option.selected} onClick={() => void choose(group.storeId, option.id)} className="rounded-lg border border-[var(--color-forest-800)] px-3 py-2 text-xs font-semibold text-[var(--color-forest-900)] disabled:opacity-50">{option.selected ? "Selected" : busy === group.storeId ? "Saving…" : "Choose"}</button></div>
            </div>)}</div>}
        </div>)}
        {!groups.length && <p className="text-sm text-[var(--muted)]">No seller shipping groups were found for this quote.</p>}
        <button type="button" onClick={() => void load()} disabled={busy !== ""} className="rounded-lg border border-[var(--border)] px-4 py-2 text-xs font-semibold">Refresh options</button>
      </div>}
  </section>;
}
