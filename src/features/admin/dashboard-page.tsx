"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

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
  locale,
  label,
  value,
  detail,
  href
}: {
  locale: "ar" | "en";
  label: string;
  value: string | number;
  detail?: string;
  href?: string;
}) {
  const labels: Record<string, string> = {
    "Total orders": "إجمالي الطلبات",
    "Orders awaiting payment": "طلبات بانتظار الدفع",
    "Orders being processed": "طلبات قيد المعالجة",
    "Fulfilled or completed orders": "طلبات منفذة أو مكتملة",
    "Gross order value": "إجمالي قيمة الطلبات",
    "Successful payments": "المدفوعات الناجحة",
    "Failed payments": "المدفوعات الفاشلة",
    "Payments awaiting completion": "مدفوعات بانتظار الإكمال",
    "Active users": "المستخدمون النشطون",
    "New user accounts": "حسابات المستخدمين الجديدة",
    "Active sellers": "البائعون النشطون",
    "Pending seller applications": "طلبات البائعين المعلقة",
    "Active stores": "المتاجر النشطة",
    "Suspended stores": "المتاجر المعلقة",
    "Total products": "إجمالي المنتجات",
    "Products awaiting approval": "منتجات بانتظار الموافقة",
    "Product reviews awaiting moderation": "مراجعات منتجات بانتظار الإشراف",
    "Store reviews awaiting moderation": "مراجعات متاجر بانتظار الإشراف",
    "Return requests": "طلبات الإرجاع",
    "Open support tickets": "تذاكر الدعم المفتوحة"
  };
  const details: Record<string, string> = {
    "in the previous equivalent period": "في الفترة السابقة المماثلة",
    "Placed orders excluding cancellations; includes orders not yet paid.": "الطلبات المسجلة باستثناء الملغاة؛ تشمل الطلبات التي لم تُدفع بعد.",
    "No successful payments in this range": "لا توجد مدفوعات ناجحة في هذه الفترة",
    "Created within the selected date range.": "أُنشئت ضمن النطاق الزمني المحدد."
  };
  const content = (
    <>
      <p className="text-sm text-[var(--muted)]">{translate(locale, label, labels[label] || label)}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--color-forest-950)]">{value}</p>
      {detail && <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{translate(locale, detail, details[detail] || detail)}</p>}
    </>
  );
  const className = "block rounded-2xl border border-[var(--border)] bg-white p-5";
  return href
    ? <Link href={href} className={`${className} transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-copper-600)]`}>{content}</Link>
    : <div className={className}>{content}</div>;
}

function DistributionChart({ locale, title, rows }: { locale: "ar" | "en"; title: string; rows: Array<{ label: string; value: number; color: string }> }) {
  const maximum = Math.max(1, ...rows.map((row) => row.value));
  return (
    <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-[var(--color-forest-950)]">{translate(locale, title, title)}</h3>
      <div className="mt-4 space-y-4">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
              <span className="text-[var(--muted)]">{translate(locale, row.label, row.label)}</span>
              <strong className="tabular-nums text-[var(--color-forest-950)]">{row.value.toLocaleString(locale)}</strong>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[var(--color-ivory-100)]">
              <div className={`h-full rounded-full ${row.color}`} style={{ width: `${Math.max(row.value > 0 ? 2 : 0, (row.value / maximum) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

export default function AdminDashboardPage() {
  const { locale } = useLocale();
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
      if (!response.ok) throw new Error(data.error || translate(locale, "Dashboard data is unavailable.", "بيانات لوحة المعلومات غير متاحة."));
      if (isActive()) setDashboard(data);
    } catch (cause) {
      if (isActive()) setError(cause instanceof Error ? cause.message : translate(locale, "Dashboard data is unavailable.", "بيانات لوحة المعلومات غير متاحة."));
    } finally {
      if (isActive()) setLoading(false);
    }
  }, [locale]);

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
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">{translate(locale, "Marketplace operations", "عمليات السوق")}</p>
            <h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">{translate(locale, "Platform overview", "نظرة عامة على المنصة")}</h1>
          </div>
          <p className="text-sm text-[var(--muted)]">{translate(locale, "Live data from PostgreSQL · order filters apply to transaction metrics; currency totals are never combined", "بيانات مباشرة من PostgreSQL · تنطبق عوامل تصفية الطلبات على مؤشرات المعاملات؛ ولا يتم جمع إجماليات العملات المختلفة")}</p>
        </div>

        <form onSubmit={submitFilters} className="mt-7 grid gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
          <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "From", "من")}<input required type="date" value={filters.from} onChange={(event) => updateFilter("from", event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label>
          <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Through", "إلى")}<input required type="date" value={filters.to} onChange={(event) => updateFilter("to", event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label>
          <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Country", "الدولة")}<select value={filters.countryCode} onChange={(event) => updateFilter("countryCode", event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"><option value="">{translate(locale, "All countries", "جميع الدول")}</option>{dashboard?.filters.countries.map((country) => <option key={country.iso2} value={country.iso2}>{country.name}</option>)}</select></label>
          <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Currency", "العملة")}<select value={filters.currencyCode} onChange={(event) => updateFilter("currencyCode", event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"><option value="">{translate(locale, "All currencies", "جميع العملات")}</option>{dashboard?.filters.currencies.map((currency) => <option key={currency.code} value={currency.code}>{currency.code} · {currency.name}</option>)}</select></label>
          <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Seller", "البائع")}<select value={filters.sellerId} onChange={(event) => updateFilter("sellerId", event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"><option value="">{translate(locale, "All sellers", "جميع البائعين")}</option>{dashboard?.filters.sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}</select></label>
          <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Store", "المتجر")}<select value={filters.storeId} onChange={(event) => updateFilter("storeId", event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"><option value="">{translate(locale, "All stores", "جميع المتاجر")}</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
          <button type="submit" disabled={loading} className="rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 lg:col-start-6">{translate(locale, "Apply filters", "تطبيق عوامل التصفية")}</button>
        </form>

        {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {loading && !dashboard ? <div className="mt-6 h-48 animate-pulse rounded-2xl bg-[var(--color-ivory-100)]" /> : dashboard && <>
          <section aria-label="Marketplace metrics" className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard locale={locale} label="Total orders" value={dashboard.metrics.totalOrders} detail={`${dashboard.metrics.previousPeriodOrders} in the previous equivalent period`} />
            <MetricCard locale={locale} label="Orders awaiting payment" value={dashboard.metrics.pendingOrders} />
            <MetricCard locale={locale} label="Orders being processed" value={dashboard.metrics.processingOrders} />
            <MetricCard locale={locale} label="Fulfilled or completed orders" value={dashboard.metrics.completedOrders} />
            <MetricCard locale={locale} label="Gross order value" value={dashboard.metrics.grossOrderValueByCurrency.length ? dashboard.metrics.grossOrderValueByCurrency.map((row) => money(row.amountMinor, row.currencyCode, currencyUnits.get(row.currencyCode) ?? 2)).join(" · ") : "—"} detail="Placed orders excluding cancellations; includes orders not yet paid." />
            <MetricCard locale={locale} label="Successful payments" value={dashboard.metrics.successfulPayments} detail={dashboard.metrics.successfulPaymentAmountByCurrency.map((row) => money(row.amountMinor, row.currencyCode, currencyUnits.get(row.currencyCode) ?? 2)).join(" · ") || "No successful payments in this range"} />
            <MetricCard locale={locale} label="Failed payments" value={dashboard.metrics.failedPayments} />
            <MetricCard locale={locale} label="Payments awaiting completion" value={dashboard.metrics.pendingPayments} />
            <MetricCard locale={locale} label="Active users" value={dashboard.metrics.activeUsers} />
            <MetricCard locale={locale} label="New user accounts" value={dashboard.metrics.newUsers} detail="Created within the selected date range." />
            <MetricCard locale={locale} label="Active sellers" value={dashboard.metrics.activeSellers} />
            <MetricCard locale={locale} label="Pending seller applications" value={dashboard.metrics.pendingSellers} />
            <MetricCard locale={locale} label="Active stores" value={dashboard.metrics.activeStores} />
            <MetricCard locale={locale} label="Suspended stores" value={dashboard.metrics.suspendedStores} />
            <MetricCard locale={locale} label="Total products" value={dashboard.metrics.totalProducts} />
            <MetricCard locale={locale} label="Products awaiting approval" value={dashboard.metrics.pendingProducts} />
            <MetricCard locale={locale} label="Product reviews awaiting moderation" value={dashboard.metrics.pendingProductReviews} href="/admin/reviews" />
            <MetricCard locale={locale} label="Store reviews awaiting moderation" value={dashboard.metrics.pendingStoreReviews} href="/admin/store-reviews" />
            <MetricCard locale={locale} label="Return requests" value={dashboard.metrics.requestedReturns} href="/admin/returns" />
            <MetricCard locale={locale} label="Open support tickets" value={dashboard.metrics.openSupportTickets} href="/admin/support" />
          </section>

          <section aria-label="Metric distributions" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <DistributionChart locale={locale} title="Users" rows={[
              { label: "Active users", value: dashboard.metrics.activeUsers, color: "bg-sky-500" },
              { label: "New users in period", value: dashboard.metrics.newUsers, color: "bg-violet-500" }
            ]} />
            <DistributionChart locale={locale} title="Seller applications" rows={[
              { label: "Active sellers", value: dashboard.metrics.activeSellers, color: "bg-emerald-500" },
              { label: "Pending sellers", value: dashboard.metrics.pendingSellers, color: "bg-amber-500" }
            ]} />
            <DistributionChart locale={locale} title="Stores" rows={[
              { label: "Active stores", value: dashboard.metrics.activeStores, color: "bg-teal-500" },
              { label: "Suspended stores", value: dashboard.metrics.suspendedStores, color: "bg-rose-500" }
            ]} />
            <DistributionChart locale={locale} title="Products" rows={[
              { label: "Total products", value: dashboard.metrics.totalProducts, color: "bg-indigo-500" },
              { label: "Products awaiting approval", value: dashboard.metrics.pendingProducts, color: "bg-orange-500" }
            ]} />
            <DistributionChart locale={locale} title="Orders" rows={[
              { label: "Awaiting payment", value: dashboard.metrics.pendingOrders, color: "bg-amber-500" },
              { label: "Being processed", value: dashboard.metrics.processingOrders, color: "bg-sky-500" },
              { label: "Completed", value: dashboard.metrics.completedOrders, color: "bg-emerald-500" }
            ]} />
            <DistributionChart locale={locale} title="Payments" rows={[
              { label: "Successful", value: dashboard.metrics.successfulPayments, color: "bg-emerald-500" },
              { label: "Failed", value: dashboard.metrics.failedPayments, color: "bg-rose-500" },
              { label: "Pending", value: dashboard.metrics.pendingPayments, color: "bg-amber-500" }
            ]} />
            <DistributionChart locale={locale} title="Customer trust & reviews" rows={[
              { label: "Product reviews awaiting moderation", value: dashboard.metrics.pendingProductReviews, color: "bg-fuchsia-500" },
              { label: "Store reviews awaiting moderation", value: dashboard.metrics.pendingStoreReviews, color: "bg-purple-500" }
            ]} />
            <DistributionChart locale={locale} title="Customer care" rows={[
              { label: "Open support tickets", value: dashboard.metrics.openSupportTickets, color: "bg-cyan-500" },
              { label: "Requested returns", value: dashboard.metrics.requestedReturns, color: "bg-orange-500" }
            ]} />
            <DistributionChart locale={locale} title="Order fulfillment pipeline" rows={[
              { label: "Awaiting payment", value: dashboard.metrics.pendingOrders, color: "bg-yellow-500" },
              { label: "Processing", value: dashboard.metrics.processingOrders, color: "bg-blue-500" },
              { label: "Completed", value: dashboard.metrics.completedOrders, color: "bg-green-500" }
            ]} />
            <DistributionChart locale={locale} title="Catalog moderation" rows={[
              { label: "Approved or published catalog", value: Math.max(0, dashboard.metrics.totalProducts - dashboard.metrics.pendingProducts), color: "bg-indigo-500" },
              { label: "Awaiting approval", value: dashboard.metrics.pendingProducts, color: "bg-amber-500" }
            ]} />
          </section>

          <section className="mt-8 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
              <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-lg font-semibold text-[var(--color-forest-950)]">{translate(locale, "Daily orders", "الطلبات اليومية")}</h2><p className="mt-1 text-xs text-[var(--muted)]">{translate(locale, "Number of orders placed; canceled orders are excluded from the bars.", "عدد الطلبات المقدمة؛ لا تشمل الأعمدة الطلبات الملغاة.")}</p></div><span className="text-xs text-[var(--muted)]">{dashboard.filters.from} — {dashboard.filters.to}</span></div>
              <div className="mt-6 overflow-x-auto">
                <div className="flex h-44 min-w-[420px] items-end gap-1 border-b border-l border-[var(--border)] px-2" style={{ minWidth: `${Math.max(420, dashboard.dailyOrders.length * 12)}px` }}>
                  {dashboard.dailyOrders.map((day) => <div key={day.day} title={`${day.day}: ${day.count} ${translate(locale, "orders", "طلب")}`} aria-label={`${day.day}: ${day.count} ${translate(locale, "orders", "طلب")}`} className="group flex h-full min-w-0 flex-1 items-end"><div className="w-full rounded-t bg-[var(--color-copper-600)] transition-opacity group-hover:opacity-70" style={{ height: day.count === 0 ? "0%" : `${Math.max(3, (day.count / maxOrders) * 100)}%` }} /></div>)}
                </div>
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-[var(--muted)]"><span>{dashboard.dailyOrders[0]?.day}</span><span>{dashboard.dailyOrders.at(-1)?.day}</span></div>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
              <h2 className="text-lg font-semibold text-[var(--color-forest-950)]">{translate(locale, "Open administrative queues", "قوائم الانتظار الإدارية المفتوحة")}</h2>
              <div className="mt-4 divide-y divide-[var(--border)]">
                <QueueLink locale={locale} href="/admin/reviews" label="Product review moderation" count={dashboard.metrics.pendingProductReviews} />
                <QueueLink locale={locale} href="/admin/store-reviews" label="Store review moderation" count={dashboard.metrics.pendingStoreReviews} />
                <QueueLink locale={locale} href="/admin/returns" label="Return requests" count={dashboard.metrics.requestedReturns} />
                <QueueLink locale={locale} href="/admin/support" label="Customer support" count={dashboard.metrics.openSupportTickets} />
              </div>
            </div>
          </section>

          <section className="mt-8 rounded-2xl border border-[var(--border)] bg-white p-5">
            <h2 className="text-lg font-semibold text-[var(--color-forest-950)]">{translate(locale, "Recent orders", "الطلبات الأخيرة")}</h2>
            {dashboard.recentOrders.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-[var(--border)] text-xs text-[var(--muted)]"><th className="py-2 pr-4 font-medium">{translate(locale, "Order", "الطلب")}</th><th className="py-2 pr-4 font-medium">{translate(locale, "Status", "الحالة")}</th><th className="py-2 pr-4 font-medium">{translate(locale, "Total", "الإجمالي")}</th><th className="py-2 font-medium">{translate(locale, "Placed", "تاريخ الإنشاء")}</th></tr></thead><tbody>{dashboard.recentOrders.map((order) => <tr key={order.id} className="border-b border-[var(--border)] last:border-0"><td className="py-3 pr-4 font-medium">{order.orderNumber}</td><td className="py-3 pr-4">{order.status.replaceAll("_", " ")}</td><td className="py-3 pr-4">{money(order.totalMinor, order.currencyCode, currencyUnits.get(order.currencyCode) ?? 2)}</td><td className="py-3">{new Date(order.placedAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-[var(--muted)]">{translate(locale, "No orders match the selected filters.", "لا توجد طلبات تطابق عوامل التصفية المحددة.")}</p>}
          </section>

          <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-base font-semibold text-amber-950">{translate(locale, "Metrics not available from current systems", "المؤشرات غير المتاحة في الأنظمة الحالية")}</h2>
            <ul className="mt-3 grid gap-2 text-sm text-amber-900 sm:grid-cols-2">
              {Object.entries(dashboard.unavailableMetrics).map(([name, reason]) => <li key={name}><span className="font-semibold capitalize">{name.replaceAll(/([A-Z])/g, " $1")}: </span>{reason}</li>)}
            </ul>
          </section>
        </>}
        {loading && dashboard && <p role="status" className="mt-3 text-sm text-[var(--muted)]">{translate(locale, "Refreshing dashboard…", "جارٍ تحديث لوحة المعلومات…")}</p>}
      </div>
    </main>
  );
}

function QueueLink({ locale, href, label, count }: { locale: "ar" | "en"; href: string; label: string; count: number }) {
  const labels: Record<string, string> = {
    "Product review moderation": "الإشراف على مراجعات المنتجات",
    "Store review moderation": "الإشراف على مراجعات المتاجر",
    "Return requests": "طلبات الإرجاع",
    "Customer support": "دعم العملاء"
  };
  return <Link href={href} className="flex items-center justify-between gap-4 py-3 text-sm hover:text-[var(--color-copper-600)]"><span>{translate(locale, label, labels[label] || label)}</span><span className="rounded-full bg-[var(--color-ivory-100)] px-3 py-1 font-semibold">{count}</span></Link>;
}
