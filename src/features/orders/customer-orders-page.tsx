"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Order = { id: string; orderNumber: string; status: string; currencyCode: string; currency: { minorUnit: number }; totalMinor: string; placedAt: string; vendorOrders: Array<{ id: string; store: { name: string } }> };
function money(value: string, code: string, unit: number) { return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(Number(value) / (10 ** unit)); }

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true); setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", cache: "no-store" });
      const data = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not sign out. Please try again.");
      window.location.assign("/login");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign out. Please try again.");
    } finally { setSigningOut(false); }
  }
  useEffect(() => {
    let active = true;
    fetch("/api/orders", { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as { orders?: Order[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Order history could not be loaded.");
      if (active) setOrders(data.orders || []);
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Order history could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <main className="min-h-screen bg-[var(--background)]"><header className="border-b border-[var(--border)] bg-white px-5 py-5"><div className="mx-auto flex max-w-4xl justify-between"><Link href="/" className="text-xl font-semibold text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link><div className="flex items-center gap-4"><Link href="/notifications" className="text-sm">Notifications</Link><Link href="/account/messages" className="text-sm">Messages</Link><Link href="/account/reviews" className="text-sm">My reviews</Link><Link href="/account/returns" className="text-sm">Returns</Link><Link href="/account/wishlist" className="text-sm">Wishlist</Link><Link href="/account/questions" className="text-sm">My questions</Link><Link href="/account/support" className="text-sm">Support</Link><Link href="/account/profile" className="text-sm">My account</Link><button type="button" onClick={signOut} disabled={signingOut} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--color-forest-900)] disabled:opacity-50">{signingOut ? "Signing out…" : "Sign out"}</button></div></div></header>
    <div className="mx-auto max-w-4xl px-5 py-10"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Your account</p><h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">Order history</h1>
      {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {loading ? <div className="mt-6 h-48 animate-pulse rounded-3xl bg-[var(--color-ivory-100)]" /> : orders.length ? <div className="mt-6 space-y-3">{orders.map((order) => <Link key={order.id} href={`/orders/${order.id}`} className="block rounded-2xl border border-[var(--border)] bg-white p-5 transition hover:border-[var(--color-copper-500)]"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{order.orderNumber}</p><p className="mt-1 text-xs text-[var(--muted)]">{new Date(order.placedAt).toLocaleDateString()} · {order.vendorOrders.map((vendor) => vendor.store.name).join(", ")}</p></div><div className="text-right"><p className="font-semibold tabular-nums">{money(order.totalMinor, order.currencyCode, order.currency.minorUnit)}</p><p className="mt-1 text-xs text-[var(--muted)]">{order.status.replaceAll("_", " ")}</p></div></div></Link>)}</div> : !error ? <div className="mt-6 rounded-3xl border border-[var(--border)] bg-white p-8 text-center"><p className="font-semibold">No orders yet</p><Link href="/products" className="mt-4 inline-flex rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white">Explore products</Link></div> : null}
    </div>
  </main>;
}
