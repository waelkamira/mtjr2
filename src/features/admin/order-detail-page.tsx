"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type AdminOrder = {
  id: string; orderNumber: string; status: string; currencyCode: string; currency: { minorUnit: number }; subtotalMinor: string; couponCode: string | null;
  discountMinor: string; shippingMinor: string; taxMinor: string; taxRuleName: string; taxRateBasisPoints: number;
  taxInclusive: boolean; taxIncludesShipping: boolean; taxDestinationRegion: string | null; totalMinor: string; placedAt: string;
  user: { id: string; email: string; displayName: string | null } | null;
  address: { recipientName: string; phone: string; countryCode: string; countryName: string; line1: string; line2: string | null; city: string; region: string | null; postalCode: string | null } | null;
  statusHistory: Array<{ status: string; note: string | null; createdAt: string }>;
  payments: Array<{ id: string; provider: string; status: string; amountMinor: string; currencyCode: string; currency: { minorUnit: number }; createdAt: string; succeededAt: string | null }>;
  vendorOrders: Array<{
    id: string; status: string; subtotalMinor: string; discountMinor: string; shippingMinor: string; taxMinor: string;
    taxInclusive: boolean; shippingServiceName: string; shippingDestinationRegion: string | null; minDeliveryDays: number | null;
    maxDeliveryDays: number | null; totalMinor: string; createdAt: string;
    store: { id: string; name: string; slug: string; seller: { id: string; displayName: string | null; legalName: string | null } };
    items: Array<{ id: string; productName: string; sku: string; variantName: string | null; quantity: number; unitAmountMinor: string; lineTotalMinor: string }>;
    statusHistory: Array<{ status: string; note: string | null; createdAt: string }>;
    shipment: null | { carrierName: string; trackingNumber: string; trackingUrl: string | null; status: string; shippedAt: string; deliveredAt: string | null; events: Array<{ status: string; description: string | null; location: string | null; occurredAt: string }> };
  }>;
};

function money(amount: string, currency: string, minorUnit: number) {
  const value = BigInt(amount);
  const divisor = BigInt(10) ** BigInt(minorUnit);
  const whole = value / divisor;
  const fraction = minorUnit ? `.${(value % divisor).toString().padStart(minorUnit, "0")}` : "";
  return `${currency} ${new Intl.NumberFormat().format(whole)}${fraction}`;
}

export default function AdminOrderDetailPage({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      try {
        const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, { cache: "no-store" });
        const result = await response.json() as { order?: AdminOrder; error?: string };
        if (!response.ok || !result.order) throw new Error(result.error || "Order details unavailable.");
        if (active) { setOrder(result.order); setError(""); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Order details unavailable.");
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [orderId]);

  return <main className="min-h-screen px-5 py-8 lg:px-8"><div className="mx-auto max-w-6xl">
    <Link href="/admin/orders" className="text-sm font-semibold text-[var(--color-copper-600)] underline">Back to orders</Link>
    {loading && <div className="mt-5 h-48 animate-pulse rounded-2xl bg-[var(--color-ivory-100)]" />}
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {order && <>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Order operations</p><h1 className="mt-1 text-3xl font-semibold text-[var(--color-forest-950)]">{order.orderNumber}</h1><p className="mt-1 text-sm text-[var(--muted)]">{order.id} · Placed {new Date(order.placedAt).toLocaleString()}</p></div><span className="rounded-full bg-[var(--color-ivory-100)] px-3 py-1 text-sm font-semibold">{order.status}</span></div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--border)] bg-white p-5"><h2 className="font-semibold">Customer</h2>{order.user ? <><p className="mt-2">{order.user.displayName || "No display name"}</p><p className="text-sm text-[var(--muted)]">{order.user.email}</p><Link href={`/admin/users/${encodeURIComponent(order.user.id)}`} className="mt-2 inline-block text-sm font-semibold underline">View account</Link></> : <p className="mt-2 text-sm text-[var(--muted)]">Guest checkout</p>}</section>
        <section className="rounded-2xl border border-[var(--border)] bg-white p-5"><h2 className="font-semibold">Delivery address</h2>{order.address ? <address className="mt-2 not-italic text-sm leading-6">{order.address.recipientName}<br />{order.address.phone}<br />{order.address.line1}{order.address.line2 && <><br />{order.address.line2}</>}<br />{[order.address.city, order.address.region, order.address.postalCode].filter(Boolean).join(", ")}<br />{order.address.countryName} ({order.address.countryCode})</address> : <p className="mt-2 text-sm text-[var(--muted)]">No address snapshot</p>}</section>
      </div>
      <section className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-5"><h2 className="font-semibold">Order totals · {order.currencyCode}</h2><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div>Subtotal: {money(order.subtotalMinor, order.currencyCode, order.currency.minorUnit)}</div><div>Discount{order.couponCode ? ` (${order.couponCode})` : ""}: {money(order.discountMinor, order.currencyCode, order.currency.minorUnit)}</div><div>Shipping: {money(order.shippingMinor, order.currencyCode, order.currency.minorUnit)}</div><div>Tax: {money(order.taxMinor, order.currencyCode, order.currency.minorUnit)} · {order.taxRuleName}</div><div className="font-semibold">Total: {money(order.totalMinor, order.currencyCode, order.currency.minorUnit)}</div><div>Tax {order.taxRateBasisPoints / 100}% · {order.taxInclusive ? "inclusive" : "exclusive"}{order.taxIncludesShipping ? ", includes shipping" : ""}{order.taxDestinationRegion ? ` · ${order.taxDestinationRegion}` : ""}</div></dl></section>
      <section className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-5"><h2 className="font-semibold">Payment attempts</h2>{order.payments.length ? <div className="mt-3 space-y-3">{order.payments.map((payment) => <div key={payment.id} className="flex flex-wrap justify-between gap-2 border-t border-[var(--border)] pt-3 text-sm"><div><p>{payment.provider} · {payment.status}</p><p className="text-xs text-[var(--muted)]">{payment.id} · {new Date(payment.createdAt).toLocaleString()}</p></div><p>{money(payment.amountMinor, payment.currencyCode, payment.currency.minorUnit)}{payment.succeededAt ? ` · succeeded ${new Date(payment.succeededAt).toLocaleString()}` : ""}</p></div>)}</div> : <p className="mt-2 text-sm text-[var(--muted)]">No payment attempts recorded. This order has not been charged by the platform.</p>}</section>
      <section className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-5"><h2 className="font-semibold">Order status history</h2>{order.statusHistory.length ? <ol className="mt-3 space-y-3">{order.statusHistory.map((event, index) => <li key={`${event.createdAt}-${index}`} className="border-l-2 border-[var(--color-copper-600)] pl-3"><p className="text-sm font-semibold">{event.status}</p><p className="text-xs text-[var(--muted)]">{new Date(event.createdAt).toLocaleString()}{event.note ? ` · ${event.note}` : ""}</p></li>)}</ol> : <p className="mt-2 text-sm text-[var(--muted)]">No order status events recorded.</p>}</section>
      <div className="mt-4 space-y-4">{order.vendorOrders.map((vendor) => <section key={vendor.id} className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex flex-wrap justify-between gap-2"><div><h2 className="text-lg font-semibold">{vendor.store.name} · {vendor.status}</h2><p className="text-xs text-[var(--muted)]">Vendor order {vendor.id} · Seller {vendor.store.seller.displayName || vendor.store.seller.legalName || vendor.store.seller.id}</p></div><p className="font-semibold">{money(vendor.totalMinor, order.currencyCode, order.currency.minorUnit)}</p></div>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-b text-xs text-[var(--muted)]"><th className="py-2">Item</th><th>SKU</th><th>Qty</th><th>Unit</th><th>Line total</th></tr></thead><tbody>{vendor.items.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="py-2">{item.productName}{item.variantName ? ` · ${item.variantName}` : ""}</td><td>{item.sku}</td><td>{item.quantity}</td><td>{money(item.unitAmountMinor, order.currencyCode, order.currency.minorUnit)}</td><td>{money(item.lineTotalMinor, order.currencyCode, order.currency.minorUnit)}</td></tr>)}</tbody></table></div>
        <p className="mt-3 text-sm text-[var(--muted)]">Shipping {money(vendor.shippingMinor, order.currencyCode, order.currency.minorUnit)} · Tax {money(vendor.taxMinor, order.currencyCode, order.currency.minorUnit)} · {vendor.shippingServiceName}{vendor.shippingDestinationRegion ? ` to ${vendor.shippingDestinationRegion}` : ""}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div><h3 className="text-sm font-semibold">Vendor status history</h3>{vendor.statusHistory.length ? <ol className="mt-2 space-y-2">{vendor.statusHistory.map((event, index) => <li key={`${event.createdAt}-${index}`} className="text-sm">{event.status}<span className="block text-xs text-[var(--muted)]">{new Date(event.createdAt).toLocaleString()}{event.note ? ` · ${event.note}` : ""}</span></li>)}</ol> : <p className="mt-2 text-sm text-[var(--muted)]">No status events.</p>}</div>
          <div><h3 className="text-sm font-semibold">Shipment</h3>{vendor.shipment ? <><p className="mt-2 text-sm">{vendor.shipment.carrierName} · {vendor.shipment.status} · {vendor.shipment.trackingNumber}</p>{vendor.shipment.trackingUrl && <a href={vendor.shipment.trackingUrl} target="_blank" rel="noreferrer" className="text-sm text-[var(--color-copper-600)] underline">Open tracking</a>}{vendor.shipment.events.map((event, index) => <p key={`${event.occurredAt}-${index}`} className="mt-2 text-xs text-[var(--muted)]">{event.status} · {new Date(event.occurredAt).toLocaleString()}{event.location ? ` · ${event.location}` : ""}{event.description ? ` · ${event.description}` : ""}</p>)}</> : <p className="mt-2 text-sm text-[var(--muted)]">No shipment recorded.</p>}</div>
        </div>
      </section>)}</div>
    </>}
  </div></main>;
}
