"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type CartItem = {
  id: string;
  quantity: number;
  variant: {
    id: string; sku: string; name: string | null;
    product: { id: string; slug: string; name: string; store: { name: string; slug: string }; media: Array<{ url: string; altText: string | null }> };
  };
  price: { amountMinor: string; compareAtMinor: string | null; currencyCode: string; minorUnit: number } | null;
  availableQuantity: number;
};
type Cart = {
  id: string;
  market: { id: string; code: string; name: string };
  currency: { code: string; symbol: string | null; minorUnit: number };
  items: CartItem[];
};

function formatMoney(amountMinor: string, currencyCode: string, minorUnit: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode }).format(
    Number(amountMinor) / (10 ** minorUnit)
  );
}

export default function CartPage() {
  const [carts, setCarts] = useState<Cart[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyItem, setBusyItem] = useState("");
  const [error, setError] = useState("");
  const [checkingOutCartId, setCheckingOutCartId] = useState("");
  const router = useRouter();

  const refresh = useCallback(async () => {
    const response = await fetch("/api/cart", { cache: "no-store" });
    const result = await response.json() as { carts?: Cart[]; error?: string };
    if (!response.ok) throw new Error(result.error || "Your cart could not be loaded.");
    setCarts(result.carts ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/cart", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { carts?: Cart[]; error?: string };
        if (!response.ok) throw new Error(result.error || "Your cart could not be loaded.");
        if (active) setCarts(result.carts ?? []);
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Your cart is unavailable."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const itemCount = useMemo(() => carts.reduce((total, cart) => total + cart.items.reduce((sum, item) => sum + item.quantity, 0), 0), [carts]);

  async function changeQuantity(itemId: string, quantity: number) {
    setBusyItem(itemId);
    setError("");
    try {
      const response = await fetch(`/api/cart/items/${encodeURIComponent(itemId)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantity })
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Quantity could not be updated.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Quantity could not be updated.");
    } finally { setBusyItem(""); }
  }

  async function removeItem(itemId: string) {
    setBusyItem(itemId);
    setError("");
    try {
      const response = await fetch(`/api/cart/items/${encodeURIComponent(itemId)}`, { method: "DELETE", headers: { "Content-Type": "application/json" } });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Item could not be removed.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Item could not be removed.");
    } finally { setBusyItem(""); }
  }

  async function beginCheckout(cart: Cart) {
    setCheckingOutCartId(cart.id);
    setError("");
    try {
      const response = await fetch("/api/checkout/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartId: cart.id, idempotencyKey: crypto.randomUUID() })
      });
      const result = await response.json() as { quote?: { id: string }; error?: string };
      if (!response.ok || !result.quote) throw new Error(result.error || "Unable to prepare checkout.");
      router.push(`/checkout?quoteId=${encodeURIComponent(result.quote.id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to prepare checkout.");
    } finally { setCheckingOutCartId(""); }
  }

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-white/80 px-5 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="text-xl font-semibold text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link>
          <Link href="/" className="text-sm text-[var(--color-forest-800)]">Continue shopping</Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-10 md:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">Your selection</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-forest-950)]">Shopping cart</h1></div>
          <p className="text-sm text-[var(--muted)]">{itemCount} {itemCount === 1 ? "item" : "items"}</p>
        </div>
        {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-[var(--color-danger)]">{error}</p>}
        {loading ? <div className="mt-8 h-48 animate-pulse rounded-2xl bg-[var(--color-ivory-100)]" /> :
          carts.length === 0 || carts.every((cart) => cart.items.length === 0) ?
            <section className="mt-10 rounded-3xl border border-[var(--border)] bg-white px-6 py-16 text-center shadow-[var(--shadow-card)]">
              <p className="text-lg font-semibold text-[var(--color-forest-950)]">Your cart is waiting for something special.</p>
              <p className="mt-2 text-sm text-[var(--muted)]">Explore the marketplace and add products you love.</p>
              <Link href="/" className="mt-6 inline-flex rounded-xl bg-[var(--color-forest-900)] px-6 py-3 text-sm font-semibold text-white">Explore products</Link>
            </section> :
            <div className="mt-8 space-y-6">
              {carts.filter((cart) => cart.items.length > 0).map((cart) => {
                const subtotal = cart.items.reduce((sum, item) => sum + (item.price ? BigInt(item.price.amountMinor) * BigInt(item.quantity) : BigInt(0)), BigInt(0));
                return <section key={cart.id} className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
                  <div className="flex flex-wrap justify-between gap-2 border-b border-[var(--border)] bg-[var(--color-ivory-100)] px-5 py-4">
                    <div><p className="font-semibold text-[var(--color-forest-950)]">{cart.market.name}</p><p className="text-xs text-[var(--muted)]">Prices in {cart.currency.code}</p></div>
                    <p className="text-sm font-semibold">{formatMoney(subtotal.toString(), cart.currency.code, cart.currency.minorUnit)}</p>
                  </div>
                  <div className="divide-y divide-[var(--border)]">
                    {cart.items.map((item) => {
                      const unavailable = item.availableQuantity < item.quantity;
                      return <article key={item.id} className="grid gap-4 p-5 sm:grid-cols-[112px_1fr_auto]">
                        <Link href={`/products/${encodeURIComponent(item.variant.product.slug)}`} className="block overflow-hidden rounded-xl bg-[var(--color-ivory-100)]">
                          {item.variant.product.media[0] ? <img src={item.variant.product.media[0].url} alt={item.variant.product.media[0].altText ?? item.variant.product.name} className="aspect-square w-full object-cover" /> : <div className="aspect-square" />}
                        </Link>
                        <div className="min-w-0">
                          <Link href={`/products/${encodeURIComponent(item.variant.product.slug)}`} className="font-semibold text-[var(--color-forest-950)] hover:underline">{item.variant.product.name}</Link>
                          <p className="mt-1 text-xs text-[var(--muted)]">Sold by {item.variant.product.store.name}{item.variant.name ? ` · ${item.variant.name}` : ""}</p>
                          <p className="mt-3 text-sm font-semibold">{item.price ? formatMoney(item.price.amountMinor, item.price.currencyCode, item.price.minorUnit) : "Price unavailable"}</p>
                          {unavailable && <p className="mt-2 text-xs text-[var(--color-danger)]">Only {item.availableQuantity} currently available. Update the quantity to continue.</p>}
                          {item.availableQuantity === 0 && <p className="mt-2 text-xs text-[var(--color-danger)]">Currently out of stock.</p>}
                        </div>
                        <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:justify-between">
                          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">Qty
                            <select aria-label={`Quantity for ${item.variant.product.name}`} disabled={busyItem === item.id} value={item.quantity} onChange={(event) => void changeQuantity(item.id, Number(event.target.value))} className="rounded-lg border border-[var(--border)] bg-white px-2 py-2 text-sm text-[var(--foreground)]">
                              {Array.from({ length: Math.min(99, Math.max(item.availableQuantity, item.quantity, 1)) }, (_, index) => index + 1).map((quantity) => <option key={quantity} value={quantity}>{quantity}</option>)}
                            </select>
                          </label>
                          <button type="button" disabled={busyItem === item.id} onClick={() => void removeItem(item.id)} className="text-xs font-medium text-[var(--color-danger)] underline disabled:opacity-50">Remove</button>
                        </div>
                      </article>;
                    })}
                  </div>
                </section>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-white p-5">
                  <div><p className="font-semibold text-[var(--color-forest-950)]">Ready to review?</p><p className="mt-1 text-xs text-[var(--muted)]">We will recheck prices and temporarily reserve available stock.</p></div>
                  <button type="button" disabled={Boolean(checkingOutCartId) || cart.items.some((item) => !item.price || item.availableQuantity < item.quantity)} onClick={() => void beginCheckout(cart)} className="rounded-xl bg-[var(--color-forest-900)] px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{checkingOutCartId === cart.id ? "Preparing…" : "Review checkout"}</button>
                </div>;
              })}
              <p className="rounded-xl bg-[var(--color-sage-100)] p-4 text-sm leading-6 text-[var(--color-forest-950)]">The checkout quote is calculated by the server and reserves stock for ten minutes. Shipping, tax, discounts and payment are not included yet.</p>
            </div>
        }
      </div>
    </main>
  );
}
