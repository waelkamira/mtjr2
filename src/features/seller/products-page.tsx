"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowUp, ImagePlus, Images, MapPin, Pencil, Star, Trash2, Upload } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import ProductLocationMap, { type ProductCoordinates } from "@/components/maps/product-location-map";
import SyriaLocationPicker from "@/components/maps/syria-location-picker";
import { toMinorUnits } from "@/lib/money";
import { buildCategoryFieldsForEdit, getCategoryFieldPresets, mergeEditedCategoryFields } from "@/lib/catalog/category-field-presets";

type Market = {
  id: string; code: string; name: string;
  defaultCurrency: { code: string; minorUnit: number; symbol: string | null };
  currencies: Array<{ currency: { code: string; name: string; minorUnit: number; symbol: string | null } }>;
};
type Category = { id: string; name: string; slug: string; children: Category[] };
type Brand = { id: string; name: string };
type Product = {
  id: string; productNumber: string; name: string; slug: string; description: string | null; city: string | null; district: string | null; contactPhone: string | null; videoUrl: string | null; customFields: unknown; brandId: string | null; status: string; approvalStatus: string;
  rejectionReason: string | null; updatedAt: string;
  mapLocation: ProductCoordinates | null;
  propertyDetails: { propertyType: string; listingType: string; bedrooms: number | null; bathrooms: number | null; floorArea: string } | null;
  categories: Array<{ category: { id: string; name: string; slug: string } }>;
  media: Array<{ url: string; storageKey: string | null; mimeType: string | null; width: number | null; height: number | null; altText: string | null; sortOrder: number; isPrimary: boolean }>;
  variants: Array<{ id: string; sku: string; name: string | null; prices: Array<{ marketId: string; currencyCode: string; amountMinor: string }> }>;
};
type Store = { id: string; name: string; markets: Array<{ market: { id: string } }> };
type Workspace = { stores: Store[] };
type UploadedImage = { url: string; provider: "imgur" | "imagekit"; storageKey: string; mimeType: string; width?: number; height?: number; name: string };

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
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [geography, setGeography] = useState<{ governorateId: string; districtId?: string; subdistrictId?: string; localityId?: string; neighborhoodId?: string; source: "opensyria"; sourceVersion: "v0.1.5" } | null>(null);
  const [contactPhone, setContactPhone] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [initialStock, setInitialStock] = useState("1");
  const [customFields, setCustomFields] = useState<Array<{ key: string; value: string; label?: string; required?: boolean }>>([]);
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [weightGrams, setWeightGrams] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [mapLocation, setMapLocation] = useState<ProductCoordinates | null>(null);
  const [mapFocus, setMapFocus] = useState<{ coordinates: ProductCoordinates; zoom: number; key: string } | null>(null);
  const [propertyType, setPropertyType] = useState("APARTMENT");
  const [listingType, setListingType] = useState("SALE");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [floorArea, setFloorArea] = useState("");
  const [marketPrices, setMarketPrices] = useState<Record<string, { currencyCode: string; amount: string }>>({});
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editOriginalCustomFields, setEditOriginalCustomFields] = useState<unknown>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editDistrict, setEditDistrict] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editVideoUrl, setEditVideoUrl] = useState("");
  const [editBrandId, setEditBrandId] = useState("");
  const [editCategoryIds, setEditCategoryIds] = useState<string[]>([]);
  const [editCustomFields, setEditCustomFields] = useState<Array<{ key: string; value: string; label?: string }>>([]);
  const [editMapLocation, setEditMapLocation] = useState<ProductCoordinates | null>(null);
  const [editPropertyType, setEditPropertyType] = useState("APARTMENT");
  const [editListingType, setEditListingType] = useState("SALE");
  const [editBedrooms, setEditBedrooms] = useState("");
  const [editBathrooms, setEditBathrooms] = useState("");
  const [editFloorArea, setEditFloorArea] = useState("");
  const [editMedia, setEditMedia] = useState<Product["media"]>([]);

  const categoryOptions = useMemo(() => flatten(categories), [categories]);
  const editIsRealEstate = editCategoryIds.some((id) => categoryOptions.find((category) => category.id === id)?.slug === "real-estate");
  const isRealEstate = categoryOptions.find((category) => category.id === categoryId)?.slug === "real-estate";
  const imagePreviews = [
    ...uploadedImages.map((image) => ({ url: image.url, name: image.name, provider: image.provider })),
    ...(imageUrl.trim() ? [{ url: imageUrl.trim(), name: name || "Hosted image", provider: "hosted" as const }] : [])
  ];
  const activePreviewIndex = imagePreviews.length
    ? Math.min(selectedPreviewIndex, imagePreviews.length - 1)
    : 0;
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
        setMarketPrices(Object.fromEntries(marketResult.items.filter((market) => enabled.has(market.id)).map((market) => [market.id, { currencyCode: market.defaultCurrency.code, amount: "" }])));
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
        const uploaded = await json<Omit<UploadedImage, "name">>(
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

  async function uploadDroppedImages(files: File[]) {
    if (!files.length) return;
    if (!storeId) { setError(translate(locale, "Choose a store before uploading images.", "اختر متجرًا قبل رفع الصور.")); return; }
    const remaining = Math.max(0, 8 - selectedImageCount);
    if (!remaining) { setError(translate(locale, "A listing can include up to eight images.", "يمكن أن يتضمن الإعلان ثماني صور كحد أقصى.")); return; }
    setUploading(true); setError("");
    for (const file of files.slice(0, remaining)) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
        setError(translate(locale, "Use JPEG, PNG, or WebP images no larger than 8 MB.", "استخدم صور JPEG أو PNG أو WebP بحجم لا يتجاوز 8 ميغابايت."));
        continue;
      }
      const body = new FormData(); body.append("storeId", storeId); body.append("file", file);
      try {
        const uploaded = await json<Omit<UploadedImage, "name">>(await fetch("/api/seller/products/images", { method: "POST", body }));
        setUploadedImages((current) => [...current, { ...uploaded, name: file.name }]);
        setMessage(translate(locale, "Image uploaded successfully.", "تم رفع الصورة بنجاح."));
      } catch (cause) { setError(cause instanceof Error ? cause.message : translate(locale, "Image upload failed.", "تعذر رفع الصورة.")); break; }
    }
    setUploading(false);
  }

  function handleImageDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    void uploadDroppedImages(Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith("image/")));
  }

  async function replaceSelectedImage(event: ChangeEvent<HTMLInputElement>, replaceIndex = activePreviewIndex) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file || !storeId) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setError(translate(locale, "Use JPEG, PNG, or WebP images no larger than 8 MB.", "استخدم صورة JPEG أو PNG أو WebP بحجم لا يتجاوز 8 ميغابايت."));
      return;
    }
    setUploading(true); setError("");
    try {
      const body = new FormData(); body.append("storeId", storeId); body.append("file", file);
      const uploaded = await json<Omit<UploadedImage, "name">>(await fetch("/api/seller/products/images", { method: "POST", body }));
      const replacement = { ...uploaded, name: file.name };
      if (replaceIndex < uploadedImages.length) {
        setUploadedImages((current) => current.map((image, index) => index === replaceIndex ? replacement : image));
      } else {
        setUploadedImages((current) => [...current, replacement]); setImageUrl("");
        setSelectedPreviewIndex(replaceIndex);
      }
      setMessage(translate(locale, "Image replaced successfully.", "تم استبدال الصورة بنجاح."));
    } catch (cause) { setError(cause instanceof Error ? cause.message : translate(locale, "Image replacement failed.", "تعذر استبدال الصورة.")); }
    finally { setUploading(false); }
  }

  function removeCreateImage(index: number) {
    if (index < uploadedImages.length) {
      setUploadedImages((current) => current.filter((_, imageIndex) => imageIndex !== index));
    } else {
      setImageUrl("");
    }
    setSelectedPreviewIndex((current) => Math.min(current > index ? current - 1 : current, Math.max(0, selectedImageCount - 2)));
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const draftImages = [
      ...uploadedImages.map((image) => ({ url: image.url, storageKey: image.storageKey, mimeType: image.mimeType, ...(image.width ? { width: image.width } : {}), ...(image.height ? { height: image.height } : {}), altText: name })),
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
    if (customFields.some((field) => field.label && !field.value.trim())) {
      setError(translate(locale, "Complete all category-specific required details.", "أكمل جميع التفاصيل المطلوبة الخاصة بالفئة."));
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
          storeId, name, slug, description, city, district, geography: geography ?? undefined, contactPhone, videoUrl: videoUrl || undefined,
          initialStock: Number(initialStock),
          customFields: Object.fromEntries(customFields.filter((field) => field.key.trim() && field.value.trim()).map((field) => [field.key.trim(), field.value.trim()])),
          ...(brandId ? { brandId } : {}),
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
          variants: [{ sku, ...(barcode.trim() ? { barcode: barcode.trim() } : {}), ...(weightGrams !== "" ? { weightGrams: Number(weightGrams) } : {}), prices: availableMarkets.map((market) => {
            const currencyCode = marketPrices[market.id]?.currencyCode ?? market.defaultCurrency.code;
            const currency = market.currencies.find((entry) => entry.currency.code === currencyCode)?.currency ?? market.defaultCurrency;
            return { marketId: market.id, currencyCode, amountMinor: toMinorUnits(marketPrices[market.id]?.amount ?? "", currency.minorUnit) };
          }) }]
        })
      }));
      setMessage(`${translate(locale, "Draft product created", "تم إنشاء مسودة المنتج")} (${product.id}). ${translate(locale, "It is awaiting platform review.", "بانتظار مراجعة المنصة.")}`);
      setName(""); setSlug(""); setDescription(""); setCity(""); setDistrict(""); setGeography(null); setContactPhone(""); setVideoUrl(""); setInitialStock("1"); setCustomFields([]); setSku(""); setBarcode(""); setWeightGrams(""); setImageUrl(""); setUploadedImages([]); setSelectedPreviewIndex(0); setMapLocation(null); setMapFocus(null);
      setPropertyType("APARTMENT"); setListingType("SALE"); setBedrooms(""); setBathrooms(""); setFloorArea("");
      setMarketPrices(Object.fromEntries(availableMarkets.map((market) => [market.id, { currencyCode: market.defaultCurrency.code, amount: "" }]))); setCategoryId(""); setBrandId("");
      await loadProducts(storeId, search);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate(locale, "Product could not be created.", "تعذر إنشاء المنتج."));
    } finally { setBusy(false); }
  }

  async function uploadEditMedia(files: File[], replaceIndex?: number) {
    if (!storeId || !files.length) return;
    const available = replaceIndex === undefined ? 8 - editMedia.length : 1;
    if (available <= 0) {
      setError(translate(locale, "A listing can include up to eight images.", "يمكن أن يتضمن الإعلان ثماني صور كحد أقصى."));
      return;
    }
    setUploading(true); setError("");
    try {
      const additions: Product["media"][number][] = [];
      for (const file of files.slice(0, available)) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
          throw new Error(translate(locale, "Use JPEG, PNG, or WebP images no larger than 8 MB.", "استخدم صور JPEG أو PNG أو WebP بحجم لا يتجاوز 8 ميغابايت."));
        }
        const body = new FormData(); body.append("storeId", storeId); body.append("file", file);
        const uploaded = await json<Omit<UploadedImage, "name">>(await fetch("/api/seller/products/images", { method: "POST", body }));
        additions.push({ url: uploaded.url, storageKey: uploaded.storageKey, mimeType: uploaded.mimeType, width: uploaded.width ?? null, height: uploaded.height ?? null, altText: file.name, sortOrder: 0, isPrimary: false });
      }
      setEditMedia((current) => {
        const next = [...current];
        if (replaceIndex !== undefined) {
          const replacement = additions[0];
          if (replacement) next.splice(replaceIndex, 1, replacement);
        } else next.push(...additions);
        return next.map((media, index) => ({
          ...media,
          sortOrder: index,
          isPrimary: replaceIndex !== undefined
            ? (current[replaceIndex]?.isPrimary ?? false)
            : (index === 0 && current.length === 0 ? true : media.isPrimary)
        }));
      });
      setMessage(translate(locale, "Product images uploaded. Save the draft to apply the changes.", "تم رفع الصور. احفظ المسودة لتطبيق التغييرات."));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate(locale, "Image upload failed.", "تعذر رفع الصورة."));
    } finally { setUploading(false); }
  }

  function removeEditMedia(index: number) {
    setEditMedia((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      const hasPrimary = next.some((media) => media.isPrimary);
      return next.map((media, sortOrder) => ({
        ...media, sortOrder,
        isPrimary: hasPrimary ? media.isPrimary : sortOrder === 0
      }));
    });
  }

  function setEditMediaPrimary(index: number) {
    setEditMedia((current) => current.map((media, itemIndex) => ({ ...media, isPrimary: itemIndex === index })));
  }

  function moveEditMedia(index: number, direction: -1 | 1) {
    setEditMedia((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current]; [next[index], next[target]] = [next[target], next[index]];
      return next.map((media, sortOrder) => ({ ...media, sortOrder }));
    });
  }

  async function saveProductEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const savedCustomFields = products.find((product) => product.id === editingId)?.customFields;
      const customFields = mergeEditedCategoryFields(savedCustomFields, editCustomFields);
      if (editIsRealEstate && !editMapLocation) {
        throw new Error(translate(locale, "Choose a location on the map for this real-estate listing.", "حدد موقع العقار على الخريطة."));
      }
      if (editIsRealEstate && !editFloorArea.trim()) {
        throw new Error(translate(locale, "Enter the property floor area.", "أدخل مساحة العقار."));
      }
      const mapLocation = editMapLocation;
      const propertyDetails = editIsRealEstate ? {
        propertyType: editPropertyType,
        listingType: editListingType,
        bedrooms: editBedrooms.trim() ? Number(editBedrooms) : null,
        bathrooms: editBathrooms.trim() ? Number(editBathrooms) : null,
        floorArea: editFloorArea
      } : null;
      await json(await fetch(`/api/products/${encodeURIComponent(editingId)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName, slug: editSlug, description: editDescription,
          city: editCity || null, district: editDistrict || null,
          contactPhone: editContactPhone || null, videoUrl: editVideoUrl || null,
          brandId: editBrandId || null, categoryIds: editCategoryIds,
          customFields, mapLocation, propertyDetails,
          media: editMedia.map((media, sortOrder) => ({ ...media, sortOrder }))
        })
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
            setMarketPrices(Object.fromEntries(markets.filter((market) => allowed.has(market.id)).map((market) => [market.id, { currencyCode: market.defaultCurrency.code, amount: "" }])));
          }}>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
          {!stores.length ? <p className="mt-4 rounded-xl bg-[var(--surface-soft)] p-4 text-sm">{translate(locale, "Create a store and activate its markets before adding products.", "أنشئ متجرًا وفعّل أسواقه قبل إضافة المنتجات.")}</p> : <form onSubmit={createProduct} className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm">{translate(locale, "Product name", "اسم المنتج")}<input required minLength={2} maxLength={180} className={inputClass} value={name} onChange={(e) => { setName(e.target.value); setSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} /></label>
            <label className="grid gap-1 text-sm">{translate(locale, "URL slug", "معرّف الرابط")}<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={inputClass} value={slug} onChange={(e) => setSlug(e.target.value)} /></label>
            <label className="grid gap-1 text-sm">{translate(locale, "Description", "الوصف")}<textarea required maxLength={12000} rows={3} className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
            <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm">SKU<input required maxLength={100} className={inputClass} value={sku} onChange={(e) => setSku(e.target.value)} /></label><label className="grid gap-1 text-sm">{translate(locale, "Barcode (optional)", "الباركود (اختياري)")}<input maxLength={100} className={inputClass} value={barcode} onChange={(e) => setBarcode(e.target.value)} /></label><label className="grid gap-1 text-sm">{translate(locale, "Weight (grams)", "الوزن (غرام)")}<input type="number" min="0" max="1000000" step="1" className={inputClass} value={weightGrams} onChange={(e) => setWeightGrams(e.target.value)} /></label></div>
            <div className="grid gap-3 rounded-2xl border border-[var(--border)] p-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><SyriaLocationPicker district={district} inputClass={inputClass} onCityChange={setCity} onDistrictChange={setDistrict} onGeographyChange={setGeography} onFocus={(coordinates, zoom) => setMapFocus({ coordinates, zoom, key: `${coordinates.latitude}:${coordinates.longitude}:${zoom}` })} /></div>
              <label className="grid gap-1 text-sm">{translate(locale, "Contact phone", "رقم الهاتف للتواصل")}<input required type="tel" minLength={6} maxLength={40} className={inputClass} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></label>
              <label className="grid gap-1 text-sm">{translate(locale, "Video link (YouTube / TikTok)", "رابط الفيديو (يوتيوب / تيك توك)")}<input type="url" maxLength={2048} className={inputClass} value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://…" /></label>
              <label className="grid gap-1 text-sm">{translate(locale, "Available quantity", "الكمية المتاحة")}<input required type="number" min="0" max="100000000" step="1" className={inputClass} value={initialStock} onChange={(e) => setInitialStock(e.target.value)} /></label>
            </div>
            <section onDragOver={(event) => event.preventDefault()} onDrop={handleImageDrop} className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-[var(--color-copper-600)]/10 p-2 text-[var(--color-copper-600)]"><Images aria-hidden="true" className="size-5" /></span>
                  <div><h3 className="text-sm font-semibold">{translate(locale, "Product images", "صور المنتج")}</h3><p className="text-xs text-[var(--muted)]">{translate(locale, "Choose a photo to make it the cover. Use the icons to replace or delete it.", "اختر صورة لتصبح الغلاف. استخدم الأيقونات لاستبدالها أو حذفها.")}</p></div>
                </div>
                <span className="rounded-full bg-[var(--color-forest-900)] px-3 py-1 text-xs font-semibold text-white">{selectedImageCount}/8</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {imagePreviews.map((preview, index) => (
                  <div key={`${preview.url}-${index}`} className={`relative overflow-hidden rounded-xl border-2 bg-[var(--surface)] ${index === activePreviewIndex ? "border-[var(--color-copper-600)] shadow-md" : "border-transparent"}`}>
                    <button type="button" onClick={() => setSelectedPreviewIndex(index)} aria-label={translate(locale, `Choose image ${index + 1} as cover`, `اختيار الصورة ${index + 1} كغلاف`)} aria-pressed={index === activePreviewIndex} className="relative block aspect-square w-full">
                      <Image src={preview.url} alt={preview.name} fill unoptimized className="object-cover" />
                      {index === activePreviewIndex && <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-[var(--color-forest-900)] px-2 py-1 text-[10px] font-semibold text-white"><Star aria-hidden="true" className="size-3 fill-current" />{translate(locale, "Cover", "الغلاف")}</span>}
                    </button>
                    <div className="absolute right-2 top-2 flex gap-1">
                      <label title={translate(locale, "Replace image", "استبدال الصورة")} className="cursor-pointer rounded-lg bg-white/95 p-2 text-[var(--color-forest-900)] shadow hover:bg-emerald-50">
                        <Pencil aria-hidden="true" className="size-4" />
                        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || busy} onChange={(event) => { void replaceSelectedImage(event, index); }} className="sr-only" aria-label={translate(locale, `Replace image ${index + 1}`, `استبدال الصورة ${index + 1}`)} />
                      </label>
                      <button type="button" disabled={uploading || busy} onClick={() => removeCreateImage(index)} title={translate(locale, "Delete image", "حذف الصورة")} aria-label={translate(locale, `Delete image ${index + 1}`, `حذف الصورة ${index + 1}`)} className="rounded-lg bg-white/95 p-2 text-red-600 shadow hover:bg-red-50 disabled:opacity-50"><Trash2 aria-hidden="true" className="size-4" /></button>
                    </div>
                    <p className="truncate px-2 py-1.5 text-xs text-[var(--muted)]">{preview.name}</p>
                  </div>
                ))}
                {selectedImageCount < 8 && <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-copper-600)]/50 bg-[var(--surface)] text-[var(--color-copper-600)] transition hover:border-[var(--color-copper-600)] hover:bg-[var(--color-copper-600)]/5">
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading || busy} onChange={uploadImages} className="sr-only" />
                  {uploading ? <Upload aria-hidden="true" className="size-6 animate-pulse" /> : <ImagePlus aria-hidden="true" className="size-6" />}
                  <span className="text-xs font-semibold">{uploading ? translate(locale, "Uploading…", "جارٍ الرفع…") : translate(locale, "Add images", "إضافة صور")}</span>
                </label>}
              </div>
              <label className="grid gap-1 text-sm">{translate(locale, "Or add a hosted image URL", "أو أضف رابط صورة مستضافة")}<input type="url" disabled={uploadedImages.length >= 8 && !imageUrl.trim()} className={inputClass} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" /></label>
              <p className="text-xs text-[var(--muted)]">{translate(locale, "JPEG, PNG or WebP · up to 8 MB each · drag images here to upload.", "JPEG أو PNG أو WebP · حتى 8 ميغابايت للصورة · اسحب الصور هنا لرفعها.")}</p>
            </section>
            <label className="grid gap-1 text-sm">{translate(locale, "Category", "الفئة")}<select required className={inputClass} value={categoryId} onChange={(e) => { setCategoryId(e.target.value); const selected = categoryOptions.find((item) => item.id === e.target.value); setCustomFields(selected ? getCategoryFieldPresets(selected.slug) : []); }}><option value="">{translate(locale, "No category", "بلا فئة")}</option>{categoryOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            {categoryId && <section className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{translate(locale, "Additional category details", "تفاصيل إضافية حسب الفئة")}</h3><button type="button" onClick={() => setCustomFields((items) => [...items, { key: "", value: "", label: "" }])} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold">{translate(locale, "Add field", "إضافة حقل")}</button></div><p className="text-xs text-[var(--muted)]">{translate(locale, "Add specifications such as model, year, condition, material, size or any category-specific detail.", "أضف المواصفات مثل الطراز والسنة والحالة والخامة والمقاس أو أي تفاصيل خاصة بالفئة.")}</p>{customFields.map((field, index) => <div key={index} className="grid items-end gap-2 sm:grid-cols-[1fr_auto]">{field.label ? <label className="grid gap-1 text-sm"><span className="font-medium">{field.label}</span>{field.options?.length ? <select required aria-label={field.label} className={inputClass} value={field.value} onChange={(e) => setCustomFields((items) => items.map((item, i) => i === index ? { ...item, value: e.target.value } : item))}><option value="">اختر {field.label}</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input required aria-label={field.label} className={inputClass} value={field.value} onChange={(e) => setCustomFields((items) => items.map((item, i) => i === index ? { ...item, value: e.target.value } : item))} />}</label> : <div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1 text-xs">{translate(locale, "Field name", "اسم الحقل")}<input className={inputClass} value={field.key} onChange={(e) => setCustomFields((items) => items.map((item, i) => i === index ? { ...item, key: e.target.value } : item))} /></label><label className="grid gap-1 text-xs">{translate(locale, "Value", "القيمة")}<input className={inputClass} value={field.value} onChange={(e) => setCustomFields((items) => items.map((item, i) => i === index ? { ...item, value: e.target.value } : item))} /></label></div>}<button type="button" onClick={() => setCustomFields((items) => items.filter((_, i) => i !== index))} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">{translate(locale, "Remove", "حذف")}</button></div>)}</section> }
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
                focus={mapFocus}
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
                const draft = marketPrices[market.id] ?? { currencyCode: market.defaultCurrency.code, amount: "" };
                const currencies = market.currencies.map((entry) => entry.currency);
                const currency = currencies.find((item) => item.code === draft.currencyCode) ?? market.defaultCurrency;
                return <div key={market.id} className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                  <p className="text-sm font-semibold">{market.name}</p>
                  <label className="grid gap-1 text-sm">{translate(locale, "Currency", "العملة")}<select required className={inputClass} value={draft.currencyCode} onChange={(e) => setMarketPrices((current) => ({ ...current, [market.id]: { ...draft, currencyCode: e.target.value } }))}>{currencies.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}</select></label>
                  <label className="grid gap-1 text-sm">{translate(locale, "Price", "السعر")} ({currency.symbol ?? currency.code})<input required type="text" inputMode="decimal" className={inputClass} value={draft.amount} onChange={(e) => setMarketPrices((current) => ({ ...current, [market.id]: { ...draft, amount: e.target.value } }))} placeholder={currency.minorUnit ? `0.${"0".repeat(currency.minorUnit)}` : "0"} /><span className="text-xs text-[var(--muted)]">{translate(locale, "Enter the normal price. Decimal places supported", "أدخل السعر المعتاد. عدد المنازل العشرية المدعومة")} {currency.minorUnit}.</span></label>
                </div>;
              })}
            </div>
            <button disabled={busy || uploading || !storeId || (!uploadedImages.length && !imageUrl.trim()) || (isRealEstate && (!mapLocation || !floorArea)) || !availableMarkets.length || availableMarkets.some((market) => { const currencyCode = marketPrices[market.id]?.currencyCode ?? market.defaultCurrency.code; const currency = market.currencies.find((entry) => entry.currency.code === currencyCode)?.currency ?? market.defaultCurrency; try { toMinorUnits(marketPrices[market.id]?.amount ?? "", currency.minorUnit); return false; } catch { return true; } })} className="mt-2 rounded-xl bg-[var(--color-ink-800)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? translate(locale, "Saving…", "جارٍ الحفظ…") : translate(locale, "Create draft product", "إنشاء مسودة منتج")}</button>
          </form>}
        </section>
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="text-lg font-semibold">{translate(locale, "Store catalog", "كتالوج المتجر")}</h2><label className="mt-4 block text-xs font-medium">{translate(locale, "Search this store catalog", "البحث في كتالوج المتجر")}<input value={search} onChange={event=>setSearch(event.target.value)} maxLength={120} placeholder={translate(locale, "Product name, slug, SKU or barcode", "اسم المنتج أو المعرّف أو SKU أو الباركود")} className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm"/></label>
          {!products.length ? <p className="mt-4 rounded-xl bg-[var(--surface-soft)] p-5 text-sm text-[var(--muted)]">{search ? translate(locale, "No products match this search.", "لا توجد منتجات تطابق هذا البحث.") : translate(locale, "No products in this store yet.", "لا توجد منتجات في هذا المتجر بعد.")}</p> : <div className="mt-4 divide-y divide-[var(--border)]">{products.map((product) => <article key={product.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              {product.media.length > 0 && <div className="grid w-24 shrink-0 grid-cols-2 gap-1">
                {product.media.slice(0, 4).map((media) => <img key={media.url} src={media.url} alt={media.altText ?? product.name} className="aspect-square w-full rounded-md object-cover" />)}
              </div>}
              <div className="min-w-0"><h3 className="font-semibold">{product.name}</h3><p className="mt-1 text-xs text-[var(--muted)]">PRD-{product.productNumber.padStart(8, "0")} · /{product.slug} · {product.variants.length} {translate(locale, "variants", "متغيرات")}</p>
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
              {product.status === "DRAFT" && <button disabled={busy} onClick={() => { setEditingId(product.id); setEditOriginalCustomFields(product.customFields); setEditName(product.name); setEditSlug(product.slug); setEditDescription(product.description ?? ""); setEditCity(product.city ?? ""); setEditDistrict(product.district ?? ""); setEditContactPhone(product.contactPhone ?? ""); setEditVideoUrl(product.videoUrl ?? ""); setEditBrandId(product.brandId ?? ""); setEditCategoryIds(product.categories.map((entry) => entry.category.id)); setEditCustomFields(buildCategoryFieldsForEdit(product.categories[0]?.category.slug ?? "", product.customFields)); setEditMapLocation(product.mapLocation); setEditPropertyType(product.propertyDetails?.propertyType ?? "APARTMENT"); setEditListingType(product.propertyDetails?.listingType ?? "SALE"); setEditBedrooms(product.propertyDetails?.bedrooms == null ? "" : String(product.propertyDetails.bedrooms)); setEditBathrooms(product.propertyDetails?.bathrooms == null ? "" : String(product.propertyDetails.bathrooms)); setEditFloorArea(product.propertyDetails?.floorArea ?? ""); const coverIndex = Math.max(0, product.media.findIndex((media) => media.isPrimary)); setEditMedia(product.media.map((media, index) => ({ ...media, sortOrder: index, isPrimary: index === coverIndex }))); }} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold">{translate(locale, "Edit draft", "تعديل المسودة")}</button>}
              {product.status === "DRAFT" && product.approvalStatus === "APPROVED" && <button disabled={busy} onClick={() => publish(product.id)} className="rounded-lg bg-[var(--color-ink-800)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{translate(locale, "Publish", "نشر")}</button>}
            </div>
          </article>)}</div>}
          {editingId && <form onSubmit={saveProductEdit} className="mt-5 grid gap-3 rounded-2xl border border-[var(--border)] p-4">
            <h3 className="font-semibold">{translate(locale, "Edit draft product", "تعديل مسودة المنتج")}</h3>
            <label className="grid gap-1 text-sm">{translate(locale, "Name", "الاسم")}<input required minLength={2} maxLength={180} className={inputClass} value={editName} onChange={(e) => setEditName(e.target.value)} /></label>
            <label className="grid gap-1 text-sm">{translate(locale, "Slug", "المعرّف")}<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={inputClass} value={editSlug} onChange={(e) => setEditSlug(e.target.value)} /></label>
            <label className="grid gap-1 text-sm">{translate(locale, "Description", "الوصف")}<textarea maxLength={12000} rows={3} className={inputClass} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">{translate(locale, "City", "المدينة")}<input maxLength={120} className={inputClass} value={editCity} onChange={(e) => setEditCity(e.target.value)} /></label>
              <label className="grid gap-1 text-sm">{translate(locale, "District", "المنطقة")}<input maxLength={120} className={inputClass} value={editDistrict} onChange={(e) => setEditDistrict(e.target.value)} /></label>
              <label className="grid gap-1 text-sm">{translate(locale, "Contact phone", "هاتف التواصل")}<input maxLength={40} className={inputClass} value={editContactPhone} onChange={(e) => setEditContactPhone(e.target.value)} /></label>
              <label className="grid gap-1 text-sm">{translate(locale, "Video URL (HTTPS)", "رابط الفيديو (HTTPS)")}<input type="url" className={inputClass} value={editVideoUrl} onChange={(e) => setEditVideoUrl(e.target.value)} /></label>
            </div>
            <label className="grid gap-1 text-sm">{translate(locale, "Brand", "العلامة التجارية")}<select className={inputClass} value={editBrandId} onChange={(e) => setEditBrandId(e.target.value)}><option value="">{translate(locale, "No brand", "بلا علامة")}</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
            <label className="grid gap-1 text-sm">{translate(locale, "Categories", "الفئات")}<select required multiple className={inputClass + " min-h-28"} value={editCategoryIds} onChange={(e) => { const nextIds = Array.from(e.target.selectedOptions, (option) => option.value); const nextSlug = categoryOptions.find((item) => item.id === nextIds[0])?.slug ?? ""; setEditCategoryIds(nextIds); setEditCustomFields((current) => buildCategoryFieldsForEdit(nextSlug, {}, current)); }}>{categoryOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <fieldset className="grid gap-3 rounded-2xl border border-[var(--border)] p-4"><legend className="px-1 text-sm font-semibold">{translate(locale, "Category-specific details", "تفاصيل الفئة")}</legend>{editCustomFields.length ? <div className="grid gap-3 sm:grid-cols-2">{editCustomFields.map((field, index) => <label key={field.key} className="grid gap-1 text-sm">{field.label ?? field.key}{field.options?.length ? <select required={field.required ?? true} className={inputClass} value={field.value} onChange={(event) => setEditCustomFields((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))}><option value="">اختر {field.label ?? field.key}</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input required={field.required ?? true} maxLength={500} className={inputClass} value={field.value} onChange={(event) => setEditCustomFields((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} />}</label>)}</div> : <p className="text-xs text-[var(--muted)]">{translate(locale, "No additional fields are defined for the selected category.", "لا توجد حقول إضافية محددة للفئة المختارة.")}</p>}</fieldset>
            {editIsRealEstate && <fieldset className="grid gap-3 rounded-2xl border border-[var(--border)] p-4"><legend className="px-1 text-sm font-semibold">{translate(locale, "Property details", "تفاصيل العقار")}</legend><div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">{translate(locale, "Property type", "نوع العقار")}<select required className={inputClass} value={editPropertyType} onChange={(e) => setEditPropertyType(e.target.value)}><option value="APARTMENT">{translate(locale, "Apartment", "شقة")}</option><option value="HOUSE">{translate(locale, "House / villa", "منزل / فيلا")}</option><option value="LAND">{translate(locale, "Land", "أرض")}</option><option value="COMMERCIAL">{translate(locale, "Commercial property", "عقار تجاري")}</option></select></label>
              <label className="grid gap-1 text-sm">{translate(locale, "Listing type", "نوع العرض")}<select required className={inputClass} value={editListingType} onChange={(e) => setEditListingType(e.target.value)}><option value="SALE">{translate(locale, "For sale", "للبيع")}</option><option value="RENT">{translate(locale, "For rent", "للإيجار")}</option></select></label>
              <label className="grid gap-1 text-sm">{translate(locale, "Bedrooms", "غرف النوم")}<input type="number" min="0" max="100" step="1" className={inputClass} value={editBedrooms} onChange={(e) => setEditBedrooms(e.target.value)} /></label>
              <label className="grid gap-1 text-sm">{translate(locale, "Bathrooms", "الحمامات")}<input type="number" min="0" max="100" step="1" className={inputClass} value={editBathrooms} onChange={(e) => setEditBathrooms(e.target.value)} /></label>
              <label className="grid gap-1 text-sm sm:col-span-2">{translate(locale, "Floor area (m²)", "المساحة (م²)")}<input required type="number" min="0.01" max="999999999" step="0.01" className={inputClass} value={editFloorArea} onChange={(e) => setEditFloorArea(e.target.value)} /></label>
            </div></fieldset>}
            <section className="grid gap-3 rounded-2xl border border-[var(--border)] p-4"><h4 className="text-sm font-semibold">{translate(locale, "Product location", "موقع المنتج")}</h4><p className="text-xs text-[var(--muted)]">{translate(locale, "The public listing shows an approximate area; exact coordinates remain private.", "يعرض الإعلان منطقة تقريبية، بينما تبقى الإحداثيات الدقيقة خاصة.")}</p><ProductLocationMap value={editMapLocation} onChange={setEditMapLocation} label={translate(locale, "Choose product location on map", "اختر موقع المنتج على الخريطة")} />{editMapLocation && <div className="flex items-center justify-between gap-3 text-xs text-[var(--muted)]"><span>{editMapLocation.latitude.toFixed(5)}, {editMapLocation.longitude.toFixed(5)}</span><button type="button" onClick={() => setEditMapLocation(null)} className="rounded-lg border border-[var(--border)] px-3 py-1.5 font-semibold">{translate(locale, "Clear location", "مسح الموقع")}</button></div>}</section>
            <section className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-3"><span className="rounded-xl bg-[var(--color-copper-600)]/10 p-2 text-[var(--color-copper-600)]"><Images aria-hidden="true" className="size-5" /></span><div><h4 className="text-sm font-semibold">{translate(locale, "Product images", "صور المنتج")}</h4><p className="text-xs text-[var(--muted)]">{translate(locale, "Choose a photo for the cover. Use the icons to replace or delete it.", "اختر صورة للغلاف. استخدم الأيقونات لاستبدالها أو حذفها.")}</p></div></div><span className="rounded-full bg-[var(--color-forest-900)] px-3 py-1 text-xs font-semibold text-white">{editMedia.length}/8</span></div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {editMedia.map((media, index) => <div key={media.storageKey ?? media.url} className={`relative overflow-hidden rounded-xl border-2 bg-[var(--surface)] ${media.isPrimary ? "border-[var(--color-copper-600)] shadow-md" : "border-transparent"}`}>
                  <button type="button" onClick={() => setEditMediaPrimary(index)} aria-label={translate(locale, `Choose image ${index + 1} as cover`, `اختيار الصورة ${index + 1} كغلاف`)} aria-pressed={media.isPrimary} className="relative block aspect-square w-full">
                    <Image src={media.url} alt={media.altText ?? ""} fill unoptimized className="object-cover" />
                    {media.isPrimary && <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-[var(--color-forest-900)] px-2 py-1 text-[10px] font-semibold text-white"><Star aria-hidden="true" className="size-3 fill-current" />{translate(locale, "Cover", "الغلاف")}</span>}
                  </button>
                  <div className="absolute right-2 top-2 flex gap-1">
                    <label title={translate(locale, "Replace image", "استبدال الصورة")} className="cursor-pointer rounded-lg bg-white/95 p-2 text-[var(--color-forest-900)] shadow hover:bg-emerald-50">
                      <Pencil aria-hidden="true" className="size-4" />
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={translate(locale, `Replace image ${index + 1}`, `استبدال الصورة ${index + 1}`)} disabled={uploading || busy} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void uploadEditMedia([file], index); }} />
                    </label>
                    <button type="button" disabled={uploading || busy} onClick={() => removeEditMedia(index)} title={translate(locale, "Delete image", "حذف الصورة")} aria-label={translate(locale, `Delete image ${index + 1}`, `حذف الصورة ${index + 1}`)} className="rounded-lg bg-white/95 p-2 text-red-600 shadow hover:bg-red-50 disabled:opacity-50"><Trash2 aria-hidden="true" className="size-4" /></button>
                  </div>
                  <div className="flex items-center justify-between gap-2 p-2">
                    <span className="truncate text-xs font-medium">{media.altText || `${translate(locale, "Image", "صورة")} ${index + 1}`}</span>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" disabled={index === 0 || uploading || busy} onClick={() => moveEditMedia(index, -1)} title={translate(locale, "Move earlier", "تحريك للأعلى")} aria-label={translate(locale, "Move image earlier", "تحريك الصورة للأعلى")} className="rounded-lg bg-[var(--surface-soft)] p-1.5 text-[var(--color-onyx)] disabled:opacity-40"><ArrowUp aria-hidden="true" className="size-3.5" /></button>
                      <button type="button" disabled={index === editMedia.length - 1 || uploading || busy} onClick={() => moveEditMedia(index, 1)} title={translate(locale, "Move later", "تحريك للأسفل")} aria-label={translate(locale, "Move image later", "تحريك الصورة للأسفل")} className="rounded-lg bg-[var(--surface-soft)] p-1.5 text-[var(--color-onyx)] disabled:opacity-40"><ArrowDown aria-hidden="true" className="size-3.5" /></button>
                    </div>
                  </div>
                </div>)}
                {editMedia.length < 8 && <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-copper-600)]/50 bg-[var(--surface)] text-[var(--color-copper-600)] transition hover:border-[var(--color-copper-600)] hover:bg-[var(--color-copper-600)]/5">
                  <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading || busy} onChange={(event) => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; void uploadEditMedia(files); }} />
                  {uploading ? <Upload aria-hidden="true" className="size-6 animate-pulse" /> : <ImagePlus aria-hidden="true" className="size-6" />}
                  <span className="text-xs font-semibold">{uploading ? translate(locale, "Uploading…", "جارٍ الرفع…") : translate(locale, "Add images", "إضافة صور")}</span>
                </label>}
              </div>
              <p className="text-xs text-[var(--muted)]">{translate(locale, "JPEG, PNG or WebP · up to 8 MB each · choose an image to set it as the cover.", "JPEG أو PNG أو WebP · حتى 8 ميغابايت للصورة · اختر صورة لتعيينها كغلاف.")}</p>
              {!editMedia.length && <p className="text-xs text-red-600">{translate(locale, "Add at least one image before saving.", "أضف صورة واحدة على الأقل قبل الحفظ.")}</p>}
            </section>
            <div className="flex gap-2"><button disabled={busy} className="rounded-lg bg-[var(--color-ink-800)] px-4 py-2 text-xs font-semibold text-white">{translate(locale, "Save changes", "حفظ التغييرات")}</button><button type="button" onClick={() => { setEditingId(""); setEditOriginalCustomFields(null); }} className="rounded-lg border border-[var(--border)] px-4 py-2 text-xs">{translate(locale, "Cancel", "إلغاء")}</button></div>
          </form>}
        </section>
      </div>}
    </div>
  </main>;
}
