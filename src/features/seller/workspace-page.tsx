"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import LeafletLocationMap from "@/components/maps/leaflet-location-map";
import AuthReturnLink from "@/components/auth-return-link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import { toMinorUnits } from "@/lib/money";
import {
  type ChartDatum,
  HorizontalBarChart,
  LineAreaChart,
  PieChart,
} from "@/components/data-charts";

type Market = { id: string; code: string; name: string; defaultCurrency: { code: string; minorUnit: number; symbol: string | null } };
type Store = {
  id: string; storeNumber: string; name: string; slug: string; status: string; isOwner: boolean;
  markets: Array<{ market: { id: string; code: string; name: string; defaultCurrencyCode: string } }>;
  warehouses: Array<{ id: string; code: string; name: string; _count: { inventories: number } }>;
};
type Workspace = {
  seller: null | { id: string; status: string; legalName: string | null; displayName: string | null };
  stores: Store[];
};
type ShippingRate = { id: string; marketId: string; market: { code: string; name: string }; currencyCode: string; name: string; description: string | null; amountMinor: string; destinationRegion: string | null; minDeliveryDays: number | null; maxDeliveryDays: number | null; isActive: boolean };
type InventoryRow = {
  id: string; quantityOnHand: number; quantityReserved: number; quantityAvailable: number;
  reorderPoint: number; isLowStock: boolean;
  warehouse: { id: string; code: string; name: string };
  variant: { id: string; sku: string | null; name: string | null; product: { name: string; slug: string } };
};
type SellerAnalytics = {
  store: { id: string; name: string };
  range: { from: string; to: string; days: number };
  permissions: { orders: boolean; catalog: boolean; inventory: boolean; reviews: boolean; returns: boolean; store: boolean };
  metrics: {
    totalOrders: number | null;
    grossSalesByCurrency: Array<{ currencyCode: string; amountMinor: string; orderCount: number; minorUnit: number; currencyName: string }>;
    activeProducts: number | null;
    pendingProducts: number | null;
    averageRating: number | null;
    reviewCount: number | null;
    requestedReturns: number | null;
  };
  orderStatuses: Array<{ status: string; count: number }>;
  dailySales: Array<{ day: string; currencyCode: string; amountMinor: string; orderCount: number }>;
  topProducts: Array<{ productId: string | null; name: string; unitsSold: number }>;
};

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw new ApiError(body.error ?? "The request could not be completed.", response.status);
  return body as T;
}

export default function SellerWorkspacePage() {
  const { locale } = useLocale();
  const emptyChartLabel = translate(locale, "No store data is available for this chart.", "لا تتوفر بيانات المتجر لهذا المخطط.");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarketIds, setSelectedMarketIds] = useState<string[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState("");
  const [sellerAnalytics, setSellerAnalytics] = useState<SellerAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [selectedSalesCurrency, setSelectedSalesCurrency] = useState("");
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [shippingMarketId, setShippingMarketId] = useState("");
  const [shippingName, setShippingName] = useState("");
  const [shippingDescription, setShippingDescription] = useState("");
  const [shippingAmount, setShippingAmount] = useState("0");
  const [shippingRegion, setShippingRegion] = useState("");
  const [shippingMinDays, setShippingMinDays] = useState("");
  const [shippingMaxDays, setShippingMaxDays] = useState("");
  const [editingShippingRateId, setEditingShippingRateId] = useState("");
  const [legalName, setLegalName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [residence, setResidence] = useState("");
  const [businessType, setBusinessType] = useState("INDIVIDUAL");
  const [sellingCategories, setSellingCategories] = useState("");
  const [intendedProducts, setIntendedProducts] = useState("");
  const [sellerDescription, setSellerDescription] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [identityDocumentFileId, setIdentityDocumentFileId] = useState("");
  const [identityDocumentName, setIdentityDocumentName] = useState("");
  const [sellerLatitude, setSellerLatitude] = useState<number | null>(null);
  const [sellerLongitude, setSellerLongitude] = useState<number | null>(null);
  const [storeName, setStoreName] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [warehouseName, setWarehouseName] = useState("");
  const [warehouseCode, setWarehouseCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authenticationRequired, setAuthenticationRequired] = useState(false);
  const [mfaEnrollmentRequired, setMfaEnrollmentRequired] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const data = await readJson<Workspace>(await fetch("/api/seller/stores", { cache: "no-store" }));
    setWorkspace(data);
    if (!selectedStoreId && data.stores[0]) { setSelectedStoreId(data.stores[0].id); localStorage.setItem("mtjr.activeStoreId", data.stores[0].id); }
  }, [selectedStoreId]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/markets").then((r) => readJson<{ items: Market[] }>(r)),
      fetch("/api/seller/stores", { cache: "no-store" }).then((r) => readJson<Workspace>(r))
    ]).then(([marketResult, sellerResult]) => {
      if (!active) return;
      setMarkets(marketResult.items);
      setWorkspace(sellerResult);
      if (sellerResult.stores[0]) { setSelectedStoreId(sellerResult.stores[0].id); localStorage.setItem("mtjr.activeStoreId", sellerResult.stores[0].id); }
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) {
        setAuthenticationRequired(true);
        return;
      }
      if (cause instanceof ApiError && /multi-factor authentication enrollment is required/i.test(cause.message)) { setMfaEnrollmentRequired(true); return; }
      setError(cause instanceof Error ? cause.message : translate(locale, "The seller workspace could not be loaded.", "تعذر تحميل مساحة عمل البائع."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [locale]);

  useEffect(() => {
    if (!selectedStoreId) return;
    let active = true;
    fetch(`/api/seller/shipping-rates?storeId=${encodeURIComponent(selectedStoreId)}`, { cache: "no-store" })
      .then((r) => readJson<{ rates: ShippingRate[] }>(r))
      .then((data) => { if (active) setShippingRates(data.rates); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : translate(locale, "Shipping rates could not be loaded.", "تعذر تحميل أسعار الشحن.")); });
    void Promise.resolve().then(() => {
      if (!active) return;
      setInventoryLoading(true);
      setInventoryError("");
      return fetch(`/api/seller/inventory?storeId=${encodeURIComponent(selectedStoreId)}`, { cache: "no-store" })
        .then((r) => readJson<InventoryRow[]>(r))
        .then((rows) => { if (active) setInventory(rows); })
        .catch((cause: unknown) => {
          if (!active) return;
          const message = cause instanceof Error ? cause.message : translate(locale, "Inventory could not be loaded.", "تعذر تحميل المخزون.");
          setInventory([]);
          setInventoryError(message);
          setError(message);
        })
        .finally(() => { if (active) setInventoryLoading(false); });
    });
    return () => { active = false; };
  }, [locale, selectedStoreId]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      if (!selectedStoreId) {
        setSellerAnalytics(null);
        setAnalyticsLoading(false);
        setAnalyticsError("");
        return;
      }
      setAnalyticsLoading(true);
      setAnalyticsError("");
      return fetch(`/api/seller/analytics?storeId=${encodeURIComponent(selectedStoreId)}`, { cache: "no-store" })
        .then((response) => readJson<SellerAnalytics>(response))
        .then((data) => {
          if (!active) return;
          setSellerAnalytics(data);
          setSelectedSalesCurrency((current) =>
            data.metrics.grossSalesByCurrency.some((entry) => entry.currencyCode === current)
              ? current
              : data.metrics.grossSalesByCurrency[0]?.currencyCode ?? ""
          );
        })
        .catch((cause: unknown) => {
          if (!active) return;
          if (cause instanceof ApiError && cause.status === 401) {
            setAuthenticationRequired(true);
            return;
          }
          setSellerAnalytics(null);
          setAnalyticsError(cause instanceof Error
            ? cause.message
            : translate(locale, "Store analytics could not be loaded.", "تعذر تحميل تحليلات المتجر."));
        })
        .finally(() => { if (active) setAnalyticsLoading(false); });
    });
    return () => { active = false; };
  }, [locale, selectedStoreId]);

  async function submit(event: FormEvent<HTMLFormElement>, path: string, payload: unknown, success: string) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await readJson<{ alreadyCreated?: boolean }>(await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }));
      setMessage(result.alreadyCreated
        ? translate(locale, "This draft store already exists; no duplicate was created.", "هذا المتجر المسودة موجود بالفعل؛ لم يتم إنشاء نسخة مكررة.")
        : translate(locale, success, ({
          "Your seller application has been submitted.": "تم إرسال طلبك لتصبح بائعًا.",
          "Your draft store has been created.": "تم إنشاء مسودة متجرك.",
          "Warehouse created.": "تم إنشاء المستودع.",
          "Shipping service created.": "تم إنشاء خدمة الشحن."
        } as Record<string, string>)[success] ?? success));
      await reload();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        setAuthenticationRequired(true);
        return;
      }
      setError(cause instanceof Error ? cause.message : translate(locale, "The request failed.", "تعذر إكمال الطلب."));
    } finally { setBusy(false); }
  }

  const selectedStore = workspace?.stores.find((store) => store.id === selectedStoreId);
  const hasOwnedStore = workspace?.stores.some((store) => store.isOwner) ?? false;
  const sellerStatusLabels: Record<string, string> = {
    PENDING_PAYMENT: translate(locale, "Awaiting payment", "بانتظار الدفع"),
    CONFIRMED: translate(locale, "Confirmed", "مؤكد"),
    PROCESSING: translate(locale, "Processing", "قيد المعالجة"),
    READY_TO_SHIP: translate(locale, "Ready to ship", "جاهز للشحن"),
    SHIPPED: translate(locale, "Shipped", "تم الشحن"),
    DELIVERED: translate(locale, "Delivered", "تم التوصيل"),
    CANCELLED: translate(locale, "Cancelled", "ملغى")
  };
  const sellerOrderStatuses: ChartDatum[] = (sellerAnalytics?.orderStatuses ?? [])
    .map(({ status, count }) => ({ label: sellerStatusLabels[status] ?? status, value: count }));
  const ordersByDay = (sellerAnalytics?.dailySales ?? []).reduce<Record<string, number>>((counts, row) => {
    counts[row.day] = (counts[row.day] ?? 0) + row.orderCount;
    return counts;
  }, {});
  const sellerDailyOrders: ChartDatum[] = Object.entries(ordersByDay)
    .sort(([dayA], [dayB]) => dayA.localeCompare(dayB))
    .map(([day, value]) => ({ label: day.slice(5), value }));
  const salesCurrencies = sellerAnalytics?.metrics.grossSalesByCurrency ?? [];
  const activeSalesCurrency = salesCurrencies.find((entry) => entry.currencyCode === selectedSalesCurrency) ?? salesCurrencies[0];
  const formatCurrencyMinor = (amountMinor: string, currencyCode: string, minorUnit: number) => {
    const amount = BigInt(amountMinor);
    const factor = BigInt(10) ** BigInt(minorUnit);
    const absolute = amount < BigInt(0) ? -amount : amount;
    const whole = amount < BigInt(0) ? -(absolute / factor) : absolute / factor;
    const fraction = absolute % factor;
    const formatter = new Intl.NumberFormat(locale, {
      style: "currency", currency: currencyCode, minimumFractionDigits: 0, maximumFractionDigits: 0
    });
    const parts = formatter.formatToParts(whole);
    if (minorUnit > 0) {
      const decimal = new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === "decimal")?.value ?? ".";
      const fractionText = new Intl.NumberFormat(locale, {
        useGrouping: false, minimumIntegerDigits: minorUnit, maximumFractionDigits: 0
      }).format(fraction);
      let insertAt = 0;
      parts.forEach((part, index) => {
        if (part.type === "integer" || part.type === "group") insertAt = index + 1;
      });
      parts.splice(insertAt, 0, { type: "decimal", value: decimal }, { type: "fraction", value: fractionText });
    }
    return parts.map((part) => part.value).join("");
  };
  const grossSalesSummary = salesCurrencies.length
    ? salesCurrencies.slice(0, 2).map((entry) => formatCurrencyMinor(entry.amountMinor, entry.currencyCode, entry.minorUnit)).join(" · ") +
      (salesCurrencies.length > 2 ? ` +${salesCurrencies.length - 2}` : "")
    : "—";
  const sellerDailySales: ChartDatum[] = (sellerAnalytics?.dailySales ?? [])
    .filter((row) => row.currencyCode === activeSalesCurrency?.currencyCode)
    .map((row) => ({
      label: row.day.slice(5),
      value: Number(row.amountMinor) / (10 ** (activeSalesCurrency?.minorUnit ?? 2))
    }));
  const topSellingProducts: ChartDatum[] = (sellerAnalytics?.topProducts ?? [])
    .map((product) => ({ label: product.name, value: product.unitsSold }));
  const fulfillmentOrderCount = (sellerAnalytics?.orderStatuses ?? [])
    .filter((row) => ["CONFIRMED", "PROCESSING", "READY_TO_SHIP"].includes(row.status))
    .reduce((total, row) => total + row.count, 0);
  const topStockProducts: ChartDatum[] = Object.values(inventory.reduce<Record<string, ChartDatum>>((products, row) => {
    const label = row.variant.product.name;
    products[label] = { label, value: (products[label]?.value ?? 0) + row.quantityAvailable };
    return products;
  }, {})).sort((a, b) => b.value - a.value).slice(0, 8);
  const lowStockCount = inventory.filter((row) => row.isLowStock).length;
  const availableUnits = inventory.reduce((total, row) => total + row.quantityAvailable, 0);
  const formatMetric = (value: number) => new Intl.NumberFormat(locale).format(value);
  const sellerMetrics = [
    {
      label: translate(locale, "Seller orders", "طلبات البائع"),
      value: analyticsLoading || analyticsError || sellerAnalytics?.metrics.totalOrders == null ? "—" : formatMetric(sellerAnalytics.metrics.totalOrders),
      description: analyticsLoading
        ? translate(locale, "Loading store sales and order data…", "جارٍ تحميل بيانات المبيعات والطلبات…")
        : analyticsError
          ? translate(locale, "Order analytics are temporarily unavailable.", "تحليلات الطلبات غير متاحة مؤقتًا.")
          : translate(locale, "Confirmed, processing, shipped and delivered orders in this period.", "الطلبات المؤكدة وقيد المعالجة والشحن والتسليم خلال هذه الفترة."),
      color: "#9384B5",
      icon: "▤"
    },
    {
      label: translate(locale, "Gross sales", "إجمالي المبيعات"),
      value: analyticsLoading || analyticsError ? "—" : grossSalesSummary,
      compact: true,
      description: translate(locale, "Gross order value before refunds, shown separately by currency; unpaid and cancelled orders are excluded.", "إجمالي قيمة الطلبات قبل المرتجعات، مع فصل العملات واستبعاد الطلبات غير المدفوعة والملغاة."),
      color: "#CE8A5A",
      icon: "↗"
    },
    {
      label: translate(locale, "Active products", "المنتجات النشطة"),
      value: analyticsLoading || analyticsError || sellerAnalytics?.metrics.activeProducts == null ? "—" : formatMetric(sellerAnalytics.metrics.activeProducts),
      description: sellerAnalytics?.metrics.pendingProducts == null
        ? translate(locale, "Catalog access is not available for this role.", "صلاحية عرض الكتالوج غير متاحة لهذا الدور.")
        : translate(locale, "{count} products are awaiting approval.", "{count} منتجات بانتظار الموافقة.").replace("{count}", formatMetric(sellerAnalytics.metrics.pendingProducts)),
      color: "#5E9878",
      icon: "▧"
    },
    {
      label: translate(locale, "Returns awaiting review", "مرتجعات بانتظار المراجعة"),
      value: analyticsLoading || analyticsError || sellerAnalytics?.metrics.requestedReturns == null ? "—" : formatMetric(sellerAnalytics.metrics.requestedReturns),
      description: translate(locale, "Customer return requests for this store.", "طلبات إرجاع العملاء الخاصة بهذا المتجر."),
      color: "#C47D96",
      icon: "↶"
    },
    {
      label: translate(locale, "Orders to fulfill", "طلبات بانتظار التجهيز"),
      value: analyticsLoading || analyticsError ? "—" : formatMetric(fulfillmentOrderCount),
      description: translate(locale, "Confirmed, processing, and ready-to-ship orders.", "الطلبات المؤكدة وقيد المعالجة والجاهزة للشحن."),
      color: "#CE8A5A",
      icon: "＋"
    },
    {
      label: translate(locale, "Available units", "الوحدات المتاحة"),
      value: inventoryLoading || inventoryError ? "—" : formatMetric(availableUnits),
      description: inventoryLoading
        ? translate(locale, "Loading inventory…", "جارٍ تحميل المخزون…")
        : inventoryError
          ? translate(locale, "Inventory data is temporarily unavailable.", "بيانات المخزون غير متاحة مؤقتًا.")
          : translate(locale, "Across this store’s warehouse records.", "في سجلات مستودعات هذا المتجر."),
      color: "#5E9878",
      icon: "▦"
    },
    {
      label: translate(locale, "Low-stock records", "سجلات المخزون المنخفض"),
      value: inventoryLoading || inventoryError ? "—" : formatMetric(lowStockCount),
      description: inventoryLoading
        ? translate(locale, "Loading inventory…", "جارٍ تحميل المخزون…")
        : inventoryError
          ? translate(locale, "Inventory data is temporarily unavailable.", "بيانات المخزون غير متاحة مؤقتًا.")
          : lowStockCount
            ? translate(locale, "Inventory records at or below reorder point.", "سجلات المخزون عند حد إعادة الطلب أو دونه.")
            : translate(locale, "No inventory is below its reorder point.", "لا يوجد مخزون دون حد إعادة الطلب."),
      color: "#B38E3F",
      icon: "⚠"
    },
    {
      label: translate(locale, "Store rating", "تقييم المتجر"),
      value: analyticsLoading || analyticsError || sellerAnalytics?.metrics.averageRating == null
        ? "—"
        : `${sellerAnalytics.metrics.averageRating.toFixed(1)} / 5`,
      description: sellerAnalytics?.metrics.reviewCount == null
        ? translate(locale, "Review access is not available for this role.", "صلاحية عرض التقييمات غير متاحة لهذا الدور.")
        : translate(locale, "{count} published customer reviews.", "{count} تقييمات منشورة من العملاء.").replace("{count}", formatMetric(sellerAnalytics.metrics.reviewCount)),
      color: "#B38E3F",
      icon: "★"
    }
  ];

  return (
    <main className="min-h-full bg-transparent text-[#263d50]">
      <div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
        <div className="relative mb-7 overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(125deg,#38556d_0%,#2b4359_58%,#3f6170_100%)] p-6 text-white shadow-[0_18px_38px_rgba(35,57,76,.2),inset_0_1px_0_rgba(255,255,255,.22)] sm:p-8">
          <div className="pointer-events-none absolute -right-10 -top-14 size-48 rounded-full bg-[var(--color-peach-100)]/80 blur-2xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#b9dce1]">{translate(locale, "SELLER WORKSPACE", "مركز البائع")}</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">{translate(locale, "Seller dashboard", "لوحة تحكم البائع")}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200/80">{translate(locale, "Your store operations, performance and daily tasks in one place.", "إدارة متجرك وأداؤه ومهامه اليومية في مكان واحد.")}</p>
            </div>
            {selectedStore && <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-xs text-white shadow-[inset_0_1px_0_rgba(255,255,255,.16)]"><span className="size-2 rounded-full bg-[var(--color-success)]" /><span className="font-bold text-white">{selectedStore.name}</span><span className="text-white/75">{selectedStore.status}</span></div>}
          </div>
        </div>
        {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {message && <p role="status" className="mt-6 rounded-xl border border-[var(--color-sage-500)] bg-[var(--color-sage-100)] px-4 py-3 text-sm text-[var(--color-forest-950)]">{message}</p>}
        {loading ? <p className="py-16 text-sm text-[var(--muted)]">{translate(locale, "Loading your workspace…", "جارٍ تحميل مساحة عملك…")}</p> : mfaEnrollmentRequired ? (<section className="mt-8 max-w-2xl rounded-3xl border bg-white p-6 sm:p-8"><h2 className="text-xl font-semibold">{translate(locale, "Secure your seller account", "أمّن حساب البائع")}</h2><p className="mt-2 text-sm text-[var(--muted)]">{translate(locale, "Your seller application has been approved. Set up multi-factor authentication to continue.", "تمت الموافقة على طلبك. أعد إعداد المصادقة متعددة العوامل للمتابعة.")}</p><Link href="/account/security?mfa=setup&returnTo=%2Fseller" className="mt-6 inline-flex rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white">{translate(locale, "Set up multi-factor authentication", "إعداد المصادقة متعددة العوامل")}</Link></section>) : authenticationRequired ? (
          <section className="mt-8 max-w-2xl rounded-[1.75rem] border border-white/80 bg-[linear-gradient(145deg,#f7fbfc,#e4edf1)] p-6 shadow-[0_12px_28px_rgba(40,65,84,.11),inset_0_1px_0_white] sm:p-8">
            <h2 className="text-xl font-semibold">{translate(locale, "Sign in to continue", "سجّل الدخول للمتابعة")}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{translate(locale, "Sign in or create an account to apply to sell and manage your stores.", "سجّل الدخول أو أنشئ حسابًا للتقدم للبيع وإدارة متاجرك.")}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <AuthReturnLink href="/login" className="rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white">{translate(locale, "Sign in", "تسجيل الدخول")}</AuthReturnLink>
              <AuthReturnLink href="/register" className="rounded-xl border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--color-forest-900)]">{translate(locale, "Create account", "إنشاء حساب")}</AuthReturnLink>
            </div>
          </section>
        ) : !workspace?.seller ? (
          <section className="mt-8 max-w-2xl rounded-[1.75rem] border border-white/80 bg-[linear-gradient(145deg,#f7fbfc,#e4edf1)] p-6 shadow-[0_12px_28px_rgba(40,65,84,.11),inset_0_1px_0_white] sm:p-8">
            <h2 className="text-xl font-semibold">{translate(locale, "Apply to become a seller", "تقدّم لتصبح بائعًا")}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{translate(locale, "Submit your legal and public business names. Your application will remain pending until reviewed by the marketplace team.", "أدخل الاسم القانوني والاسم التجاري العلني. سيظل طلبك قيد الانتظار حتى يراجعه فريق السوق.")}</p>
            <form onSubmit={(event) => {
              if (sellerLatitude === null || sellerLongitude === null) {
                event.preventDefault();
                setError(translate(locale, "Choose your business location on the map.", "حدد موقع نشاطك على الخريطة قبل الإرسال."));
                return;
              }
              void submit(event, "/api/seller/applications", {
                legalName, displayName, contactName, contactEmail, phoneNumber, residence, businessType,
                sellingCategories, intendedProducts, description: sellerDescription,
                facebookUrl, youtubeUrl, twitterUrl, identityDocumentFileId, latitude: sellerLatitude, longitude: sellerLongitude
              }, "Your seller application has been submitted.");
            }} className="mt-6 grid gap-5">
              <section className="grid gap-4 rounded-[1.5rem] border border-white/80 bg-[linear-gradient(145deg,#eaf2f5,#e0ebef)] p-4 shadow-[inset_0_1px_0_white,0_5px_14px_rgba(43,69,88,.06)]">
                <div><h3 className="font-extrabold text-[#2d4a60]">{translate(locale, "01 · Applicant and business", "01 · بيانات البائع والنشاط")}</h3><p className="mt-1 text-xs text-[#718899]">{translate(locale, "Your legal identity and public store details.", "بياناتك الشخصية واسم المتجر الذي سيظهر للعملاء.")}</p></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm">{translate(locale, "Full legal name", "الاسم الكامل كما في الهوية")}<input required minLength={2} maxLength={160} autoComplete="name" value={legalName} onChange={(e) => setLegalName(e.target.value)} className="rounded-2xl border border-white/90 bg-[#f7fbfc] px-4 py-3 font-normal shadow-[inset_0_2px_5px_rgba(43,69,88,.08)]" /></label>
                  <label className="grid gap-1 text-sm">{translate(locale, "Store name", "اسم المتجر")}<input required minLength={2} maxLength={80} value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="rounded-2xl border border-white/90 bg-[#f7fbfc] px-4 py-3 font-normal shadow-[inset_0_2px_5px_rgba(43,69,88,.08)]" /></label>
                  <label className="grid gap-1 text-sm">{translate(locale, "Contact person", "الشخص المسؤول")}<input required minLength={2} maxLength={120} value={contactName} onChange={(e) => setContactName(e.target.value)} className="rounded-2xl border border-white/90 bg-[#f7fbfc] px-4 py-3 font-normal shadow-[inset_0_2px_5px_rgba(43,69,88,.08)]" /></label>
                  <label className="grid gap-1 text-sm">{translate(locale, "Contact email", "البريد الإلكتروني للتواصل")}<input required type="email" maxLength={254} autoComplete="email" dir="ltr" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="rounded-2xl border border-white/90 bg-[#f7fbfc] px-4 py-3 text-left font-normal shadow-[inset_0_2px_5px_rgba(43,69,88,.08)]" /></label>
                  <label className="grid gap-1 text-sm">{translate(locale, "Phone number", "رقم الهاتف")}<input required type="tel" maxLength={25} autoComplete="tel" dir="ltr" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+963 9xx xxx xxx" className="rounded-2xl border border-white/90 bg-[#f7fbfc] px-4 py-3 text-left font-normal shadow-[inset_0_2px_5px_rgba(43,69,88,.08)]" /></label>
                  <label className="grid gap-1 text-sm">{translate(locale, "Business type", "نوع النشاط")}<select required value={businessType} onChange={(e) => setBusinessType(e.target.value)} className="rounded-2xl border border-white/90 bg-[#f7fbfc] px-4 py-3 font-normal shadow-[inset_0_2px_5px_rgba(43,69,88,.08)]"><option value="INDIVIDUAL">{translate(locale, "Individual seller", "بائع فردي")}</option><option value="STORE">{translate(locale, "Store or company", "متجر أو شركة")}</option><option value="ARTISAN">{translate(locale, "Artisan / maker", "حرفي أو صانع")}</option><option value="AGENCY">{translate(locale, "Agency / distributor", "وكالة أو موزع")}</option><option value="OTHER">{translate(locale, "Other", "أخرى")}</option></select></label>
                  <label className="grid gap-1 text-sm sm:col-span-2">{translate(locale, "Business address / residence", "عنوان النشاط أو مكان الإقامة")}<input required minLength={3} maxLength={240} value={residence} onChange={(e) => setResidence(e.target.value)} placeholder={translate(locale, "City, district, street", "المدينة، المنطقة، الشارع")} className="rounded-2xl border border-white/90 bg-[#f7fbfc] px-4 py-3 font-normal shadow-[inset_0_2px_5px_rgba(43,69,88,.08)]" /></label>
                </div>
              </section>
              <section className="grid gap-4 rounded-[1.5rem] border border-white/80 bg-[linear-gradient(145deg,#eaf2f5,#e0ebef)] p-4 shadow-[inset_0_1px_0_white,0_5px_14px_rgba(43,69,88,.06)]">
                <div><h3 className="font-extrabold text-[#2d4a60]">{translate(locale, "02 · Products and selling plan", "02 · المنتجات وخطة البيع")}</h3><p className="mt-1 text-xs text-[#718899]">{translate(locale, "Tell us what you plan to offer and where it comes from.", "أخبرنا عن المنتجات التي ستعرضها ومصدرها وخطة توفيرها.")}</p></div>
                <label className="grid gap-1 text-sm">{translate(locale, "Product categories", "فئات المنتجات")}<input required minLength={2} maxLength={300} value={sellingCategories} onChange={(e) => setSellingCategories(e.target.value)} placeholder={translate(locale, "Fashion, electronics, home, beauty…", "أزياء، إلكترونيات، منزل، تجميل...")} className="rounded-2xl border border-white/90 bg-[#f7fbfc] px-4 py-3 font-normal shadow-[inset_0_2px_5px_rgba(43,69,88,.08)]" /></label>
                <label className="grid gap-1 text-sm">{translate(locale, "Products and sales plan (at least 20 characters)", "المنتجات وخطة البيع (20 حرفاً على الأقل)")}<textarea required minLength={20} maxLength={4000} rows={4} value={intendedProducts} onChange={(e) => setIntendedProducts(e.target.value)} placeholder={translate(locale, "Examples, condition, sourcing, expected quantities and supply frequency…", "أمثلة المنتجات، حالتها، مصدرها، الكميات المتوقعة وتواتر التوريد...")} className="rounded-2xl border border-white/90 bg-[#f7fbfc] px-4 py-3 font-normal shadow-[inset_0_2px_5px_rgba(43,69,88,.08)]" /><span className="text-xs text-[#718899]">{intendedProducts.length}/4000</span></label>
                <label className="grid gap-1 text-sm">{translate(locale, "About your business (optional)", "نبذة عن نشاطك (اختياري)")}<textarea maxLength={2000} rows={3} value={sellerDescription} onChange={(e) => setSellerDescription(e.target.value)} className="rounded-2xl border border-white/90 bg-[#f7fbfc] px-4 py-3 font-normal shadow-[inset_0_2px_5px_rgba(43,69,88,.08)]" /></label>
              </section>
              <section className="grid gap-4 rounded-[1.5rem] border border-white/80 bg-[linear-gradient(145deg,#eaf2f5,#e0ebef)] p-4 shadow-[inset_0_1px_0_white,0_5px_14px_rgba(43,69,88,.06)]">
                <div><h3 className="font-extrabold text-[#2d4a60]">{translate(locale, "03 · Business location", "03 · موقع النشاط")}</h3><p className="mt-1 text-xs text-[#718899]">{translate(locale, "Click or drag the pin to mark your business location.", "انقر على الخريطة أو اسحب الدبوس لتحديد موقع نشاطك بدقة.")}</p></div>
                <LeafletLocationMap locale={locale} value={sellerLatitude !== null && sellerLongitude !== null ? { latitude: sellerLatitude, longitude: sellerLongitude } : null} onChange={(point) => { setSellerLatitude(point.latitude); setSellerLongitude(point.longitude); }} height={300} />
                <p className="text-xs text-[#718899]">{sellerLatitude === null || sellerLongitude === null ? translate(locale, "A map location is required.", "تحديد الموقع على الخريطة مطلوب.") : sellerLatitude.toFixed(5) + ", " + sellerLongitude.toFixed(5)}</p>
              </section>
              <section className="grid gap-4 rounded-[1.5rem] border border-white/80 bg-[linear-gradient(145deg,#eaf2f5,#e0ebef)] p-4 shadow-[inset_0_1px_0_white,0_5px_14px_rgba(43,69,88,.06)]">
                <div><h3 className="font-extrabold text-[#2d4a60]">{translate(locale, "04 · Online presence", "04 · الحضور الرقمي")}</h3><p className="mt-1 text-xs text-[#718899]">{translate(locale, "Optional links help us understand your business.", "روابط اختيارية تساعدنا على التعرف على نشاطك.")}</p></div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="grid gap-1 text-sm">Facebook<input type="url" maxLength={2048} dir="ltr" value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} placeholder="https://facebook.com/…" className="rounded-2xl border border-white/90 bg-[#f7fbfc] px-4 py-3 text-left font-normal shadow-[inset_0_2px_5px_rgba(43,69,88,.08)]" /></label>
                  <label className="grid gap-1 text-sm">YouTube<input type="url" maxLength={2048} dir="ltr" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/…" className="rounded-2xl border border-white/90 bg-[#f7fbfc] px-4 py-3 text-left font-normal shadow-[inset_0_2px_5px_rgba(43,69,88,.08)]" /></label>
                  <label className="grid gap-1 text-sm">X<input type="url" maxLength={2048} dir="ltr" value={twitterUrl} onChange={(e) => setTwitterUrl(e.target.value)} placeholder="https://x.com/…" className="rounded-2xl border border-white/90 bg-[#f7fbfc] px-4 py-3 text-left font-normal shadow-[inset_0_2px_5px_rgba(43,69,88,.08)]" /></label>
                </div>
              </section>
              <button disabled={busy} className="mt-2 rounded-2xl bg-[linear-gradient(135deg,#68b4b5,#3d8993)] px-5 py-3 text-sm font-extrabold text-white shadow-[0_9px_20px_rgba(39,104,112,.22),inset_0_1px_0_rgba(255,255,255,.35)] disabled:opacity-50">{busy ? translate(locale, "Submitting…", "جارٍ الإرسال…") : translate(locale, "Submit application", "إرسال الطلب للمراجعة")}</button>
            </form>
          </section>
        ) : (
          <>
          {selectedStore && <>
            <section className="mt-7 flex flex-wrap items-center justify-between gap-5 rounded-[2rem] border border-white/80 bg-[linear-gradient(120deg,#d8e9ed,#e7eef1_58%,#e1e4f1)] p-6 shadow-[0_12px_28px_rgba(42,66,84,.12),inset_0_1px_0_white] sm:p-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.18em] text-[#587b8c]">{translate(locale, "Store overview", "نظرة عامة على المتجر")}</p>
                <h2 className="mt-2 text-2xl font-bold text-[#263d50]">{selectedStore.name}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">/{selectedStore.slug} · {selectedStore.status}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/seller/products#create-product" className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#65aeb0,#3c858f)] px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(38,94,105,.25),inset_0_1px_0_rgba(255,255,255,.35)] transition hover:shadow-[var(--shadow-clay-hover)]">
                  <span aria-hidden="true" className="text-base leading-none">＋</span>
                  {translate(locale, "Create new listing", "إنشاء منتج جديد")}
                </Link>
                <Link href="/seller/orders" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[#eef4f5] px-4 py-3 text-sm font-semibold text-[#365267] shadow-[inset_0_1px_0_white,0_4px_12px_rgba(39,63,81,.08)] transition hover:bg-white">
                  {translate(locale, "View orders", "عرض الطلبات")}
                </Link>
              </div>
            </section>

            <section aria-label={translate(locale, "Store metrics", "مؤشرات المتجر")} className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {sellerMetrics.map((metric) => {
                return (
                  <article key={metric.label} className="group relative overflow-hidden rounded-[1.75rem] border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,.82),rgba(218,232,238,.9))] p-5 shadow-[0_10px_24px_rgba(39,63,81,.12),inset_0_1px_0_white] transition duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-clay-hover)]" style={{ backgroundColor: `${metric.color}12`, borderColor: `${metric.color}44` }}>
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `${metric.color}20`, color: metric.color }}>
                        <span aria-hidden="true" className="text-lg leading-none">{metric.icon}</span>
                      </span>
                      <h3 className="text-sm font-semibold text-[var(--color-onyx)]">{metric.label}</h3>
                    </div>
                    <p className={`mt-4 break-words font-black tracking-tight text-[var(--color-ink-950)] ${("compact" in metric && metric.compact) ? "text-xl sm:text-2xl" : "text-3xl"}`}>{metric.value}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{metric.description}</p>
                  </article>
                );
              })}
            </section>

            <section aria-label={translate(locale, "Store analytics", "تحليلات المتجر")} className="mt-8">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-[#2c485c]">{translate(locale, "Store performance", "أداء المتجر")}</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">{translate(locale, "Sales, order health, catalog performance and stock for the selected store.", "المبيعات وحالة الطلبات وأداء الكتالوج والمخزون للمتجر المحدد.")}</p>
                </div>
                {analyticsLoading && <span role="status" className="rounded-full bg-[var(--color-lavender-100)] px-3 py-1.5 text-xs font-semibold text-[var(--color-lavender-800)]">{translate(locale, "Refreshing store analytics…", "جارٍ تحديث تحليلات المتجر…")}</span>}
              </div>
              {analyticsError && <p role="status" className="mb-4 rounded-xl border border-[var(--color-blush-300)] bg-[var(--color-blush-50)] p-3 text-xs text-[var(--color-blush-800)]">{translate(locale, "Store analytics are temporarily unavailable for this account or store.", "تحليلات المتجر غير متاحة مؤقتًا لهذا الحساب أو المتجر.")}</p>}
              {inventoryError && <p role="status" className="mb-4 rounded-xl bg-[var(--background)] p-3 text-xs text-[var(--muted)]">{translate(locale, "Inventory charts are temporarily unavailable.", "مخططات المخزون غير متاحة مؤقتًا.")}</p>}
              {salesCurrencies.length > 1 && (
                <div className="mb-4 flex justify-end">
                  <label className="flex items-center gap-2 text-xs font-semibold text-[var(--color-ink-600)]">
                    {translate(locale, "Sales currency", "عملة المبيعات")}
                    <select value={activeSalesCurrency?.currencyCode ?? ""} onChange={(event) => setSelectedSalesCurrency(event.target.value)} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs shadow-[var(--shadow-clay)]">
                      {salesCurrencies.map((entry) => <option key={entry.currencyCode} value={entry.currencyCode}>{entry.currencyCode}</option>)}
                    </select>
                  </label>
                </div>
              )}
              <div className="grid gap-5 lg:grid-cols-2">
                <LineAreaChart
                  title={translate(locale, "Daily orders", "الطلبات اليومية")}
                  description={translate(locale, "All eligible seller orders in the selected 30-day period.", "جميع طلبات البائع المؤهلة خلال فترة الثلاثين يومًا المحددة.")}
                  data={sellerDailyOrders}
                  emptyLabel={emptyChartLabel}
                />
                <PieChart
                  title={translate(locale, "Orders by status", "الطلبات حسب الحالة")}
                  data={sellerOrderStatuses}
                  emptyLabel={emptyChartLabel}
                />
                <LineAreaChart
                  title={activeSalesCurrency ? `${translate(locale, "Gross sales", "إجمالي المبيعات")} · ${activeSalesCurrency.currencyCode}` : translate(locale, "Gross sales", "إجمالي المبيعات")}
                  description={translate(locale, "Completed and active order value in one currency. No currency conversion is applied.", "قيمة الطلبات المكتملة والنشطة بعملة واحدة دون إجراء تحويل للعملات.")}
                  data={sellerDailySales}
                  emptyLabel={emptyChartLabel}
                />
                <HorizontalBarChart
                  title={translate(locale, "Top-selling products", "المنتجات الأكثر مبيعًا")}
                  description={translate(locale, "Products ranked by units sold, not mixed-currency revenue.", "ترتيب المنتجات حسب الوحدات المباعة، وليس الإيرادات بعملات مختلطة.")}
                  data={topSellingProducts}
                  emptyLabel={emptyChartLabel}
                />
                <div className="lg:col-span-2">
                  <HorizontalBarChart
                    title={translate(locale, "Available stock by product", "المخزون المتاح حسب المنتج")}
                    description={translate(locale, "Top eight products by available units across this store’s warehouses.", "أعلى ثمانية منتجات حسب الوحدات المتاحة في مستودعات هذا المتجر.")}
                    data={inventoryError ? [] : topStockProducts}
                    emptyLabel={inventoryError ? translate(locale, "Inventory data is unavailable.", "بيانات المخزون غير متاحة.") : emptyChartLabel}
                  />
                </div>
              </div>
            </section>
          </>}

          <div className="mt-8 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
            <section className="rounded-[1.75rem] border border-white/80 bg-[linear-gradient(145deg,#f7fbfc,#e4edf1)] p-6 shadow-[0_12px_28px_rgba(40,65,84,.11),inset_0_1px_0_white]">
              <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-extrabold tracking-tight text-[#2d4a60]">{translate(locale, "Seller status", "حالة البائع")}</h2><span className="rounded-full bg-[var(--color-sage-100)] px-3 py-1 text-xs font-semibold text-[var(--color-forest-900)]">{workspace.seller.status}</span></div>
              <p className="mt-3 text-sm text-[var(--muted)]">{workspace.seller.displayName ?? workspace.seller.legalName}</p>
              {hasOwnedStore && <p className="mt-4 rounded-xl border border-[var(--color-sage-500)]/30 bg-[var(--color-sage-100)] p-3 text-sm leading-6 text-[var(--color-forest-900)]">{translate(locale, "This account is linked to one store. You can manage and update its settings at any time; creating another store is disabled.", "هذا الحساب مرتبط بمتجر واحد. يمكنك إدارة إعداداته وتحديثها في أي وقت؛ وتم تعطيل إنشاء متجر آخر.")}</p>}
              {workspace.seller.status === "PENDING" && <p className="mt-4 rounded-xl bg-[var(--color-ivory-100)] p-4 text-sm leading-6">{translate(locale, "Your application is awaiting review. Store creation becomes available after approval.", "طلبك بانتظار المراجعة. سيصبح إنشاء المتجر متاحًا بعد الموافقة.")}</p>}
              {workspace.seller.status === "ACTIVE" && !hasOwnedStore && (
                <form onSubmit={(event) => submit(event, "/api/seller/stores", { name: storeName, slug: storeSlug, marketIds: selectedMarketIds }, "Your draft store has been created.")} className="mt-6 grid gap-4 border-t border-[var(--border)] pt-6">
                  <h3 className="text-base font-extrabold text-[#2d4a60]">{translate(locale, "Create a store", "إنشاء متجر")}</h3>
                  <label className="grid gap-2 text-sm">{translate(locale, "Store name", "اسم المتجر")}<input required minLength={2} maxLength={120} value={storeName} onChange={(e) => { setStoreName(e.target.value); setStoreSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} className="rounded-2xl border border-white/90 bg-[linear-gradient(145deg,#f7fbfc,#e8f0f3)] px-4 py-3 text-[#263d50] shadow-[inset_0_2px_5px_rgba(43,69,88,.08),0_1px_0_white]" /></label>
                  <label className="grid gap-2 text-sm">{translate(locale, "Store URL slug", "معرّف رابط المتجر")}<input required minLength={3} maxLength={160} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={storeSlug} onChange={(e) => setStoreSlug(e.target.value)} className="rounded-2xl border border-white/90 bg-[linear-gradient(145deg,#f7fbfc,#e8f0f3)] px-4 py-3 text-[#263d50] shadow-[inset_0_2px_5px_rgba(43,69,88,.08),0_1px_0_white]" /></label>
                  <fieldset className="grid gap-2"><legend className="text-sm font-medium">{translate(locale, "Markets served", "الأسواق التي يخدمها المتجر")}</legend>{markets.map((market) => <label key={market.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedMarketIds.includes(market.id)} onChange={(e) => setSelectedMarketIds((ids) => e.target.checked ? [...ids, market.id] : ids.filter((id) => id !== market.id))} />{market.name} · {market.defaultCurrency.code}</label>)}{!markets.length && <p className="text-xs text-[var(--muted)]">{translate(locale, "No active launch markets are configured yet.", "لم يتم إعداد أسواق الإطلاق النشطة بعد.")}</p>}</fieldset>
                  <button disabled={busy || !selectedMarketIds.length} className="rounded-2xl bg-[linear-gradient(135deg,#68b4b5,#3d8993)] px-4 py-3 text-sm font-extrabold text-white shadow-[0_9px_20px_rgba(39,104,112,.22),inset_0_1px_0_rgba(255,255,255,.35)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50">{busy ? translate(locale, "Creating…", "جارٍ الإنشاء…") : translate(locale, "Create draft store", "إنشاء متجر كمسودة")}</button>
                </form>
              )}
            </section>
            <section className="rounded-[1.75rem] border border-white/80 bg-[linear-gradient(145deg,#f7fbfc,#e4edf1)] p-6 shadow-[0_12px_28px_rgba(40,65,84,.11),inset_0_1px_0_white]">
              <h2 className="text-lg font-extrabold tracking-tight text-[#2d4a60]">{translate(locale, "Your stores", "متاجرك")}</h2>
              {!workspace.stores.length ? <p className="mt-4 rounded-xl bg-[var(--color-ivory-100)] p-5 text-sm text-[var(--muted)]">{translate(locale, "No stores have been created yet.", "لم يتم إنشاء أي متاجر بعد.")}</p> : (
                <>
                  <div className="mt-4"><Link href="/seller/messages" className="inline-flex rounded-2xl bg-[linear-gradient(135deg,#68b4b5,#3d8993)] px-4 py-2 text-sm font-bold text-white shadow-[0_6px_14px_rgba(39,104,112,.18),inset_0_1px_0_rgba(255,255,255,.3)]">{translate(locale, "Open store inbox", "فتح صندوق وارد المتجر")}</Link></div>
                  <div className="mt-4 flex flex-wrap gap-2">{workspace.stores.map((store) => <button key={store.id} onClick={() => { setSelectedStoreId(store.id); localStorage.setItem("mtjr.activeStoreId", store.id); }} className={`rounded-xl border px-4 py-2 text-sm ${selectedStoreId === store.id ? "border-[var(--color-forest-800)] bg-[var(--color-forest-900)] text-white" : "border-[var(--border)]"}`}>{store.name}</button>)}</div>
                  {selectedStore && <div className="mt-6 border-t border-[var(--border)] pt-5">
                    <div className="flex flex-wrap items-center justify-between gap-2"><div><div><h3 className="font-semibold">{selectedStore.name}</h3><p className="mt-1 text-xs text-[var(--muted)]">STR-{selectedStore.storeNumber.padStart(8, "0")} · /{selectedStore.slug} · {selectedStore.status}</p></div><div className="mt-2 flex flex-wrap gap-2"><Link href="/seller/products" className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--color-forest-900)]">{translate(locale, "Manage products", "إدارة المنتجات")}</Link><Link href="/seller/orders" className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--color-forest-900)]">{translate(locale, "Seller orders", "طلبات البائع")}</Link><Link href="/seller/inventory" className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--color-forest-900)]">{translate(locale, "Inventory operations", "إدارة المخزون")}</Link><Link href="/seller/staff" className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--color-forest-900)]">{translate(locale, "Team & access", "الفريق والصلاحيات")}</Link></div></div><span className="text-xs text-[var(--muted)]">{selectedStore.markets.length} {translate(locale, "active markets", "أسواق نشطة")}</span></div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {selectedStore.warehouses.map((warehouse) => <div key={warehouse.id} className="rounded-xl bg-[var(--color-ivory-100)] p-4"><p className="font-medium">{warehouse.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{warehouse.code} · {warehouse._count.inventories} {translate(locale, "inventory records", "سجل مخزون")}</p></div>)}
                    </div>
                    {selectedStore.isOwner && <form onSubmit={(event) => submit(event, "/api/seller/warehouses", { storeId: selectedStore.id, name: warehouseName, code: warehouseCode }, "Warehouse created.")} className="mt-5 grid gap-3 rounded-[1.5rem] border border-dashed border-[#a9c7d1] bg-[#eaf3f6] p-4 shadow-[inset_0_2px_7px_rgba(43,69,88,.06)] sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                      <label className="grid gap-1 text-xs">{translate(locale, "Warehouse name", "اسم المستودع")}<input required minLength={2} maxLength={120} value={warehouseName} onChange={(e) => setWarehouseName(e.target.value)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" /></label>
                      <label className="grid gap-1 text-xs">{translate(locale, "Code", "الرمز")}<input required minLength={2} maxLength={40} value={warehouseCode} onChange={(e) => setWarehouseCode(e.target.value.toUpperCase())} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" /></label>
                      <button disabled={busy} className="rounded-lg bg-[var(--color-forest-900)] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{translate(locale, "Add warehouse", "إضافة مستودع")}</button>
                    </form>}
                    <div className="mt-7 border-t border-[var(--border)] pt-6">
                      <h3 className="font-semibold">{translate(locale, "Shipping services", "خدمات الشحن")}</h3>
                      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{translate(locale, "Rates are scoped to a market and optional destination region. Enter the normal amount in the market currency.", "ترتبط الأسعار بسوق ومنطقة وجهة اختيارية. أدخل تكلفة الشحن بصيغتها المعتادة بعملة السوق.")}</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {shippingRates.map((rate) => <div key={rate.id} className="rounded-2xl border border-white/80 bg-[linear-gradient(145deg,#f7fbfc,#e4edf1)] p-4 text-sm shadow-[0_8px_18px_rgba(40,65,84,.1),inset_0_1px_0_white]"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{rate.name} · {rate.market.name}</p>{rate.description && <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{rate.description}</p>}</div><button type="button" onClick={() => { setEditingShippingRateId(rate.id); setShippingMarketId(rate.marketId); setShippingName(rate.name); setShippingDescription(rate.description ?? ""); setShippingAmount((Number(rate.amountMinor) / (10 ** (markets.find((item) => item.id === rate.marketId)?.defaultCurrency.minorUnit ?? 2))).toFixed(markets.find((item) => item.id === rate.marketId)?.defaultCurrency.minorUnit ?? 2)); setShippingRegion(rate.destinationRegion ?? ""); setShippingMinDays(rate.minDeliveryDays?.toString() ?? ""); setShippingMaxDays(rate.maxDeliveryDays?.toString() ?? ""); }} className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold">{translate(locale, "Edit", "تعديل")}</button></div><p className="mt-1 text-xs text-[var(--muted)]">{(Number(rate.amountMinor) / (10 ** (markets.find((item) => item.id === rate.marketId)?.defaultCurrency.minorUnit ?? 2))).toFixed(markets.find((item) => item.id === rate.marketId)?.defaultCurrency.minorUnit ?? 2)} {rate.currencyCode}{rate.destinationRegion ? ` · ${rate.destinationRegion}` : ` · ${translate(locale, "All regions", "جميع المناطق")}`}</p><p className="mt-1 text-xs text-[var(--muted)]">{rate.minDeliveryDays ?? "—"}–{rate.maxDeliveryDays ?? "—"} {translate(locale, "days", "يومًا")} · {rate.isActive ? translate(locale, "Active", "نشط") : translate(locale, "Inactive", "غير نشط")}</p></div>)}
                        {!shippingRates.length && <p className="rounded-xl bg-[var(--color-ivory-100)] p-4 text-xs text-[var(--muted)]">{translate(locale, "No shipping services configured.", "لم يتم إعداد خدمات شحن.")}</p>}
                      </div>
                      {selectedStore.isOwner && <form onSubmit={async (event) => {
                        event.preventDefault();
                        const market = selectedStore.markets.find((item) => item.market.id === shippingMarketId);
                        if (!market) return;
                        setBusy(true); setError(""); setMessage("");
                        try {
                          await readJson(await fetch(editingShippingRateId ? `/api/seller/shipping-rates/${encodeURIComponent(editingShippingRateId)}` : "/api/seller/shipping-rates", {
                            method: editingShippingRateId ? "PATCH" : "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              storeId: selectedStore.id, marketId: market.market.id, currencyCode: market.market.defaultCurrencyCode,
                              name: shippingName, description: shippingDescription || null,
                              amountMinor: toMinorUnits(shippingAmount, markets.find((item) => item.id === market.market.id)?.defaultCurrency.minorUnit ?? 2),
                              destinationRegion: shippingRegion || null,
                              minDeliveryDays: shippingMinDays ? Number(shippingMinDays) : null,
                              maxDeliveryDays: shippingMaxDays ? Number(shippingMaxDays) : null
                            })
                          }));
                          setMessage(translate(locale, editingShippingRateId ? "Shipping service updated." : "Shipping service created.", editingShippingRateId ? "تم تحديث خدمة الشحن." : "تم إنشاء خدمة الشحن."));
                          setEditingShippingRateId(""); setShippingName(""); setShippingDescription(""); setShippingAmount("0"); setShippingRegion(""); setShippingMinDays(""); setShippingMaxDays("");
                          const refreshed = await readJson<{ rates: ShippingRate[] }>(await fetch(`/api/seller/shipping-rates?storeId=${encodeURIComponent(selectedStore.id)}`, { cache: "no-store" }));
                          setShippingRates(refreshed.rates);
                        } catch (cause) { setError(cause instanceof Error ? cause.message : translate(locale, "Shipping service could not be saved.", "تعذر حفظ خدمة الشحن.")); }
                        finally { setBusy(false); }
                      }} className="mt-4 grid gap-3 rounded-[1.5rem] border border-dashed border-[#a9c7d1] bg-[#eaf3f6] p-4 shadow-[inset_0_2px_7px_rgba(43,69,88,.06)] sm:grid-cols-2">
                        <label className="grid gap-1 text-xs">{translate(locale, "Market", "السوق")}<select required value={shippingMarketId} onChange={(e) => setShippingMarketId(e.target.value)} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"><option value="">{translate(locale, "Choose market", "اختر سوقًا")}</option>{selectedStore.markets.map(({ market }) => <option key={market.id} value={market.id}>{market.name} · {market.defaultCurrencyCode}</option>)}</select></label>
                        <label className="grid gap-1 text-xs">{translate(locale, "Service name", "اسم الخدمة")}<input required minLength={2} maxLength={120} value={shippingName} onChange={(e) => setShippingName(e.target.value)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" /></label>
                        <label className="grid gap-1 text-xs">{translate(locale, "Description", "الوصف")}<input maxLength={500} value={shippingDescription} onChange={(e) => setShippingDescription(e.target.value)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" /></label>
                        <label className="grid gap-1 text-xs">{translate(locale, "Shipping amount", "تكلفة الشحن")}<input required type="number" min="0" step={1 / (10 ** (markets.find((item) => item.id === shippingMarketId)?.defaultCurrency.minorUnit ?? 2))} value={shippingAmount} onChange={(e) => setShippingAmount(e.target.value)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" /></label>
                        <label className="grid gap-1 text-xs">{translate(locale, "Destination region", "منطقة الوجهة")}<input maxLength={120} value={shippingRegion} onChange={(e) => setShippingRegion(e.target.value)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" /></label>
                        <label className="grid gap-1 text-xs">{translate(locale, "Minimum days", "الحد الأدنى للأيام")}<input type="number" min="0" max="365" value={shippingMinDays} onChange={(e) => setShippingMinDays(e.target.value)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" /></label>
                        <label className="grid gap-1 text-xs">{translate(locale, "Maximum days", "الحد الأقصى للأيام")}<input type="number" min="0" max="365" value={shippingMaxDays} onChange={(e) => setShippingMaxDays(e.target.value)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" /></label>
                        <button disabled={busy || !selectedStore.markets.length} className="rounded-lg bg-[var(--color-forest-900)] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50 sm:col-span-2">{translate(locale, editingShippingRateId ? "Save changes" : "Add shipping service", editingShippingRateId ? "حفظ التعديلات" : "إضافة خدمة شحن")}</button>{editingShippingRateId && <button type="button" onClick={() => { setEditingShippingRateId(""); setShippingName(""); setShippingDescription(""); setShippingAmount("0"); setShippingRegion(""); setShippingMinDays(""); setShippingMaxDays(""); }} className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-xs font-semibold">{translate(locale, "Cancel edit", "إلغاء التعديل")}</button>}
                      </form>}
                    </div>
                    <div className="mt-7">
                      <h3 className="font-semibold">{translate(locale, "Inventory overview", "نظرة عامة على المخزون")}</h3>
                      {!inventory.length ? <p className="mt-3 rounded-xl bg-[var(--color-ivory-100)] p-4 text-sm text-[var(--muted)]">{translate(locale, "No stock records in this store yet.", "لا توجد سجلات مخزون في هذا المتجر بعد.")}</p> : (
                        <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-[var(--border)] text-xs text-[var(--muted)]"><th className="py-3 pr-3">{translate(locale, "Product / SKU", "المنتج / رمز SKU")}</th><th className="py-3 pr-3">{translate(locale, "Warehouse", "المستودع")}</th><th className="py-3 pr-3">{translate(locale, "On hand", "المتوفر فعليًا")}</th><th className="py-3 pr-3">{translate(locale, "Reserved", "محجوز")}</th><th className="py-3">{translate(locale, "Available", "المتاح")}</th></tr></thead><tbody>{inventory.map((row) => <tr key={row.id} className="border-b border-[var(--border)] last:border-0"><td className="py-3 pr-3"><p className="font-medium">{row.variant.product.name}</p><p className="text-xs text-[var(--muted)]">{row.variant.sku ?? row.variant.name ?? translate(locale, "Variant", "متغير")}</p></td><td className="py-3 pr-3">{row.warehouse.name}</td><td className="py-3 pr-3">{row.quantityOnHand}</td><td className="py-3 pr-3">{row.quantityReserved}</td><td className={`py-3 font-semibold ${row.isLowStock ? "text-amber-700" : ""}`}>{row.quantityAvailable}</td></tr>)}</tbody></table></div>
                      )}
                    </div>
                  </div>}
                </>
              )}
            </section>
          </div>
          </>
        )}
      </div>
    </main>
  );
}
