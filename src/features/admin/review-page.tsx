"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type SellerApplication = {
  id: string; legalName: string | null; displayName: string | null; createdAt: string;
  owner: { id: string; email: string; displayName: string | null };
};
type PendingProduct = {
  id: string; name: string; slug: string; description: string | null; createdAt: string;
  store: { id: string; name: string; seller: { id: string; displayName: string | null; legalName: string | null } };
  media: Array<{ url: string; altText: string | null }>;
  variants: Array<{ id: string; sku: string; prices: Array<{ marketId: string; currencyCode: string; amountMinor: string }> }>;
};
type Queues = { sellers: SellerApplication[]; products: PendingProduct[] };

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Request failed.");
  return body as T;
}

export default function AdminReviewPage() {
  const [queues, setQueues] = useState<Queues>({ sellers: [], products: [] });
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    const [sellers, products] = await Promise.all([
      fetch("/api/admin/sellers", { cache: "no-store" }).then((r) => readJson<{ items: SellerApplication[] }>(r)),
      fetch("/api/admin/products", { cache: "no-store" }).then((r) => readJson<{ items: PendingProduct[] }>(r))
    ]);
    setQueues({ sellers: sellers.items, products: products.items });
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/admin/sellers", { cache: "no-store" }).then((r) => readJson<{ items: SellerApplication[] }>(r)),
      fetch("/api/admin/products", { cache: "no-store" }).then((r) => readJson<{ items: PendingProduct[] }>(r))
    ]).then(([sellers, products]) => {
      if (active) setQueues({ sellers: sellers.items, products: products.items });
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load moderation queues.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function reviewSeller(id: string, decision: "APPROVE" | "REJECT") {
    const reason = reasons[id]?.trim() ?? "";
    if (decision === "REJECT" && reason.length < 5) {
      setError("Enter a rejection reason of at least five characters.");
      return;
    }
    setBusyId(id); setError(""); setNotice("");
    try {
      await readJson(await fetch(`/api/admin/sellers/${encodeURIComponent(id)}/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, ...(decision === "REJECT" ? { reason } : {}) })
      }));
      setNotice(decision === "APPROVE" ? "Seller application approved." : "Seller application rejected.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to review seller application.");
    } finally { setBusyId(""); }
  }

  async function reviewProduct(id: string, decision: "APPROVE" | "REJECT") {
    const reason = reasons[id]?.trim() ?? "";
    if (decision === "REJECT" && reason.length < 5) {
      setError("Enter a rejection reason of at least five characters.");
      return;
    }
    setBusyId(id); setError(""); setNotice("");
    try {
      const endpoint = decision === "APPROVE"
        ? `/api/admin/products/${encodeURIComponent(id)}/approve`
        : `/api/admin/products/${encodeURIComponent(id)}/reject`;
      await readJson(await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        ...(decision === "REJECT" ? { body: JSON.stringify({ reason }) } : {})
      }));
      setNotice(decision === "APPROVE" ? "Product approved." : "Product rejected.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to review product.");
    } finally { setBusyId(""); }
  }

  const field = "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm";
  const action = "rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-50";
  return <main className="min-h-screen bg-[var(--background)]">
    <header className="border-b border-[var(--border)] bg-[var(--background)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" className="text-2xl font-semibold text-[var(--color-ink-950)]">mtjr<span className="text-[var(--color-lavender-600)]">.</span></Link>
        <span className="text-sm text-[var(--muted)]">Platform administration</span>
      </div>
    </header>
    <div className="mx-auto max-w-6xl px-5 py-10">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-lavender-600)]">Moderation</p>
      <h1 className="mt-2 text-3xl font-semibold text-[var(--color-ink-950)]">Review queue</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Review seller applications and new product submissions. Every decision is authorized and recorded by the server.</p>
      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl border border-[var(--color-sage-500)] bg-[var(--color-sage-100)] p-3 text-sm">{notice}</p>}
      {loading ? <p className="py-12 text-sm text-[var(--muted)]">Loading review queues…</p> : <div className="mt-8 grid gap-8">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Seller applications</h2><span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs">{queues.sellers.length} pending</span></div>
          {!queues.sellers.length ? <p className="mt-4 text-sm text-[var(--muted)]">No pending seller applications.</p> : <div className="mt-4 divide-y divide-[var(--border)]">
            {queues.sellers.map((seller) => <article key={seller.id} className="grid gap-3 py-5 md:grid-cols-[1fr_1fr]">
              <div><h3 className="font-semibold">{seller.displayName || seller.legalName}</h3><p className="mt-1 text-sm text-[var(--muted)]">{seller.legalName}</p><p className="mt-1 text-xs text-[var(--muted)]">{seller.owner.displayName || seller.owner.email} · {seller.owner.email}</p><p className="mt-1 text-xs text-[var(--muted)]">Submitted {new Date(seller.createdAt).toLocaleDateString()}</p></div>
              <div className="grid gap-2"><input className={field} value={reasons[seller.id] ?? ""} onChange={(e) => setReasons((current) => ({ ...current, [seller.id]: e.target.value }))} placeholder="Rejection reason (required to reject)" /><div className="flex gap-2"><button disabled={!!busyId} onClick={() => reviewSeller(seller.id, "APPROVE")} className={action + " bg-[var(--color-ink-800)] text-white"}>Approve seller</button><button disabled={!!busyId} onClick={() => reviewSeller(seller.id, "REJECT")} className={action + " border border-red-200 text-red-700"}>Reject</button></div></div>
            </article>)}
          </div>}
        </section>
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Product submissions</h2><span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs">{queues.products.length} pending</span></div>
          {!queues.products.length ? <p className="mt-4 text-sm text-[var(--muted)]">No products awaiting review.</p> : <div className="mt-4 divide-y divide-[var(--border)]">
            {queues.products.map((product) => <article key={product.id} className="grid gap-4 py-5 md:grid-cols-[1fr_1fr]">
              <div className="flex gap-4">{product.media[0] && <img src={product.media[0].url} alt={product.media[0].altText ?? product.name} className="h-24 w-24 rounded-xl object-cover" />}<div className="min-w-0"><h3 className="font-semibold">{product.name}</h3><p className="mt-1 text-xs text-[var(--muted)]">/{product.slug} · {product.store.name}</p><p className="mt-1 text-xs text-[var(--muted)]">Seller: {product.store.seller.displayName || product.store.seller.legalName}</p><p className="mt-2 line-clamp-3 text-sm text-[var(--muted)]">{product.description || "No description provided."}</p><p className="mt-2 text-xs text-[var(--muted)]">{product.variants.length} active variants · submitted {new Date(product.createdAt).toLocaleDateString()}</p></div></div>
              <div className="grid gap-2"><input className={field} value={reasons[product.id] ?? ""} onChange={(e) => setReasons((current) => ({ ...current, [product.id]: e.target.value }))} placeholder="Rejection reason (required to reject)" /><div className="flex gap-2"><button disabled={!!busyId} onClick={() => reviewProduct(product.id, "APPROVE")} className={action + " bg-[var(--color-ink-800)] text-white"}>Approve product</button><button disabled={!!busyId} onClick={() => reviewProduct(product.id, "REJECT")} className={action + " border border-red-200 text-red-700"}>Reject</button></div></div>
            </article>)}
          </div>}
        </section>
      </div>}
    </div>
  </main>;
}
