"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Images, MapPin, Plus, Trash2 } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import ProductLocationMap, { type ProductCoordinates } from "@/components/maps/product-location-map";

type Market = {
  id: string; code: string; name: string;
  defaultCurrency: { code: string; minorUnit: number; symbol: string | null };
  currencies: Array<{ currency: { code: string; name: string; minorUnit: number; symbol: string | null } }>;
};
type Category = { id: string; name: string; slug: string; children: Category[] };
type Brand = { id: string; name: string };
type Product = {
  id: string; name: string; slug: string; description: string | null; status: string; approvalStatus: string;
  rejectionReason: string | null; updatedAt: string;
  mapLocation: ProductCoordinates | null;
  propertyDetails: { propertyType: string; listingType: string; bedrooms: number | null; bathrooms: number | null; floorArea: string } | null;
  categories: Array<{ category: { id: string; name: string; slug: string } }>;
  media: Array<{ url: string; altText: string | null; isPrimary: boolean }>;
  variants: Array<{ id: string; sku: string; name: string | null; prices: Array<{ marketId: string; currencyCode: string; amountMinor: string }> }>;
};
type Store = { id: string; name: string; markets: Array<{ market: { id: string } }> };
type Workspace = { stores: Store[] };
type UploadedImage = { url: string; provider: "imgur" | "imagekit"; name: string };

async function json<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data as T;
}
function flatten(items: Category[], prefix = ""): Array<{ id: string; slug: string; label: string }> {
  return items.flatMap((item) => [
    { id: item.id, slug: item.slug, label: prefix + item.name },
    ...flatten(item.children ?? [], prefix + item.name + " / ")
  ]);
}

export default function SellerProductsPage() {
  const { locale } = useLocale();
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState("");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [mapLocation, setMapLocation] = useState<ProductCoordinates | null>(null);
  const [propertyType, setPropertyType] = useState("APARTMENT");
  const [listingType, setListingType] = useState("SALE");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [floorArea, setFloorArea] = useState("");
  const [marketPrices, setMarketPrices] = useState<Record<string, { currencyCode: string; amountMinor: string }>>({});
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const categoryOptions = useMemo(() => flatten(categories), [categories]);
  const isRealEstate = categoryOptions.find((category) => category.id === categoryId)?.slug === "real-estate";
  const imagePreviews = [
    ...uploadedImages.map((image) => ({ url: image.url, name: image.name, provider: image.provider })),
    ...(imageUrl.trim() ? [{ url: imageUrl.trim(), name: name || "Hosted image", provider: "hosted" as const }] : [])
  ];
  const activePreviewIndex = imagePreviews.length
    ? Math.min(selectedPreviewIndex, imagePreviews.length - 1)
    : 0;
  const activePreview = imagePreviews[activePreviewIndex];
  const thumbnailIndexes = imagePreviews.length
    ? Array.from({ length: Math.min(6, imagePreviews.length) }, (_, index) => (activePreviewIndex + index) % imagePreviews.length)
    : [];
  const selectedImageCount = uploadedImages.length + (imageUrl.trim() ? 1 : 0);
  const enabledMarketIds = useMemo(() => new Set(stores.find((store) => store.id === storeId)?.markets.map((entry) => entry.market.id) ?? []), [stores, storeId]);
  const availableMarkets = markets.filter((market) => enabledMarketIds.has(market.id));

  const loadProducts = useCallback(async (id: string, q = "") => {
    if (!id) return;
    const params = new URLSearchParams({ storeId: id });
    if (q.trim()) params.set("q", q.trim());
    const result = await json<{ items: Product[] }>(await fetch(`/api/seller/products?${params.toString()}`, { cache: "no-store" }));
    setProducts(result.items);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/seller/stores", { cache: "no-store" }).then((r) => json<Workspace>(r)),
      fetch("/api/markets").then((r) => json<{ items: Market[] }>(r)),
      fetch("/api/categories?limit=100&includeEmpty=true").then((r) => json<{ items: Category[] }>(r)),
      fetch("/api/brands?limit=100").then((r) => json<{ items: Brand[] }>(r))
    ]).then(([workspace, marketResult, categoryResult, brandResult]) => {
      if (!active) return;
      setStores(workspace.stores);
      setMarkets(marketResult.items);
      setCategories(categoryResult.items);
      setBrands(brandResult.items);
      const preferredStoreId = window.localStorage.getItem("mtjr.activeStoreId");
      const initialStore = workspace.stores.find((store) => store.id === preferredStoreId) ?? workspace.stores[0];
      if (initialStore) {
        setStoreId(initialStore.id);
        const enabled = new Set(initialStore.markets.map((entry) => entry.market.id));
        setMarketPrices(Object.fromEntries(marketResult.items.filter((market) => enabled.has(market.id)).map((market) => [market.id, { currencyCode: market.defaultCurrency.code, amountMinor: "" }])));
      }
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load seller catalog.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!storeId) return;
    let active = true;
    const timer = window.setTimeout(() => { void loadProducts(storeId, search).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load products.");
    }); }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [storeId, search, loadProducts]);

  async function uploadImages(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const selected = Array.from(input.files ?? []);
    input.value = "";
    if (!selected.length) return;
    if (!storeId) {
      setError(translate(locale, "Choose a store before uploading images.", "اختر متجرًا قبل رفع الصور."));
      return;
    }
    const remaining = Math.max(0, 8 - selectedImageCount);
    if (!remaining) {
      setError(translate(locale, "A listing can include up to eight images.", "يمكن أن يتضمن الإعلان ثماني صور كحد أقصى."));
      return;
    }
    if (selected.length > remaining) {
      setError(translate(locale, "Only the first eight available image slots can be filled.", "يمكن تعبئة خانات الصور الثماني المتاحة فقط."));
    } else {
      setError("");
    }

    setUploading(true);
    for (const file of selected.slice(0, remaining)) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
        setError(translate(locale, "Use JPEG, PNG, or WebP images no larger than 8 MB.", "استخدم صور JPEG أو PNG أو WebP بحجم لا يتجاوز 8 ميغابايت."));
        continue;
      }
      const body = new FormData();
      body.append("storeId", storeId);
      body.append("file", file);
      try {
        const uploaded = await json<{ url: string; provider: UploadedImage["provider"] }>(
          await fetch("/api/seller/products/images", { method: "POST", body })
        );
        setUploadedImages((current) => [...current, { ...uploaded, name: file.name }]);
        setMessage(translate(locale, `Image uploaded with ${uploaded.provider === "imgur" ? "Imgur" : "ImageKit"}.`, `تم رفع الصورة باستخدام ${uploaded.provider === "imgur" ? "Imgur" : "ImageKit"}.`));
      } catch (cause) {
        setError(cause instanceof Error
          ? cause.message
          : translate(locale, "Image upload failed.", "تعذر رفع الصورة."));
        break;
      }
    }
    setUploading(false);
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const draftImages = [
      ...uploadedImages.map((image) => ({ url: image.url, altText: name })),
      ...(imageUrl.trim() ? [{ url: imageUrl.trim(), altText: name }] : [])
    ];
    const primaryImage = draftImages[activePreviewIndex];
    const orderedImages = primaryImage
      ? [primaryImage, ...draftImages.filter((_, index) => index !== activePreviewIndex)]
      : draftImages;
    const media = orderedImages.slice(0, 8).map((image, index) => ({ ...image, sortOrder: index, isPrimary: index === 0 }));
    if (!media.length) {
      setError(translate(locale, "Upload at least one product image.", "ارفع صورة واحدة على الأقل للمنتج."));
      return;
    }
    if (isRealEstate && !mapLocation) {
      setError(translate(locale, "Select a map location for this real-estate listing.", "حدد موقعًا على الخريطة لهذا الإعلان العقاري."));
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const product = await json<{ id: string }>(await fetch("/api/products", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId, name, slug, description, ...(brandId ? { brandId } : {}),
          categoryIds: categoryId ? [categoryId] : [],
          media,
          ...(mapLocation ? { mapLocation } : {}),
          ...(isRealEstate ? {
            propertyDetails: {
              propertyType,
              listingType,
              bedrooms: bedrooms ? Number(bedrooms) : null,
              bathrooms: bathrooms ? Number(bathrooms) : null,
              floorArea
            }
          } : {}),
          variants: [{ sku, prices: availableMarkets.map((market) => ({ marketId: market.id, currencyCode: marketPrices[market.id]?.currencyCode ?? market.defaultCurrency.code, amountMinor: marketPrices[market.id]?.amountMinor ?? "" })) }]
        })
      }));
      setMessage(`${translate(locale, "Draft product created", "تم إنشاء مسودة المنتج")} (${product.id}). ${translate(locale, "It is awaiting platform review.", "بانتظار مراجعة المنصة.")}`);
      setName(""); setSlug(""); setDescription(""); setSku(""); setImageUrl(""); setUploadedImages([]); setSelectedPreviewIndex(0); setMapLocation(null);
      setPropertyType("APARTMENT"); setListingType("SALE"); setBedrooms(""); setBathrooms(""); setFloorArea("");
      setMarketPrices(Object.fromEntries(availableMarkets.map((market) => [market.id, { currencyCode: market.defaultCurrency.code, amountMinor: "" }]))); setCategoryId(""); setBrandId("");
      await loadProducts(storeId, search);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate(locale, "Product could not be created.", "تعذر إنشاء المنتج."));
    } finally { setBusy(false); }
  }

  async function saveProductEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await json(await fetch(`/api/products/${encodeURIComponent(editingId)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, slug: editSlug, description: editDescription })
      }));
      setEditingId("");
      setMessage(translate(locale, "Draft product updated and returned to pending review.", "تم تحديث مسودة المنتج وإعادتها إلى قائمة المراجعة."));
      await loadProducts(storeId, search);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate(locale, "Product could not be updated.", "تعذر تحديث المنتج."));
    } finally { setBusy(false); }
  }

  async function publish(id: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      await json(await fetch(`/api/products/${encodeURIComponent(id)}/publish`, { method: "POST" }));
      setMessage(translate(locale, "Product published.", "تم نشر المنتج."));
      await loadProducts(storeId, search);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate(locale, "Product could not be published.", "تعذر نشر المنتج."));
    } finally { setBusy(false); }
  }

  const inputClass = "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm";
  return <main className="min-h-screen bg-[var(--background)]">
    <header className="border-b border-[var(--border)] bg-[var(--background)]"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><Link href="/" className="text-2xl font-semibold text-[var(--color-ink-950)]">mtjr<span className="text-[var(--color-lavender-600)]">.</span></Link><Link href="/seller" className="text-sm font-medium text-[var(--color-ink-800)]">← Seller workspace</Link></div></header>
    <div className="mx-auto max-w-6xl px-5 py-10">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-lavender-600)]">{translate(locale, "Catalog management", "إدارة الكتالوج")}</p>
      <h1 className="mt-2 text-3xl font-semibold text-[var(--color-ink-950)]">{translate(locale, "Products", "المنتجات")}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{translate(locale, "Create draft products using your store's enabled markets. Product review and publication are enforced by the backend.", "أنشئ مسودات منتجات باستخدام الأسواق المفعلة لمتجرك. تتم مراجعة المنتجات ونشرها بواسطة النظام الخلفي.")}</p>
      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="mt-5 rounded-xl border border-[var(--color-sage-500)] bg-[var(--color-sage-100)] p-3 text-sm">{message}</p>}
      {loading ? <p className="py-12 text-sm text-[var(--muted)]">{translate(locale, "Loading catalog…", "جارٍ تحميل الكتالوج…")}</p> : <div className="mt-8 grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="text-lg font-semibold">{translate(locale, "Create product draft", "إنشاء مسودة منتج")}</h2>
          <label className="mt-5 grid gap-2 text-sm font-medium">{translate(locale, "Store", "المتجر")}<select className={inputClass} value={storeId} onChange={(e) => {
            const nextId = e.target.value;
            setStoreId(nextId);
            window.localStorage.setItem("mtjr.activeStoreId", nextId);
            setProducts([]);
            const nextStore = stores.find((store) => store.id === nextId);
            const allowed = new Set(nextStore?.markets.map((entry) => entry.market.id) ?? []);
            setMarketPrices(Object.fromEntries(markets.filter((market) => allowed.has(market.id)).map((market) => [market.id, { currencyCode: market.defaultCurrency.code, amountMinor: "" }])));
          }}>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
          {!stores.length ? <p className="mt-4 rounded-xl bg-[var(--surface-soft)] p-4 text-sm">{translate(locale, "Create a store and activate its markets before adding products.", "أنشئ متجرًا وفعّل أسواقه قبل إضافة المنتجات.")}</p> : <form onSubmit={createProduct} className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm">{translate(locale, "Product name", "اسم المنتج")}<input required minLength={2} maxLength={180} className={inputClass} value={name} onChange={(e) => { setName(e.target.value); setSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} /></label>
            <label className="grid gap-1 text-sm">{translate(locale, "URL slug", "معرّف الرابط")}<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={inputClass} value={slug} onChange={(e) => setSlug(e.target.value)} /></label>
            <label className="grid gap-1 text-sm">{translate(locale, "Description", "الوصف")}<textarea maxLength={12000} rows={3} className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
            <label className="grid gap-1 text-sm">SKU<input required maxLength={100} className={inputClass} value={sku} onChange={(e) => setSku(e.target.value)} /></label>
            <section className="grid gap-3 rounded-2xl border border-[var(--border)] p-4">
              <div className="flex items-center gap-2">
                <Images aria-hidden="true" className="size-5 text-[var(--color-copper-600)]" />
                <h3 className="text-sm font-semibold">{translate(locale, "Listing images", "صور الإعلان")}</h3>
              </div>
              <p className="text-xs leading-5 text-[var(--muted)]">{translate(locale, "Upload up to eight JPEG, PNG, or WebP images. Imgur is used first; ImageKit is the fallback.", "ارفع حتى ثماني صور JPEG أو PNG أو WebP. يُستخدم Imgur أولًا ثم ImageKit عند تعذره.")}</p>
              <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold">
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading || busy || selectedImageCount >= 8} onChange={uploadImages} className="sr-only" />
                <Images aria-hidden="true" className="size-4" />
                {uploading ? translate(locale, "Uploading…", "جارٍ الرفع…") : translate(locale, "Choose images", "اختر الصور")}
              </label>
              <label className="grid gap-1 text-sm">{translate(locale, "Or add a hosted image URL", "أو أضف رابط صورة مستضافة")}<input type="url" disabled={uploadedImages.length >= 8 && !imageUrl.trim()} className={inputClass} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" /></label>
              <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)]">
                <div className="relative flex aspect-[4/3] items-center justify-center">
                  {activePreview
                    ? <img src={activePreview.url} alt={activePreview.name} className="size-full object-contain" />
                    : <div className="flex flex-col items-center gap-2 text-[var(--muted)]"><Images aria-hidden="true" className="size-10" /><span className="text-sm">{translate(locale, "Your main image preview will appear here", "ستظهر معاينة الصورة الرئيسية هنا")}</span></div>}
                  {activePreview && imagePreviews.length > 1 && <>
                    <button type="button" onClick={() => setSelectedPreviewIndex((activePreviewIndex - 1 + imagePreviews.length) % imagePreviews.length)} aria-label={translate(locale, "Previous image", "الصورة السابقة")} className="absolute left-3 top-1/2 rounded-full bg-white/90 p-2 shadow"><ChevronLeft aria-hidden="true" className="size-5" /></button>
                    <button type="button" onClick={() => setSelectedPreviewIndex((activePreviewIndex + 1) % imagePreviews.length)} aria-label={translate(locale, "Next image", "الصورة التالية")} className="absolute right-3 top-1/2 rounded-full bg-white/90 p-2 shadow"><ChevronRight aria-hidden="true" className="size-5" /></button>
                    <button type="button" disabled={busy || uploading} onClick={() => {
                      if (activePreviewIndex < uploadedImages.length) {
                        setUploadedImages((current) => current.filter((_, index) => index !== activePreviewIndex));
                      } else {
                        setImageUrl("");
                      }
                      setSelectedPreviewIndex(Math.max(0, activePreviewIndex - 1));
                    }} aria-label={translate(locale, "Remove selected image", "إزالة الصورة المحددة")} className="absolute right-3 top-3 rounded-lg bg-white p-2 text-[var(--color-onyx)] shadow disabled:opacity-50"><Trash2 aria-hidden="true" className="size-4" /></button>
                  </>}
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-[var(--border)] p-2 sm:grid-cols-6">
                  {Array.from({ length: 6 }, (_, slot) => {
                    const previewIndex = thumbnailIndexes[slot];
                    const preview = previewIndex === undefined ? undefined : imagePreviews[previewIndex];
                    return preview && previewIndex !== undefined
                      ? <button type="button" key={`${preview.url}-${previewIndex}`} onClick={() => setSelectedPreviewIndex(previewIndex)} aria-label={translate(locale, `Show image ${previewIndex + 1}: ${preview.name}`, `عرض الصورة ${previewIndex + 1}: ${preview.name}`)} aria-pressed={previewIndex === activePreviewIndex} className={`aspect-square overflow-hidden rounded-lg border-2 transition hover:border-[var(--color-copper-500)] focus-visible:outline-2 focus-visible:outline-[var(--color-copper-600)] ${previewIndex === activePreviewIndex ? "border-[var(--color-copper-600)]" : "border-transparent"}`}><img src={preview.url} alt="" className="size-full object-cover" /></button>
                      : <div key={`empty-${slot}`} aria-hidden="true" className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-[var(--muted)]"><Plus className="size-5" /></div>;
                  })}
                </div>
              </div>
              <p className="text-xs text-[var(--muted)]">{selectedImageCount}/8 {translate(locale, "images selected; the first image is the cover.", "صور محددة؛ الصورة الأولى هي الغلاف.")}</p>
            </section>
            <label className="grid gap-1 text-sm">{translate(locale, "Category", "الفئة")}<select className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">{translate(locale, "No category", "بلا فئة")}</option>{categoryOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            {isRealEstate && <section className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <h3 className="text-sm font-semibold">{translate(locale, "Property details", "تفاصيل العقار")}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">{translate(locale, "Property type", "نوع العقار")}<select required className={inputClass} value={propertyType} onChange={(e) => setPropertyType(e.target.value)}>
                  <option value="APARTMENT">{translate(locale, "Apartment", "شقة")}</option>
                  <option value="HOUSE">{translate(locale, "House / villa", "منزل / فيلا")}</option>
                  <option value="LAND">{translate(locale, "Land", "أرض")}</option>
                  <option value="COMMERCIAL">{translate(locale, "Commercial property", "عقار تجاري")}</option>
                </select></label>
                <label className="grid gap-1 text-sm">{translate(locale, "Listing type", "نوع العرض")}<select required className={inputClass} value={listingType} onChange={(e) => setListingType(e.target.value)}>
                  <option value="SALE">{translate(locale, "For sale", "للبيع")}</option>
                  <option value="RENT">{translate(locale, "For rent", "للإيجار")}</option>
                </select></label>
                <label className="grid gap-1 text-sm">{translate(locale, "Bedrooms", "غرف النوم")}<input type="number" min="0" max="100" className={inputClass} value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} /></label>
                <label className="grid gap-1 text-sm">{translate(locale, "Bathrooms", "الحمامات")}<input type="number" min="0" max="100" className={inputClass} value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} /></label>
                <label className="grid gap-1 text-sm sm:col-span-2">{translate(locale, "Floor area (m²)", "المساحة (م²)")}<input required type="number" min="0.01" max="999999999" step="0.01" className={inputClass} value={floorArea} onChange={(e) => setFloorArea(e.target.value)} /></label>
              </div>
            </section>}
            <section className="grid gap-3 rounded-2xl border border-[var(--border)] p-4">
              <div className="flex items-center gap-2">
                <MapPin aria-hidden="true" className="size-5 text-[var(--color-copper-600)]" />
                <h3 className="text-sm font-semibold">{translate(locale, "Product location", "موقع المنتج")}</h3>
              </div>
              <p className="text-xs leading-5 text-[var(--muted)]">{translate(locale, "Choose a map pin if location matters. Shoppers see an approximate area; your exact pin is kept private. A location is required for real-estate listings.", "حدد الموقع على الخريطة إذا كان مهمًا. سيرى المتسوقون منطقة تقريبية، بينما يبقى موقعك الدقيق خاصًا. الموقع مطلوب للإعلانات العقارية.")}</p>
              <ProductLocationMap
                value={mapLocation}
                onChange={setMapLocation}
                label={translate(locale, "Choose product location on map", "اختر موقع المنتج على الخريطة")}
              />
              {mapLocation && <div className="flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
                <span>{mapLocation.latitude.toFixed(5)}, {mapLocation.longitude.toFixed(5)}</span>
                <button type="button" onClick={() => setMapLocation(null)} className="rounded-lg border border-[var(--border)] px-3 py-1.5 font-semibold">{translate(locale, "Clear location", "مسح الموقع")}</button>
              </div>}
            </section>
            <label className="grid gap-1 text-sm">{translate(locale, "Brand", "العلامة التجارية")}<select className={inputClass} value={brandId} onChange={(e) => setBrandId(e.target.value)}><option value="">{translate(locale, "No brand", "بلا علامة تجارية")}</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
            <div className="grid gap-3 rounded-2xl bg-[var(--surface-soft)] p-4">
              <p className="text-sm font-semibold">{translate(locale, "Prices for every enabled store market", "أسعار كل سوق مفعّل للمتجر")}</p>
              {!availableMarkets.length && <p className="text-xs text-amber-800">{translate(locale, "This store has no active markets enabled.", "لا توجد أسواق مفعّلة لهذا المتجر.")}</p>}
              {availableMarkets.map((market) => {
                const draft = marketPrices[market.id] ?? { currencyCode: market.defaultCurrency.code, amountMinor: "" };
                const currencies = market.currencies.map((entry) => entry.currency);
                const currency = currencies.find((item) => item.code === draft.currencyCode) ?? market.defaultCurrency;
                return <div key={market.id} className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                  <p className="text-sm font-semibold">{market.name}</p>
                  <label className="grid gap-1 text-sm">{translate(locale, "Currency", "العملة")}<select required className={inputClass} value={draft.currencyCode} onChange={(e) => setMarketPrices((current) => ({ ...current, [market.id]: { ...draft, currencyCode: e.target.value } }))}>{currencies.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}</select></label>
                  <label className="grid gap-1 text-sm">{translate(locale, "Price in minor units", "السعر بالوحدات الصغرى")}<input required inputMode="numeric" pattern="[0-9]+" className={inputClass} value={draft.amountMinor} onChange={(e) => setMarketPrices((current) => ({ ...current, [market.id]: { ...draft, amountMinor: e.target.value } }))} placeholder={translate(locale, "e.g. 1299", "مثال: 1299")} /><span className="text-xs text-[var(--muted)]">{translate(locale, "Integer minor units · precision", "عدد صحيح بالوحدات الصغرى · الدقة")} {currency.minorUnit}.</span></label>
                </div>;
              })}
            </div>
            <button disabled={busy || uploading || !storeId || (!uploadedImages.length && !imageUrl.trim()) || (isRealEstate && (!mapLocation || !floorArea)) || !availableMarkets.length || availableMarkets.some((market) => !/^(0|[1-9][0-9]{0,17})$/.test(marketPrices[market.id]?.amountMinor ?? ""))} className="mt-2 rounded-xl bg-[var(--color-ink-800)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? translate(locale, "Saving…", "جارٍ الحفظ…") : translate(locale, "Create draft product", "إنشاء مسودة منتج")}</button>
          </form>}
        </section>
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="text-lg font-semibold">{translate(locale, "Store catalog", "كتالوج المتجر")}</h2><label className="mt-4 block text-xs font-medium">{translate(locale, "Search this store catalog", "البحث في كتالوج المتجر")}<input value={search} onChange={event=>setSearch(event.target.value)} maxLength={120} placeholder={translate(locale, "Product name, slug, SKU or barcode", "اسم المنتج أو المعرّف أو SKU أو الباركود")} className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm"/></label>
          {!products.length ? <p className="mt-4 rounded-xl bg-[var(--surface-soft)] p-5 text-sm text-[var(--muted)]">{search ? translate(locale, "No products match this search.", "لا توجد منتجات تطابق هذا البحث.") : translate(locale, "No products in this store yet.", "لا توجد منتجات في هذا المتجر بعد.")}</p> : <div className="mt-4 divide-y divide-[var(--border)]">{products.map((product) => <article key={product.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              {product.media.length > 0 && <div className="grid w-24 shrink-0 grid-cols-2 gap-1">
                {product.media.slice(0, 4).map((media) => <img key={media.url} src={media.url} alt={media.altText ?? product.name} className="aspect-square w-full rounded-md object-cover" />)}
              </div>}
              <div className="min-w-0"><h3 className="font-semibold">{product.name}</h3><p className="mt-1 text-xs text-[var(--muted)]">/{product.slug} · {product.variants.length} {translate(locale, "variants", "متغيرات")}</p>
                {product.categories[0] && <p className="mt-1 text-xs text-[var(--muted)]">{product.categories[0].category.name}</p>}
                {product.propertyDetails && <p className="mt-1 text-xs text-[var(--muted)]">{translate(locale, product.propertyDetails.propertyType, ({
                  APARTMENT: "شقة", HOUSE: "منزل / فيلا", LAND: "أرض", COMMERCIAL: "عقار تجاري"
                } as Record<string, string>)[product.propertyDetails.propertyType] ?? product.propertyDetails.propertyType)} · {product.propertyDetails.floorArea} m² · {product.propertyDetails.listingType === "SALE" ? translate(locale, "For sale", "للبيع") : translate(locale, "For rent", "للإيجار")}</p>}
                {product.mapLocation && <p className="mt-1 flex items-center gap-1 text-xs text-[var(--muted)]"><MapPin aria-hidden="true" className="size-3" />{product.mapLocation.latitude.toFixed(5)}, {product.mapLocation.longitude.toFixed(5)}</p>}
                <div className="mt-2 flex flex-wrap gap-2"><span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs">{translate(locale, product.status, product.status === "DRAFT" ? "مسودة" : product.status)}</span><span className="rounded-full bg-[var(--color-sage-100)] px-2.5 py-1 text-xs">{translate(locale, product.approvalStatus, product.approvalStatus === "PENDING" ? "قيد المراجعة" : product.approvalStatus === "APPROVED" ? "مقبول" : product.approvalStatus === "REJECTED" ? "مرفوض" : product.approvalStatus)}</span></div>
                {product.rejectionReason && <p className="mt-2 text-xs text-red-700">{translate(locale, "Review:", "ملاحظة المراجعة:")} {product.rejectionReason}</p>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {product.status === "DRAFT" && <button disabled={busy} onClick={() => { setEditingId(product.id); setEditName(product.name); setEditSlug(product.slug); setEditDescription(product.description ?? ""); }} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold">{translate(locale, "Edit draft", "تعديل المسودة")}</button>}
              {product.status === "DRAFT" && product.approvalStatus === "APPROVED" && <button disabled={busy} onClick={() => publish(product.id)} className="rounded-lg bg-[var(--color-ink-800)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{translate(locale, "Publish", "نشر")}</button>}
            </div>
          </article>)}</div>}
          {editingId && <form onSubmit={saveProductEdit} className="mt-5 grid gap-3 rounded-2xl border border-[var(--border)] p-4">
            <h3 className="font-semibold">{translate(locale, "Edit draft product", "تعديل مسودة المنتج")}</h3>
            <label className="grid gap-1 text-sm">{translate(locale, "Name", "الاسم")}<input required minLength={2} maxLength={180} className={inputClass} value={editName} onChange={(e) => setEditName(e.target.value)} /></label>
            <label className="grid gap-1 text-sm">{translate(locale, "Slug", "المعرّف")}<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={inputClass} value={editSlug} onChange={(e) => setEditSlug(e.target.value)} /></label>
            <label className="grid gap-1 text-sm">{translate(locale, "Description", "الوصف")}<textarea maxLength={12000} rows={3} className={inputClass} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} /></label>
            <div className="flex gap-2"><button disabled={busy} className="rounded-lg bg-[var(--color-ink-800)] px-4 py-2 text-xs font-semibold text-white">{translate(locale, "Save changes", "حفظ التغييرات")}</button><button type="button" onClick={() => setEditingId("")} className="rounded-lg border border-[var(--border)] px-4 py-2 text-xs">{translate(locale, "Cancel", "إلغاء")}</button></div>
          </form>}
        </section>
      </div>}
    </div>
  </main>;
}
