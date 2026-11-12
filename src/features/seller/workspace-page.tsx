"use client";

import { StatusBadge } from "@/components/status-badge";
import { StatusBadge } from "@/components/status-badge";
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import SyriaLocationPicker from "@/components/maps/syria-location-picker";
import AuthReturnLink from "@/components/auth-return-link";
import { SellerIcon } from "@/features/seller/seller-navigation";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import { toMinorUnits } from "@/lib/money";
import {
  type ChartDatum,
  HorizontalBarChart,
  LineAreaChart,
  PieChart,
} from "@/components/data-charts";

type Market = { id: string; code: string; name: string; defaultCurrency: { code: string; minorUnit: number; symbol: string | null }; currencies: Array<{ currency: { code: string; name: string; minorUnit: number } }> };
type Store = {
  id: string; storeNumber: string; name: string; slug: string; status: string; isOwner: boolean;
  description: string | null; publicPhone: string | null; publicAddress: string | null; logoUrl: string | null; bannerUrl: string | null;
  logoStorageKey: string | null; bannerStorageKey: string | null;
  shippingPolicy: string | null; returnsPolicy: string | null; privacyPolicy: string | null; termsOfSale: string | null;
  shippingContactName: string | null; shippingPhone: string | null; shippingAddressLine1: string | null; shippingAddressLine2: string | null;
  shippingCity: string | null; shippingRegion: string | null; shippingPostalCode: string | null; shippingCountryCode: string | null; shippingInstructions: string | null;
  markets: Array<{ market: { id: string; code: string; name: string; defaultCurrencyCode: string } }>;
  mediaAssets: Array<{ id: string; url: string; storageKey: string | null; mimeType: string | null; width: number | null; height: number | null; createdAt: string }>;
  warehouses: Array<{ id: string; code: string; name: string; _count: { inventories: number } }>;
};
type Workspace = {
  seller: null | {
    id: string; status: string; legalName: string | null; displayName: string | null; contactName: string | null;
    contactEmail: string | null; phoneNumber: string | null; residence: string | null; businessType: string | null;
    sellingCategories: string | null; intendedProducts: string | null; description: string | null;
    facebookUrl: string | null; youtubeUrl: string | null; twitterUrl: string | null;
    latitude: number | null; longitude: number | null;
    registrationCountryCode: string | null; registrationNumber: string | null; registrationAuthority: string | null;
    registrationDate: string | null; registeredAddress: string | null; taxIdentificationNumber: string | null; businessWebsite: string | null;
    hasBusinessRegistrationDocument: boolean; hasTaxCertificateDocument: boolean; hasProofOfAddressDocument: boolean;
    createdAt: string; rejectionReason: string | null; reviewedAt: string | null
  };
  stores: Store[];
};
type ShippingRate = { id: string; marketId: string; market: { code: string; name: string }; currencyCode: string; currency: { minorUnit: number }; name: string; description: string | null; amountMinor: string; destinationRegion: string | null; minDeliveryDays: number | null; maxDeliveryDays: number | null; isActive: boolean };
type InventoryRow = {
  id: string; quantityOnHand: number; quantityReserved: number; quantityAvailable: number;
  reorderPoint: number; isLowStock: boolean;
  warehouse: { id: string; code: string; name: string };
  variant: { id: string; sku: string | null; name: string | null; product: { name: string; slug: string } };
};
type RecentSellerOrder = {
  id: string;
  status: string;
  store: { id: string; name: string };
  order: { orderNumber: string; placedAt: string; currencyCode: string; currency: { minorUnit: number } };
  totalMinor: string;
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

function safeStoreImagePreviewUrl(value: string): string | undefined {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

async function loadStoreInventory(storeId: string): Promise<InventoryRow[]> {
  const rows: InventoryRow[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  do {
    if (cursor) {
      if (seenCursors.has(cursor)) throw new Error("The inventory response contained a repeated cursor.");
      seenCursors.add(cursor);
    }

    const params = new URLSearchParams({ storeId });
    if (cursor) params.set("cursor", cursor);
    const page = await readJson<unknown>(
      await fetch(`/api/seller/inventory?${params.toString()}`, { cache: "no-store" })
    );
    if (!page || typeof page !== "object") throw new Error("The inventory response was invalid.");

    const result = page as Record<string, unknown>;
    if (!Array.isArray(result.items) ||
      !(result.nextCursor === null || typeof result.nextCursor === "string")) {
      throw new Error("The inventory response was invalid.");
    }

    rows.push(...result.items as InventoryRow[]);
    cursor = result.nextCursor;
  } while (cursor);

  return rows;
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
  const [recentOrders, setRecentOrders] = useState<RecentSellerOrder[]>([]);
  const [recentOrdersLoading, setRecentOrdersLoading] = useState(false);
  const [recentOrdersError, setRecentOrdersError] = useState("");
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [analyticsRangeDays, setAnalyticsRangeDays] = useState<7 | 30 | 90>(30);
  const [selectedSalesCurrency, setSelectedSalesCurrency] = useState("");
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [shippingMarketId, setShippingMarketId] = useState("");
  const [shippingCurrencyCode, setShippingCurrencyCode] = useState("");
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
  const [registrationCountryCode, setRegistrationCountryCode] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [registrationAuthority, setRegistrationAuthority] = useState("");
  const [registrationDate, setRegistrationDate] = useState("");
  const [registeredAddress, setRegisteredAddress] = useState("");
  const [taxIdentificationNumber, setTaxIdentificationNumber] = useState("");
  const [businessWebsite, setBusinessWebsite] = useState("");
  const [businessRegistrationDocumentFileId, setBusinessRegistrationDocumentFileId] = useState("");
  const [businessRegistrationDocumentName, setBusinessRegistrationDocumentName] = useState("");
  const [taxCertificateDocumentFileId, setTaxCertificateDocumentFileId] = useState("");
  const [taxCertificateDocumentName, setTaxCertificateDocumentName] = useState("");
  const [proofOfAddressDocumentFileId, setProofOfAddressDocumentFileId] = useState("");
  const [proofOfAddressDocumentName, setProofOfAddressDocumentName] = useState("");
  const [sellerLatitude, setSellerLatitude] = useState<number | null>(null);
  const [sellerLongitude, setSellerLongitude] = useState<number | null>(null);
  const [sellerLocation, setSellerLocation] = useState<{
    governorate?: string; district?: string; subdistrict?: string; city?: string;
    localityId?: string; neighborhood?: string; streetAddress?: string;
  }>({});
  const [storeName, setStoreName] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [editingStoreProfile, setEditingStoreProfile] = useState(false);
  const [editingStoreName, setEditingStoreName] = useState("");
  const [editingStoreSlug, setEditingStoreSlug] = useState("");
  const [editingStoreDescription, setEditingStoreDescription] = useState("");
  const [editingStorePublicPhone, setEditingStorePublicPhone] = useState("");
  const [editingStorePublicAddress, setEditingStorePublicAddress] = useState("");
  const [editingStoreLogoUrl, setEditingStoreLogoUrl] = useState("");
  const [editingStoreBannerUrl, setEditingStoreBannerUrl] = useState("");
  const [editingStoreLogoStorageKey, setEditingStoreLogoStorageKey] = useState("");
  const [editingStoreBannerStorageKey, setEditingStoreBannerStorageKey] = useState("");
  const [storeLogoDeleteToken, setStoreLogoDeleteToken] = useState("");
  const [storeBannerDeleteToken, setStoreBannerDeleteToken] = useState("");
  const [storeStagedDeleteTokens, setStoreStagedDeleteTokens] = useState<string[]>([]);
  const [editingShippingPolicy, setEditingShippingPolicy] = useState("");
  const [editingReturnsPolicy, setEditingReturnsPolicy] = useState("");
  const [editingPrivacyPolicy, setEditingPrivacyPolicy] = useState("");
  const [editingTermsOfSale, setEditingTermsOfSale] = useState("");
  const [storeMediaUploading, setStoreMediaUploading] = useState<"logo" | "banner" | "">("");
  const [shippingContactName, setShippingContactName] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [shippingAddressLine1, setShippingAddressLine1] = useState("");
  const [shippingAddressLine2, setShippingAddressLine2] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingRegionAddress, setShippingRegionAddress] = useState("");
  const [shippingPostalCode, setShippingPostalCode] = useState("");
  const [shippingCountryCode, setShippingCountryCode] = useState("");
  const [shippingInstructions, setShippingInstructions] = useState("");

  const [warehouseName, setWarehouseName] = useState("");
  const [warehouseCode, setWarehouseCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authenticationRequired, setAuthenticationRequired] = useState(false);
  const [mfaEnrollmentRequired, setMfaEnrollmentRequired] = useState(false);
  const [mfaVerificationRequired, setMfaVerificationRequired] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear editors and form values scoped to the previous store.
    setEditingStoreProfile(false);
    setEditingShippingRateId("");
    setShippingMarketId("");
    setShippingCurrencyCode("");
    setShippingName("");
    setShippingDescription("");
    setShippingAmount("0");
    setShippingRegion("");
    setShippingMinDays("");
    setShippingMaxDays("");
  }, [selectedStoreId]);

  const reload = useCallback(async () => {
    const data = await readJson<Workspace>(await fetch("/api/seller/stores", { cache: "no-store" }));
    setWorkspace(data);
    if (!selectedStoreId && data.stores[0]) {
      setSelectedStoreId(data.stores[0].id);
      try {
        localStorage.setItem("mtjr.activeStoreId", data.stores[0].id); window.dispatchEvent(new Event("mtjr:active-store-changed"));
      } catch {
        // The workspace must remain usable when browser storage is unavailable.
      }
    }
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
      let preferredStoreId = "";
      try { preferredStoreId = localStorage.getItem("mtjr.activeStoreId") ?? ""; } catch { /* Storage can be unavailable in restricted browsers. */ }
      const initialStore = sellerResult.stores.find((store) => store.id === preferredStoreId) ?? sellerResult.stores[0];
      if (initialStore) { setSelectedStoreId(initialStore.id); try { localStorage.setItem("mtjr.activeStoreId", initialStore.id); window.dispatchEvent(new Event("mtjr:active-store-changed")); } catch { /* Storage can be unavailable in restricted browsers. */ } }
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) {
        setAuthenticationRequired(true);
        return;
      }
      if (cause instanceof ApiError && /multi-factor authentication enrollment is required/i.test(cause.message)) { setMfaEnrollmentRequired(true); return; }
      if (cause instanceof ApiError && /multi-factor authentication is required or has expired/i.test(cause.message)) { setMfaVerificationRequired(true); return; }
      setError(cause instanceof Error ? cause.message : translate(locale, "The seller workspace could not be loaded.", "تعذر تحميل مساحة عمل البائع."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [locale]);

  useEffect(() => {
    if (!selectedStoreId) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear shipping rates belonging to the previously selected store.
    setShippingRates([]);
    fetch(`/api/seller/shipping-rates?storeId=${encodeURIComponent(selectedStoreId)}`, { cache: "no-store" })
      .then((r) => readJson<{ rates: ShippingRate[] }>(r))
      .then((data) => { if (active) setShippingRates(data.rates); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : translate(locale, "Shipping rates could not be loaded.", "تعذر تحميل أسعار الشحن.")); });
    void Promise.resolve().then(() => {
      if (!active) return;
      setInventory([]);
      setInventoryLoading(true);
      setInventoryError("");
      return loadStoreInventory(selectedStoreId)
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
      setSellerAnalytics(null);
      setRecentOrders([]);
      setAnalyticsLoading(true);
      setAnalyticsError("");
      const rangeTo = new Date();
      rangeTo.setUTCHours(0, 0, 0, 0);
      const rangeFrom = new Date(rangeTo);
      rangeFrom.setUTCDate(rangeFrom.getUTCDate() - (analyticsRangeDays - 1));
      const analyticsParams = new URLSearchParams({
        storeId: selectedStoreId,
        from: rangeFrom.toISOString().slice(0, 10),
        to: rangeTo.toISOString().slice(0, 10)
      });
      return fetch(`/api/seller/analytics?${analyticsParams.toString()}`, { cache: "no-store" })
        .then((response) => readJson<SellerAnalytics>(response))
        .then((data) => {
          if (!active) return;
          setSellerAnalytics(data);
          setSelectedSalesCurrency((current) =>
            data.metrics.grossSalesByCurrency.some((entry) => entry.currencyCode === current)
              ? current
              : (data.metrics.grossSalesByCurrency.find((entry) => entry.currencyCode === "SYP")
                ?? data.metrics.grossSalesByCurrency[0])?.currencyCode ?? ""
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
  }, [locale, selectedStoreId, analyticsRangeDays]);

  useEffect(() => {
    let active = true;
    if (!selectedStoreId || !sellerAnalytics?.permissions.orders) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- remove stale recent orders when the selected store has no order permission.
      setRecentOrders([]);
      setRecentOrdersLoading(false);
      setRecentOrdersError("");
      return () => { active = false; };
    }
    setRecentOrders([]);
    setRecentOrdersLoading(true);
    setRecentOrdersError("");
    fetch(`/api/seller/orders?storeId=${encodeURIComponent(selectedStoreId)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { orders?: RecentSellerOrder[]; error?: string };
        if (!response.ok) throw new Error(data.error || translate(locale, "Recent orders could not be loaded.", "تعذر تحميل الطلبات الأخيرة."));
        return data.orders ?? [];
      })
      .then((orders) => {
        if (active) setRecentOrders(orders.filter((order) => order.store.id === selectedStoreId).slice(0, 5));
      })
      .catch((cause: unknown) => {
        if (active) setRecentOrdersError(cause instanceof Error ? cause.message : translate(locale, "Recent orders could not be loaded.", "تعذر تحميل الطلبات الأخيرة."));
      })
      .finally(() => { if (active) setRecentOrdersLoading(false); });
    return () => { active = false; };
  }, [locale, selectedStoreId, sellerAnalytics?.permissions.orders]);



  async function uploadSellerIdentityDocument(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size <= 0 || file.size > 4 * 1024 * 1024) {
      setError(translate(locale, "Choose an image no larger than 4 MB.", "اختر صورة لا يتجاوز حجمها 4 ميغابايت."));
      input.value = "";
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const body = new FormData();
      body.append("file", file);
      const result = await readJson<{ fileId: string }>(await fetch("/api/seller/applications/identity-document", { method: "POST", body }));
      setIdentityDocumentFileId(result.fileId);
      setIdentityDocumentName(file.name);
      setMessage(translate(locale, "Private identity document uploaded.", "تم رفع وثيقة الهوية إلى مساحة تخزين خاصة."));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate(locale, "The identity document could not be uploaded.", "تعذر رفع وثيقة الهوية."));
    } finally {
      input.value = "";
      setBusy(false);
    }
  }

  async function uploadSellerVerificationDocument(
    event: ChangeEvent<HTMLInputElement>,
    documentType: "businessRegistration" | "taxCertificate" | "proofOfAddress"
  ) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      setError(translate(locale, "Choose a PDF, JPG, PNG, WebP or AVIF document.", "اختر مستنداً بصيغة PDF أو JPG أو PNG أو WebP أو AVIF."));
      input.value = "";
      return;
    }
    if (file.size <= 0 || file.size > 8 * 1024 * 1024) {
      setError(translate(locale, "Business documents must be 8 MB or smaller.", "يجب ألا يتجاوز حجم المستند 8 ميغابايت."));
      input.value = "";
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("documentType", documentType);
      const result = await readJson<{ fileId: string }>(await fetch("/api/seller/applications/documents", { method: "POST", body }));
      if (documentType === "businessRegistration") {
        setBusinessRegistrationDocumentFileId(result.fileId);
        setBusinessRegistrationDocumentName(file.name);
      } else if (documentType === "taxCertificate") {
        setTaxCertificateDocumentFileId(result.fileId);
        setTaxCertificateDocumentName(file.name);
      } else {
        setProofOfAddressDocumentFileId(result.fileId);
        setProofOfAddressDocumentName(file.name);
      }
      setMessage(translate(locale, "Private verification document uploaded and ready to attach.", "تم رفع مستند التحقق بشكل خاص وأصبح جاهزاً للإرفاق."));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate(locale, "The business document could not be uploaded.", "تعذر رفع مستند النشاط."));
    } finally {
      input.value = "";
      setBusy(false);
    }
  }

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
      if (cause instanceof ApiError && /MFA_ENROLLMENT_REQUIRED|multi-factor authentication setup/i.test(cause.message)) { setMfaEnrollmentRequired(true); return; }
      if (cause instanceof ApiError && /MFA_VERIFICATION_REQUIRED|verify your multi-factor authentication/i.test(cause.message)) { setMfaVerificationRequired(true); return; }
      setError(cause instanceof Error ? cause.message : translate(locale, "The request failed.", "تعذر إكمال الطلب."));
    } finally { setBusy(false); }
  }

  async function saveShippingDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStore?.isOwner) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await readJson(await fetch(`/api/seller/stores/${encodeURIComponent(selectedStore.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedStore.name, slug: selectedStore.slug,
          shippingContactName: shippingContactName.trim() || null,
          shippingPhone: shippingPhone.trim() || null,
          shippingAddressLine1: shippingAddressLine1.trim() || null,
          shippingAddressLine2: shippingAddressLine2.trim() || null,
          shippingCity: shippingCity.trim() || null,
          shippingRegion: shippingRegionAddress.trim() || null,
          shippingPostalCode: shippingPostalCode.trim() || null,
          shippingCountryCode: shippingCountryCode.trim().toUpperCase() || null,
          shippingInstructions: shippingInstructions.trim() || null
        })
      }));
      await reload();
      setMessage(translate(locale, "Shipping address and contact details saved.", "تم حفظ عنوان الشحن وبيانات التواصل."));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate(locale, "Shipping details could not be saved.", "تعذر حفظ بيانات الشحن."));
    } finally { setBusy(false); }
  }

  async function saveStoreProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStore) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await readJson(await fetch(`/api/seller/stores/${encodeURIComponent(selectedStore.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingStoreName, slug: editingStoreSlug,
          description: editingStoreDescription.trim() || null,
          publicPhone: editingStorePublicPhone.trim() || null,
          publicAddress: editingStorePublicAddress.trim() || null,
          logoUrl: editingStoreLogoUrl.trim() || null,
          bannerUrl: editingStoreBannerUrl.trim() || null,
          logoStorageKey: editingStoreLogoStorageKey || null,
          bannerStorageKey: editingStoreBannerStorageKey || null,
          shippingPolicy: editingShippingPolicy.trim() || null,
          returnsPolicy: editingReturnsPolicy.trim() || null,
          privacyPolicy: editingPrivacyPolicy.trim() || null,
          termsOfSale: editingTermsOfSale.trim() || null
        })
      }));
      await reload();
      const retainedTokens = new Set([storeLogoDeleteToken, storeBannerDeleteToken].filter(Boolean));
      await Promise.all(storeStagedDeleteTokens.filter((token) => !retainedTokens.has(token)).map((token) =>
        fetch("/api/seller/products/media", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId: selectedStore.id, deleteToken: token }) })
      ));
      setStoreStagedDeleteTokens([]); setStoreLogoDeleteToken(""); setStoreBannerDeleteToken("");
      setEditingStoreProfile(false);
      setMessage(translate(locale, "Store profile updated and recorded in the audit log.", "تم تحديث ملف المتجر وتسجيل التغيير في سجل التدقيق."));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate(locale, "Unable to update store profile.", "تعذر تحديث ملف المتجر."));
    } finally { setBusy(false); }
  }

  async function discardStoreProfileEdits() {
    if (selectedStore && storeStagedDeleteTokens.length) {
      await Promise.allSettled(storeStagedDeleteTokens.map((deleteToken) =>
        fetch("/api/seller/products/media", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storeId: selectedStore.id, deleteToken })
        })
      ));
    }
    setStoreStagedDeleteTokens([]);
    setStoreLogoDeleteToken("");
    setStoreBannerDeleteToken("");
    setEditingStoreProfile(false);
  }

  async function uploadStoreImage(event: ChangeEvent<HTMLInputElement>, kind: "logo" | "banner") {
    const file = event.target.files?.[0];
    if (!file || !selectedStore) return;
    event.target.value = "";
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      setError(translate(locale, "Choose a JPG, PNG, WebP or AVIF image.", "اختر صورة بصيغة JPG أو PNG أو WebP أو AVIF."));
      return;
    }
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
      setError(translate(locale, "Store images must be 10 MB or smaller.", "يجب ألا يتجاوز حجم صورة المتجر 10 ميغابايت."));
      return;
    }
    setStoreMediaUploading(kind); setError(""); setMessage("");
    try {
      const form = new FormData(); form.append("storeId", selectedStore.id); form.append("file", file);
      const response = await fetch("/api/seller/products/media", { method: "POST", body: form });
      const payload = await response.json() as { success?: boolean; data?: { url?: string; storageKey?: string; deleteToken?: string }; error?: string };
      if (!response.ok || !payload.success || !payload.data?.url) throw new Error(payload.error || translate(locale, "The image could not be uploaded.", "تعذر رفع الصورة."));
      if (payload.data.deleteToken) setStoreStagedDeleteTokens((tokens) => [...tokens, payload.data!.deleteToken!]);
      if (kind === "logo") { setEditingStoreLogoUrl(payload.data.url); setEditingStoreLogoStorageKey(payload.data.storageKey ?? ""); setStoreLogoDeleteToken(payload.data.deleteToken ?? ""); }
      else { setEditingStoreBannerUrl(payload.data.url); setEditingStoreBannerStorageKey(payload.data.storageKey ?? ""); setStoreBannerDeleteToken(payload.data.deleteToken ?? ""); }
      await reload();
      setMessage(translate(locale, "Image uploaded to your reusable store media library. Save the profile to apply it.", "تم رفع الصورة إلى مكتبة وسائط المتجر القابلة لإعادة الاستخدام. احفظ الملف لاعتمادها."));
    } catch (cause) { setError(cause instanceof Error ? cause.message : translate(locale, "The image could not be uploaded.", "تعذر رفع الصورة.")); }
    finally { setStoreMediaUploading(""); }
  }
  const selectedStore = workspace?.stores.find((store) => store.id === selectedStoreId);
  useEffect(() => {
    if (!selectedStore) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate the editable dispatch form from the selected store record.
    setShippingContactName(selectedStore.shippingContactName ?? "");
    setShippingPhone(selectedStore.shippingPhone ?? "");
    setShippingAddressLine1(selectedStore.shippingAddressLine1 ?? "");
    setShippingAddressLine2(selectedStore.shippingAddressLine2 ?? "");
    setShippingCity(selectedStore.shippingCity ?? "");
    setShippingRegionAddress(selectedStore.shippingRegion ?? "");
    setShippingPostalCode(selectedStore.shippingPostalCode ?? "");
    setShippingCountryCode(selectedStore.shippingCountryCode ?? "");
    setShippingInstructions(selectedStore.shippingInstructions ?? "");
  }, [selectedStoreId, workspace]);

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
  const minorUnitsToInput = (amountMinor: string, minorUnit: number) => { const amount = BigInt(amountMinor); const scale = BigInt(10) ** BigInt(minorUnit); const whole = amount / scale; return minorUnit === 0 ? whole.toString() : whole.toString() + "." + (amount % scale).toString().padStart(minorUnit, "0"); };
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

  const registrationRequired = businessType === "STORE" || businessType === "AGENCY";
  const applicationChecklist = [
    { id: "seller-application-step-applicant", label: translate(locale, "Applicant and store profile", "بيانات البائع والمتجر"), icon: "user" as const, complete: Boolean(legalName.trim() && displayName.trim() && contactName.trim() && contactEmail.trim() && phoneNumber.trim()) },
    { id: "seller-application-step-registration", label: translate(locale, "Business registration", "التسجيل التجاري"), icon: "document" as const, complete: !registrationRequired || Boolean(registrationCountryCode.trim() && registrationNumber.trim()), required: registrationRequired },
    { id: "seller-application-step-products", label: translate(locale, "Products and selling plan", "المنتجات وخطة البيع"), icon: "catalog" as const, complete: Boolean(sellingCategories.trim() && intendedProducts.trim().length >= 20) },
    { id: "seller-application-step-location", label: translate(locale, "Business location", "موقع النشاط"), icon: "pin" as const, complete: sellerLatitude !== null && sellerLongitude !== null }
  ];
  const requiredApplicationChecklist = applicationChecklist.filter((item) => item.required !== false);
  const completedApplicationSteps = requiredApplicationChecklist.filter((item) => item.complete).length;
  const applicationProgress = Math.round((completedApplicationSteps / requiredApplicationChecklist.length) * 100);
  const applicationSteps = [
    { id: applicationChecklist[0].id, label: translate(locale, "Applicant", "مقدم الطلب"), icon: "user" as const },
    { id: applicationChecklist[1].id, label: translate(locale, "Registration", "التسجيل"), icon: "document" as const },
    { id: applicationChecklist[2].id, label: translate(locale, "Products", "المنتجات"), icon: "catalog" as const },
    { id: applicationChecklist[3].id, label: translate(locale, "Location", "الموقع"), icon: "pin" as const },
    { id: "seller-application-step-online", label: translate(locale, "Online profile", "الحضور الرقمي"), icon: "globe" as const }
  ];

  const previewBannerUrl = safeStoreImagePreviewUrl(editingStoreBannerUrl);
  const previewLogoUrl = safeStoreImagePreviewUrl(editingStoreLogoUrl);

    if (!loading && workspace?.seller?.status === "PENDING") {
    const application = workspace.seller;
    return (
      <main dir={locale === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-[#fffaf6] px-4 py-8 text-[#454545] sm:px-6">
        <section className="seller-application-status mx-auto max-w-6xl overflow-hidden rounded-[1.75rem]">
          <header className="bg-[linear-gradient(110deg,#fff6ef_0%,#ffffff_58%,#fff1e8_100%)] p-6 text-[#454545] sm:p-9">
            <p className="text-[10px] font-extrabold tracking-[.2em] text-[#a94308]">{translate(locale, "SELLER APPLICATION", "طلب فتح متجر")}</p>
            <h1 className="mt-3 flex items-center gap-3 text-3xl font-black"><span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-[#f6d8c5] bg-[#fff1e8] text-[#FF8C1C]"><SellerIcon name="document" /></span>{translate(locale, "Your application is under review", "طلبك قيد المراجعة")}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#77716c]">{translate(locale, "Your application has been received. The marketplace team will review your business details before enabling store operations.", "تم استلام طلبك. سيراجع فريق المنصة بيانات نشاطك قبل تفعيل عمليات المتجر.")}</p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900"><span className="size-2 rounded-full bg-amber-300"/>{translate(locale, "Pending review", "بانتظار المراجعة")}</div>
          </header>
          <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-8">
            <section className="rounded-2xl border border-[#eee9e4] bg-white p-5">
              <h2 className="flex items-center gap-2 text-lg font-black"><SellerIcon name="user" />{translate(locale, "Applicant profile", "ملف مقدم الطلب")}</h2>
              <dl className="mt-4 grid gap-3 text-sm">
                <div><dt className="text-xs text-[#918a84]">{translate(locale, "Full legal name", "الاسم القانوني")}</dt><dd className="mt-1 font-semibold">{application.legalName || "—"}</dd></div>
                <div><dt className="text-xs text-[#918a84]">{translate(locale, "Store / business", "اسم المتجر أو النشاط")}</dt><dd className="mt-1 font-semibold">{application.displayName || "—"}</dd></div>
                <div><dt className="text-xs text-[#918a84]">{translate(locale, "Contact person", "الشخص المسؤول")}</dt><dd className="mt-1">{application.contactName || "—"}</dd></div>
                <div><dt className="text-xs text-[#918a84]">{translate(locale, "Email / phone", "البريد والهاتف")}</dt><dd dir="ltr" className="mt-1 text-left">{application.contactEmail || "—"} · {application.phoneNumber || "—"}</dd></div>
                <div><dt className="text-xs text-[#918a84]">{translate(locale, "Address", "العنوان")}</dt><dd className="mt-1">{application.residence || "—"}</dd></div>
                <div><dt className="text-xs text-[#918a84]">{translate(locale, "Business type", "نوع النشاط")}</dt><dd className="mt-1">{application.businessType || "—"}</dd></div>
                <div><dt className="text-xs text-[#918a84]">{translate(locale, "Registration country / number", "بلد ورقم التسجيل")}</dt><dd className="mt-1" dir="ltr">{application.registrationCountryCode || "—"} · {application.registrationNumber || "—"}</dd></div>
                <div><dt className="text-xs text-[#918a84]">{translate(locale, "Registration authority", "جهة التسجيل")}</dt><dd className="mt-1">{application.registrationAuthority || "—"}</dd></div>
                <div><dt className="text-xs text-[#918a84]">{translate(locale, "Registration date", "تاريخ التسجيل")}</dt><dd className="mt-1">{application.registrationDate ? new Date(application.registrationDate).toLocaleDateString(locale === "ar" ? "ar" : "en") : "—"}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs text-[#918a84]">{translate(locale, "Registered address", "العنوان المسجل")}</dt><dd className="mt-1">{application.registeredAddress || "—"}</dd></div>
                <div><dt className="text-xs text-[#918a84]">{translate(locale, "Tax ID", "الرقم الضريبي")}</dt><dd className="mt-1">{application.taxIdentificationNumber || "—"}</dd></div>
                {application.businessWebsite && <div className="sm:col-span-2"><dt className="text-xs text-[#918a84]">{translate(locale, "Business website", "موقع النشاط")}</dt><dd className="mt-1 break-all" dir="ltr"><a href={application.businessWebsite} target="_blank" rel="noreferrer" className="underline">{application.businessWebsite}</a></dd></div>}
                <div className="sm:col-span-2 flex flex-wrap gap-3 text-xs">
                  {application.hasBusinessRegistrationDocument && <span className="font-semibold text-emerald-700">{translate(locale, "Registration certificate attached", "شهادة السجل التجاري مرفقة")}</span>}
                  {application.hasTaxCertificateDocument && <span className="font-semibold text-emerald-700">{translate(locale, "Tax certificate attached", "الشهادة الضريبية مرفقة")}</span>}
                  {application.hasProofOfAddressDocument && <span className="font-semibold text-emerald-700">{translate(locale, "Address proof attached", "إثبات العنوان مرفق")}</span>}
                </div>
              </dl>
            </section>
            <section className="rounded-2xl border border-[#eee9e4] bg-white p-5">
              <h2 className="flex items-center gap-2 text-lg font-black"><SellerIcon name="catalog" />{translate(locale, "Products and selling plan", "المنتجات وخطة البيع")}</h2>
              <p className="mt-3 text-sm font-bold text-[#a94308]">{application.sellingCategories || "—"}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#77716c]">{application.intendedProducts || "—"}</p>
              {application.description && <p className="mt-4 border-t border-[#eee9e4] pt-4 text-sm leading-7 text-[#77716c]">{application.description}</p>}
              <div className="mt-4 flex flex-wrap gap-3 text-xs">
                {application.facebookUrl && <a href={application.facebookUrl} target="_blank" rel="noreferrer" className="underline">Facebook</a>}
                {application.youtubeUrl && <a href={application.youtubeUrl} target="_blank" rel="noreferrer" className="underline">YouTube</a>}
                {application.twitterUrl && <a href={application.twitterUrl} target="_blank" rel="noreferrer" className="underline">X</a>}
              </div>
              {application.latitude !== null && application.longitude !== null && <p dir="ltr" className="mt-4 text-left text-xs text-[#918a84]">{application.latitude.toFixed(5)}, {application.longitude.toFixed(5)}</p>}
            </section>
            <p className="flex items-center gap-2 border-t border-[#eee9e4] pt-4 text-xs text-[#77716c] sm:col-span-2"><SellerIcon name="document" />{translate(locale, "Submitted", "تاريخ التقديم")}: {new Date(application.createdAt).toLocaleString(locale === "ar" ? "ar" : "en")}</p>
          </div>
        </section>
      </main>
    );
  }




  return (
    <main className="min-h-screen bg-[#fffaf6] text-[#454545]">
      <div className="mx-auto w-full max-w-[1680px] px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <section className="seller-overview-hero relative mb-7 min-h-[220px] overflow-hidden rounded-[2rem] border border-[#eee9e4] bg-white p-5 text-[#454545] shadow-[0_12px_28px_rgba(69,69,69,.07)] sm:p-7 lg:p-8">
          {selectedStore?.bannerUrl && <img src={selectedStore.bannerUrl} alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover opacity-25" />}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(100deg,rgba(255,250,246,.96),rgba(255,255,255,.90)_52%,rgba(255,241,232,.92))]" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 size-64 rounded-full bg-[#f6d8c5]/55 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-[34%] size-72 rounded-full bg-[#f6d8c5]/35 blur-3xl" />
          <div className="relative z-10 grid min-w-0 items-center gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex min-w-0 items-center gap-4 sm:gap-6">
              <div className="grid size-[76px] shrink-0 place-items-center overflow-hidden rounded-[1.7rem] border border-[#f6d8c5] bg-[#fff1e8] text-3xl font-black text-[#a94308] shadow-[0_8px_18px_rgba(255,140,28,.10)] sm:size-24 sm:text-4xl">
                {selectedStore?.logoUrl ? <img src={selectedStore.logoUrl} alt={selectedStore.name} className="size-full object-cover" /> : (selectedStore?.name ?? workspace?.seller?.displayName ?? "M").trim().slice(0,1).toLocaleUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[.22em] text-[#918a84]">{translate(locale, "MATJAR · SELLER STUDIO", "متجر · استوديو البائع")}</p>
                <h1 className="mt-2 text-2xl font-black tracking-tight text-[#454545] sm:text-3xl">{selectedStore?.name ?? translate(locale, "Welcome back to your store", "أهلاً بعودتك إلى متجرك")}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#77716c]">{selectedStore?.description || (selectedStore ? translate(locale, "Your store is ready. Review today's activity, manage your catalog and keep customer orders moving.", "متجرك جاهز. راجع نشاط اليوم وأدر منتجاتك وتابع طلبات العملاء.") : translate(locale, "Your seller workspace brings products, orders and store operations together.", "تجمع مساحة عمل البائع منتجاتك وطلباتك وعمليات متجرك في مكان واحد."))}</p>
                {selectedStore && <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#eee9e4] bg-white px-3 py-1.5 text-xs font-bold text-[#5f5a55] shadow-[inset_0_1px_0_white]">
                    <span className="size-2 shrink-0 rounded-full bg-[#62a9a0]" />
                    <span className="shrink-0 text-[#918a84]">{translate(locale, "Active store", "المتجر النشط")}</span>
                    {(workspace?.stores.length ?? 0) > 1 ? <select aria-label={translate(locale, "Choose active store", "اختر المتجر النشط")} value={selectedStoreId} onChange={(event) => { setSelectedStoreId(event.target.value); try { localStorage.setItem("mtjr.activeStoreId", event.target.value); window.dispatchEvent(new Event("mtjr:active-store-changed")); } catch { /* Storage can be unavailable in restricted browsers. */ } }} className="max-w-[190px] bg-transparent font-extrabold text-[#454545] outline-none">{(workspace?.stores ?? []).map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select> : <span className="truncate">{selectedStore.name}</span>}
                  </label>
                  <StatusBadge locale={locale} status={selectedStore.status} />
                </div>}
                {selectedStore && (selectedStore.publicPhone || selectedStore.publicAddress) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedStore.publicPhone && <a href={`tel:${selectedStore.publicPhone.replace(/[^+\\d]/g, "")}`} dir="ltr" className="inline-flex items-center gap-2 rounded-full border border-white/90 bg-white/55 px-3 py-1.5 text-xs font-semibold text-[#5f5a55] shadow-[inset_0_1px_0_white]"><span aria-hidden="true">☎</span>{selectedStore.publicPhone}</a>}
                    {selectedStore.publicAddress && <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/90 bg-white/55 px-3 py-1.5 text-xs font-semibold text-[#5f5a55] shadow-[inset_0_1px_0_white]"><span aria-hidden="true">⌖</span><span className="truncate">{selectedStore.publicAddress}</span></span>}
                  </div>
                )}
              </div>
            </div>
            <div className="relative z-10 flex flex-wrap gap-3 lg:justify-end">
              {selectedStore && <Link href="/seller/products#create-product" className="inline-flex items-center justify-center gap-2 rounded-full border border-[#FF8C1C] bg-[#FF8C1C] px-5 py-3 text-sm font-extrabold text-white shadow-[0_7px_16px_rgba(255,140,28,.18)] transition hover:-translate-y-0.5 hover:bg-[#E8750B]"><span aria-hidden="true" className="text-lg leading-none">＋</span>{translate(locale, "Create product", "إنشاء منتج")}</Link>}
              <Link href="/seller/orders" className="seller-overview-secondary-action inline-flex items-center justify-center rounded-full border border-[#eee9e4] bg-white px-5 py-3 text-sm font-bold text-[#454545] shadow-[0_4px_12px_rgba(69,69,69,.06)] transition hover:-translate-y-0.5">{translate(locale, "View orders", "عرض الطلبات")}</Link>
              {selectedStore?.isOwner && <Link href="/seller#store-management" className="seller-overview-secondary-action inline-flex items-center justify-center rounded-full border border-[#eee9e4] bg-white px-5 py-3 text-sm font-bold text-[#454545] shadow-[0_4px_12px_rgba(69,69,69,.06)] transition hover:-translate-y-0.5">{translate(locale, "Edit store", "تعديل المتجر")}</Link>}
            </div>
          </div>
        </section>
        {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {message && <p role="status" className="mt-6 rounded-xl border border-[var(--color-sage-500)] bg-[var(--color-sage-100)] px-4 py-3 text-sm text-[var(--color-forest-950)]">{message}</p>}
        {loading ? <p className="py-16 text-sm text-[var(--muted)]">{translate(locale, "Loading your workspace…", "جارٍ تحميل مساحة عملك…")}</p> : mfaEnrollmentRequired ? (<section className="mt-8 max-w-2xl rounded-3xl border bg-white p-6 sm:p-8"><h2 className="text-xl font-semibold">{translate(locale, "Secure your seller account", "أمّن حساب البائع")}</h2><p className="mt-2 text-sm text-[var(--muted)]">{translate(locale, "Your seller application has been approved. Set up multi-factor authentication to continue.", "تمت الموافقة على طلبك. أعد إعداد المصادقة متعددة العوامل للمتابعة.")}</p><Link href="/account/security?mfa=setup&returnTo=%2Fseller" className="mt-6 inline-flex rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white">{translate(locale, "Set up multi-factor authentication", "إعداد المصادقة متعددة العوامل")}</Link></section>) : mfaVerificationRequired ? (<section className="mt-8 max-w-2xl rounded-3xl border bg-white p-6 sm:p-8"><h2 className="text-xl font-semibold">{translate(locale, "Verify your seller account", "تحقق من حساب البائع")}</h2><p className="mt-2 text-sm text-[var(--muted)]">{translate(locale, "Your authenticator is enabled, but this session needs a fresh verification. Verify once and you will return to your seller workspace.", "تطبيق المصادقة مفعّل، لكن جلستك تحتاج إلى تحقق جديد. أكمل التحقق وستعود تلقائياً إلى لوحة البائع.")}</p><Link href="/account/security?mfa=verify&returnTo=%2Fseller" className="mt-6 inline-flex rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white">{translate(locale, "Verify and continue", "تحقق وتابع")}</Link></section>) : authenticationRequired ? (
          <section className="mt-8 max-w-2xl rounded-[1.75rem] border border-white/80 bg-[linear-gradient(145deg,#f5f2fb,#e3e2ef)] p-6 shadow-[0_12px_28px_rgba(74,75,112,.10),inset_0_1px_0_white] sm:p-8">
            <h2 className="text-xl font-semibold">{translate(locale, "Sign in to continue", "سجّل الدخول للمتابعة")}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{translate(locale, "Sign in or create an account to apply to sell and manage your stores.", "سجّل الدخول أو أنشئ حسابًا للتقدم للبيع وإدارة متاجرك.")}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <AuthReturnLink href="/login" className="rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white">{translate(locale, "Sign in", "تسجيل الدخول")}</AuthReturnLink>
              <AuthReturnLink href="/register" className="rounded-xl border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--color-forest-900)]">{translate(locale, "Create account", "إنشاء حساب")}</AuthReturnLink>
            </div>
          </section>
        ) : (!workspace?.seller || workspace.seller.status === "REJECTED") ? (
          <section className="seller-application-form mt-8 max-w-6xl rounded-[1.75rem] p-4 sm:p-7">
              <div className="mb-6 rounded-2xl border border-[#eee9e4] bg-[linear-gradient(110deg,#fff6ef_0%,#ffffff_58%,#fff1e8_100%)] p-5 text-[#454545] shadow-[0_12px_28px_rgba(69,69,69,.07)] sm:p-7">
              <p className="text-[10px] font-extrabold tracking-[.2em] text-[#a94308]">{translate(locale,"SELLER APPLICATION","طلب فتح متجر")}</p>
                <h2 className="mt-2 flex items-center gap-3 text-2xl font-black tracking-tight"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#f6d8c5] bg-[#fff1e8] text-[#FF8C1C]"><SellerIcon name="store" /></span>{translate(locale, "Apply to become a seller", "تقدّم لتصبح بائعًا")}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#77716c]">{translate(locale,"A guided application for your business, products and store location. Complete each section so our marketplace team can review it.","طلب منظم للتعريف بنشاطك ومنتجاتك وموقع متجرك. أكمل الأقسام ليتمكن فريق السوق من مراجعة طلبك.")}</p>
                <nav aria-label={translate(locale, "Application sections", "أقسام الطلب")} className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {applicationSteps.map((step, index) => <a key={step.id} href={`#${step.id}`} className="flex min-w-0 items-center gap-2 rounded-xl border border-[#eee9e4] bg-white px-3 py-2.5 text-xs font-bold text-[#454545] transition hover:border-[#f6d8c5] hover:bg-[#fffaf6]">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#fff1e8] text-[#FF8C1C]"><SellerIcon name={step.icon} /></span>
                    <span className="min-w-0"><span className="block text-[9px] font-bold text-[#918a84]">0{index + 1}</span><span className="block truncate">{step.label}</span></span>
                  </a>)}
                </nav>
              </div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{workspace?.seller?.status === "REJECTED" ? translate(locale, "Your previous application was not approved. Review the feedback below, correct the information and submit it again.", "لم تتم الموافقة على طلبك السابق. راجع الملاحظات أدناه وصحح البيانات ثم أعد الإرسال.") : translate(locale, "Complete the business details below. Your application will remain pending until reviewed by the marketplace team.", "أكمل بيانات نشاطك التجاري أدناه. سيظل طلبك قيد المراجعة حتى يراجعه فريق السوق.")}</p>
            {workspace?.seller?.status === "REJECTED" && workspace.seller.rejectionReason && <div role="alert" className="mt-4 rounded-2xl border border-[#e7c6ce] bg-[linear-gradient(145deg,#f9e9ed,#f2dce3)] p-4 text-sm leading-7 text-[#75495a] shadow-[inset_0_1px_0_white]"><p className="font-extrabold">{translate(locale, "Reviewer feedback", "ملاحظات المراجع")}</p><p className="mt-1 whitespace-pre-wrap">{workspace.seller.rejectionReason}</p>{workspace.seller.reviewedAt && <p className="mt-2 text-xs text-[#987384]">{translate(locale, "Reviewed", "تاريخ المراجعة")}: {new Date(workspace.seller.reviewedAt).toLocaleString(locale === "ar" ? "ar" : "en")}</p>}</div>}
            <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <form onSubmit={(event) => {
              if (sellerLatitude === null || sellerLongitude === null) {
                event.preventDefault();
                setError(translate(locale, "Choose your business location on the map.", "حدد موقع نشاطك على الخريطة قبل الإرسال."));
                return;
              }
              void submit(event, "/api/seller/applications", {
                legalName, displayName, contactName, contactEmail, phoneNumber, residence, businessType,
                sellingCategories, intendedProducts, description: sellerDescription,
                facebookUrl, youtubeUrl, twitterUrl, identityDocumentFileId,
                registrationCountryCode, registrationNumber, registrationAuthority, registrationDate,
                registeredAddress, taxIdentificationNumber, businessWebsite,
                businessRegistrationDocumentFileId, taxCertificateDocumentFileId, proofOfAddressDocumentFileId,
                latitude: sellerLatitude, longitude: sellerLongitude
              }, "Your seller application has been submitted.");
            }} className="grid gap-5">
              <section id="seller-application-step-applicant" className="seller-application-section grid scroll-mt-24 gap-4 rounded-2xl border border-[#eee9e4] bg-white p-5">
                <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff1e8] text-[#FF8C1C]"><SellerIcon name="user" /></span><div><h3 className="font-extrabold text-[#454545]">{translate(locale, "01 · Applicant and business", "01 · بيانات البائع والنشاط")}</h3><p className="mt-1 text-xs text-[#77716c]">{translate(locale, "Your legal identity and public store details.", "بياناتك الشخصية واسم المتجر الذي سيظهر للعملاء.")}</p></div></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm">{translate(locale, "Full legal name", "الاسم الكامل كما في الهوية")}<input required minLength={2} maxLength={160} autoComplete="name" value={legalName} onChange={(e) => setLegalName(e.target.value)} className="rounded-2xl border border-white/90 bg-[#fffaf6] px-4 py-3 font-normal shadow-[inset_0_2px_5px_rgba(74,75,112,.08)]" /></label>
                  <label className="grid gap-1 text-sm">{translate(locale, "Store name", "اسم المتجر")}<input required minLength={2} maxLength={80} value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="rounded-2xl border border-[#eee9e4] bg-[#fffaf6] px-4 py-3 font-normal shadow-[inset_0_2px_5px_rgba(74,75,112,.08)]" /></label>
                  <label className="grid gap-1 text-sm">{translate(locale, "Contact person", "الشخص المسؤول")}<input required minLength={2} maxLength={120} value={contactName} onChange={(e) => setContactName(e.target.value)} className="rounded-2xl border border-white/90 bg-[#fffaf6] px-4 py-3 font-normal shadow-[inset_0_2px_5px_rgba(74,75,112,.08)]" /></label>
                  <label className="grid gap-1 text-sm">{translate(locale, "Contact email", "البريد الإلكتروني للتواصل")}<input required type="email" maxLength={254} autoComplete="email" dir="ltr" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="rounded-2xl border border-white/90 bg-[#fffaf6] px-4 py-3 text-left font-normal shadow-[inset_0_2px_5px_rgba(74,75,112,.08)]" /></label>
                  <label className="grid gap-1 text-sm">{translate(locale, "Phone number", "رقم الهاتف")}<input required type="tel" maxLength={25} autoComplete="tel" dir="ltr" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+963 9xx xxx xxx" className="rounded-2xl border border-white/90 bg-[#f5f2fb] px-4 py-3 text-left font-normal shadow-[inset_0_2px_5px_rgba(74,75,112,.08)]" /></label>
                  <label className="grid gap-1 text-sm">{translate(locale, "Business type", "نوع النشاط")}<select required value={businessType} onChange={(e) => setBusinessType(e.target.value)} className="rounded-2xl border border-white/90 bg-[#f5f2fb] px-4 py-3 font-normal shadow-[inset_0_2px_5px_rgba(74,75,112,.08)]"><option value="INDIVIDUAL">{translate(locale, "Individual seller", "بائع فردي")}</option><option value="STORE">{translate(locale, "Store or company", "متجر أو شركة")}</option><option value="ARTISAN">{translate(locale, "Artisan / maker", "حرفي أو صانع")}</option><option value="AGENCY">{translate(locale, "Agency / distributor", "وكالة أو موزع")}</option><option value="OTHER">{translate(locale, "Other", "أخرى")}</option></select></label>
                  <label className="grid gap-1 text-sm sm:col-span-2">{translate(locale, "Business address / residence", "عنوان النشاط أو مكان الإقامة")}<input required minLength={3} maxLength={240} value={residence} onChange={(e) => setResidence(e.target.value)} placeholder={translate(locale, "City, district, street", "المدينة، المنطقة، الشارع")} className="rounded-2xl border border-white/90 bg-[#f5f2fb] px-4 py-3 font-normal shadow-[inset_0_2px_5px_rgba(74,75,112,.08)]" /></label>
                </div>
              </section>
              <section id="seller-application-step-registration" className="seller-application-section grid scroll-mt-24 gap-4 rounded-2xl border border-[#e1e8f0] bg-white p-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff1e8] text-[#FF8C1C]"><SellerIcon name="document" /></span>
                  <div>
                  <h3 className="font-extrabold text-[#454545]">{translate(locale, "02 · Business registration and compliance", "02 · التسجيل التجاري والامتثال")}</h3>
                  <p className="mt-1 text-xs leading-6 text-[#918a84]">{translate(locale, "Registered companies and agencies must provide their legal registration details and certificate. Tax and address documents can be added where applicable. Files are private and visible only to authorized reviewers.", "يجب على الشركات والوكالات المسجلة إدخال بيانات تسجيلها القانوني وإرفاق الشهادة. يمكن إضافة المستند الضريبي وإثبات العنوان عند انطباقهما. تحفظ الملفات بشكل خاص ولا يطلع عليها إلا المراجعون المخولون.")}</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm">{translate(locale, "Registration country (ISO 2-letter code)", "بلد التسجيل (رمز من حرفين)")}<input required={businessType === "STORE" || businessType === "AGENCY"} minLength={2} maxLength={2} pattern="[A-Za-z]{2}" value={registrationCountryCode} onChange={(e) => setRegistrationCountryCode(e.target.value.toUpperCase())} placeholder="DE" dir="ltr" className="rounded-2xl border border-[#eee9e4] bg-[#fffaf6] px-4 py-3 text-left font-normal" /></label>
                  <label className="grid gap-1 text-sm">{translate(locale, "Commercial registration number", "رقم السجل التجاري")}<input required={businessType === "STORE" || businessType === "AGENCY"} maxLength={120} value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} className="rounded-2xl border border-[#eee9e4] bg-[#fffaf6] px-4 py-3 font-normal" /></label>
                  <label className="grid gap-1 text-sm">{translate(locale, "Registration authority", "جهة التسجيل")}<input maxLength={160} value={registrationAuthority} onChange={(e) => setRegistrationAuthority(e.target.value)} placeholder={translate(locale, "Chamber of commerce / company registry", "غرفة التجارة / سجل الشركات")} className="rounded-2xl border border-[#eee9e4] bg-[#fffaf6] px-4 py-3 font-normal" /></label>
                  <label className="grid gap-1 text-sm">{translate(locale, "Registration date", "تاريخ التسجيل")}<input type="date" value={registrationDate} onChange={(e) => setRegistrationDate(e.target.value)} className="rounded-2xl border border-[#eee9e4] bg-[#fffaf6] px-4 py-3 font-normal" /></label>
                  <label className="grid gap-1 text-sm sm:col-span-2">{translate(locale, "Registered legal address", "العنوان القانوني المسجل")}<input maxLength={500} value={registeredAddress} onChange={(e) => setRegisteredAddress(e.target.value)} className="rounded-2xl border border-[#eee9e4] bg-[#fffaf6] px-4 py-3 font-normal" /></label>
                  <label className="grid gap-1 text-sm">{translate(locale, "Tax identification number", "الرقم الضريبي")}<input maxLength={120} value={taxIdentificationNumber} onChange={(e) => setTaxIdentificationNumber(e.target.value)} className="rounded-2xl border border-[#eee9e4] bg-[#fffaf6] px-4 py-3 font-normal" /></label>
                  <label className="grid gap-1 text-sm">{translate(locale, "Business website", "الموقع الإلكتروني للنشاط")}<input type="url" maxLength={2048} dir="ltr" value={businessWebsite} onChange={(e) => setBusinessWebsite(e.target.value)} placeholder="https://example.com" className="rounded-2xl border border-[#eee9e4] bg-[#fffaf6] px-4 py-3 text-left font-normal" /></label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 rounded-2xl border border-dashed border-[#f0c7ad] bg-[#fffaf6] p-4 text-sm">
                    <span className="font-bold text-[#454545]">{translate(locale, "Business registration certificate", "شهادة السجل التجاري")} {businessType === "STORE" || businessType === "AGENCY" ? "*" : ""}</span>
                    <span className="text-xs text-[#918a84]">{businessRegistrationDocumentName || translate(locale, "PDF or image · up to 8 MB · private upload", "PDF أو صورة · حتى 8 ميغابايت · رفع خاص")}</span>
                    <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/avif" required={(businessType === "STORE" || businessType === "AGENCY") && !businessRegistrationDocumentFileId} onChange={(e) => void uploadSellerVerificationDocument(e, "businessRegistration")} disabled={busy} className="block w-full text-xs" />
                    {businessRegistrationDocumentFileId && <span className="text-xs font-semibold text-emerald-700">{translate(locale, "Certificate attached", "تم إرفاق الشهادة")}</span>}
                  </label>
                  <label className="grid gap-2 rounded-2xl border border-dashed border-[#f0c7ad] bg-[#fffaf6] p-4 text-sm">
                    <span className="font-bold text-[#454545]">{translate(locale, "Tax certificate (if applicable)", "الشهادة الضريبية (إن وجدت)")}</span>
                    <span className="text-xs text-[#918a84]">{taxCertificateDocumentName || translate(locale, "PDF or image · up to 8 MB · private upload", "PDF أو صورة · حتى 8 ميغابايت · رفع خاص")}</span>
                    <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/avif" onChange={(e) => void uploadSellerVerificationDocument(e, "taxCertificate")} disabled={busy} className="block w-full text-xs" />
                    {taxCertificateDocumentFileId && <span className="text-xs font-semibold text-emerald-700">{translate(locale, "Tax document attached", "تم إرفاق المستند الضريبي")}</span>}
                  </label>
                  <label className="grid gap-2 rounded-2xl border border-dashed border-[#f0c7ad] bg-[#fffaf6] p-4 text-sm sm:col-span-2">
                    <span className="font-bold text-[#454545]">{translate(locale, "Proof of registered address (optional)", "إثبات العنوان المسجل (اختياري)")}</span>
                    <span className="text-xs text-[#918a84]">{proofOfAddressDocumentName || translate(locale, "PDF or image · up to 8 MB · private upload", "PDF أو صورة · حتى 8 ميغابايت · رفع خاص")}</span>
                    <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/avif" onChange={(e) => void uploadSellerVerificationDocument(e, "proofOfAddress")} disabled={busy} className="block w-full text-xs" />
                    {proofOfAddressDocumentFileId && <span className="text-xs font-semibold text-emerald-700">{translate(locale, "Address proof attached", "تم إرفاق إثبات العنوان")}</span>}
                  </label>
                </div>
              </section>
              <section id="seller-application-step-products" className="seller-application-section grid scroll-mt-24 gap-4 rounded-2xl border border-[#e1e8f0] bg-white p-5">
                <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff1e8] text-[#FF8C1C]"><SellerIcon name="catalog" /></span><div><h3 className="font-extrabold text-[#454545]">{translate(locale, "03 · Products and selling plan", "03 · المنتجات وخطة البيع")}</h3><p className="mt-1 text-xs text-[#77716c]">{translate(locale, "Tell us what you plan to offer and where it comes from.", "أخبرنا عن المنتجات التي ستعرضها ومصدرها وخطة توفيرها.")}</p></div></div>
                <label className="grid gap-1 text-sm">{translate(locale, "Product categories", "فئات المنتجات")}<input required minLength={2} maxLength={300} value={sellingCategories} onChange={(e) => setSellingCategories(e.target.value)} placeholder={translate(locale, "Fashion, electronics, home, beauty…", "أزياء، إلكترونيات، منزل، تجميل...")} className="rounded-2xl border border-white/90 bg-[#f5f2fb] px-4 py-3 font-normal shadow-[inset_0_2px_5px_rgba(74,75,112,.08)]" /></label>
                <label className="grid gap-1 text-sm">{translate(locale, "Products and sales plan (at least 20 characters)", "المنتجات وخطة البيع (20 حرفاً على الأقل)")}<textarea required minLength={20} maxLength={4000} rows={4} value={intendedProducts} onChange={(e) => setIntendedProducts(e.target.value)} placeholder={translate(locale, "Examples, condition, sourcing, expected quantities and supply frequency…", "أمثلة المنتجات، حالتها، مصدرها، الكميات المتوقعة وتواتر التوريد...")} className="rounded-2xl border border-white/90 bg-[#f5f2fb] px-4 py-3 font-normal shadow-[inset_0_2px_5px_rgba(74,75,112,.08)]" /><span className="text-xs text-[#918a84]">{intendedProducts.length}/4000</span></label>
                <label className="grid gap-1 text-sm">{translate(locale, "About your business (optional)", "نبذة عن نشاطك (اختياري)")}<textarea maxLength={2000} rows={3} value={sellerDescription} onChange={(e) => setSellerDescription(e.target.value)} className="rounded-2xl border border-white/90 bg-[#f5f2fb] px-4 py-3 font-normal shadow-[inset_0_2px_5px_rgba(74,75,112,.08)]" /></label>
              </section>
              <section id="seller-application-step-location" className="seller-application-section grid scroll-mt-24 gap-4 rounded-2xl border border-[#e1e8f0] bg-white p-5">
                <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff1e8] text-[#FF8C1C]"><SellerIcon name="pin" /></span><div><h3 className="font-extrabold text-[#454545]">{translate(locale, "04 · Business location", "04 · موقع النشاط")}</h3><p className="mt-1 text-xs text-[#77716c]">{translate(locale, "Click or drag the pin to mark your business location.", "انقر على الخريطة أو اسحب الدبوس لتحديد موقع نشاطك بدقة.")}</p></div></div>
                <SyriaLocationPicker
                  locale={locale}
                  title={translate(locale, "Business location in Syria", "موقع النشاط في سوريا")}
                  value={{
                    ...sellerLocation,
                    ...(sellerLatitude !== null && sellerLongitude !== null
                      ? { latitude: sellerLatitude, longitude: sellerLongitude }
                      : {})
                  }}
                  onChange={(location) => {
                    setSellerLocation({
                      governorate: location.governorate,
                      district: location.district,
                      subdistrict: location.subdistrict,
                      city: location.city,
                      localityId: location.localityId,
                      neighborhood: location.neighborhood,
                      streetAddress: location.streetAddress
                    });
                    const addressParts = [
                      location.streetAddress, location.neighborhood, location.city,
                      location.subdistrict, location.district, location.governorate
                    ].filter((part): part is string => Boolean(part?.trim()));
                    setResidence(addressParts.join("، ").slice(0, 240));
                    setSellerLatitude(location.latitude ?? null);
                    setSellerLongitude(location.longitude ?? null);
                  }}
                />
                <p className="text-xs text-[#918a84]">{sellerLatitude === null || sellerLongitude === null ? translate(locale, "A map location is required.", "تحديد الموقع على الخريطة مطلوب.") : sellerLatitude.toFixed(5) + ", " + sellerLongitude.toFixed(5)}</p>
              </section>
              <section id="seller-application-step-online" className="seller-application-section grid scroll-mt-24 gap-4 rounded-2xl border border-[#e1e8f0] bg-white p-5">
                <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff1e8] text-[#FF8C1C]"><SellerIcon name="globe" /></span><div><h3 className="font-extrabold text-[#454545]">{translate(locale, "05 · Online presence", "05 · الحضور الرقمي")}</h3><p className="mt-1 text-xs text-[#77716c]">{translate(locale, "Optional links help us understand your business.", "روابط اختيارية تساعدنا على التعرف على نشاطك.")}</p></div></div>
                <label className="grid gap-2 rounded-2xl border border-dashed border-[#f0c7ad] bg-[#fffaf6] p-4 text-sm">
                  <span className="font-bold text-[#454545]">{translate(locale, "Identity document (optional)", "وثيقة الهوية (اختياري)")}</span>
                  <span className="text-xs text-[#918a84]">{identityDocumentName || translate(locale, "Upload JPG, PNG, WebP or AVIF · up to 4 MB. Stored privately for authorized review only.", "ارفع JPG أو PNG أو WebP أو AVIF · حتى 4 ميغابايت. تحفظ بشكل خاص للمراجعة من المسؤولين المخولين فقط.")}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={uploadSellerIdentityDocument} disabled={busy} className="block w-full text-xs" />
                  {identityDocumentFileId && <span className="text-xs font-semibold text-emerald-700">{translate(locale, "Private document attached to this application.", "تم إرفاق الوثيقة الخاصة بالطلب.")}</span>}
                </label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="grid gap-1 text-sm">Facebook<input type="url" maxLength={2048} dir="ltr" value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} placeholder="https://facebook.com/…" className="rounded-2xl border border-white/90 bg-[#f5f2fb] px-4 py-3 text-left font-normal shadow-[inset_0_2px_5px_rgba(74,75,112,.08)]" /></label>
                  <label className="grid gap-1 text-sm">YouTube<input type="url" maxLength={2048} dir="ltr" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/…" className="rounded-2xl border border-white/90 bg-[#f5f2fb] px-4 py-3 text-left font-normal shadow-[inset_0_2px_5px_rgba(74,75,112,.08)]" /></label>
                  <label className="grid gap-1 text-sm">X<input type="url" maxLength={2048} dir="ltr" value={twitterUrl} onChange={(e) => setTwitterUrl(e.target.value)} placeholder="https://x.com/…" className="rounded-2xl border border-white/90 bg-[#f5f2fb] px-4 py-3 text-left font-normal shadow-[inset_0_2px_5px_rgba(74,75,112,.08)]" /></label>
                </div>
              </section>
              <button disabled={busy} className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF8C1C] px-5 py-3 text-sm font-extrabold text-white shadow-[0_8px_18px_rgba(255,140,28,.18)] transition hover:bg-[#E8750B] disabled:opacity-50"><SellerIcon name="document" />{busy ? translate(locale, "Submitting…", "جارٍ الإرسال…") : translate(locale, "Submit application", "إرسال الطلب للمراجعة")}</button>
            </form>
              <aside className="space-y-4 lg:sticky lg:top-28">
                <section className="rounded-2xl border border-[#e1e8f0] bg-white p-5 shadow-[0_8px_22px_rgba(30,57,83,.06)]">
                  <div className="flex items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 text-sm font-extrabold text-[#454545]"><SellerIcon name="document" />{translate(locale, "Application checklist", "قائمة إكمال الطلب")}</h3><p className="mt-1 text-xs text-[#77716c]">{translate(locale, "{done} of {total} required sections complete", "اكتمل {done} من {total} أقسام مطلوبة").replace("{done}", String(completedApplicationSteps)).replace("{total}", String(requiredApplicationChecklist.length))}</p></div><span className="text-sm font-extrabold text-[#E8750B]">{applicationProgress}%</span></div>
                  <div role="progressbar" aria-label={translate(locale, "Required application progress", "تقدم الطلب")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={applicationProgress} className="mt-4 h-2 overflow-hidden rounded-full bg-[#f5eee7]"><span className="block h-full rounded-full bg-[#39bdb6] transition-[width]" style={{ width: `${applicationProgress}%` }} /></div>
                  <ul className="mt-4 space-y-3">
                    {requiredApplicationChecklist.map((step) => <li key={step.id}><a href={`#${step.id}`} className="flex items-center gap-3 text-xs font-semibold text-[#5f5a55] hover:text-[#E8750B]"><span className={`grid size-8 shrink-0 place-items-center rounded-lg ${step.complete ? "bg-[#e7f6f1] text-[#18815d]" : "bg-[#f1f5f9] text-[#77716c]"}`}><SellerIcon name={step.icon} /></span><span className="min-w-0 flex-1">{step.label}</span><span className="text-[10px]">{step.complete ? translate(locale, "Complete", "مكتمل") : translate(locale, "Required", "مطلوب")}</span></a></li>)}
                  </ul>
                </section>
                <section className="overflow-hidden rounded-2xl border border-[#dce5ee] bg-white shadow-[0_8px_22px_rgba(30,57,83,.06)]">
                  <div className="seller-application-preview-header bg-[linear-gradient(110deg,#fff6ef_0%,#ffffff_58%,#fff1e8_100%)] p-5 text-[#454545]"><p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.18em] text-[#a94308]"><SellerIcon name="store" />{translate(locale, "SELLER PROFILE PREVIEW", "معاينة ملف البائع")}</p><h3 className="mt-2 break-words text-xl font-black">{displayName.trim() || translate(locale, "Your new store", "متجرك الجديد")}</h3><p className="mt-1 text-sm text-white/75">{contactName.trim() || translate(locale, "Add your full name", "أضف اسمك الكامل")}</p></div>
                  <div className="space-y-4 p-5 text-sm text-[#657487]">
                    <div><p className="text-[10px] font-bold text-[#77716c]">{translate(locale, "LEGAL NAME", "الاسم القانوني")}</p><p className="mt-1 break-words font-semibold text-[#454545]">{legalName.trim() || "—"}</p></div>
                    <div><p className="text-[10px] font-bold text-[#77716c]">{translate(locale, "CONTACT EMAIL", "البريد الإلكتروني")}</p><p dir="ltr" className="mt-1 break-all text-left">{contactEmail.trim() || translate(locale, "Required", "مطلوب")}</p></div>
                    <div><p className="text-[10px] font-bold text-[#77716c]">{translate(locale, "PHONE", "الهاتف")}</p><p dir="ltr" className="mt-1 text-left">{phoneNumber.trim() || translate(locale, "Required", "مطلوب")}</p></div>
                    <div><p className="text-[10px] font-bold text-[#77716c]">{translate(locale, "PRODUCT CATEGORIES", "فئات المنتجات")}</p><p className="mt-1 break-words">{sellingCategories.trim() || translate(locale, "Categories you plan to sell", "فئات المنتجات التي ستبيعها")}</p></div>
                    <div><p className="text-[10px] font-bold text-[#77716c]">{translate(locale, "BUSINESS LOCATION", "موقع النشاط")}</p><p className="mt-1 break-words">{residence.trim() || translate(locale, "Add your address", "أضف عنوانك")}</p></div>
                  </div>
                </section>
                <section className="rounded-2xl border border-[#eee9e4] bg-[#fffaf6] p-5"><h3 className="flex items-center gap-2 text-sm font-extrabold text-[#454545]"><SellerIcon name="shield" />{translate(locale, "Your privacy matters", "خصوصيتك مهمة")}</h3><p className="mt-3 text-xs leading-6 text-[#77716c]">{translate(locale, "Your contact details and map location are used only to review your seller application. Identity documents are optional and stored privately for authorized reviewers.", "تُستخدم بيانات التواصل وموقع الخريطة لمراجعة طلبك فقط. وثيقة الهوية اختيارية وتُحفظ بشكل خاص ولا يطّلع عليها إلا المسؤولون المخولون.")}</p></section>
              </aside>
            </div>
          </section>
        ) : (
          <>
          {selectedStore && <>
            <section aria-label={translate(locale, "Store metrics", "مؤشرات المتجر")} className="seller-overview-metrics mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {sellerMetrics.map((metric, index) => {
                const surface = [
                  "bg-[#ffffff]",
                  "bg-[#fffaf6]",
                  "bg-[#f8f5fc]",
                  "bg-[#f2f8f4]",
                  "bg-[#fff7f0]",
                  "bg-[#f7f8fb]",
                  "bg-[#fbf8ed]",
                  "bg-[#f5f8f4]"
                ][index % 8];
                return (
                  <article key={metric.label} className={`group relative isolate overflow-hidden rounded-[1.8rem] border border-[#eee9e4] ${surface} p-5 shadow-[0_5px_16px_rgba(69,69,69,.05)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_12px_26px_rgba(69,69,69,.09)]`}>
                    <div className="flex items-center gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-[1rem] border border-white/75 bg-white/45 shadow-[0_5px_12px_rgba(35,62,81,.1),inset_0_1px_0_white]" style={{ color: metric.color }}>
                        <span aria-hidden="true" className="text-xl leading-none">{metric.icon}</span>
                      </span>
                      <h3 className="text-sm font-semibold text-[var(--color-onyx)]">{metric.label}</h3>
                    </div>
                    <p className={`mt-4 break-words font-black tracking-tight text-[var(--color-ink-950)] ${("compact" in metric && metric.compact) ? "text-xl sm:text-2xl" : "text-3xl"}`}>{metric.value}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{metric.description}</p>
                  </article>
                );
              })}
            </section>

            <section aria-label={translate(locale, "Seller quick actions", "إجراءات البائع السريعة")} className="seller-quick-actions mt-7">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-[#454545]">{translate(locale, "Run your store", "أدر متجرك بسرعة")}</h2>
                  <p className="mt-1 text-sm text-[#77716c]">{translate(locale, "Shortcuts to the daily tasks and financial tools connected to this store.", "اختصارات للمهام اليومية والأدوات المالية المرتبطة بهذا المتجر.")}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Link href="/seller/orders" className="group flex items-center gap-4 rounded-[1.45rem] border border-[#eee9e4] bg-white p-4 shadow-[0_5px_16px_rgba(69,69,69,.05)] transition hover:-translate-y-1">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#fff1e8] text-[#FF8C1C] shadow-[inset_0_1px_0_white]"><SellerIcon name="orders" /></span>
                  <span className="min-w-0"><strong className="block text-sm font-black text-[#454545]">{translate(locale, "Process orders", "معالجة الطلبات")}</strong><span className="mt-1 block text-xs text-[#77716c]">{translate(locale, "Review, prepare and ship customer orders.", "راجع طلبات العملاء وجهّزها واشحنها.")}</span></span>
                  <span className="ms-auto text-lg text-[#77716c] transition group-hover:translate-x-1" aria-hidden="true">↗</span>
                </Link>
                <Link href="/seller/products" className="group flex items-center gap-4 rounded-[1.45rem] border border-[#eee9e4] bg-white p-4 shadow-[0_5px_16px_rgba(69,69,69,.05)] transition hover:-translate-y-1">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#fff1e8] text-[#FF8C1C] shadow-[inset_0_1px_0_white]"><SellerIcon name="package" /></span>
                  <span className="min-w-0"><strong className="block text-sm font-black text-[#454545]">{translate(locale, "Manage products", "إدارة المنتجات")}</strong><span className="mt-1 block text-xs text-[#77716c]">{translate(locale, "Create products, update prices and manage media.", "أنشئ المنتجات وحدّث الأسعار وأدر الصور.")}</span></span>
                  <span className="ms-auto text-lg text-[#77716c] transition group-hover:translate-x-1" aria-hidden="true">↗</span>
                </Link>
                <Link href="/seller/finance" className="group flex items-center gap-4 rounded-[1.45rem] border border-[#eee9e4] bg-white p-4 shadow-[0_5px_16px_rgba(69,69,69,.05)] transition hover:-translate-y-1">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#fff1e8] text-[#FF8C1C] shadow-[inset_0_1px_0_white]"><SellerIcon name="finance" /></span>
                  <span className="min-w-0"><strong className="block text-sm font-black text-[#454545]">{translate(locale, "Financial overview", "الملخص المالي")}</strong><span className="mt-1 block text-xs text-[#77716c]">{translate(locale, "Review sales, commissions and completed refunds.", "راجع المبيعات والعمولات والمبالغ المستردة.")}</span></span>
                  <span className="ms-auto text-lg text-[#77716c] transition group-hover:translate-x-1" aria-hidden="true">↗</span>
                </Link>
                <Link href="/seller/payouts" className="group flex items-center gap-4 rounded-[1.45rem] border border-[#eee9e4] bg-white p-4 shadow-[0_5px_16px_rgba(69,69,69,.05)] transition hover:-translate-y-1">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#fff1e8] text-[#FF8C1C] shadow-[inset_0_1px_0_white]"><SellerIcon name="finance" /></span>
                  <span className="min-w-0"><strong className="block text-sm font-black text-[#454545]">{translate(locale, "Bank accounts", "الحسابات البنكية")}</strong><span className="mt-1 block text-xs text-[#77716c]">{translate(locale, "Manage saved payout destinations and verification status.", "أدر حسابات استلام الأرباح وحالة التحقق.")}</span></span>
                  <span className="ms-auto text-lg text-[#77716c] transition group-hover:translate-x-1" aria-hidden="true">↗</span>
                </Link>
                <Link href="/seller/shipping" className="group flex items-center gap-4 rounded-[1.45rem] border border-[#eee9e4] bg-white p-4 shadow-[0_5px_16px_rgba(69,69,69,.05)] transition hover:-translate-y-1">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#fff1e8] text-[#FF8C1C] shadow-[inset_0_1px_0_white]"><SellerIcon name="shipping" /></span>
                  <span className="min-w-0"><strong className="block text-sm font-black text-[#454545]">{translate(locale, "Shipping settings", "إعدادات الشحن")}</strong><span className="mt-1 block text-xs text-[#77716c]">{translate(locale, "Maintain delivery services, rates and destinations.", "حدّث خدمات التوصيل والأسعار والوجهات.")}</span></span>
                  <span className="ms-auto text-lg text-[#77716c] transition group-hover:translate-x-1" aria-hidden="true">↗</span>
                </Link>
                <Link href="/seller/advertising" className="group flex items-center gap-4 rounded-[1.45rem] border border-[#eee9e4] bg-white p-4 shadow-[0_5px_16px_rgba(69,69,69,.05)] transition hover:-translate-y-1">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/65 text-2xl shadow-[inset_0_1px_0_white]">📣</span>
                  <span className="min-w-0"><strong className="block text-sm font-black text-[#454545]">{translate(locale, "Advertising campaigns", "الحملات الإعلانية")}</strong><span className="mt-1 block text-xs text-[#77716c]">{translate(locale, "Manage campaign drafts, budgets and invoices.", "أدر مسودات الحملات والميزانيات والفواتير.")}</span></span>
                  <span className="ms-auto text-lg text-[#77716c]" aria-hidden="true">↗</span>
                </Link>
                <Link href="/seller/settings" className="group flex items-center gap-4 rounded-[1.45rem] border border-[#eee9e4] bg-white p-4 shadow-[0_5px_16px_rgba(69,69,69,.05)] transition hover:-translate-y-1">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/65 text-2xl shadow-[inset_0_1px_0_white]">⚙️</span>
                  <span className="min-w-0"><strong className="block text-sm font-black text-[#454545]">{translate(locale, "Store settings", "إعدادات المتجر")}</strong><span className="mt-1 block text-xs text-[#77716c]">{translate(locale, "Update your business profile and account preferences.", "حدّث ملف نشاطك التجاري وتفضيلات الحساب.")}</span></span>
                  <span className="ms-auto text-lg text-[#77716c]" aria-hidden="true">↗</span>
                </Link>
                {selectedStore.isOwner && <Link href="/seller/staff" className="group flex items-center gap-4 rounded-[1.45rem] border border-[#eee9e4] bg-white p-4 shadow-[0_5px_16px_rgba(69,69,69,.05)] transition hover:-translate-y-1">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/65 text-2xl shadow-[inset_0_1px_0_white]">👥</span>
                  <span className="min-w-0"><strong className="block text-sm font-black text-[#454545]">{translate(locale, "Manage store team", "إدارة فريق المتجر")}</strong><span className="mt-1 block text-xs text-[#77716c]">{translate(locale, "Invite staff and assign least-privilege store roles.", "ادعُ الموظفين وامنحهم أقل الصلاحيات اللازمة.")}</span></span>
                  <span className="ms-auto text-lg text-[#77716c]" aria-hidden="true">↗</span>
                </Link>}
                {selectedStore.isOwner && <a href={`/api/seller/stores/${encodeURIComponent(selectedStore.id)}/export`} className="group flex items-center gap-4 rounded-[1.45rem] border border-[#eee9e4] bg-white p-4 shadow-[0_5px_16px_rgba(69,69,69,.05)] transition hover:-translate-y-1">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/65 text-2xl shadow-[inset_0_1px_0_white]">📥</span>
                  <span className="min-w-0"><strong className="block text-sm font-black text-[#454545]">{translate(locale, "Export store to Excel", "تصدير بيانات المتجر إلى Excel")}</strong><span className="mt-1 block text-xs text-[#77716c]">{translate(locale, "Download your store profile, catalog, prices and inventory.", "نزّل ملف المتجر والمنتجات والأسعار والمخزون.")}</span></span>
                  <span className="ms-auto text-lg text-[#77716c]" aria-hidden="true">↓</span>
                </a>}
              </div>
            </section>

            <section aria-label={translate(locale, "Store analytics", "تحليلات المتجر")} className="mt-8">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-[#454545]">{translate(locale, "Store performance", "أداء المتجر")}</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">{translate(locale, "Sales, order health, catalog performance and stock for the selected store.", "المبيعات وحالة الطلبات وأداء الكتالوج والمخزون للمتجر المحدد.")}</p>
                </div>
                {analyticsLoading && <span role="status" className="rounded-full bg-[var(--color-lavender-100)] px-3 py-1.5 text-xs font-semibold text-[var(--color-lavender-800)]">{translate(locale, "Refreshing store analytics…", "جارٍ تحديث تحليلات المتجر…")}</span>}
              </div>
              {analyticsError && <p role="status" className="mb-4 rounded-xl border border-[var(--color-blush-300)] bg-[var(--color-blush-50)] p-3 text-xs text-[var(--color-blush-800)]">{translate(locale, "Store analytics are temporarily unavailable for this account or store.", "تحليلات المتجر غير متاحة مؤقتًا لهذا الحساب أو المتجر.")}</p>}
              {inventoryError && <p role="status" className="mb-4 rounded-xl bg-[var(--background)] p-3 text-xs text-[var(--muted)]">{translate(locale, "Inventory charts are temporarily unavailable.", "مخططات المخزون غير متاحة مؤقتًا.")}</p>}
              <div className="mb-4 flex justify-end">
                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--color-ink-600)]">
                  {translate(locale, "Analytics period", "فترة التحليلات")}
                  <select value={analyticsRangeDays} onChange={(event) => setAnalyticsRangeDays(Number(event.target.value) as 7 | 30 | 90)} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs shadow-[var(--shadow-clay)]">
                    <option value={7}>{translate(locale, "Last 7 days", "آخر 7 أيام")}</option>
                    <option value={30}>{translate(locale, "Last 30 days", "آخر 30 يومًا")}</option>
                    <option value={90}>{translate(locale, "Last 90 days", "آخر 90 يومًا")}</option>
                  </select>
                </label>
              </div>
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
                  description={translate(locale, "All eligible seller orders in the selected period.", "جميع طلبات البائع المؤهلة خلال الفترة المحددة.")}
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

            <section aria-label={translate(locale, "Store action center", "مركز مهام المتجر")} className="mt-7 rounded-[1.8rem] border border-white/90 bg-[linear-gradient(145deg,#f5eff8,#e4e8f3)] p-5 shadow-[0_14px_28px_rgba(35,62,81,.10),inset_0_2px_0_white] sm:p-6">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#77716c]">{translate(locale, "DAILY OPERATIONS", "العمليات اليومية")}</p>
                  <h2 className="mt-1 text-lg font-black text-[#454545]">{translate(locale, "Needs your attention", "يحتاج إلى متابعتك")}</h2>
                  <p className="mt-1 text-xs text-[#918a84]">{translate(locale, "Order counts follow the selected analytics period; inventory and review queues reflect current store records.", "تتبع أعداد الطلبات فترة التحليلات المختارة؛ أما المخزون وقوائم المراجعة فتعكس سجلات المتجر الحالية.")}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Link href="/seller/orders" className="group rounded-2xl border border-white/90 bg-[linear-gradient(145deg,#f9e8ed,#efd5df)] p-4 shadow-[0_7px_15px_rgba(75,65,92,.08),inset_0_1px_0_white] transition hover:-translate-y-0.5">
                  <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-[#79576b]">{translate(locale, "Orders to fulfill", "طلبات بانتظار التجهيز")}</span><span className="text-lg" aria-hidden="true">📦</span></div>
                  <p className="mt-3 text-3xl font-black tabular-nums text-[#454545]">{analyticsLoading || analyticsError ? "—" : formatMetric(fulfillmentOrderCount)}</p>
                  <p className="mt-1 text-[11px] text-[#77716c]">{translate(locale, "Confirmed, processing or ready to ship", "مؤكدة أو قيد التجهيز أو جاهزة للشحن")}</p>
                  <span className="mt-3 inline-block text-xs font-extrabold text-[#79576b]">{translate(locale, "Open orders", "فتح الطلبات")} ↗</span>
                </Link>
                <Link href="/seller/inventory" className="group rounded-2xl border border-white/90 bg-[linear-gradient(145deg,#f6f0d9,#e9e0b8)] p-4 shadow-[0_7px_15px_rgba(75,65,92,.08),inset_0_1px_0_white] transition hover:-translate-y-0.5">
                  <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-[#786b43]">{translate(locale, "Low-stock records", "سجلات المخزون المنخفض")}</span><span className="text-lg" aria-hidden="true">⚠️</span></div>
                  <p className="mt-3 text-3xl font-black tabular-nums text-[#454545]">{inventoryLoading || inventoryError ? "—" : formatMetric(lowStockCount)}</p>
                  <p className="mt-1 text-[11px] text-[#77716c]">{translate(locale, "Inventory rows at or below reorder point", "سجلات وصلت إلى حد إعادة الطلب أو دونه")}</p>
                  <span className="mt-3 inline-block text-xs font-extrabold text-[#786b43]">{translate(locale, "Review inventory", "مراجعة المخزون")} ↗</span>
                </Link>
                <Link href="/seller/returns" className="group rounded-2xl border border-white/90 bg-[linear-gradient(145deg,#e9e5f7,#d8d2ee)] p-4 shadow-[0_7px_15px_rgba(75,65,92,.08),inset_0_1px_0_white] transition hover:-translate-y-0.5">
                  <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-[#625c83]">{translate(locale, "Return requests", "طلبات الإرجاع")}</span><span className="text-lg" aria-hidden="true">↶</span></div>
                  <p className="mt-3 text-3xl font-black tabular-nums text-[#454545]">{analyticsLoading || analyticsError || sellerAnalytics?.metrics.requestedReturns == null ? "—" : formatMetric(sellerAnalytics.metrics.requestedReturns)}</p>
                  <p className="mt-1 text-[11px] text-[#77716c]">{translate(locale, "Waiting for seller review", "بانتظار مراجعة البائع")}</p>
                  <span className="mt-3 inline-block text-xs font-extrabold text-[#625c83]">{translate(locale, "Review returns", "مراجعة المرتجعات")} ↗</span>
                </Link>
                <Link href="/seller/products" className="group rounded-2xl border border-white/90 bg-[linear-gradient(145deg,#e0f1ed,#c9e4dc)] p-4 shadow-[0_7px_15px_rgba(75,65,92,.08),inset_0_1px_0_white] transition hover:-translate-y-0.5">
                  <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-[#4c7066]">{translate(locale, "Products awaiting approval", "منتجات بانتظار الموافقة")}</span><span className="text-lg" aria-hidden="true">🛍️</span></div>
                  <p className="mt-3 text-3xl font-black tabular-nums text-[#454545]">{analyticsLoading || analyticsError || sellerAnalytics?.metrics.pendingProducts == null ? "—" : formatMetric(sellerAnalytics.metrics.pendingProducts)}</p>
                  <p className="mt-1 text-[11px] text-[#77716c]">{translate(locale, "Submitted products not yet approved", "منتجات أُرسلت ولم تتم الموافقة عليها بعد")}</p>
                  <span className="mt-3 inline-block text-xs font-extrabold text-[#4c7066]">{translate(locale, "Manage products", "إدارة المنتجات")} ↗</span>
                </Link>
              </div>
            </section>

            <section aria-label={translate(locale, "Customer relationships and team", "علاقات العملاء والفريق")} className="mt-7 rounded-[1.8rem] border border-white/90 bg-[linear-gradient(145deg,#edf5f7,#dce8f0)] p-5 shadow-[0_14px_28px_rgba(35,62,81,.10),inset_0_2px_0_white] sm:p-6">
              <div className="mb-4">
                <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#718a99]">{translate(locale, "CUSTOMER RELATIONSHIPS", "علاقات العملاء")}</p>
                <h2 className="mt-1 text-lg font-black text-[#454545]">{translate(locale, "Stay close to your customers", "ابقَ قريباً من عملائك")}</h2>
                <p className="mt-1 text-xs text-[#918a84]">{translate(locale, "Open the existing customer-service and reputation workspaces. Counts are shown only where the analytics API provides them.", "افتح مساحات خدمة العملاء والسمعة الحالية. لا نعرض أعداداً إلا عندما توفرها واجهة التحليلات.")}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Link href="/seller/messages" className="group rounded-2xl border border-white/90 bg-[linear-gradient(145deg,#e4f0f6,#cfe2eb)] p-4 shadow-[0_7px_15px_rgba(75,65,92,.08),inset_0_1px_0_white] transition hover:-translate-y-0.5">
                  <span className="text-xl" aria-hidden="true">✉️</span>
                  <h3 className="mt-2 text-sm font-black text-[#38566b]">{translate(locale, "Customer messages", "رسائل العملاء")}</h3>
                  <p className="mt-1 text-xs leading-5 text-[#718a99]">{translate(locale, "Read conversations and reply to customer enquiries.", "اقرأ المحادثات وأجب عن استفسارات العملاء.")}</p>
                  <span className="mt-3 inline-block text-xs font-extrabold text-[#426d83]">{translate(locale, "Open inbox", "فتح الرسائل")} ↗</span>
                </Link>
                <Link href="/seller/questions" className="group rounded-2xl border border-white/90 bg-[linear-gradient(145deg,#eee9f8,#ddd5ee)] p-4 shadow-[0_7px_15px_rgba(75,65,92,.08),inset_0_1px_0_white] transition hover:-translate-y-0.5">
                  <span className="text-xl" aria-hidden="true">❔</span>
                  <h3 className="mt-2 text-sm font-black text-[#454545]">{translate(locale, "Product questions", "أسئلة المنتجات")}</h3>
                  <p className="mt-1 text-xs leading-5 text-[#77716c]">{translate(locale, "Review questions and manage published answers.", "راجع الأسئلة وأدر الإجابات المنشورة.")}</p>
                  <span className="mt-3 inline-block text-xs font-extrabold text-[#625c83]">{translate(locale, "Answer questions", "الإجابة عن الأسئلة")} ↗</span>
                </Link>
                <Link href="/seller/reviews" className="group rounded-2xl border border-white/90 bg-[linear-gradient(145deg,#f7f0dc,#eee3bd)] p-4 shadow-[0_7px_15px_rgba(75,65,92,.08),inset_0_1px_0_white] transition hover:-translate-y-0.5">
                  <span className="text-xl" aria-hidden="true">⭐</span>
                  <h3 className="mt-2 text-sm font-black text-[#74633b]">{translate(locale, "Store reputation", "سمعة المتجر")}</h3>
                  <p className="mt-2 text-2xl font-black tabular-nums text-[#454545]">{analyticsLoading || analyticsError || sellerAnalytics?.metrics.averageRating == null ? "—" : sellerAnalytics.metrics.averageRating.toFixed(1)} <span className="text-sm text-[#9b854e]">/ 5</span></p>
                  <p className="mt-1 text-xs text-[#77716c]">{analyticsLoading || analyticsError || sellerAnalytics?.metrics.reviewCount == null ? translate(locale, "Review count unavailable", "عدد التقييمات غير متاح") : formatMetric(sellerAnalytics.metrics.reviewCount) + " " + translate(locale, "customer reviews", "تقييمات العملاء")}</p>
                  <span className="mt-3 inline-block text-xs font-extrabold text-[#786b43]">{translate(locale, "Manage reviews", "إدارة التقييمات")} ↗</span>
                </Link>
                <Link href="/seller/staff" className="group rounded-2xl border border-white/90 bg-[linear-gradient(145deg,#e2f1e9,#cfe7dc)] p-4 shadow-[0_7px_15px_rgba(75,65,92,.08),inset_0_1px_0_white] transition hover:-translate-y-0.5">
                  <span className="text-xl" aria-hidden="true">👥</span>
                  <h3 className="mt-2 text-sm font-black text-[#454545]">{translate(locale, "Team & permissions", "الفريق والصلاحيات")}</h3>
                  <p className="mt-1 text-xs leading-5 text-[#77716c]">{translate(locale, "Invite staff and manage store-scoped access.", "ادعُ أعضاء الفريق وأدر صلاحيات الوصول إلى المتجر.")}</p>
                  <span className="mt-3 inline-block text-xs font-extrabold text-[#4c7066]">{translate(locale, "Manage team", "إدارة الفريق")} ↗</span>
                </Link>
              </div>
            </section>

            <section aria-label={translate(locale, "Recent orders", "الطلبات الأخيرة")} className="mt-7 overflow-hidden rounded-[1.8rem] border border-[#eee9e4] bg-white p-5 shadow-[0_14px_28px_rgba(35,62,81,.12),inset_0_2px_0_white] sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#77716c]">{translate(locale, "CUSTOMER ACTIVITY", "نشاط العملاء")}</p><h2 className="mt-1 text-lg font-black text-[#454545]">{translate(locale, "Recent orders", "الطلبات الأخيرة")}</h2><p className="mt-1 text-xs text-[#918a84]">{translate(locale, "The latest orders for the selected store.", "أحدث الطلبات الخاصة بالمتجر المحدد.")}</p></div>
                <Link href="/seller/orders" className="rounded-full border border-white/90 bg-[linear-gradient(145deg,#eaf3f5,#e1dfed)] px-4 py-2 text-xs font-extrabold text-[#454545] shadow-[0_5px_12px_rgba(35,62,81,.1),inset_0_1px_0_white]">{translate(locale, "See all orders", "عرض كل الطلبات")} ↗</Link>
              </div>
              {recentOrdersLoading ? <p className="rounded-2xl bg-white/45 p-4 text-sm text-[#918a84]">{translate(locale, "Loading recent orders…", "جارٍ تحميل الطلبات الأخيرة…")}</p>
                : recentOrdersError ? <p role="status" className="rounded-2xl bg-white/45 p-4 text-sm text-[#918a84]">{translate(locale, "Recent orders are temporarily unavailable.", "الطلبات الأخيرة غير متاحة مؤقتاً.")}</p>
                : recentOrders.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{recentOrders.map((order) => {
                  const formattedAmount = formatCurrencyMinor(order.totalMinor, order.order.currencyCode, order.order.currency.minorUnit);
                  return <article key={order.id} className="rounded-2xl border border-[#eee9e4] bg-[#fffaf6] p-4 shadow-[0_6px_14px_rgba(35,62,81,.08),inset_0_1px_0_white]">
                    <div className="flex items-start justify-between gap-2"><p className="font-black text-[#454545]">#{order.order.orderNumber}</p><StatusBadge locale={locale} status={order.status} /></div>
                    <p className="mt-3 text-xl font-black tracking-tight text-[#46516b]">{formattedAmount}</p>
                    <p className="mt-1 text-[11px] text-[#918a84]">{new Date(order.order.placedAt).toLocaleDateString(locale === "ar" ? "ar" : "en", { year: "numeric", month: "short", day: "numeric" })}</p>
                  </article>;
                })}</div>
                : <p className="rounded-2xl bg-white/45 p-4 text-sm text-[#918a84]">{translate(locale, "No orders have been placed for this store yet.", "لم تُسجل طلبات لهذا المتجر بعد.")}</p>}
            </section>
          </>}

          <div className="mt-9 grid gap-6 xl:grid-cols-[.78fr_1.22fr]">
            <section className="rounded-[1.75rem] border border-white/80 bg-[linear-gradient(145deg,#f5f2fb,#e3e2ef)] p-6 shadow-[0_12px_28px_rgba(74,75,112,.10),inset_0_1px_0_white]">
              <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-extrabold tracking-tight text-[#454545]">{translate(locale, "Seller status", "حالة البائع")}</h2><StatusBadge locale={locale} status={workspace.seller.status} /></div>
              <p className="mt-3 text-sm text-[var(--muted)]">{workspace.seller.displayName ?? workspace.seller.legalName}</p>
              {hasOwnedStore && <p className="mt-4 rounded-xl border border-[var(--color-sage-500)]/30 bg-[var(--color-sage-100)] p-3 text-sm leading-6 text-[var(--color-forest-900)]">{translate(locale, "This account is linked to one store. You can manage and update its settings at any time; creating another store is disabled.", "هذا الحساب مرتبط بمتجر واحد. يمكنك إدارة إعداداته وتحديثها في أي وقت؛ وتم تعطيل إنشاء متجر آخر.")}</p>}
              {workspace.seller.status === "PENDING" && <p className="mt-4 rounded-xl bg-[var(--color-ivory-100)] p-4 text-sm leading-6">{translate(locale, "Your application is awaiting review. Store creation becomes available after approval.", "طلبك بانتظار المراجعة. سيصبح إنشاء المتجر متاحًا بعد الموافقة.")}</p>}
              {workspace.seller.status === "ACTIVE" && !hasOwnedStore && (
                <form onSubmit={(event) => submit(event, "/api/seller/stores", { name: storeName, slug: storeSlug, marketIds: selectedMarketIds }, "Your draft store has been created.")} className="mt-6 grid gap-4 border-t border-[var(--border)] pt-6">
                  <h3 className="text-base font-extrabold text-[#454545]">{translate(locale, "Create a store", "إنشاء متجر")}</h3>
                  <label className="grid gap-2 text-sm">{translate(locale, "Store name", "اسم المتجر")}<input required minLength={2} maxLength={120} value={storeName} onChange={(e) => { setStoreName(e.target.value); setStoreSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} className="rounded-2xl border border-white/90 bg-[linear-gradient(145deg,#f5f2fb,#e8e5f2)] px-4 py-3 text-[#46516b] shadow-[inset_0_2px_5px_rgba(74,75,112,.08),0_1px_0_white]" /></label>
                  <label className="grid gap-2 text-sm">{translate(locale, "Store URL slug", "معرّف رابط المتجر")}<input required minLength={3} maxLength={160} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={storeSlug} onChange={(e) => setStoreSlug(e.target.value)} className="rounded-2xl border border-white/90 bg-[linear-gradient(145deg,#f5f2fb,#e8e5f2)] px-4 py-3 text-[#46516b] shadow-[inset_0_2px_5px_rgba(74,75,112,.08),0_1px_0_white]" /></label>
                  <fieldset className="grid gap-2"><legend className="text-sm font-medium">{translate(locale, "Markets served", "الأسواق التي يخدمها المتجر")}</legend>{markets.map((market) => <label key={market.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedMarketIds.includes(market.id)} onChange={(e) => setSelectedMarketIds((ids) => e.target.checked ? [...ids, market.id] : ids.filter((id) => id !== market.id))} />{market.name} · {market.defaultCurrency.code}</label>)}{!markets.length && <p className="text-xs text-[var(--muted)]">{translate(locale, "No active launch markets are configured yet.", "لم يتم إعداد أسواق الإطلاق النشطة بعد.")}</p>}</fieldset>
                  <button disabled={busy || !selectedMarketIds.length} className="rounded-2xl bg-[linear-gradient(135deg,#c8bee9,#9b91c8)] px-4 py-3 text-sm font-extrabold text-[#40375f] shadow-[0_9px_20px_rgba(93,83,139,.14),inset_0_1px_0_rgba(255,255,255,.35)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"><SellerIcon name="store" />{busy ? translate(locale, "Creating…", "جارٍ الإنشاء…") : translate(locale, "Create draft store", "إنشاء متجر كمسودة")}</button>
                </form>
              )}
            </section>
            <section id="store-management" className="scroll-mt-28 rounded-[1.75rem] border border-white/80 bg-[linear-gradient(145deg,#edf3f5,#d5e1e7)] p-6 shadow-[0_12px_28px_rgba(74,75,112,.10),inset_0_1px_0_white]">
              <h2 className="text-lg font-extrabold tracking-tight text-[#454545]">{translate(locale, "Your stores", "متاجرك")}</h2>
              {!workspace.stores.length ? <p className="mt-4 rounded-xl bg-[var(--color-ivory-100)] p-5 text-sm text-[var(--muted)]">{translate(locale, "No stores have been created yet.", "لم يتم إنشاء أي متاجر بعد.")}</p> : (
                <>
                  <div className="mt-4"><Link href="/seller/messages" className="inline-flex rounded-2xl bg-[linear-gradient(135deg,#a8d9d4,#75b8b8)] px-4 py-2 text-sm font-bold text-[#23485a] shadow-[0_6px_14px_rgba(39,104,112,.18),inset_0_1px_0_rgba(255,255,255,.3)]"><SellerIcon name="messages" />{translate(locale, "Open store inbox", "فتح صندوق وارد المتجر")}</Link></div>
                  <div className="mt-4 flex flex-wrap gap-2">{workspace.stores.map((store) => <button key={store.id} onClick={() => { setSelectedStoreId(store.id); try { localStorage.setItem("mtjr.activeStoreId", store.id); window.dispatchEvent(new Event("mtjr:active-store-changed")); } catch { /* Storage can be unavailable in restricted browsers. */ } }} className={`rounded-xl border px-4 py-2 text-sm ${selectedStoreId === store.id ? "border-[var(--color-forest-800)] bg-[var(--color-forest-900)] text-white" : "border-[var(--border)]"}`}>{store.name}</button>)}</div>
                  {selectedStore && <div className="mt-6 border-t border-[var(--border)] pt-5">
                    <div className="flex flex-wrap items-center justify-between gap-2"><div><div><h3 className="font-semibold">{selectedStore.name}</h3><p className="mt-1 text-xs text-[var(--muted)]">STR-{selectedStore.storeNumber.padStart(8, "0")} · /{selectedStore.slug} · <StatusBadge locale={locale} status={selectedStore.status} /></p></div><div className="mt-2 flex flex-wrap gap-2"><Link href="/seller/products" className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--color-forest-900)]"><SellerIcon name="package" />{translate(locale, "Manage products", "إدارة المنتجات")}</Link><Link href="/seller/orders" className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--color-forest-900)]"><SellerIcon name="orders" />{translate(locale, "Seller orders", "طلبات البائع")}</Link><Link href="/seller/inventory" className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--color-forest-900)]"><SellerIcon name="inventory" />{translate(locale, "Inventory operations", "إدارة المخزون")}</Link><Link href="/seller/staff" className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--color-forest-900)]"><SellerIcon name="team" />{translate(locale, "Team & access", "الفريق والصلاحيات")}</Link></div></div><div className="flex items-center gap-3"><span className="text-xs text-[var(--muted)]">{selectedStore.markets.length} {translate(locale, "active markets", "أسواق نشطة")}</span>{selectedStore.isOwner && <button type="button" onClick={() => { setEditingStoreName(selectedStore.name); setEditingStoreSlug(selectedStore.slug);
                        setEditingStoreDescription(selectedStore.description ?? "");
                         setEditingStorePublicPhone(selectedStore.publicPhone ?? "");
                         setEditingStorePublicAddress(selectedStore.publicAddress ?? "");
                        setEditingStoreLogoUrl(selectedStore.logoUrl ?? "");
                        setEditingStoreBannerUrl(selectedStore.bannerUrl ?? "");
                        setEditingStoreLogoStorageKey(selectedStore.logoStorageKey ?? ""); setEditingStoreBannerStorageKey(selectedStore.bannerStorageKey ?? "");
                        setStoreLogoDeleteToken(""); setStoreBannerDeleteToken(""); setStoreStagedDeleteTokens([]);
                        setEditingShippingPolicy(selectedStore.shippingPolicy ?? "");
                        setEditingReturnsPolicy(selectedStore.returnsPolicy ?? "");
                        setEditingPrivacyPolicy(selectedStore.privacyPolicy ?? "");
                        setEditingTermsOfSale(selectedStore.termsOfSale ?? "");
                        setEditingStoreProfile((value) => !value); }} className="rounded-xl border border-white bg-[linear-gradient(145deg,#eeeaf8,#ded9f0)] px-3 py-2 text-xs font-bold text-[#454545] shadow-[0_4px_10px_rgba(35,62,81,.1),inset_0_1px_0_white]"><SellerIcon name="business" />{translate(locale, editingStoreProfile ? "Close profile editor" : "Edit store profile", editingStoreProfile ? "إغلاق تعديل المتجر" : "تعديل ملف المتجر")}</button>}</div></div>
                    {editingStoreProfile && selectedStore.isOwner && <form onSubmit={saveStoreProfile} className="mt-5 grid gap-4 rounded-[1.5rem] border border-dashed border-[#f0c7ad] bg-[#fffaf6] p-4 shadow-[inset_0_2px_7px_rgba(74,75,112,.08)] sm:grid-cols-2">
                      <div className="sm:col-span-2"><h4 className="font-extrabold text-[#454545]">{translate(locale, "Store profile", "ملف المتجر")}</h4><p className="mt-1 text-xs leading-5 text-[#918a84]">{translate(locale, "Update your public name, contact details, images and URL. Changing the URL may affect links customers have saved.", "حدّث اسم المتجر وبيانات التواصل والصور والرابط العام. قد يؤثر تغيير الرابط في الروابط التي حفظها العملاء.")}</p></div>
                      <label className="grid gap-1 text-xs font-semibold">{translate(locale, "Store name", "اسم المتجر")}<input required minLength={2} maxLength={120} value={editingStoreName} onChange={(event) => setEditingStoreName(event.target.value)} className="rounded-xl border border-white bg-[linear-gradient(145deg,#f5f2fb,#e8e5f2)] px-3 py-2.5 text-sm font-normal text-[#46516b] shadow-[inset_0_2px_5px_rgba(74,75,112,.08)]" /></label>
                      <label className="grid gap-1 text-xs font-semibold">{translate(locale, "Store URL slug", "معرّف رابط المتجر")}<input required minLength={3} maxLength={160} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={editingStoreSlug} onChange={(event) => setEditingStoreSlug(event.target.value)} disabled={selectedStore.status === "ACTIVE"} className="rounded-xl border border-white bg-[linear-gradient(145deg,#f5f2fb,#e8e5f2)] px-3 py-2.5 text-sm font-normal text-[#46516b] shadow-[inset_0_2px_5px_rgba(74,75,112,.08)] disabled:cursor-not-allowed disabled:opacity-60" /><span className="text-[10px] font-normal text-[#918a84]">{selectedStore.status === "ACTIVE" ? translate(locale, "Public URL is locked after activation to protect saved customer links.", "يُقفل الرابط العام بعد التفعيل لحماية روابط العملاء المحفوظة.") : translate(locale, "Public URL: ", "الرابط العام: ")} /stores/{editingStoreSlug || selectedStore.slug}</span></label>
                      <label className="grid gap-1 text-xs font-semibold">{translate(locale, "Public store phone", "رقم هاتف المتجر الظاهر للعملاء")}<input type="tel" minLength={7} maxLength={25} value={editingStorePublicPhone} onChange={(event) => setEditingStorePublicPhone(event.target.value)} placeholder="+963…" className="rounded-xl border border-white bg-white/80 px-3 py-2.5 text-sm font-normal text-[#46516b]" /></label>
                      <label className="grid gap-1 text-xs font-semibold">{translate(locale, "Public store address", "عنوان المتجر الظاهر للعملاء")}<input maxLength={500} value={editingStorePublicAddress} onChange={(event) => setEditingStorePublicAddress(event.target.value)} placeholder={translate(locale, "City, district and street", "المدينة والمنطقة والشارع")} className="rounded-xl border border-white bg-white/80 px-3 py-2.5 text-sm font-normal text-[#46516b]" /></label>
                      <label className="grid gap-1 text-xs font-semibold sm:col-span-2">{translate(locale, "Public store description", "وصف المتجر الظاهر للعملاء")}<textarea rows={4} maxLength={2000} value={editingStoreDescription} onChange={(event) => setEditingStoreDescription(event.target.value)} placeholder={translate(locale, "Tell customers what your store offers and what makes it special.", "عرّف العملاء بما يقدمه متجرك وما يميزه.")} className="rounded-xl border border-white bg-white/80 px-3 py-2.5 text-sm font-normal text-[#46516b] shadow-[inset_0_2px_5px_rgba(74,75,112,.08)]" /></label>
                      <div className="sm:col-span-2 mt-2"><h5 className="font-extrabold text-[#454545]">{translate(locale, "Customer policies", "سياسات العملاء")}</h5><p className="mt-1 text-xs leading-5 text-[#918a84]">{translate(locale, "These policies appear on your public storefront. Do not include private dispatch addresses or sensitive customer information.", "تظهر هذه السياسات في واجهة متجرك العامة. لا تضع فيها عنوان تجهيز الطلبات الخاص أو بيانات حساسة للعملاء.")}</p></div>
                      <label className="grid gap-1 text-xs font-semibold">{translate(locale, "Shipping & delivery policy", "سياسة الشحن والتوصيل")}<textarea rows={5} maxLength={8000} value={editingShippingPolicy} onChange={(event) => setEditingShippingPolicy(event.target.value)} placeholder={translate(locale, "Delivery areas, estimated times and shipping conditions…", "مناطق التوصيل والمدد المتوقعة وشروط الشحن…")} className="rounded-xl border border-white bg-white/80 px-3 py-2.5 text-sm font-normal text-[#46516b]" /></label>
                      <label className="grid gap-1 text-xs font-semibold">{translate(locale, "Returns & refunds policy", "سياسة الإرجاع والاسترداد")}<textarea rows={5} maxLength={8000} value={editingReturnsPolicy} onChange={(event) => setEditingReturnsPolicy(event.target.value)} placeholder={translate(locale, "Return window, eligible items and refund conditions…", "مدة الإرجاع والمنتجات المشمولة وشروط الاسترداد…")} className="rounded-xl border border-white bg-white/80 px-3 py-2.5 text-sm font-normal text-[#46516b]" /></label>
                      <label className="grid gap-1 text-xs font-semibold">{translate(locale, "Privacy notice", "إشعار الخصوصية")}<textarea rows={5} maxLength={8000} value={editingPrivacyPolicy} onChange={(event) => setEditingPrivacyPolicy(event.target.value)} placeholder={translate(locale, "Explain how store-specific customer information is handled…", "اشرح كيفية التعامل مع معلومات العملاء الخاصة بالمتجر…")} className="rounded-xl border border-white bg-white/80 px-3 py-2.5 text-sm font-normal text-[#46516b]" /></label>
                      <label className="grid gap-1 text-xs font-semibold">{translate(locale, "Terms of sale", "شروط البيع")}<textarea rows={5} maxLength={8000} value={editingTermsOfSale} onChange={(event) => setEditingTermsOfSale(event.target.value)} placeholder={translate(locale, "Product-specific terms, warranties and limitations…", "شروط المنتجات والضمانات والقيود…")} className="rounded-xl border border-white bg-white/80 px-3 py-2.5 text-sm font-normal text-[#46516b]" /></label>
                      <label className="grid gap-1 text-xs font-semibold">{translate(locale, "Store logo image URL", "رابط شعار المتجر")}<input type="url" maxLength={2048} value={editingStoreLogoUrl} onChange={(event) => setEditingStoreLogoUrl(event.target.value)} placeholder="https://…" className="rounded-xl border border-white bg-white/80 px-3 py-2.5 text-sm font-normal text-[#46516b]" /></label>
                      <label className="grid gap-1 text-xs font-semibold">{translate(locale, "Store banner image URL", "رابط غلاف المتجر")}<input type="url" maxLength={2048} value={editingStoreBannerUrl} onChange={(event) => setEditingStoreBannerUrl(event.target.value)} placeholder="https://…" className="rounded-xl border border-white bg-white/80 px-3 py-2.5 text-sm font-normal text-[#46516b]" /></label>
                      {(editingStoreLogoUrl.trim() || editingStoreBannerUrl.trim()) && <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                        {previewBannerUrl && <div className="overflow-hidden rounded-xl border border-white bg-white/60"><p className="px-3 py-2 text-[10px] font-bold text-[#918a84]">{translate(locale, "Banner preview", "معاينة الغلاف")}</p><img src={previewBannerUrl} alt={translate(locale, "Store banner preview", "معاينة غلاف المتجر")} referrerPolicy="no-referrer" className="h-28 w-full object-cover" /></div>}
                        {previewLogoUrl && <div className="flex items-center gap-3 rounded-xl border border-white bg-white/60 p-3"><img src={previewLogoUrl} alt={translate(locale, "Store logo preview", "معاينة شعار المتجر")} referrerPolicy="no-referrer" className="h-16 w-16 rounded-xl object-cover" /><span className="text-xs font-semibold text-[#454545]">{translate(locale, "Logo preview", "معاينة الشعار")}</span></div>}
                      </div>}
                      <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                        <label className="grid gap-2 rounded-2xl border border-white bg-white/65 p-3 text-xs font-bold text-[#46516b]">{translate(locale, "Upload store logo", "رفع شعار المتجر")}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={Boolean(storeMediaUploading)} onChange={(event) => uploadStoreImage(event, "logo")} className="block w-full text-xs file:me-3 file:rounded-full file:border-0 file:bg-[#d8e9ee] file:px-3 file:py-2 file:font-bold file:text-[#454545]" />{storeMediaUploading === "logo" && <span className="text-[#77716c]">{translate(locale, "Uploading logo…", "جارٍ رفع الشعار…")}</span>}<button type="button" onClick={() => { setEditingStoreLogoUrl(""); setEditingStoreLogoStorageKey(""); setStoreLogoDeleteToken(""); }} className="justify-self-start text-[11px] font-bold text-[#89546a] underline">{translate(locale, "Remove logo from store profile", "إزالة الشعار من ملف المتجر")}</button></label>
                        <label className="grid gap-2 rounded-2xl border border-white bg-white/65 p-3 text-xs font-bold text-[#46516b]">{translate(locale, "Upload store banner", "رفع غلاف المتجر")}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={Boolean(storeMediaUploading)} onChange={(event) => uploadStoreImage(event, "banner")} className="block w-full text-xs file:me-3 file:rounded-full file:border-0 file:bg-[#cfe8df] file:px-3 file:py-2 file:font-bold file:text-[#454545]" />{storeMediaUploading === "banner" && <span className="text-[#5d9d8c]">{translate(locale, "Uploading banner…", "جارٍ رفع الغلاف…")}</span>}<button type="button" onClick={() => { setEditingStoreBannerUrl(""); setEditingStoreBannerStorageKey(""); setStoreBannerDeleteToken(""); }} className="justify-self-start text-[11px] font-bold text-[#89546a] underline">{translate(locale, "Remove banner from store profile", "إزالة الغلاف من ملف المتجر")}</button></label>
                      </div>
                      <p className="text-[10px] leading-5 text-[#918a84] sm:col-span-2">{translate(locale, "Images use the seller-scoped media uploader and its configured provider rotation. Uploading only stages the URL in this editor; save the store profile to publish it.", "تُرفع الصور عبر خدمة الوسائط المقيّدة بمتجرك وبآلية التناوب بين مزودي الرفع المضبوطين. الرفع يضع الرابط في المحرر فقط؛ احفظ ملف المتجر لاعتماده.")}</p>
                      <div className="sm:col-span-2 rounded-2xl border border-white/90 bg-white/55 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2"><h5 className="text-sm font-extrabold text-[#454545]">{translate(locale, "Store media library", "مكتبة وسائط المتجر")}</h5><span className="text-[10px] text-[#918a84]">{selectedStore.mediaAssets.length} / 100</span></div>
                        {selectedStore.mediaAssets.length ? <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                          {selectedStore.mediaAssets.map((asset) => <div key={asset.id} className="overflow-hidden rounded-xl border border-white bg-white/80 p-2 shadow-[inset_0_1px_0_white]">
                            <img src={asset.url} alt="" referrerPolicy="no-referrer" className="h-24 w-full rounded-lg object-cover" />
                            <p className="mt-2 truncate text-[10px] text-[#918a84]">{asset.width && asset.height ? asset.width + " × " + asset.height : asset.mimeType ?? translate(locale, "Image", "صورة")}</p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              <button type="button" onClick={() => { setEditingStoreLogoUrl(asset.url); setEditingStoreLogoStorageKey(asset.storageKey ?? ""); setStoreLogoDeleteToken(""); }} className="rounded-lg bg-[#d8e9ee] px-2 py-1 text-[10px] font-bold text-[#454545]"><SellerIcon name="media" />{translate(locale, "Use as logo", "استخدام كشعار")}</button>
                              <button type="button" onClick={() => { setEditingStoreBannerUrl(asset.url); setEditingStoreBannerStorageKey(asset.storageKey ?? ""); setStoreBannerDeleteToken(""); }} className="rounded-lg bg-[#cfe8df] px-2 py-1 text-[10px] font-bold text-[#454545]"><SellerIcon name="media" />{translate(locale, "Use as banner", "استخدام كغلاف")}</button>
                              <button type="button" disabled={!asset.storageKey} onClick={async () => { try { const response = await fetch(`/api/seller/stores/${encodeURIComponent(selectedStore.id)}/media`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetId: asset.id }) }); const data = await response.json() as { error?: string }; if (!response.ok) throw new Error(data.error || "Unable to delete media."); await reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to delete media."); } }} className="rounded-lg bg-[#f8e5eb] px-2 py-1 text-[10px] font-bold text-[#89546a] disabled:opacity-40"><SellerIcon name="trash" />{translate(locale, "Delete", "حذف")}</button>
                            </div>
                          </div>)}
                        </div> : <p className="mt-3 rounded-xl bg-white/70 p-4 text-xs text-[#918a84]">{translate(locale, "Uploaded product and store images will appear here for reuse.", "ستظهر هنا صور المنتجات والمتجر التي ترفعها لإعادة استخدامها.")}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2 sm:col-span-2"><button disabled={busy || Boolean(storeMediaUploading) || !editingStoreName.trim() || !editingStoreSlug.trim()} className="rounded-xl bg-[linear-gradient(135deg,#a8d9d4,#75b8b8)] px-5 py-2.5 text-xs font-extrabold text-[#23485a] shadow-[0_6px_14px_rgba(39,104,112,.18)] disabled:opacity-50"><SellerIcon name="document" />{busy ? translate(locale, "Saving…", "جارٍ الحفظ…") : translate(locale, "Save store profile", "حفظ ملف المتجر")}</button><button type="button" disabled={busy} onClick={() => { void discardStoreProfileEdits(); }} className="rounded-xl border border-white bg-white/70 px-4 py-2.5 text-xs font-semibold text-[#454545]">{translate(locale, "Cancel", "إلغاء")}</button></div>
                    </form>}
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {selectedStore.warehouses.map((warehouse) => <div key={warehouse.id} className="rounded-xl bg-[var(--color-ivory-100)] p-4"><p className="font-medium">{warehouse.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{warehouse.code} · {warehouse._count.inventories} {translate(locale, "inventory records", "سجل مخزون")}</p></div>)}
                    </div>
                    {selectedStore.isOwner && <form onSubmit={(event) => submit(event, "/api/seller/warehouses", { storeId: selectedStore.id, name: warehouseName, code: warehouseCode }, "Warehouse created.")} className="mt-5 grid gap-3 rounded-[1.5rem] border border-dashed border-[#f0c7ad] bg-[#fffaf6] p-4 shadow-[inset_0_2px_7px_rgba(69,69,69,.04)] sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                      <label className="grid gap-1 text-xs">{translate(locale, "Warehouse name", "اسم المستودع")}<input required minLength={2} maxLength={120} value={warehouseName} onChange={(e) => setWarehouseName(e.target.value)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" /></label>
                      <label className="grid gap-1 text-xs">{translate(locale, "Code", "الرمز")}<input required minLength={2} maxLength={40} value={warehouseCode} onChange={(e) => setWarehouseCode(e.target.value.toUpperCase())} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" /></label>
                      <button disabled={busy} className="rounded-lg bg-[var(--color-forest-900)] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"><SellerIcon name="warehouse" />{translate(locale, "Add warehouse", "إضافة مستودع")}</button>
                    </form>}
                    {selectedStore.isOwner && <div className="mt-7 border-t border-[var(--border)] pt-6">
                      <h3 className="font-semibold">{translate(locale, "Shipping address & contact", "عنوان الشحن وبيانات التواصل")}</h3>
                      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{translate(locale, "These details are used by your team when preparing and handing over orders. Keep them current.", "تستخدم هذه البيانات عند تجهيز الطلبات وتسليمها لشركة الشحن. احرص على تحديثها.")}</p>
                      <form onSubmit={saveShippingDetails} className="mt-4 grid gap-3 rounded-[1.5rem] border border-white/80 bg-[linear-gradient(145deg,#edf3f5,#d5e1e7)] p-4 shadow-[0_8px_18px_rgba(74,75,112,.09),inset_0_1px_0_white] sm:grid-cols-2">
                        <label className="grid gap-1 text-xs">{translate(locale, "Shipping contact name", "اسم مسؤول الشحن")}<input maxLength={120} value={shippingContactName} required minLength={2} onChange={(event) => setShippingContactName(event.target.value)} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm" /></label>
                        <label className="grid gap-1 text-xs">{translate(locale, "Shipping phone", "هاتف الشحن")}<input type="tel" minLength={7} maxLength={25} value={shippingPhone} onChange={(event) => setShippingPhone(event.target.value)} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm" /></label>
                        <label className="grid gap-1 text-xs sm:col-span-2">{translate(locale, "Address line 1", "العنوان — السطر الأول")}<input minLength={3} maxLength={240} value={shippingAddressLine1} onChange={(event) => setShippingAddressLine1(event.target.value)} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm" /></label>
                        <label className="grid gap-1 text-xs sm:col-span-2">{translate(locale, "Address line 2", "العنوان — السطر الثاني")}<input maxLength={240} value={shippingAddressLine2} onChange={(event) => setShippingAddressLine2(event.target.value)} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm" /></label>
                        <label className="grid gap-1 text-xs">{translate(locale, "City", "المدينة")}<input minLength={2} maxLength={120} value={shippingCity} onChange={(event) => setShippingCity(event.target.value)} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm" /></label>
                        <label className="grid gap-1 text-xs">{translate(locale, "Region / governorate", "المنطقة / المحافظة")}<input maxLength={120} value={shippingRegionAddress} onChange={(event) => setShippingRegionAddress(event.target.value)} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm" /></label>
                        <label className="grid gap-1 text-xs">{translate(locale, "Postal code", "الرمز البريدي")}<input maxLength={40} value={shippingPostalCode} onChange={(event) => setShippingPostalCode(event.target.value)} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm" /></label>
                        <label className="grid gap-1 text-xs">{translate(locale, "Country code (2 letters)", "رمز الدولة (حرفان)")}<input minLength={2} maxLength={2} pattern="[A-Za-z]{2}" value={shippingCountryCode} onChange={(event) => setShippingCountryCode(event.target.value.toUpperCase())} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm uppercase" /></label>
                        <label className="grid gap-1 text-xs sm:col-span-2">{translate(locale, "Delivery / pickup instructions", "تعليمات التسليم والاستلام")}<textarea rows={3} maxLength={1000} value={shippingInstructions} onChange={(event) => setShippingInstructions(event.target.value)} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm" /></label>
                        <div className="sm:col-span-2 flex justify-end"><button type="submit" disabled={busy} className="rounded-xl bg-[#756b9f] px-5 py-2.5 text-xs font-semibold text-white shadow-[0_5px_12px_rgba(93,83,139,.14)] disabled:opacity-50"><SellerIcon name="shipping" />{busy ? translate(locale, "Saving…", "جارٍ الحفظ…") : translate(locale, "Save shipping details", "حفظ بيانات الشحن")}</button></div>
                      </form>
                    </div>}
                    <div className="mt-7 border-t border-[var(--border)] pt-6">
                      <h3 className="font-semibold">{translate(locale, "Shipping services", "خدمات الشحن")}</h3>
                      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{translate(locale, "Rates are scoped to a market and optional destination region. Enter the normal amount in the market currency.", "ترتبط الأسعار بسوق ومنطقة وجهة اختيارية. أدخل تكلفة الشحن بصيغتها المعتادة بعملة السوق.")}</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {shippingRates.map((rate) => <div key={rate.id} className="rounded-2xl border border-white/80 bg-[linear-gradient(145deg,#edf3f5,#d5e1e7)] p-4 text-sm shadow-[0_8px_18px_rgba(74,75,112,.09),inset_0_1px_0_white]"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{rate.name} · {rate.market.name}</p>{rate.description && <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{rate.description}</p>}</div><button type="button" onClick={() => { setEditingShippingRateId(rate.id); setShippingMarketId(rate.marketId); setShippingCurrencyCode(rate.currencyCode); setShippingName(rate.name); setShippingDescription(rate.description ?? ""); setShippingAmount(minorUnitsToInput(rate.amountMinor, rate.currency.minorUnit)); setShippingRegion(rate.destinationRegion ?? ""); setShippingMinDays(rate.minDeliveryDays?.toString() ?? ""); setShippingMaxDays(rate.maxDeliveryDays?.toString() ?? ""); }} className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold"><SellerIcon name="edit" />{translate(locale, "Edit", "تعديل")}</button></div><p className="mt-1 text-xs text-[var(--muted)]">{formatCurrencyMinor(rate.amountMinor, rate.currencyCode, rate.currency.minorUnit)}{rate.destinationRegion ? ` · ${rate.destinationRegion}` : ` · ${translate(locale, "All regions", "جميع المناطق")}`}</p><p className="mt-1 text-xs text-[var(--muted)]">{rate.minDeliveryDays ?? "—"}–{rate.maxDeliveryDays ?? "—"} {translate(locale, "days", "يومًا")} · {rate.isActive ? translate(locale, "Active", "نشط") : translate(locale, "Inactive", "غير نشط")}</p></div>)}
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
                              storeId: selectedStore.id, marketId: market.market.id, currencyCode: shippingCurrencyCode || market.market.defaultCurrencyCode,
                              name: shippingName, description: shippingDescription || null,
                              amountMinor: toMinorUnits(shippingAmount, markets.find((item) => item.id === market.market.id)?.currencies.find((entry) => entry.currency.code === (shippingCurrencyCode || market.market.defaultCurrencyCode))?.currency.minorUnit ?? 2),
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
                      }} className="mt-4 grid gap-3 rounded-[1.5rem] border border-dashed border-[#f0c7ad] bg-[#fffaf6] p-4 shadow-[inset_0_2px_7px_rgba(69,69,69,.04)] sm:grid-cols-2">
                        <label className="grid gap-1 text-xs">{translate(locale, "Market", "السوق")}<select required value={shippingMarketId} onChange={(e) => { setShippingMarketId(e.target.value); setShippingCurrencyCode(markets.find((item) => item.id === e.target.value)?.defaultCurrency.code ?? ""); }} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"><option value="">{translate(locale, "Choose market", "اختر سوقًا")}</option>{selectedStore.markets.map(({ market }) => <option key={market.id} value={market.id}>{market.name} · {market.defaultCurrencyCode}</option>)}</select></label>
                        <label className="grid gap-1 text-xs">{translate(locale, "Currency", "العملة")}<select required value={shippingCurrencyCode} onChange={(e) => setShippingCurrencyCode(e.target.value)} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm">{(markets.find((item) => item.id === shippingMarketId)?.currencies ?? []).map(({ currency }) => <option key={currency.code} value={currency.code}>{currency.name} ({currency.code})</option>)}</select></label>
                        <label className="grid gap-1 text-xs">{translate(locale, "Service name", "اسم الخدمة")}<input required minLength={2} maxLength={120} value={shippingName} onChange={(e) => setShippingName(e.target.value)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" /></label>
                        <label className="grid gap-1 text-xs">{translate(locale, "Description", "الوصف")}<input maxLength={500} value={shippingDescription} onChange={(e) => setShippingDescription(e.target.value)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" /></label>
                        <label className="grid gap-1 text-xs">{translate(locale, "Shipping amount", "تكلفة الشحن")}<input required type="number" min="0" step={1 / (10 ** (markets.find((item) => item.id === shippingMarketId)?.currencies.find((entry) => entry.currency.code === shippingCurrencyCode)?.currency.minorUnit ?? 2))} value={shippingAmount} onChange={(e) => setShippingAmount(e.target.value)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" /></label>
                        <label className="grid gap-1 text-xs">{translate(locale, "Destination region", "منطقة الوجهة")}<input maxLength={120} value={shippingRegion} onChange={(e) => setShippingRegion(e.target.value)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" /></label>
                        <label className="grid gap-1 text-xs">{translate(locale, "Minimum days", "الحد الأدنى للأيام")}<input type="number" min="0" max="365" value={shippingMinDays} onChange={(e) => setShippingMinDays(e.target.value)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" /></label>
                        <label className="grid gap-1 text-xs">{translate(locale, "Maximum days", "الحد الأقصى للأيام")}<input type="number" min="0" max="365" value={shippingMaxDays} onChange={(e) => setShippingMaxDays(e.target.value)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" /></label>
                        <button disabled={busy || !selectedStore.markets.length} className="rounded-lg bg-[var(--color-forest-900)] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50 sm:col-span-2"><SellerIcon name="shipping" />{translate(locale, editingShippingRateId ? "Save changes" : "Add shipping service", editingShippingRateId ? "حفظ التعديلات" : "إضافة خدمة شحن")}</button>{editingShippingRateId && <button type="button" onClick={() => { setEditingShippingRateId(""); setShippingName(""); setShippingDescription(""); setShippingAmount("0"); setShippingRegion(""); setShippingMinDays(""); setShippingMaxDays(""); }} className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-xs font-semibold">{translate(locale, "Cancel edit", "إلغاء التعديل")}</button>}
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
