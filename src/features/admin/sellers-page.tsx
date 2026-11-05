"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type StoreRow = { id: string; name: string; slug: string; status: string; createdAt: string };
type SellerRow = {
  id: string; status: string; legalName: string | null; displayName: string | null; createdAt: string;
  owner: { id: string; email: string; displayName: string | null; status: string };
  stores: StoreRow[]; storeCount: number;
};
type Result = { items: SellerRow[]; page: number; pageCount: number; total: number };
const statuses = ["PENDING", "ACTIVE", "SUSPENDED", "REJECTED"];

export default function AdminSellersPage() {
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Result | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (query.trim()) params.set("q", query.trim());
    if (status) params.set("status", status);
    const response = await fetch(`/api/admin/sellers?${params}`, { cache: "no-store" });
    const result = await response.json() as Result & { error?: string };
    if (!response.ok) throw new Error(result.error || "Seller list unavailable.");
    setData(result);
  }

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (query.trim()) params.set("q", query.trim());
    if (status) params.set("status", status);
    void Promise.resolve().then(async () => {
      try {
        const response = await fetch(`/api/admin/sellers?${params}`, { cache: "no-store" });
        const result = await response.json() as Result & { error?: string };
        if (!response.ok) throw new Error(result.error || "Seller list unavailable.");
        if (active) { setData(result); setError(""); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Seller list unavailable.");
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [page, query, status]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = draftQuery.trim();
    if (query === q && page === 1) return;
    setLoading(true);
    setPage(1);
    setQuery(q);
  }

  async function review(seller: SellerRow, decision: "APPROVE" | "REJECT") {
    const reason = reasons[seller.id]?.trim() || "";
    if (decision === "REJECT" && reason.length < 5) { setError("Enter a rejection reason of at least five characters."); return; }
    if (!window.confirm(`${decision === "APPROVE" ? "Approve" : "Reject"} seller ${seller.displayName || seller.legalName || seller.id}?`)) return;
    setBusy(seller.id); setError("");
    try {
      const response = await fetch(`/api/admin/sellers/${encodeURIComponent(seller.id)}/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason: reason || undefined })
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Seller review failed.");
      setReasons((current) => ({ ...current, [seller.id]: "" }));
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Seller review failed."); }
    finally { setBusy(""); }
  }

  async function changeStore(store: StoreRow, nextStatus: "ACTIVE" | "SUSPENDED") {
    const reason = reasons[store.id]?.trim() || "";
    if (reason.length < 5) { setError("Enter a store status reason of at least five characters."); return; }
    if (!window.confirm(`${nextStatus === "SUSPENDED" ? "Suspend" : "Reactivate"} store ${store.name}?`)) return;
    setBusy(store.id); setError("");
    try {
      const response = await fetch(`/api/admin/stores/${encodeURIComponent(store.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, reason })
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Store status update failed.");
      setReasons((current) => ({ ...current, [store.id]: "" }));
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Store status update failed."); }
    finally { setBusy(""); }
  }

  return <main className="min-h-screen px-5 py-8 lg:px-8"><div className="mx-auto max-w-7xl">
    <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Seller operations</p>
    <div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-semibold text-[var(--color-forest-950)]">Sellers and stores</h1><p className="mt-1 text-sm text-[var(--muted)]">Review seller applications and administer active store availability.</p></div><p className="text-sm text-[var(--muted)]">{data?.total ?? 0} sellers</p></div>
    <form onSubmit={search} className="mt-6 grid gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 sm:grid-cols-[1fr_220px_auto]">
      <label className="text-xs font-medium text-[var(--muted)]">Search seller, owner, email or ID<input value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label>
      <label className="text-xs font-medium text-[var(--muted)]">Seller status<select value={status} onChange={(event) => { setLoading(true); setStatus(event.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"><option value="">All statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label>
      <button disabled={loading} className="self-end rounded-xl bg-[var(--color-forest-900)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Search</button>
    </form>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {loading && !data ? <div className="mt-6 h-48 animate-pulse rounded-2xl bg-[var(--color-ivory-100)]" /> : <div className="mt-5 space-y-4">{data?.items.map((seller) => <article key={seller.id} className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs text-[var(--muted)]">Seller {seller.id}</p><h2 className="mt-1 text-lg font-semibold">{seller.displayName || seller.legalName || "Unnamed seller"}</h2><p className="mt-1 text-sm text-[var(--muted)]">{seller.legalName || "No legal name"} · Applied {new Date(seller.createdAt).toLocaleDateString()}</p></div><span className="h-fit rounded-full bg-[var(--color-ivory-100)] px-3 py-1 text-xs font-semibold">{seller.status}</span></div>
      <div className="mt-4 border-t border-[var(--border)] pt-4 text-sm"><p><Link href={`/admin/users/${encodeURIComponent(seller.owner.id)}`} className="font-semibold underline">{seller.owner.displayName || seller.owner.email}</Link> · {seller.owner.email} · account {seller.owner.status}</p></div>
      {seller.status === "PENDING" && <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]"><label className="text-xs font-medium text-[var(--muted)]">Review reason (required for rejection)<input value={reasons[seller.id] || ""} onChange={(event) => setReasons((current) => ({ ...current, [seller.id]: event.target.value }))} maxLength={500} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label><button disabled={busy === seller.id} onClick={() => void review(seller, "APPROVE")} className="self-end rounded-xl bg-[var(--color-forest-900)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Approve</button><button disabled={busy === seller.id} onClick={() => void review(seller, "REJECT")} className="self-end rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-50">Reject</button></div>}
      <div className="mt-5 border-t border-[var(--border)] pt-4"><div className="flex items-center justify-between"><h3 className="font-semibold">Stores</h3><span className="text-xs text-[var(--muted)]">{seller.storeCount} total · showing latest {seller.stores.length}</span></div>{seller.stores.length ? seller.stores.map((store) => <div key={store.id} className="mt-3 rounded-xl bg-[var(--color-ivory-100)] p-3"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">{store.name}</p><p className="text-xs text-[var(--muted)]">/{store.slug} · {store.status}</p></div>{store.status === "ACTIVE" || store.status === "SUSPENDED" ? <div className="flex flex-wrap gap-2"><input aria-label={`Reason for ${store.name} status change`} placeholder="Reason (5+ chars)" value={reasons[store.id] || ""} onChange={(event) => setReasons((current) => ({ ...current, [store.id]: event.target.value }))} maxLength={500} className="w-44 rounded-lg border border-[var(--border)] bg-white px-2 py-1 text-xs" /><button disabled={busy === store.id} onClick={() => void changeStore(store, store.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE")} className="rounded-lg border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold disabled:opacity-50">{store.status === "ACTIVE" ? "Suspend" : "Reactivate"}</button></div> : null}</div></div>) : <p className="mt-2 text-sm text-[var(--muted)]">No stores created.</p>}</div>
    </article>)}{!data?.items.length && !error && <div className="rounded-2xl border border-[var(--border)] bg-white p-8 text-center text-sm text-[var(--muted)]">No sellers match the selected filters.</div>}</div>}
    {data && data.pageCount > 1 && <div className="mt-4 flex items-center justify-between"><button disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((value) => value - 1); }} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">Previous</button><span className="text-sm text-[var(--muted)]">Page {data.page} of {data.pageCount}</span><button disabled={page >= data.pageCount || loading} onClick={() => { setLoading(true); setPage((value) => value + 1); }} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">Next</button></div>}
  </div></main>;
}
