"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import {
  BoxPlot,
  type ChartDatum,
  HistogramChart,
  HorizontalBarChart,
  LineAreaChart,
  PieChart,
  RadarChart,
  type ScatterDatum,
  ScatterPlot
} from "@/components/data-charts";

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
  orderStatusCounts: Array<{ status: string; count: number }>;
  dailyOrders: Array<{ day: string; count: number }>;
  metricSamples: Record<string, ChartDatum[]>;
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

function money(amountMinor: string, currencyCode: string, minorUnit: number, locale: "ar" | "en"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode }).format(
    Number(amountMinor) / (10 ** minorUnit)
  );
}

const metricCardColors = [
  "#f97316", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6",
  "#14b8a6", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
  "#d946ef", "#f43f5e", "#eab308", "#10b981", "#6366f1",
  "#0ea5e9", "#a855f7", "#fb7185", "#65a30d", "#0891b2"
] as const;

type MetricChartType = "area" | "line" | "bar" | "donut";

function MetricChart({
  data,
  color,
  type,
  highlightedIndex
}: {
  data: ChartDatum[];
  color: string;
  type: MetricChartType;
  highlightedIndex?: number;
}) {
  const maximum = Math.max(0, ...data.map((item) => item.value));
  const points = data.map((item, index) => {
    const x = data.length <= 1 ? 80 : 6 + (index * 148) / (data.length - 1);
    const y = 35 - (maximum ? (item.value / maximum) * 28 : 0);
    return { x, y, item, index };
  });

  if (type === "donut") {
    const scale = maximum ? maximum : 1;
    const total = data.reduce((sum, item) => sum + item.value / scale, 0);
    let offset = 0;
    return (
      <svg viewBox="0 0 160 44" className="h-10 w-full" aria-hidden="true">
        <circle cx="80" cy="22" r="15" fill="none" stroke={`${color}20`} strokeWidth="8" />
        {total > 0 && data.map((item, index) => {
          const fraction = (item.value / scale) / total;
          const dash = fraction * 2 * Math.PI * 15;
          const circle = (
            <circle
              key={`${item.label}-${index}`}
              cx="80"
              cy="22"
              r="15"
              fill="none"
              stroke={highlightedIndex === undefined || highlightedIndex === index ? color : `${color}55`}
              strokeWidth="8"
              strokeDasharray={`${dash} ${2 * Math.PI * 15 - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 80 22)"
            />
          );
          offset += dash;
          return circle;
        })}
      </svg>
    );
  }

  if (type === "area" || type === "line") {
    const line = points.map(({ x, y }) => `${x},${y}`).join(" ");
    const area = points.length
      ? `M ${points[0].x} 39 L ${points.map(({ x, y }) => `${x} ${y}`).join(" L ")} L ${points.at(-1)?.x} 39 Z`
      : "";
    return (
      <svg viewBox="0 0 160 44" className="h-10 w-full" preserveAspectRatio="none" aria-hidden="true">
        <line x1="4" x2="156" y1="39" y2="39" stroke={`${color}35`} />
        {type === "area" && <path d={area} fill={color} opacity=".16" />}
        <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map(({ x, y, item, index }) => (
          <circle key={`${item.label}-${index}`} cx={x} cy={y} r="2" fill={highlightedIndex === undefined || highlightedIndex === index ? color : `${color}66`} />
        ))}
      </svg>
    );
  }

  return (
    <div className="flex h-10 items-end gap-1 border-b border-black/10 pt-2" aria-hidden="true">
      {data.map((item, index) => (
        <span
          key={`${item.label}-${index}`}
          className="min-w-1 flex-1 rounded-t-sm transition-[height] duration-300"
          style={{
            height: maximum ? `${(item.value / maximum) * 100}%` : "0%",
            backgroundColor: highlightedIndex === undefined || highlightedIndex === index ? color : `${color}55`
          }}
        />
      ))}
    </div>
  );
}

function MetricCard({
  locale,
  label,
  value,
  detail,
  href,
  chartData,
  highlightedIndex,
  chartType,
  color
}: {
  locale: "ar" | "en";
  label: string;
  value: string | number;
  detail?: string;
  href?: string;
  chartData: ChartDatum[];
  highlightedIndex?: number;
  chartType: MetricChartType;
  color: string;
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
  const translatedLabel = translate(locale, label, labels[label] || label);
  const chartDescription = `${translatedLabel}: ${value}. ${chartData.map((item) => `${item.label}: ${item.value}`).join("; ")}`;
  const content = (
    <div className="flex h-full flex-col">
      <span aria-hidden="true" className="mb-3 h-1 w-9 rounded-full" style={{ backgroundColor: color }} />
      <p className="text-sm text-[var(--muted)]">{translatedLabel}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--color-forest-950)]">{value}</p>
      {detail && <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{translate(locale, detail, details[detail] || detail)}</p>}
      <div
        role="img"
        aria-label={`${chartDescription} Chart type: ${chartType}.`}
        className="mt-auto pt-3"
      >
        <MetricChart data={chartData} color={color} type={chartType} highlightedIndex={highlightedIndex} />
      </div>
    </div>
  );
  const className = "block min-h-40 rounded-2xl border p-4 transition-shadow";
  const style = {
    borderColor: `${color}55`,
    backgroundColor: `${color}0d`
  };
  return href
    ? <Link href={href} style={style} className={`${className} hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-copper-600)]`}>{content}</Link>
    : <div style={style} className={className}>{content}</div>;
}

export default function AdminDashboardPage() {
  const { locale } = useLocale();
  const emptyChartLabel = translate(locale, "No chart data is available for this range.", "لا تتوفر بيانات للمخطط في هذه الفترة.");
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
  const dailyOrdersChart: ChartDatum[] = dashboard?.dailyOrders.map((day) => ({
    label: day.day.slice(5),
    value: day.count
  })) ?? [];
  const orderStatusLabels: Record<string, string> = {
    PENDING_PAYMENT: translate(locale, "Pending payment", "بانتظار الدفع"),
    CONFIRMED: translate(locale, "Confirmed", "مؤكد"),
    PROCESSING: translate(locale, "Processing", "قيد المعالجة"),
    PARTIALLY_FULFILLED: translate(locale, "Partially fulfilled", "منفذ جزئيًا"),
    FULFILLED: translate(locale, "Fulfilled", "منفذ"),
    COMPLETED: translate(locale, "Completed", "مكتمل"),
    CANCELLED: translate(locale, "Cancelled", "ملغى")
  };
  const orderStatusChart: ChartDatum[] = dashboard?.orderStatusCounts.map((item) => ({
    label: orderStatusLabels[item.status] ?? item.status,
    value: item.count
  })) ?? [];
  const queueChart: ChartDatum[] = dashboard ? [
    { label: translate(locale, "Product reviews", "مراجعات المنتجات"), value: dashboard.metrics.pendingProductReviews },
    { label: translate(locale, "Store reviews", "مراجعات المتاجر"), value: dashboard.metrics.pendingStoreReviews },
    { label: translate(locale, "Returns", "المرتجعات"), value: dashboard.metrics.requestedReturns },
    { label: translate(locale, "Support tickets", "تذاكر الدعم"), value: dashboard.metrics.openSupportTickets }
  ] : [];
  const consecutiveDayPoints: ScatterDatum[] = (dashboard?.dailyOrders ?? []).slice(1).map((day, index) => {
    const previousCount = dashboard?.dailyOrders[index]?.count ?? 0;
    return {
      label: `${dashboard?.dailyOrders[index]?.day} → ${day.day}`,
      x: previousCount,
      y: day.count,
      size: Math.abs(day.count - previousCount)
    };
  });
  const radarChart: ChartDatum[] = dashboard ? [
    { label: translate(locale, "Orders", "الطلبات"), value: dashboard.metrics.totalOrders },
    { label: translate(locale, "Payments", "المدفوعات"), value: dashboard.metrics.successfulPayments + dashboard.metrics.failedPayments + dashboard.metrics.pendingPayments },
    { label: translate(locale, "Active users", "المستخدمون النشطون"), value: dashboard.metrics.activeUsers },
    { label: translate(locale, "Products", "المنتجات"), value: dashboard.metrics.totalProducts },
    { label: translate(locale, "Active stores", "المتاجر النشطة"), value: dashboard.metrics.activeStores },
    { label: translate(locale, "Open support", "الدعم المفتوح"), value: dashboard.metrics.openSupportTickets }
  ] : [];
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
          <section aria-label="Marketplace metrics" className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
            <MetricCard locale={locale} label="Total orders" value={dashboard.metrics.totalOrders} detail={`${dashboard.metrics.previousPeriodOrders} in the previous equivalent period`} chartData={dashboard.metricSamples.totalOrders} chartType="area" color={metricCardColors[0]} />
            <MetricCard locale={locale} label="Orders awaiting payment" value={dashboard.metrics.pendingOrders} chartData={dashboard.metricSamples.pendingOrders} chartType="line" color={metricCardColors[1]} />
            <MetricCard locale={locale} label="Orders being processed" value={dashboard.metrics.processingOrders} chartData={dashboard.metricSamples.processingOrders} chartType="bar" color={metricCardColors[2]} />
            <MetricCard locale={locale} label="Fulfilled or completed orders" value={dashboard.metrics.completedOrders} chartData={dashboard.metricSamples.completedOrders} chartType="donut" color={metricCardColors[3]} />
            <MetricCard locale={locale} label="Gross order value" value={dashboard.metrics.grossOrderValueByCurrency.length ? dashboard.metrics.grossOrderValueByCurrency.map((row) => money(row.amountMinor, row.currencyCode, currencyUnits.get(row.currencyCode) ?? 2, locale)).join(" · ") : "—"} detail="Placed orders excluding cancellations; includes orders not yet paid." chartData={dashboard.metricSamples.grossOrderValue} chartType="donut" color={metricCardColors[4]} />
            <MetricCard locale={locale} label="Successful payments" value={dashboard.metrics.successfulPayments} detail={dashboard.metrics.successfulPaymentAmountByCurrency.map((row) => money(row.amountMinor, row.currencyCode, currencyUnits.get(row.currencyCode) ?? 2, locale)).join(" · ") || "No successful payments in this range"} chartData={dashboard.metricSamples.successfulPayments} chartType="line" color={metricCardColors[5]} />
            <MetricCard locale={locale} label="Failed payments" value={dashboard.metrics.failedPayments} chartData={dashboard.metricSamples.failedPayments} chartType="bar" color={metricCardColors[6]} />
            <MetricCard locale={locale} label="Payments awaiting completion" value={dashboard.metrics.pendingPayments} chartData={dashboard.metricSamples.pendingPayments} chartType="area" color={metricCardColors[7]} />
            <MetricCard locale={locale} label="Active users" value={dashboard.metrics.activeUsers} chartData={dashboard.metricSamples.activeUsers} chartType="area" color={metricCardColors[8]} />
            <MetricCard locale={locale} label="New user accounts" value={dashboard.metrics.newUsers} detail="Created within the selected date range." chartData={dashboard.metricSamples.newUsers} chartType="bar" color={metricCardColors[9]} />
            <MetricCard locale={locale} label="Active sellers" value={dashboard.metrics.activeSellers} chartData={dashboard.metricSamples.activeSellers} chartType="donut" color={metricCardColors[10]} />
            <MetricCard locale={locale} label="Pending seller applications" value={dashboard.metrics.pendingSellers} chartData={dashboard.metricSamples.pendingSellers} chartType="line" color={metricCardColors[11]} />
            <MetricCard locale={locale} label="Active stores" value={dashboard.metrics.activeStores} chartData={dashboard.metricSamples.activeStores} chartType="area" color={metricCardColors[12]} />
            <MetricCard locale={locale} label="Suspended stores" value={dashboard.metrics.suspendedStores} chartData={dashboard.metricSamples.suspendedStores} chartType="bar" color={metricCardColors[13]} />
            <MetricCard locale={locale} label="Total products" value={dashboard.metrics.totalProducts} chartData={dashboard.metricSamples.totalProducts} chartType="bar" color={metricCardColors[14]} />
            <MetricCard locale={locale} label="Products awaiting approval" value={dashboard.metrics.pendingProducts} chartData={dashboard.metricSamples.pendingProducts} chartType="line" color={metricCardColors[15]} />
            <MetricCard locale={locale} label="Product reviews awaiting moderation" value={dashboard.metrics.pendingProductReviews} href="/admin/reviews" chartData={dashboard.metricSamples.pendingProductReviews} chartType="donut" color={metricCardColors[16]} />
            <MetricCard locale={locale} label="Store reviews awaiting moderation" value={dashboard.metrics.pendingStoreReviews} href="/admin/store-reviews" chartData={dashboard.metricSamples.pendingStoreReviews} chartType="bar" color={metricCardColors[17]} />
            <MetricCard locale={locale} label="Return requests" value={dashboard.metrics.requestedReturns} href="/admin/returns" chartData={dashboard.metricSamples.requestedReturns} chartType="line" color={metricCardColors[18]} />
            <MetricCard locale={locale} label="Open support tickets" value={dashboard.metrics.openSupportTickets} href="/admin/support" chartData={dashboard.metricSamples.openSupportTickets} chartType="area" color={metricCardColors[19]} />
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

          <section aria-label={translate(locale, "Analytics charts", "مخططات التحليلات")} className="mt-8 grid gap-5 lg:grid-cols-2">
            <LineAreaChart
              title={translate(locale, "Order trend · line and area", "اتجاه الطلبات · خط ومساحة")}
              description={translate(locale, "Daily order counts show the trend; shaded area emphasizes volume.", "يعرض عدد الطلبات اليومي اتجاهها، وتبرز المساحة المظللة حجمها.")}
              data={dailyOrdersChart}
              emptyLabel={emptyChartLabel}
            />
            <PieChart
              title={translate(locale, "Order status · share of total", "حالات الطلبات · النسبة من الإجمالي")}
              description={translate(locale, "Each segment is a share of all orders in the selected period.", "يمثل كل جزء نسبة من إجمالي الطلبات في الفترة المحددة.")}
              data={orderStatusChart}
              emptyLabel={emptyChartLabel}
            />
            <HorizontalBarChart
              title={translate(locale, "Administrative queues · horizontal bars", "قوائم العمل الإدارية · أشرطة أفقية")}
              description={translate(locale, "Compare open work by operational category.", "قارن حجم العمل المفتوح حسب الفئة التشغيلية.")}
              data={queueChart}
              emptyLabel={emptyChartLabel}
            />
            <HistogramChart
              title={translate(locale, "Daily order frequency · histogram", "توزيع تكرار الطلبات اليومية · مدرج تكراري")}
              description={translate(locale, "Frequency distribution of daily order counts in the selected range.", "توزيع تكرار أعداد الطلبات اليومية ضمن الفترة المحددة.")}
              values={dashboard.dailyOrders.map((day) => day.count)}
              emptyLabel={emptyChartLabel}
            />
            <ScatterPlot
              title={translate(locale, "Consecutive-day relationship · scatter plot", "العلاقة بين الأيام المتتالية · مبعثر")}
              description={translate(locale, "Compare each day’s orders with the prior day; bubble size shows the absolute change.", "قارن طلبات كل يوم باليوم السابق؛ يوضح حجم الفقاعة مقدار التغير.")}
              data={consecutiveDayPoints}
              bubble
              emptyLabel={emptyChartLabel}
              xLabel={translate(locale, "Previous day orders", "طلبات اليوم السابق")}
              yLabel={translate(locale, "Current day orders", "طلبات اليوم الحالي")}
            />
            <BoxPlot
              title={translate(locale, "Daily orders · box plot", "الطلبات اليومية · مخطط الصندوق")}
              description={translate(locale, "Summarizes daily order distribution and highlights outliers.", "يلخص توزيع الطلبات اليومية ويبرز القيم المتطرفة.")}
              values={dashboard.dailyOrders.map((day) => day.count)}
              emptyLabel={emptyChartLabel}
            />
            <RadarChart
              title={translate(locale, "Platform activity · radar", "نشاط المنصة · رادار")}
              description={translate(locale, "Normalized shape only: figures include both range-based and platform-wide counts, and are not percentages.", "شكل نسبي فقط: تشمل الأرقام مؤشرات للفترة وأخرى للمنصة ككل، وليست نسبًا مئوية.")}
              data={radarChart}
              emptyLabel={emptyChartLabel}
            />
          </section>

          <section className="mt-8 rounded-2xl border border-[var(--border)] bg-white p-5">
            <h2 className="text-lg font-semibold text-[var(--color-forest-950)]">{translate(locale, "Recent orders", "الطلبات الأخيرة")}</h2>
            {dashboard.recentOrders.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-[var(--border)] text-xs text-[var(--muted)]"><th className="py-2 pr-4 font-medium">{translate(locale, "Order", "الطلب")}</th><th className="py-2 pr-4 font-medium">{translate(locale, "Status", "الحالة")}</th><th className="py-2 pr-4 font-medium">{translate(locale, "Total", "الإجمالي")}</th><th className="py-2 font-medium">{translate(locale, "Placed", "تاريخ الإنشاء")}</th></tr></thead><tbody>            {dashboard.recentOrders.map((order) => <tr key={order.id} className="border-b border-[var(--border)] last:border-0"><td className="py-3 pr-4 font-medium">{order.orderNumber}</td><td className="py-3 pr-4">{order.status.replaceAll("_", " ")}</td><td className="py-3 pr-4">{money(order.totalMinor, order.currencyCode, currencyUnits.get(order.currencyCode) ?? 2, locale)}</td><td className="py-3">{new Date(order.placedAt).toLocaleString(locale)}</td></tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-[var(--muted)]">{translate(locale, "No orders match the selected filters.", "لا توجد طلبات تطابق عوامل التصفية المحددة.")}</p>}
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
