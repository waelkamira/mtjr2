"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StoreReviewForm from "@/features/orders/store-review-form";

type PaymentProvider = { key: string; displayName: string };

type Order = {
  id: string; orderNumber: string; status: string; currencyCode: string;
  currency: { minorUnit: number; symbol: string | null };
  subtotalMinor: string; shippingMinor: string; taxMinor: string; totalMinor: string; tax: { ruleName: string; rateBasisPoints: number; inclusive: boolean; includesShipping: boolean; destinationRegion: string | null }; placedAt: string;
  address: { recipientName: string; phone: string; countryName: string; line1: string; line2: string | null; city: string; region: string | null; postalCode: string | null } | null;
  vendorOrders: Array<{
    id: string; status: string; store: { id: string; name: string; slug: string }; shippingServiceName: string; shippingDestinationRegion: string | null; minDeliveryDays: number | null; maxDeliveryDays: number | null;
    subtotalMinor: string; shippingMinor: string; taxMinor: string; totalMinor: string;
    items: Array<{ id: string; productName: string; sku: string; variantName: string | null; quantity: number; unitAmountMinor: string; lineTotalMinor: string }>;
  }>;
};

function money(value: string, code: string, minorUnit: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(Number(value) / (10 ** minorUnit));
}

export default function OrderDetailPage({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentProviders, setPaymentProviders] = useState<PaymentProvider[]>([]);
  const [paymentBusy, setPaymentBusy] = useState("");
  const [paymentError, setPaymentError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/orders/${encodeURIComponent(orderId)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { order?: Order; error?: string };
        if (!response.ok || !data.order) throw new Error(data.error || "Order could not be loaded.");
        if (active) setOrder(data.order);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Order could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [orderId]);

  useEffect(() => {
    let active = true;
    fetch("/api/payments/providers", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { providers?: PaymentProvider[] };
        if (active && response.ok) setPaymentProviders(data.providers || []);
      })
      .catch(() => { if (active) setPaymentProviders([]); });
    return () => { active = false; };
  }, []);

  async function startPayment(provider: PaymentProvider) {
    if (!order) return;
    setPaymentBusy(provider.key);
    setPaymentError("");
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider.key, idempotencyKey: crypto.randomUUID() })
      });
      const data = await response.json() as { payment?: { checkoutUrl: string | null }; error?: string };
      if (!response.ok || !data.payment) throw new Error(data.error || "Payment could not be started.");
      if (!data.payment.checkoutUrl) throw new Error("The payment session is being prepared. Refresh this page shortly.");
      window.location.assign(data.payment.checkoutUrl);
    } catch (cause) {
      setPaymentError(cause instanceof Error ? cause.message : "Payment could not be started.");
    } finally {
      setPaymentBusy("");
    }
  }

  return <main className="min-h-screen bg-[var(--background)]">
    <header className="border-b border-[var(--border)] bg-white px-5 py-5"><div className="mx-auto flex max-w-4xl justify-between"><Link href="/" className="text-xl font-semibold text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link><div className="flex items-center gap-4"><Link href="/notifications" className="text-sm text-[var(--color-forest-800)]">Notifications</Link><Link href="/account/orders" className="text-sm text-[var(--color-forest-800)]">Order history</Link><Link href="/account/returns" className="text-sm text-[var(--color-forest-800)]">Returns</Link></div></div></header>
    <div className="mx-auto max-w-4xl px-5 py-10">
      {loading ? <div className="h-64 animate-pulse rounded-3xl bg-[var(--color-ivory-100)]" /> : error ? <div role="alert" className="rounded-2xl bg-red-50 p-5 text-sm text-red-800">{error}</div> : order ? <>
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Order confirmation</p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">Thank you for your order</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Order {order.orderNumber} · {new Date(order.placedAt).toLocaleString()}</p>
        <div className="mt-6 rounded-3xl border border-[var(--border)] bg-white p-6">
          <div className="flex flex-wrap justify-between gap-3"><div><p className="text-sm text-[var(--muted)]">Order status</p><p className="mt-1 font-semibold">{order.status.replaceAll("_", " ")}</p></div><div className="text-right"><p className="text-sm text-[var(--muted)]">Total</p><p className="mt-1 text-2xl font-semibold tabular-nums">{money(order.totalMinor, order.currencyCode, order.currency.minorUnit)}</p></div></div>
          <div className="mt-5 space-y-2 border-t border-[var(--border)] pt-4 text-sm"><div className="flex justify-between"><span className="text-[var(--muted)]">Items</span><strong>{money(order.subtotalMinor, order.currencyCode, order.currency.minorUnit)}</strong></div><div className="flex justify-between"><span className="text-[var(--muted)]">Shipping</span><strong>{money(order.shippingMinor, order.currencyCode, order.currency.minorUnit)}</strong></div><div className="flex justify-between"><span className="text-[var(--muted)]">Tax · {order.tax.ruleName} ({(order.tax.rateBasisPoints / 100).toFixed(2)}%)</span><strong>{money(order.taxMinor, order.currencyCode, order.currency.minorUnit)}</strong></div><p className="text-xs text-[var(--muted)]">{order.tax.inclusive ? "Included in listed prices" : "Added to subtotal"}{order.tax.destinationRegion ? ` · ${order.tax.destinationRegion}` : ""}</p></div>
          <p className="mt-4 rounded-xl bg-[var(--color-ivory-100)] p-3 text-sm leading-6 text-[var(--muted)]">{order.status === "PENDING_PAYMENT" ? "Your order has been recorded. Payment is pending; fulfillment remains locked until the provider verifies payment." : "Payment has been confirmed for this order."}</p>
        </div>
        {order.status === "PENDING_PAYMENT" && <section className="mt-5 rounded-3xl border border-[var(--border)] bg-white p-6">
          <h2 className="font-semibold text-[var(--color-forest-950)]">Payment</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Choose a configured payment method to continue. The order is confirmed only after the provider verifies payment.</p>
          {paymentError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{paymentError}</p>}
          {paymentProviders.length ? <div className="mt-4 flex flex-wrap gap-3">{paymentProviders.map((provider) => <button key={provider.key} type="button" disabled={Boolean(paymentBusy)} onClick={() => void startPayment(provider)} className="rounded-xl bg-[var(--color-violet-600)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-violet-700)] disabled:opacity-50">{paymentBusy === provider.key ? "Connecting…" : `Pay with ${provider.displayName}`}</button>)}</div> : <p className="mt-4 rounded-xl bg-[var(--color-ivory-100)] p-4 text-sm text-[var(--muted)]">Online payment is not configured yet. Your order is safely awaiting payment; no charge has been made.</p>}
        </section>}

        <section className="mt-6 space-y-4">{order.vendorOrders.map((vendor) => <article key={vendor.id} className="rounded-3xl border border-[var(--border)] bg-white p-6">
          <div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-[var(--muted)]">Seller order</p><h2 className="mt-1 text-lg font-semibold">{vendor.store.name}</h2><p className="mt-1 text-xs text-[var(--muted)]">{vendor.shippingServiceName}{vendor.minDeliveryDays != null ? ` · ${vendor.minDeliveryDays}–${vendor.maxDeliveryDays ?? vendor.minDeliveryDays} days` : ""}</p></div><p className="text-sm font-semibold">{vendor.status.replaceAll("_", " ")}</p></div>
          <div className="mt-4 divide-y divide-[var(--border)]">{vendor.items.map((item) => <div key={item.id} className="flex justify-between gap-4 py-3"><div><p className="font-medium">{item.productName}</p><p className="mt-1 text-xs text-[var(--muted)]">{item.sku}{item.variantName ? ` · ${item.variantName}` : ""} · Qty {item.quantity}</p></div><p className="font-semibold tabular-nums">{money(item.lineTotalMinor, order.currencyCode, order.currency.minorUnit)}</p></div>)}</div>
          <div className="mt-4 flex justify-between border-t border-[var(--border)] pt-4 text-sm"><span className="text-[var(--muted)]">Seller order total</span><strong>{money(vendor.totalMinor, order.currencyCode, order.currency.minorUnit)}</strong></div>
          {vendor.status === "DELIVERED" && <Link href="/account/returns" className="mt-4 inline-flex rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold">Request a return</Link>}{vendor.status === "DELIVERED" && <StoreReviewForm storeId={vendor.store.id} vendorOrderId={vendor.id} storeName={vendor.store.name} />}
        </article>)}</section>
        {order.address && <section className="mt-6 rounded-3xl border border-[var(--border)] bg-white p-6"><h2 className="font-semibold">Delivery address</h2><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{order.address.recipientName}<br />{order.address.phone}<br />{order.address.line1}{order.address.line2 ? `, ${order.address.line2}` : ""}<br />{order.address.city}{order.address.region ? `, ${order.address.region}` : ""}{order.address.postalCode ? ` ${order.address.postalCode}` : ""}<br />{order.address.countryName}</p></section>}
        <div className="mt-6 flex flex-wrap gap-3"><Link href="/products" className="rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white">Continue shopping</Link><Link href="/account/orders" className="rounded-xl border border-[var(--border)] px-5 py-3 text-sm font-semibold">View order history</Link></div>
      </> : null}
    </div>
  </main>;
}
