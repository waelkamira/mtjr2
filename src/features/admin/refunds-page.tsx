"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Candidate = {
  returnRequestId: string;
  returnNumber: string;
  orderNumber: string;
  currencyCode: string;
  provider: string | null;
  amountMinor: string;
  amountDisplay: string;
  eligible: boolean;
  reason: string | null;
  items: Array<{ productName: string; sku: string; quantity: number }>;
};
type RefundRow = {
  id: string;
  returnNumber: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  provider: string;
  amountMinor: string;
  amountDisplay: string;
  currencyCode: string;
  externalReference: string | null;
  note: string | null;
  requestedAt: string;
  completedAt: string | null;
  items: Array<{ productName: string; sku: string; quantity: number; amountMinor: string }>;
};

export default function AdminRefundsPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [externalReferences, setExternalReferences] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const response = await fetch("/api/admin/refunds", { cache: "no-store" });
    const data = await response.json() as { candidates?: Candidate[]; refunds?: RefundRow[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Refund operations could not be loaded.");
    setCandidates(data.candidates ?? []);
    setRefunds(data.refunds ?? []);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/admin/refunds", { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as { candidates?: Candidate[]; refunds?: RefundRow[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Refund operations could not be loaded.");
      if (active) { setCandidates(data.candidates ?? []); setRefunds(data.refunds ?? []); }
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Refund operations could not be loaded.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function createRefund(candidate: Candidate) {
    setBusy(candidate.returnRequestId); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/refunds", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnRequestId: candidate.returnRequestId })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Manual refund request could not be created.");
      setNotice("Manual refund queued for " + candidate.returnNumber + ". Process it in the payment provider's dashboard, then record its external reference below.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Manual refund request could not be created.");
    } finally { setBusy(""); }
  }

  async function completeRefund(refund: RefundRow) {
    const externalReference = (externalReferences[refund.id] || "").trim();
    if (externalReference.length < 4) { setError("Enter the external refund transaction reference first."); return; }
    setBusy(refund.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/refunds/" + encodeURIComponent(refund.id), {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ externalReference, note: notes[refund.id] || "" })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Refund completion could not be recorded.");
      setNotice("External refund confirmation recorded for " + refund.returnNumber + ". The payment status has been updated from the confirmed refund ledger.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Refund completion could not be recorded.");
    } finally { setBusy(""); }
  }

  return <main className="min-h-screen bg-[var(--background)]">
    <header className="border-b border-[var(--border)] bg-white px-5 py-5">
      <div className="mx-auto flex max-w-7xl justify-between gap-4">
        <Link href="/" className="text-xl font-semibold text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link>
        <nav className="flex gap-4 text-sm"><Link href="/admin/returns">Returns</Link><Link href="/admin">Administration</Link></nav>
      </div>
    </header>
    <div className="mx-auto max-w-7xl px-5 py-8">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Finance operations</p>
      <h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">Refunds</h1>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--muted)]">Only physically received return items can enter the refund queue. This release is manual: process the refund outside Mtjr2, then record the external transaction reference. The platform does not call a payment-provider refund API.</p>
      <p className="mt-4 rounded-xl border border-[var(--border)] bg-white p-4 text-sm text-[var(--muted)]">Amounts below cover returned merchandise only. Shipping and tax are not automatically refunded or allocated; review them separately before processing an external refund.</p>
      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl border border-[var(--border)] bg-white p-4 text-sm">{notice}</p>}
      {loading ? <div className="mt-6 h-48 animate-pulse rounded-2xl bg-[var(--color-ivory-100)]" /> : <>
        <section className="mt-8">
          <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Received returns eligible for refund</h2><span className="text-xs text-[var(--muted)]">{candidates.length} candidate(s)</span></div>
          {!candidates.length ? <p className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-5 text-sm text-[var(--muted)]">No received returns are waiting for a refund request.</p> : <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {candidates.map((candidate) => <article key={candidate.returnRequestId} className="rounded-2xl border border-[var(--border)] bg-white p-5">
              <div className="flex flex-wrap justify-between gap-2"><p className="text-xs font-semibold text-[var(--color-copper-600)]">{candidate.returnNumber}</p><p className="text-sm font-semibold">{candidate.amountDisplay}</p></div>
              <p className="mt-2 font-semibold">Order {candidate.orderNumber}</p><p className="mt-1 text-xs text-[var(--muted)]">Payment provider: {candidate.provider || "Unavailable"}</p>
              <ul className="mt-3 space-y-1 text-sm text-[var(--muted)]">{candidate.items.map((item) => <li key={item.sku}>{item.productName} · {item.sku} × {item.quantity}</li>)}</ul>
              {!candidate.eligible && <p className="mt-3 text-sm text-red-700">{candidate.reason || "This return is not eligible."}</p>}
              <button disabled={!candidate.eligible || Boolean(busy)} onClick={() => void createRefund(candidate)} className="mt-4 rounded-xl bg-[var(--color-forest-900)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === candidate.returnRequestId ? "Creating…" : "Create manual refund"}</button>
            </article>)}
          </div>}
        </section>
        <section className="mt-10">
          <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Refund ledger</h2><span className="text-xs text-[var(--muted)]">{refunds.length} record(s)</span></div>
          {!refunds.length ? <p className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-5 text-sm text-[var(--muted)]">No refund records yet.</p> : <div className="mt-4 space-y-4">
            {refunds.map((refund) => <article key={refund.id} className="rounded-2xl border border-[var(--border)] bg-white p-5">
              <div className="flex flex-wrap justify-between gap-2"><div><p className="text-xs font-semibold text-[var(--color-copper-600)]">{refund.returnNumber} · Order {refund.orderNumber}</p><p className="mt-1 font-semibold">{refund.amountDisplay}</p></div><div className="text-right"><p className="text-sm font-semibold">{refund.status.replaceAll("_", " ")}</p><p className="text-xs text-[var(--muted)]">Payment: {refund.paymentStatus} · Provider: {refund.provider}</p></div></div>
              <ul className="mt-3 space-y-1 text-sm text-[var(--muted)]">{refund.items.map((item) => <li key={item.sku}>{item.productName} · {item.sku} × {item.quantity}</li>)}</ul>
              {refund.status === "PENDING_MANUAL" ? <div className="mt-4 grid gap-3 border-t border-[var(--border)] pt-4">
                <label className="grid gap-1 text-sm font-medium">External refund transaction reference<input value={externalReferences[refund.id] || ""} onChange={(event) => setExternalReferences((current) => ({ ...current, [refund.id]: event.target.value }))} maxLength={180} minLength={4} className="rounded-xl border border-[var(--border)] px-3 py-2.5" placeholder="Reference from the payment provider"/></label>
                <label className="grid gap-1 text-sm font-medium">Finance note (optional)<textarea rows={2} maxLength={1000} value={notes[refund.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [refund.id]: event.target.value }))} className="rounded-xl border border-[var(--border)] p-3"/></label>
                <button disabled={Boolean(busy) || (externalReferences[refund.id] || "").trim().length < 4} onClick={() => void completeRefund(refund)} className="w-fit rounded-xl bg-[var(--color-forest-900)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === refund.id ? "Saving…" : "Confirm external refund completed"}</button>
              </div> : <p className="mt-4 border-t border-[var(--border)] pt-3 text-sm text-[var(--muted)]">External reference: {refund.externalReference || "Not recorded"} · Completed {refund.completedAt ? new Date(refund.completedAt).toLocaleString() : "—"}</p>}
            </article>)}
          </div>}
        </section>
      </>}
    </div>
  </main>;
}
