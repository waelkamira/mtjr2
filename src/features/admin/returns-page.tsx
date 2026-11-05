"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ReturnRow = { id: string; returnNumber: string; orderNumber: string; customer: string; customerEmail: string; status: string; reasonCode: string; reasonDetails: string | null; reviewNote: string | null; requestedAt: string; items: Array<{ productName: string; sku: string; orderedQuantity: number; quantity: number }> };
export default function AdminReturnsPage() {
  const [items, setItems] = useState<ReturnRow[]>([]);
  const [selected, setSelected] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    const response = await fetch("/api/admin/returns", { cache: "no-store" });
    const data = await response.json() as { items?: ReturnRow[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Return queue unavailable.");
    setItems(data.items || []);
    if (!selected && data.items?.[0]) setSelected(data.items[0].id);
  }
  useEffect(() => { let live = true; fetch("/api/admin/returns", { cache: "no-store" }).then(async (response) => {
    const data = await response.json() as { items?: ReturnRow[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Return queue unavailable.");
    if (live) { setItems(data.items || []); if (data.items?.[0]) setSelected(data.items[0].id); }
  }).catch((cause) => { if (live) setError(cause instanceof Error ? cause.message : "Return queue unavailable."); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, []);
  const row = items.find((item) => item.id === selected);
  async function update(status: "APPROVED" | "REJECTED") {
    if (!selected) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/returns/" + encodeURIComponent(selected), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, note }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Return update failed.");
      setNote(""); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Return update failed."); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-[var(--background)]">
    <header className="border-b border-[var(--border)] bg-white px-5 py-5"><div className="mx-auto flex max-w-7xl justify-between"><Link href="/" className="text-xl font-semibold text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link><nav className="flex gap-4 text-sm"><Link href="/admin/refunds">Refunds</Link><span className="text-[var(--muted)]">Platform administration</span></nav></div></header>
    <div className="mx-auto max-w-7xl px-5 py-8"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Customer operations</p><h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">Return requests</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Review return eligibility. Physical receipt is recorded by the seller against a warehouse and held in inventory quarantine; it does not initiate a refund.</p>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      {loading ? <div className="mt-6 h-48 animate-pulse rounded-2xl bg-[var(--color-ivory-100)]"/> : <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-2">{items.map((item) => <button key={item.id} onClick={() => setSelected(item.id)} className={"w-full rounded-2xl border bg-white p-4 text-left " + (selected === item.id ? "border-[var(--color-copper-600)]" : "border-[var(--border)]")}><div className="flex justify-between gap-2"><span className="text-xs font-semibold text-[var(--color-copper-600)]">{item.returnNumber}</span><span className="text-xs">{item.status}</span></div><p className="mt-2 font-semibold">{item.orderNumber}</p><p className="mt-1 text-xs text-[var(--muted)]">{item.customer} · {item.items.length} item(s)</p></button>)}{!items.length && <p className="rounded-2xl bg-white p-5 text-sm text-[var(--muted)]">No return requests.</p>}</aside>
        <section>{row && <article className="rounded-3xl border border-[var(--border)] bg-white p-6"><p className="text-xs text-[var(--color-copper-600)]">{row.returnNumber} · {row.orderNumber}</p><h2 className="mt-2 text-xl font-semibold">{row.customer}</h2><p className="mt-1 text-sm text-[var(--muted)]">{row.customerEmail} · {row.status}</p><div className="mt-5 divide-y divide-[var(--border)]">{row.items.map((item) => <div key={item.sku} className="flex justify-between gap-4 py-3 text-sm"><span>{item.productName} · {item.sku}</span><strong>{item.quantity} / {item.orderedQuantity}</strong></div>)}</div><div className="mt-4 rounded-xl bg-[var(--color-ivory-100)] p-4 text-sm"><p className="font-semibold">{row.reasonCode.replaceAll("_", " ")}</p><p className="mt-1 whitespace-pre-wrap">{row.reasonDetails || "No additional details."}</p></div><label className="mt-5 grid gap-2 text-sm font-medium">Review note<textarea rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} className="rounded-xl border border-[var(--border)] p-3" placeholder="Optional note for the customer"/></label>
          <div className="mt-5 flex flex-wrap gap-2">{row.status === "REQUESTED" && <><button disabled={busy} onClick={() => void update("APPROVED")} className="rounded-xl bg-[var(--color-forest-900)] px-4 py-2 text-sm font-semibold text-white">Approve return</button><button disabled={busy} onClick={() => void update("REJECTED")} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700">Reject request</button></>}{row.status === "APPROVED" && <p className="text-sm text-[var(--muted)]">Awaiting the seller to record physical receipt into a selected warehouse.</p>}</div>
        </article>}</section>
      </div>}
    </div>
  </main>;
}
