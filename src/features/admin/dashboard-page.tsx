"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Dashboard = {
  filters: {
    from: string;
    to: string;
    countryCode: string;
    currencyCode: string;
    sellerId: string;
    storeId: string;
    countries: Array<{ iso2: string; name: string }>;
    currencies: Array<{ code: string; name: string; minorUnit: number }>;
    sellers: Array<{ id: string; name: string }>;
    stores: Array<{ id: string; name: string; sellerId: string }>;
  };
  metrics: {
    activeUsers: number;
    newUsers: number;
    activeSellers: number;
    pendingSellers: number;
    activeStores: number;
    suspendedStores: number;
    totalProducts: number;
    pendingProducts: number;
    totalOrders: number;
    pendingOrders: number;
    processingOrders: number;
    completedOrders: number;
    previousPeriodOrders: number;
    grossOrderValueByCurrency: Array<{ currencyCode: string; amountMinor: string }>;
    successfulPayments: number;
    failedPayments: number;
    pendingPayments: number;
    successfulPaymentAmountByCurrency: Array<{ currencyCode: string; amountMinor: string }>;
    pendingProductReviews: number;
    pendingStoreReviews: number;
    requestedReturns: number;
    openSupportTickets: number;
  };
  dailyOrders: Array<{ day: string; count: number }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    totalMinor: string;
    currencyCode: string;
    placedAt: string;
  }>;
  unavailableMetrics: Record<string, string>;
};

type Filters = { from: string; to: string; countryCode: string; currencyCode: string; sellerId: string; storeId: string };

function defaultFilters(): Filters {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    countryCode: "",
    currencyCode: "",
    sellerId: "",
    storeId: ""
  };
}

function money(amountMinor: string, currencyCode: string, minorUnit: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode }).format(
    Number(amountMinor) / (10 ** minorUnit)
  );
}

function MetricCard({
  label,
  value,
  detail,
  href
}: {
  label: string;
  value: string | number;
  detail?: string;
  href?: string;
}) {
  const content = (
    <>
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--color-forest-950)]">{value}</p>
      {detail && <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{detail}</p>}
    </>
  );
  const className = "block rounded-2xl border border-[var(--border)] bg-white p-5";
  return href
    ? <Link href={href} className={`${className} transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-copper-600)]`}>{content}</Link>
    : <div className={className}>{content}</div>;
}

export default function AdminDashboardPage() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (query: Filters, isActive: () => boolean = () => true) => {
    if (isActive()) {
      setLoading(true);
      setError("");
    }
    try {
      const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value));
      const response = await fetch(`/api/admin/dashboard?${params.toString()}`, { cache: "no-store" });
      const data = await response.json() as Dashboard & { error?: string };
      if (!response.ok) throw new Error(data.error || "Dashboard data is unavailable.");
      if (isActive()) setDashboard(data);
    } catch (cause) {
      if (isActive()) setError(cause instanceof Error ? cause.message : "Dashboard data is unavailable.");
    } finally {
      if (isActive()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => load(defaultFilters(), () => active));
    return () => { active = false; };
  }, [load]);

  const currencyUnits = useMemo(
    () => new Map(dashboard?.filters.currencies.map((currency) => [currency.code, currency.minorUnit]) ?? []),
    [dashboard?.filters.currencies]
  );
  const stores = useMemo(
    () => dashboard?.filters.stores.filter((store) => !filters.sellerId || store.sellerId === filters.sellerId) ?? [],
    [dashboard?.filters.stores, filters.sellerId]
  );
  const maxOrders = Math.max(1, ...(dashboard?.dailyOrders.map((day) => day.count) ?? [0]));

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value, ...(key === "sellerId" ? { storeId: "" } : {}) }));
  }

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load(filters);
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Marketplace operations</p>
            <h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">Platform overview</h1>
          </div>
          <p className="text-sm text-[var(--muted)]">Live data from PostgreSQL · order filters apply to transaction metrics; currency totals are never combined</p>
        </div>

        <form onSubmit={submitFilters} className="mt-7 grid gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
          <label className="text-xs font-medium text-[var(--muted)]">From<input required type="date" value={filters.from} onChange={(event) => updateFilter("from", event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label>
          <label className="text-xs font-medium text-[var(--muted)]">Through<input required type="date" value={filters.to} onChange={(event) => updateFilter("to", event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label>
          <label className="text-xs font-medium text-[var(--muted)]">Country<select value={filters.countryCode} onChange={(event) => updateFilter("countryCode", event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"><option value="">All countries</option>{dashboard?.filters.countries.map((country) => <option key={country.iso2} value={country.iso2}>{country.name}</option>)}</select></label>
          <label className="text-xs font-medium text-[var(--muted)]">Currency<select value={filters.currencyCode} onChange={(event) => updateFilter("currencyCode", event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"><option value="">All currencies</option>{dashboard?.filters.currencies.map((currency) => <option key={currency.code} value={currency.code}>{currency.code} · {currency.name}</option>)}</select></label>
          <label className="text-xs font-medium text-[var(--muted)]">Seller<select value={filters.sellerId} onChange={(event) => updateFilter("sellerId", event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"><option value="">All sellers</option>{dashboard?.filters.sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}</select></label>
          <label className="text-xs font-medium text-[var(--muted)]">Store<select value={filters.storeId} onChange={(event) => updateFilter("storeId", event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"><option value="">All stores</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
          <button type="submit" disabled={loading} className="rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 lg:col-start-6">Apply filters</button>
        </form>

        {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {loading && !dashboard ? <div className="mt-6 h-48 animate-pulse rounded-2xl bg-[var(--color-ivory-100)]" /> : dashboard && <>
          <section aria-label="Marketplace metrics" className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total orders" value={dashboard.metrics.totalOrders} detail={`${dashboard.metrics.previousPeriodOrders} in the previous equivalent period`} />
            <MetricCard label="Orders awaiting payment" value={dashboard.metrics.pendingOrders} />
            <MetricCard label="Orders being processed" value={dashboard.metrics.processingOrders} />
            <MetricCard label="Fulfilled or completed orders" value={dashboard.metrics.completedOrders} />
            <MetricCard label="Gross order value" value={dashboard.metrics.grossOrderValueByCurrency.length ? dashboard.metrics.grossOrderValueByCurrency.map((row) => money(row.amountMinor, row.currencyCode, currencyUnits.get(row.currencyCode) ?? 2)).join(" · ") : "—"} detail="Placed orders excluding cancellations; includes orders not yet paid." />
            <MetricCard label="Successful payments" value={dashboard.metrics.successfulPayments} detail={dashboard.metrics.successfulPaymentAmountByCurrency.map((row) => money(row.amountMinor, row.currencyCode, currencyUnits.get(row.currencyCode) ?? 2)).join(" · ") || "No successful payments in this range"} />
            <MetricCard label="Failed payments" value={dashboard.metrics.failedPayments} />
            <MetricCard label="Payments awaiting completion" value={dashboard.metrics.pendingPayments} />
            <MetricCard label="Active users" value={dashboard.metrics.activeUsers} />
            <MetricCard label="New user accounts" value={dashboard.metrics.newUsers} detail="Created within the selected date range." />
            <MetricCard label="Active sellers" value={dashboard.metrics.activeSellers} />
            <MetricCard label="Pending seller applications" value={dashboard.metrics.pendingSellers} />
            <MetricCard label="Active stores" value={dashboard.metrics.activeStores} />
            <MetricCard label="Suspended stores" value={dashboard.metrics.suspendedStores} />
            <MetricCard label="Total products" value={dashboard.metrics.totalProducts} />
            <MetricCard label="Products awaiting approval" value={dashboard.metrics.pendingProducts} />
            <MetricCard label="Product reviews awaiting moderation" value={dashboard.metrics.pendingProductReviews} href="/admin/reviews" />
            <MetricCard label="Store reviews awaiting moderation" value={dashboard.metrics.pendingStoreReviews} href="/admin/store-reviews" />
            <MetricCard label="Return requests" value={dashboard.metrics.requestedReturns} href="/admin/returns" />
            <MetricCard label="Open support tickets" value={dashboard.metrics.openSupportTickets} href="/admin/support" />
          </section>

          <section className="mt-8 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
              <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-lg font-semibold text-[var(--color-forest-950)]">Daily orders</h2><p className="mt-1 text-xs text-[var(--muted)]">Number of orders placed; canceled orders are excluded from the bars.</p></div><span className="text-xs text-[var(--muted)]">{dashboard.filters.from} — {dashboard.filters.to}</span></div>
              <div className="mt-6 overflow-x-auto">
                <div className="flex h-44 min-w-[420px] items-end gap-1 border-b border-l border-[var(--border)] px-2" style={{ minWidth: `${Math.max(420, dashboard.dailyOrders.length * 12)}px` }}>
                  {dashboard.dailyOrders.map((day) => <div key={day.day} title={`${day.day}: ${day.count} orders`} aria-label={`${day.day}: ${day.count} orders`} className="group flex h-full min-w-0 flex-1 items-end"><div className="w-full rounded-t bg-[var(--color-copper-600)] transition-opacity group-hover:opacity-70" style={{ height: day.count === 0 ? "0%" : `${Math.max(3, (day.count / maxOrders) * 100)}%` }} /></div>)}
                </div>
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-[var(--muted)]"><span>{dashboard.dailyOrders[0]?.day}</span><span>{dashboard.dailyOrders.at(-1)?.day}</span></div>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
              <h2 className="text-lg font-semibold text-[var(--color-forest-950)]">Open administrative queues</h2>
              <div className="mt-4 divide-y divide-[var(--border)]">
                <QueueLink href="/admin/reviews" label="Product review moderation" count={dashboard.metrics.pendingProductReviews} />
                <QueueLink href="/admin/store-reviews" label="Store review moderation" count={dashboard.metrics.pendingStoreReviews} />
                <QueueLink href="/admin/returns" label="Return requests" count={dashboard.metrics.requestedReturns} />
                <QueueLink href="/admin/support" label="Customer support" count={dashboard.metrics.openSupportTickets} />
              </div>
            </div>
          </section>

          <section className="mt-8 rounded-2xl border border-[var(--border)] bg-white p-5">
            <h2 className="text-lg font-semibold text-[var(--color-forest-950)]">Recent orders</h2>
            {dashboard.recentOrders.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-[var(--border)] text-xs text-[var(--muted)]"><th className="py-2 pr-4 font-medium">Order</th><th className="py-2 pr-4 font-medium">Status</th><th className="py-2 pr-4 font-medium">Total</th><th className="py-2 font-medium">Placed</th></tr></thead><tbody>{dashboard.recentOrders.map((order) => <tr key={order.id} className="border-b border-[var(--border)] last:border-0"><td className="py-3 pr-4 font-medium">{order.orderNumber}</td><td className="py-3 pr-4">{order.status.replaceAll("_", " ")}</td><td className="py-3 pr-4">{money(order.totalMinor, order.currencyCode, currencyUnits.get(order.currencyCode) ?? 2)}</td><td className="py-3">{new Date(order.placedAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-[var(--muted)]">No orders match the selected filters.</p>}
          </section>

          <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-base font-semibold text-amber-950">Metrics not available from current systems</h2>
            <ul className="mt-3 grid gap-2 text-sm text-amber-900 sm:grid-cols-2">
              {Object.entries(dashboard.unavailableMetrics).map(([name, reason]) => <li key={name}><span className="font-semibold capitalize">{name.replaceAll(/([A-Z])/g, " $1")}: </span>{reason}</li>)}
            </ul>
          </section>
        </>}
        {loading && dashboard && <p role="status" className="mt-3 text-sm text-[var(--muted)]">Refreshing dashboard…</p>}
      </div>
    </main>
  );
}

function QueueLink({ href, label, count }: { href: string; label: string; count: number }) {
  return <Link href={href} className="flex items-center justify-between gap-4 py-3 text-sm hover:text-[var(--color-copper-600)]"><span>{label}</span><span className="rounded-full bg-[var(--color-ivory-100)] px-3 py-1 font-semibold">{count}</span></Link>;
}
