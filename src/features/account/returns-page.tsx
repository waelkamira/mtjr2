"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type EligibleItem = { id: string; productName: string; sku: string; orderedQuantity: number; availableQuantity: number };
type EligibleOrder = { id: string; orderNumber: string; vendorOrders: Array<{ id: string; storeName: string; items: EligibleItem[] }> };
type ReturnRow = { id: string; returnNumber: string; orderNumber: string; status: string; reasonCode: string; reasonDetails: string | null; reviewNote: string | null; requestedAt: string; refund: { status: string; amountMinor: string; amountDisplay: string } | null; items: Array<{ productName: string; sku: string; quantity: number; status: string; reviewNote: string | null }> };
type Center = { eligibleOrders: EligibleOrder[]; requests: ReturnRow[] };

export default function CustomerReturnsPage() {
  const [center, setCenter] = useState<Center>({ eligibleOrders: [], requests: [] });
  const [selection, setSelection] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reasonCode, setReasonCode] = useState("DAMAGED");
  const [reasonDetails, setReasonDetails] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const options = useMemo(() => center.eligibleOrders.flatMap((order) => order.vendorOrders.flatMap((vendor) => vendor.items.map((item) => ({
    value: order.id + "::" + item.id, orderId: order.id, item, orderNumber: order.orderNumber, storeName: vendor.storeName
  })))), [center]);
  const selected = options.find((option) => option.value === selection);

  async function load() {
    const response = await fetch("/api/returns", { cache: "no-store" });
    const data = await response.json() as Center & { error?: string };
    if (!response.ok) throw new Error(data.error || "Returns could not be loaded.");
    setCenter({ eligibleOrders: data.eligibleOrders || [], requests: data.requests || [] });
  }
  useEffect(() => { let live = true; fetch("/api/returns", { cache: "no-store" }).then(async (response) => {
    const data = await response.json() as Center & { error?: string };
    if (!response.ok) throw new Error(data.error || "Returns could not be loaded.");
    if (live) { setCenter({ eligibleOrders: data.eligibleOrders || [], requests: data.requests || [] }); const firstOrder = data.eligibleOrders?.[0]; const firstVendor = firstOrder?.vendorOrders?.[0]; const firstItem = firstVendor?.items?.[0]; if (firstOrder && firstItem) setSelection(firstOrder.id + "::" + firstItem.id); }
  }).catch((cause) => { if (live) setError(cause instanceof Error ? cause.message : "Returns could not be loaded."); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); if (!selected) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/returns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        orderId: selected.orderId, reasonCode, reasonDetails, items: [{ orderItemId: selected.item.id, quantity }]
      }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Return request could not be submitted.");
      setNotice("Your return request has been submitted. No refund has been initiated.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Return request could not be submitted."); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[var(--background)]">
    <header className="border-b border-[var(--border)] bg-white px-5 py-5"><div className="mx-auto flex max-w-5xl justify-between"><Link href="/" className="text-xl font-semibold text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link><nav className="flex gap-4 text-sm"><Link href="/account/orders">Orders</Link><Link href="/account/profile">My account</Link></nav></div></header>
    <div className="mx-auto max-w-5xl px-5 py-10">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Customer care</p><h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">Returns</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Request a return for delivered items and follow its review. Return eligibility and quantity are checked against your order. This workflow does not initiate a payment refund.</p>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl bg-[var(--color-ivory-100)] p-4 text-sm text-[var(--color-forest-900)]">{notice}</p>}
      <section className="mt-7 rounded-3xl border border-[var(--border)] bg-white p-6">
        <h2 className="text-lg font-semibold">Start a return</h2>
        {loading ? <div className="mt-4 h-24 animate-pulse rounded-xl bg-[var(--color-ivory-100)]"/> : options.length ? <form onSubmit={submit} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium md:col-span-2">Delivered order item
            <select required value={selection} onChange={(event) => { setSelection(event.target.value); setQuantity(1); }} className="rounded-xl border border-[var(--border)] bg-white p-3">
              {options.map((option) => <option key={option.value} value={option.value}>{option.orderNumber} · {option.storeName} · {option.item.productName} (up to {option.item.availableQuantity})</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">Quantity
            <input type="number" min={1} max={selected?.item.availableQuantity || 1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} className="rounded-xl border border-[var(--border)] p-3"/>
          </label>
          <label className="grid gap-2 text-sm font-medium">Reason
            <select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} className="rounded-xl border border-[var(--border)] bg-white p-3">
              <option value="DAMAGED">Item arrived damaged</option><option value="WRONG_ITEM">Wrong item received</option><option value="NOT_AS_DESCRIBED">Not as described</option><option value="CHANGED_MIND">Changed my mind</option><option value="OTHER">Other</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium md:col-span-2">Additional details
            <textarea rows={3} maxLength={2000} value={reasonDetails} onChange={(event) => setReasonDetails(event.target.value)} className="rounded-xl border border-[var(--border)] p-3" placeholder="Describe the issue (optional)"/>
          </label>
          <div className="md:col-span-2"><button disabled={busy || !selected || quantity > (selected?.item.availableQuantity || 0)} className="rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Submitting…" : "Submit return request"}</button></div>
        </form> : <p className="mt-3 text-sm text-[var(--muted)]">No delivered items currently have remaining return quantity. Check back after an order is delivered.</p>}
      </section>
      <section className="mt-8"><h2 className="text-xl font-semibold">Your return requests</h2>
        {loading ? <div className="mt-4 h-32 animate-pulse rounded-2xl bg-[var(--color-ivory-100)]"/> : center.requests.length ? <div className="mt-4 space-y-3">{center.requests.map((row) => <article key={row.id} className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="flex flex-wrap justify-between gap-2"><div><p className="text-xs font-semibold text-[var(--color-copper-600)]">{row.returnNumber} · {row.orderNumber}</p><p className="mt-1 font-semibold">{row.items.map((item) => item.productName + " × " + item.quantity + " (" + item.status.replaceAll("_", " ") + ")").join(", ")}</p></div><span className="h-fit rounded-full bg-[var(--color-ivory-100)] px-3 py-1 text-xs font-semibold">{row.status.replaceAll("_", " ")}</span></div>
          <p className="mt-2 text-xs text-[var(--muted)]">{row.reasonCode.replaceAll("_", " ")} · {new Date(row.requestedAt).toLocaleString()}</p>
          {row.refund && <p className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--color-ivory-100)] p-3 text-sm">Refund: <strong>{row.refund.status.replaceAll("_", " ")}</strong> · {row.refund.amountDisplay}{row.refund.status === "PENDING_MANUAL" ? " · awaiting finance processing outside Mtjr2" : " · finance recorded external confirmation"}</p>}
          {row.items.filter((item) => item.reviewNote).map((item) => <p key={item.sku} className="mt-2 rounded-xl bg-[var(--color-ivory-100)] p-3 text-sm">{item.sku}: {item.reviewNote}</p>)}{row.reviewNote && <p className="mt-3 rounded-xl bg-[var(--color-ivory-100)] p-3 text-sm">{row.reviewNote}</p>}
        </article>)}</div> : <p className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-6 text-sm text-[var(--muted)]">You have not requested a return yet.</p>}
      </section>
    </div>
  </main>;
}
