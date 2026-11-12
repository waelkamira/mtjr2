"use client";

import { StatusBadge } from "@/components/status-badge";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ChangeEvent } from "react";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate, translateStatus } from "@/lib/locale";
import { toMinorUnits } from "@/lib/money";
import { createProductSlug } from "@/lib/product-slug";
import MetricBarChart from "@/components/analytics/metric-bar-chart";
import SyriaLocationPicker from "@/components/maps/syria-location-picker";
import { SellerIcon } from "@/features/seller/seller-navigation";

type Market = {
  id: string; code: string; name: string;
  defaultCurrency: { code: string; minorUnit: number; symbol: string | null };
  currencies: Array<{ currency: { code: string; name: string; minorUnit: number; symbol: string | null } }>;
};
type Category = { id: string; name: string; slug: string; children: Category[] };
type CategoryAttribute = {
  id: string; key: string; label: string; description: string | null;
  valueType: "TEXT" | "NUMBER" | "BOOLEAN" | "SELECT" | "MULTI_SELECT";
  required: boolean; variantLevel: boolean; options: string[];
};
type ProductLocationDraft = { city?: string; district?: string; localityId?: string; neighborhood?: string; streetAddress?: string; latitude?: number; longitude?: number };
type Product = {
  id: string; productNumber: string; name: string; slug: string; description: string | null;
  city: string | null; district: string | null; contactPhone: string | null; videoUrl: string | null;
  localityId: string | null; neighborhood: string | null; streetAddress: string | null;
  latitude: number | null; longitude: number | null;
  propertyDetails: { propertyType: "APARTMENT" | "HOUSE" | "LAND" | "COMMERCIAL"; listingType: "SALE" | "RENT"; bedrooms: number | null; bathrooms: number | null; floorArea: string } | null;
  categories: Array<{ category: { id: string; name: string; slug: string } }>;
  status: string; approvalStatus: string;
  rejectionReason: string | null; updatedAt: string;
  media: Array<{ id: string; url: string; storageKey: string | null; mimeType: string | null; width: number | null; height: number | null; altText: string | null; sortOrder: number; isPrimary: boolean }>;
  variants: Array<{ id: string; sku: string; name: string | null; prices: Array<{ marketId: string; currencyCode: string; amountMinor: string; compareAtMinor: string | null; currency: { minorUnit: number } }> }>;
};
type Store = { id: string; storeNumber: string; name: string; markets: Array<{ market: { id: string } }> };
type Workspace = { stores: Store[] };
type EditableProductMedia = Product["media"][number] & { deleteToken?: string };
type EditVariantDraft = { id: string; sku: string; name: string | null; prices: Record<string, { currencyCode: string; amount: string; compareAt: string }> };

async function json<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data as T;
}
function minorUnitsToInput(amountMinor: string, minorUnit: number): string {
  const amount = BigInt(amountMinor);
  const scale = BigInt(10) ** BigInt(minorUnit);
  const whole = amount / scale;
  if (minorUnit === 0) return whole.toString();
  return whole.toString() + "." + (amount % scale).toString().padStart(minorUnit, "0");
}

function flatten(items: Category[], prefix = "", ancestors: string[] = []): Array<{ id: string; slug: string; ancestors: string[]; label: string }> {
  return items.flatMap((item) => {
    const children = item.children ?? [];
    return children.length
      ? flatten(children, prefix + item.name + " / ", [...ancestors, item.slug])
      : [{ id: item.id, slug: item.slug, ancestors, label: prefix + item.name }];
  });
}

export default function SellerProductsPage() {
  const { locale } = useLocale();
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState("");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [basicSpecifications, setBasicSpecifications] = useState({
    model: "", color: "", material: "", weight: "", dimensions: "",
    condition: "", warranty: "", countryOfOrigin: ""
  });
  const [customSpecifications, setCustomSpecifications] = useState<Array<{ id: string; name: string; value: string }>>([]);
  type VariantDraft = { id: string; sku: string; barcode: string; name: string; optionValues: Record<string, string | number | boolean | string[]>; prices: Record<string, { currencyCode: string; amount: string; compareAt: string }> };
  const [variantRows, setVariantRows] = useState<VariantDraft[]>([{ id: "variant-1", sku: "", barcode: "", name: "", optionValues: {}, prices: {} }]);
  type ProductImageDraft = { id: string; file: File; url: string; provider: string; mimeType: string; storageKey?: string; deleteToken?: string; width?: number; height?: number; previewUrl: string; status: "uploading" | "ready" | "failed"; error?: string };
  const [uploadedImages, setUploadedImages] = useState<ProductImageDraft[]>([]);
  const uploadedImagesRef = useRef<ProductImageDraft[]>([]);
  uploadedImagesRef.current = uploadedImages;
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ url: string; alt: string } | null>(null);
  const [marketPrices, setMarketPrices] = useState<Record<string, { currencyCode: string; amount: string; compareAt: string }>>({});
  const [categoryId, setCategoryId] = useState("");
  const [categoryAttributes, setCategoryAttributes] = useState<CategoryAttribute[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<string, string | number | boolean | string[]>>({});
  const [loadingCategoryAttributes, setLoadingCategoryAttributes] = useState(false);
  const [productLocation, setProductLocation] = useState<ProductLocationDraft>({});
  const [contactPhone, setContactPhone] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [propertyType, setPropertyType] = useState<"APARTMENT" | "HOUSE" | "LAND" | "COMMERCIAL">("APARTMENT");
  const [listingType, setListingType] = useState<"SALE" | "RENT">("SALE");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [floorArea, setFloorArea] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editVideoUrl, setEditVideoUrl] = useState("");
  const [editProductLocation, setEditProductLocation] = useState<ProductLocationDraft>({});
  const [editPropertyType, setEditPropertyType] = useState<"APARTMENT" | "HOUSE" | "LAND" | "COMMERCIAL">("APARTMENT");
  const [editListingType, setEditListingType] = useState<"SALE" | "RENT">("SALE");
  const [editBedrooms, setEditBedrooms] = useState("");
  const [editBathrooms, setEditBathrooms] = useState("");
  const [editFloorArea, setEditFloorArea] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editMedia, setEditMedia] = useState<EditableProductMedia[]>([]);
  const [editVariantRows, setEditVariantRows] = useState<EditVariantDraft[]>([]);
  const [editMediaUploading, setEditMediaUploading] = useState(false);

  useEffect(() => {
    if (!imagePreview) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setImagePreview(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [imagePreview]);

  useEffect(() => {
    const initialSearch = new URLSearchParams(window.location.search).get("search")?.slice(0, 120) ?? "";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate the optional initial search query from the URL after mount.
    if (initialSearch) setSearch(initialSearch);
  }, []);

  const categoryOptions = useMemo(() => flatten(categories), [categories]);
  const currencyLabel = (code: string, fallbackName: string) => code === "SYP"
    ? translate(locale, "Syrian Pound", "الليرة السورية")
    : code === "USD"
      ? translate(locale, "US Dollar", "الدولار الأمريكي")
      : fallbackName;
  const isRealEstate = (() => { const selected = categoryOptions.find((category) => category.id === categoryId); return selected?.slug === "real-estate" || selected?.ancestors.includes("real-estate") === true; })();
  const editIsRealEstate = (() => { const selected = categoryOptions.find((category) => category.id === editCategoryId); return selected?.slug === "real-estate" || selected?.ancestors.includes("real-estate") === true; })();
  const enabledMarketIds = useMemo(() => new Set(stores.find((store) => store.id === storeId)?.markets.map((entry) => entry.market.id) ?? []), [stores, storeId]);
  const availableMarkets = markets.filter((market) => enabledMarketIds.has(market.id));
  const productStatusLabel = (status: string) => translateStatus(locale, status);
  const approvalCounts = products.reduce((counts, product) => {
    counts[product.approvalStatus] = (counts[product.approvalStatus] ?? 0) + 1;
    return counts;
  }, {} as Record<string, number>);
  const publicationCounts = products.reduce((counts, product) => {
    counts[product.status] = (counts[product.status] ?? 0) + 1;
    return counts;
  }, {} as Record<string, number>);

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
      fetch(`/api/categories?limit=100&includeEmpty=true&locale=${encodeURIComponent(locale)}`).then((r) => json<{ items: Category[] }>(r))
    ]).then(([workspace, marketResult, categoryResult]) => {
      if (!active) return;
      setStores(workspace.stores);
      setMarkets(marketResult.items);
      setCategories(categoryResult.items);
      let preferredStoreId = "";
      try { preferredStoreId = localStorage.getItem("mtjr.activeStoreId") ?? ""; } catch { /* Storage can be unavailable in restricted browsers. */ }
      const initialStore = workspace.stores.find((store) => store.id === preferredStoreId) ?? workspace.stores[0];
      if (initialStore) {
        setStoreId(initialStore.id);
        const enabled = new Set(initialStore.markets.map((entry) => entry.market.id));
        const initialPrices = Object.fromEntries(marketResult.items.filter((market) => enabled.has(market.id)).map((market) => [market.id, { currencyCode: market.defaultCurrency.code, amount: "", compareAt: "" }]));
        setMarketPrices(initialPrices);
        setVariantRows((rows) => rows.map((row) => ({ ...row, prices: initialPrices })));
      }
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load seller catalog.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [locale]);

  useEffect(() => {
    if (!categoryId) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the category-attribute loading state while the dependent schema is fetched.
    setLoadingCategoryAttributes(true);
    fetch(`/api/categories/${encodeURIComponent(categoryId)}/attributes?locale=${encodeURIComponent(locale)}`, { cache: "no-store" })
      .then((response) => json<{ items: CategoryAttribute[] }>(response))
      .then((result) => { if (active) setCategoryAttributes(result.items); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load category fields."); })
      .finally(() => { if (active) setLoadingCategoryAttributes(false); });
    return () => { active = false; };
  }, [categoryId, locale]);

  const requiredAttributesComplete = categoryAttributes.filter((attribute) => !attribute.variantLevel).every((attribute) => {
    if (!attribute.required) return true;
    const value = attributeValues[attribute.id];
    return value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0);
  });
  const requiredVariantAttributesComplete = variantRows.every((variant) => categoryAttributes.filter((attribute) => attribute.variantLevel && attribute.required).every((attribute) => {
    const value = variant.optionValues[attribute.key];
    return value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0);
  }));
  const variantSkusValid = variantRows.length > 0 && variantRows.every((variant) => variant.sku.trim().length > 0) &&
    new Set(variantRows.map((variant) => variant.sku.trim().toLowerCase())).size === variantRows.length;
  function updateVariant(id: string, patch: Partial<VariantDraft>) {
    setVariantRows((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  }
  function updateVariantOption(id: string, key: string, value: string | number | boolean | string[]) {
    setVariantRows((rows) => rows.map((row) => row.id === id ? { ...row, optionValues: { ...row.optionValues, [key]: value } } : row));
  }
  function updateVariantPrice(id: string, marketId: string, patch: Partial<{ currencyCode: string; amount: string; compareAt: string }>) {
    setVariantRows((rows) => rows.map((row) => row.id === id ? {
      ...row,
      prices: { ...row.prices, [marketId]: { ...(row.prices[marketId] ?? marketPrices[marketId] ?? { currencyCode: "", amount: "", compareAt: "" }), ...patch } }
    } : row));
  }
  const variantPricesValid = variantRows.every((variant) => availableMarkets.every((market) => {
    const price = variant.prices[market.id] ?? marketPrices[market.id];
    if (!price?.amount.trim()) return false;
    const currency = market.currencies.find((entry) => entry.currency.code === price.currencyCode)?.currency;
    if (!currency) return false;
    try {
      const amountMinor = BigInt(toMinorUnits(price.amount, currency.minorUnit));
      if (!price.compareAt.trim()) return true;
      const compareAtMinor = BigInt(toMinorUnits(price.compareAt, currency.minorUnit));
      return compareAtMinor >= amountMinor;
    } catch {
      return false;
    }
  }));
  const editVariantPricesValid = editVariantRows.length === 0 || availableMarkets.length === 0 || editVariantRows.every((variant) =>
    availableMarkets.every((market) => {
      const price = variant.prices[market.id];
      const currency = market.currencies.find((entry) => entry.currency.code === price?.currencyCode)?.currency;
      if (!price?.amount.trim() || !currency) return false;
      try {
        const amountMinor = BigInt(toMinorUnits(price.amount, currency.minorUnit));
        return !price.compareAt.trim() || BigInt(toMinorUnits(price.compareAt, currency.minorUnit)) >= amountMinor;
      } catch {
        return false;
      }
    })
  );
  function updateEditVariantPrice(variantId: string, marketId: string, patch: Partial<{ currencyCode: string; amount: string; compareAt: string }>) {
    setEditVariantRows((rows) => rows.map((row) => row.id === variantId
      ? { ...row, prices: { ...row.prices, [marketId]: { ...row.prices[marketId], ...patch } } }
      : row
    ));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset product editor and temporary media when the active store changes.
    setProducts([]);
    setEditingId("");
    setEditMedia([]);
    setEditVariantRows([]);
    setCategoryAttributes([]);
    setAttributeValues({});
    uploadedImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setUploadedImages([]);
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    let active = true;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ storeId });
      if (search.trim()) params.set("q", search.trim());
      fetch(`/api/seller/products?${params.toString()}`, { cache: "no-store" })
        .then((response) => json<{ items: Product[] }>(response))
        .then((result) => { if (active) setProducts(result.items); })
        .catch((cause: unknown) => {
          if (active) setError(cause instanceof Error ? cause.message : "Unable to load products.");
        });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [storeId, search]);

  async function uploadProductImageFiles(files: File[]) {
    if (!files.length) return;
    if (uploadedImages.length + files.length > 10) {
      toast.error(translate(locale, "A product can have up to 10 images.", "يمكن إضافة ١٠ صور كحد أقصى للمنتج."));
      return;
    }
    const invalid = files.find((file) => !["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"].includes(file.type) || file.size <= 0 || file.size > 10 * 1024 * 1024);
    if (invalid) {
      toast.error(translate(locale, "Use JPG, PNG, WebP, GIF or AVIF images up to 10 MB each.", "استخدم صور JPG أو PNG أو WebP أو GIF أو AVIF بحجم لا يتجاوز ١٠ ميغابايت للصورة."));
      return;
    }
    if (!storeId) {
      toast.error(translate(locale, "Choose a store before uploading images.", "اختر متجراً قبل رفع الصور."));
      return;
    }

    const drafts: ProductImageDraft[] = files.map((file) => ({
      id: crypto.randomUUID(), file, url: "", provider: "", mimeType: file.type, previewUrl: URL.createObjectURL(file), status: "uploading"
    }));
    setUploadedImages((current) => [...current, ...drafts]);
    setUploadingImages(true);
    setError("");

    const results = await Promise.allSettled(files.map(async (file, index) => {
      const form = new FormData();
      form.append("file", file, file.name);
      form.append("storeId", storeId);
      const result = await json<{ success: true; data: { url: string; provider: string; mimeType?: string; storageKey?: string; deleteToken?: string; width?: number; height?: number } }>(
        await fetch("/api/seller/products/media", { method: "POST", body: form })
      );
      setUploadedImages((current) => current.map((image) => image.id === drafts[index].id
        ? { ...image, url: result.data.url, provider: result.data.provider, mimeType: result.data.mimeType ?? file.type, storageKey: result.data.storageKey, deleteToken: result.data.deleteToken, width: result.data.width, height: result.data.height, status: "ready" }
        : image));
      return result.data;
    }));

    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length) {
      const firstError = failed[0].status === "rejected" && failed[0].reason instanceof Error
        ? failed[0].reason.message
        : translate(locale, "One or more images could not be uploaded.", "تعذر رفع صورة واحدة أو أكثر.");
      setUploadedImages((current) => current.map((image) => drafts.some((draft) => draft.id === image.id) && image.status === "uploading"
        ? { ...image, status: "failed", error: firstError }
        : image));
      setError(firstError);
      toast.error(firstError);
    } else {
      toast.success(translate(locale, "Images uploaded successfully.", "تم رفع الصور بنجاح."));
    }
    setUploadingImages(false);
  }

  function uploadProductImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void uploadProductImageFiles(files);
  }

  async function replaceProductImage(id: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const current = uploadedImages.find((entry) => entry.id === id);
    if (!file || !current) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"].includes(file.type) || file.size <= 0 || file.size > 10 * 1024 * 1024) {
      toast.error(translate(locale, "Use JPG, PNG, WebP, GIF or AVIF images up to 10 MB.", "استخدم صور JPG أو PNG أو WebP أو GIF بحجم لا يتجاوز ١٠ ميغابايت."));
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setUploadingImages(true);
    try {
      const form = new FormData();
      form.append("file", file, file.name);
      form.append("storeId", storeId);
      const result = await json<{ success: true; data: { url: string; provider: string; mimeType?: string; storageKey?: string; deleteToken?: string; width?: number; height?: number } }>(
        await fetch("/api/seller/products/media", { method: "POST", body: form })
      );
      setUploadedImages((items) => items.map((item) => item.id === id ? {
        ...item, file, previewUrl, url: result.data.url, provider: result.data.provider,
        mimeType: result.data.mimeType ?? file.type, storageKey: result.data.storageKey,
        deleteToken: result.data.deleteToken, width: result.data.width, height: result.data.height,
        status: "ready", error: undefined
      } : item));
      URL.revokeObjectURL(current.previewUrl);
      await deleteTemporaryProductImage(current.deleteToken);
      toast.success(translate(locale, "Image replaced successfully.", "تم استبدال الصورة بنجاح."));
    } catch (cause) {
      URL.revokeObjectURL(previewUrl);
      toast.error(cause instanceof Error ? cause.message : translate(locale, "Image could not be replaced.", "تعذر استبدال الصورة."));
    } finally {
      setUploadingImages(false);
    }
  }

  async function retryProductImage(id: string) {
    const image = uploadedImages.find((entry) => entry.id === id);
    if (!image || image.status !== "failed") return;
    setUploadingImages(true);
    setUploadedImages((current) => current.map((entry) => entry.id === id ? { ...entry, status: "uploading", error: undefined } : entry));
    try {
      const form = new FormData();
      form.append("file", image.file, image.file.name);
      form.append("storeId", storeId);
      const result = await json<{ success: true; data: { url: string; provider: string; mimeType?: string; storageKey?: string; deleteToken?: string; width?: number; height?: number } }>(
        await fetch("/api/seller/products/media", { method: "POST", body: form })
      );
      setUploadedImages((current) => current.map((entry) => entry.id === id
        ? { ...entry, url: result.data.url, provider: result.data.provider, mimeType: result.data.mimeType ?? image.file.type, storageKey: result.data.storageKey, deleteToken: result.data.deleteToken, width: result.data.width, height: result.data.height, status: "ready", error: undefined }
        : entry));
      setError("");
      toast.success(translate(locale, "Image uploaded successfully.", "تم رفع الصورة بنجاح."));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Image upload failed.", "فشل رفع الصورة.");
      setUploadedImages((current) => current.map((entry) => entry.id === id ? { ...entry, status: "failed", error: message } : entry));
      toast.error(message);
    } finally {
      setUploadingImages(false);
    }
  }

  async function deleteTemporaryProductImage(deleteToken?: string) {
    if (!deleteToken || !storeId) return;
    try {
      const result = await json<{ deleted: boolean; warning?: string }>(await fetch("/api/seller/products/media", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, deleteToken })
      }));
      if (!result.deleted && result.warning) toast.warning(translate(locale, "The image was removed from this draft, but the provider could not delete the remote file.", "تمت إزالة الصورة من المسودة، لكن مزود التخزين لم يتمكن من حذف الملف البعيد."));
    } catch {
      toast.warning(translate(locale, "The image was removed from this draft, but remote cleanup could not be confirmed.", "تمت إزالة الصورة من المسودة، لكن تعذر تأكيد حذف الملف البعيد."));
    }
  }

  function removeProductImage(id: string) {
    const image = uploadedImages.find((entry) => entry.id === id);
    if (!image) return;
    if (imagePreview?.url === image.previewUrl) setImagePreview(null);
    setUploadedImages((current) => current.filter((entry) => entry.id !== id));
    URL.revokeObjectURL(image.previewUrl);
    void deleteTemporaryProductImage(image.deleteToken);
  }

  function moveProductImage(id: string, direction: -1 | 1) {
    setUploadedImages((current) => {
      const index = current.findIndex((image) => image.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploadingImages || uploadedImages.some((image) => image.status === "uploading")) {
      setError(translate(locale, "Wait for image uploads to finish before saving the product.", "انتظر حتى يكتمل رفع الصور قبل حفظ المنتج."));
      return;
    }
    if (uploadedImages.some((image) => image.status === "failed")) {
      setError(translate(locale, "Retry or remove failed images before saving the product.", "أعد محاولة رفع الصور الفاشلة أو احذفها قبل حفظ المنتج."));
      return;
    }
    if (!uploadedImages.some((image) => image.status === "ready")) {
      setError(translate(locale, "Add at least one successfully uploaded product image before saving.", "أضف صورة واحدة على الأقل وارفعها بنجاح قبل حفظ المنتج."));
      return;
    }
    if (isRealEstate && (productLocation.latitude == null || productLocation.longitude == null || !floorArea || Number(floorArea) <= 0)) {
      setError(translate(locale, "Real-estate listings need a map location and a positive floor area.", "تحتاج الإعلانات العقارية إلى موقع على الخريطة ومساحة موجبة."));
      return;
    }
    if (!variantPricesValid) {
      setError(translate(locale, "Enter a valid price for every SKU and enabled market.", "أدخل سعراً صالحاً لكل متغير وسوق مفعّل."));
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const product = await json<{ id: string }>(await fetch("/api/products", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId, name, slug, description, contactPhone: contactPhone || undefined, videoUrl: videoUrl || undefined,
          specifications: {
            ...Object.fromEntries(Object.entries(basicSpecifications).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()])),
            custom: customSpecifications.filter((item) => item.name.trim() && item.value.trim()).map((item) => ({ name: item.name.trim(), value: item.value.trim() }))
          },
          ...(isRealEstate ? { propertyDetails: { propertyType, listingType, bedrooms: bedrooms === "" ? null : Number(bedrooms), bathrooms: bathrooms === "" ? null : Number(bathrooms), floorArea } } : {}),
          categoryIds: categoryId ? [categoryId] : [],
          attributes: categoryAttributes.filter((attribute) => !attribute.variantLevel).flatMap((attribute) => {
            const value = attributeValues[attribute.id];
            return value === undefined || value === "" || (Array.isArray(value) && value.length === 0)
              ? []
              : [{ attributeDefinitionId: attribute.id, value }];
          }),
          // Keep the API payload aligned with the strict server schema.
          // The picker stores canonical locality IDs and seller-entered location details;
          // the server resolves administrative relations from localityId.
          ...{
            city: productLocation.city,
            district: productLocation.district,
            localityId: productLocation.localityId,
            neighborhood: productLocation.neighborhood,
            streetAddress: productLocation.streetAddress,
            latitude: productLocation.latitude,
            longitude: productLocation.longitude
          },
          media: uploadedImages.filter((image) => image.status === "ready").map((image, index) => ({ url: image.url, mimeType: image.mimeType, storageKey: image.storageKey, width: image.width, height: image.height, altText: name, sortOrder: index, isPrimary: index === 0 })),
          variants: variantRows.map((variant) => ({
            sku: variant.sku.trim(),
            ...(variant.barcode.trim() ? { barcode: variant.barcode.trim() } : {}),
            ...(variant.name.trim() ? { name: variant.name.trim() } : {}),
            optionValues: Object.fromEntries(Object.entries(variant.optionValues).filter(([, value]) => value !== "" && (!Array.isArray(value) || value.length > 0))),
            prices: availableMarkets.map((market) => { const price = variant.prices[market.id] ?? marketPrices[market.id] ?? { currencyCode: market.defaultCurrency.code, amount: "", compareAt: "" }; const currency = market.currencies.find((entry) => entry.currency.code === price.currencyCode)?.currency ?? market.defaultCurrency; return { marketId: market.id, currencyCode: price.currencyCode, amountMinor: toMinorUnits(price.amount, currency.minorUnit), ...(price.compareAt.trim() ? { compareAtMinor: toMinorUnits(price.compareAt, currency.minorUnit) } : {}) }; })
          }))
        })
      }));
      setMessage(`${translate(locale, "Draft product created", "تم إنشاء مسودة المنتج")} (${product.id}). ${translate(locale, "It is awaiting platform review.", "بانتظار مراجعة المنصة.")}`);
      toast.success(translate(locale, "Product created", "تم إنشاء المنتج"), { description: translate(locale, "Your draft is awaiting platform review.", "المسودة بانتظار مراجعة المنصة.") });
      uploadedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl)); setName(""); setSlug(""); setDescription(""); setBasicSpecifications({ model: "", color: "", material: "", weight: "", dimensions: "", condition: "", warranty: "", countryOfOrigin: "" }); setCustomSpecifications([]); setVariantRows([{ id: crypto.randomUUID(), sku: "", barcode: "", name: "", optionValues: {}, prices: Object.fromEntries(availableMarkets.map((market) => [market.id, { currencyCode: market.defaultCurrency.code, amount: "", compareAt: "" }])) }]); setUploadedImages([]); setMarketPrices(Object.fromEntries(availableMarkets.map((market) => [market.id, { currencyCode: market.defaultCurrency.code, amount: "", compareAt: "" }]))); setCategoryId(""); setCategoryAttributes([]); setAttributeValues({}); setProductLocation({});
      await loadProducts(storeId, search);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate(locale, "Product could not be created.", "تعذر إنشاء المنتج."));
      toast.error(translate(locale, "Product could not be created", "تعذر إنشاء المنتج"));
    } finally { setBusy(false); }
  }

  async function uploadEditProductImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length || !editingId) return;
    if (editMedia.length + files.length > 10) {
      toast.error(translate(locale, "A product can have up to 10 images.", "يمكن إضافة ١٠ صور كحد أقصى للمنتج."));
      return;
    }
    const invalid = files.find((file) => !["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"].includes(file.type) || file.size <= 0 || file.size > 10 * 1024 * 1024);
    if (invalid) {
      toast.error(translate(locale, "Use JPG, PNG, WebP, GIF or AVIF images up to 10 MB each.", "استخدم صور JPG أو PNG أو WebP أو GIF أو AVIF بحجم لا يتجاوز ١٠ ميغابايت للصورة."));
      return;
    }
    if (!storeId) {
      toast.error(translate(locale, "Choose a store before uploading images.", "اختر متجراً قبل رفع الصور."));
      return;
    }
    setEditMediaUploading(true);
    try {
      const results = await Promise.allSettled(files.map(async (file) => {
        const form = new FormData();
        form.append("file", file, file.name);
        form.append("storeId", storeId);
        const result = await json<{ success: true; data: { url: string; storageKey?: string; deleteToken?: string; mimeType?: string; width?: number; height?: number } }>(
          await fetch("/api/seller/products/media", { method: "POST", body: form })
        );
        return {
          id: crypto.randomUUID(),
          url: result.data.url,
          storageKey: result.data.storageKey ?? null,
          deleteToken: result.data.deleteToken,
          mimeType: result.data.mimeType ?? file.type,
          width: result.data.width ?? null,
          height: result.data.height ?? null,
          altText: editName,
          sortOrder: 0,
          isPrimary: false
        };
      }));
      const uploaded = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      if (uploaded.length) {
        setEditMedia((current) => [...current, ...uploaded].map((item, index) => ({
          ...item, sortOrder: index, isPrimary: index === 0
        })));
      }
      const failures = results.filter((result) => result.status === "rejected");
      if (failures.length) {
        const first = failures[0];
        toast.error(first.status === "rejected" && first.reason instanceof Error
          ? first.reason.message
          : translate(locale, "One or more images could not be uploaded.", "تعذر رفع صورة واحدة أو أكثر."));
      } else {
        toast.success(translate(locale, "Images uploaded successfully.", "تم رفع الصور بنجاح."));
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Image upload failed.", "فشل رفع الصورة.");
      toast.error(message);
    } finally {
      setEditMediaUploading(false);
    }
  }

  async function replaceEditProductImage(id: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const current = editMedia.find((item) => item.id === id);
    if (!file || !current) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"].includes(file.type) || file.size <= 0 || file.size > 10 * 1024 * 1024) {
      toast.error(translate(locale, "Use JPG, PNG, WebP, GIF or AVIF images up to 10 MB.", "استخدم صور JPG أو PNG أو WebP أو GIF بحجم لا يتجاوز ١٠ ميغابايت."));
      return;
    }
    setEditMediaUploading(true);
    try {
      const form = new FormData();
      form.append("file", file, file.name);
      form.append("storeId", storeId);
      const result = await json<{ success: true; data: { url: string; storageKey?: string; deleteToken?: string; mimeType?: string; width?: number; height?: number } }>(
        await fetch("/api/seller/products/media", { method: "POST", body: form })
      );
      setEditMedia((items) => items.map((item) => item.id === id ? {
        ...item, url: result.data.url, storageKey: result.data.storageKey ?? null,
        deleteToken: result.data.deleteToken, mimeType: result.data.mimeType ?? file.type,
        width: result.data.width ?? null, height: result.data.height ?? null, altText: editName
      } : item));
      if (current.deleteToken) await deleteTemporaryProductImage(current.deleteToken);
      toast.success(translate(locale, "Image replaced successfully.", "تم استبدال الصورة بنجاح."));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : translate(locale, "Image could not be replaced.", "تعذر استبدال الصورة."));
    } finally {
      setEditMediaUploading(false);
    }
  }

  function removeEditProductImage(id: string) {
    const removed = editMedia.find((item) => item.id === id);
    if (removed && imagePreview?.url === removed.url) setImagePreview(null);
    setEditMedia((current) => current.filter((item) => item.id !== id).map((item, index) => ({
      ...item, sortOrder: index, isPrimary: index === 0
    })));
    if (removed?.deleteToken) void deleteTemporaryProductImage(removed.deleteToken);
  }

  function moveEditProductImage(id: string, direction: -1 | 1) {
    setEditMedia((current) => {
      const index = current.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((item, order) => ({ ...item, sortOrder: order, isPrimary: order === 0 }));
    });
  }

  async function saveProductEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    if (!editMedia.length) {
      setError(translate(locale, "A product must keep at least one image. Add a replacement before removing the final image.", "يجب أن يحتفظ المنتج بصورة واحدة على الأقل. أضف صورة بديلة قبل إزالة الصورة الأخيرة."));
      return;
    }
    if (!editVariantPricesValid) {
      setError(translate(locale, "Enter a valid price for every SKU and enabled market.", "أدخل سعراً صالحاً لكل متغير وسوق مفعّل."));
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      await json(await fetch(`/api/products/${encodeURIComponent(editingId)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName, slug: editSlug, description: editDescription,
          city: editProductLocation.city ?? null, district: editProductLocation.district ?? null,
          localityId: editProductLocation.localityId ?? null,
          neighborhood: editProductLocation.neighborhood ?? null,
          streetAddress: editProductLocation.streetAddress ?? null,
          latitude: editProductLocation.latitude ?? null,
          longitude: editProductLocation.longitude ?? null,
          contactPhone: editContactPhone || null, videoUrl: editVideoUrl || null,
          categoryIds: editCategoryId ? [editCategoryId] : [],
          ...(editIsRealEstate ? {
            propertyDetails: { propertyType: editPropertyType, listingType: editListingType, bedrooms: editBedrooms === "" ? null : Number(editBedrooms), bathrooms: editBathrooms === "" ? null : Number(editBathrooms), floorArea: editFloorArea }
          } : {}),
          media: editMedia.map(({ id: _id, deleteToken: _deleteToken, ...item }, index) => ({ ...item, sortOrder: index, isPrimary: index === 0 })),
          ...(editVariantRows.length > 0 && availableMarkets.length > 0 ? {
            variants: editVariantRows.map((variant) => ({
              id: variant.id,
              prices: availableMarkets.map((market) => {
                const price = variant.prices[market.id];
                const currency = market.currencies.find((entry) => entry.currency.code === price.currencyCode)!.currency;
                return {
                  marketId: market.id,
                  currencyCode: price.currencyCode,
                  amountMinor: toMinorUnits(price.amount, currency.minorUnit),
                  ...(price.compareAt.trim() ? { compareAtMinor: toMinorUnits(price.compareAt, currency.minorUnit) } : {})
                };
              })
            }))
          } : {})
        })
      }));
      setEditingId("");
      setEditVariantRows([]);
      setMessage(translate(locale, "Draft product updated and returned to pending review.", "تم تحديث مسودة المنتج وإعادتها إلى قائمة المراجعة."));
      toast.success(translate(locale, "Product updated", "تم تحديث المنتج"));
      await loadProducts(storeId, search);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate(locale, "Product could not be updated.", "تعذر تحديث المنتج."));
      toast.error(translate(locale, "Product could not be updated", "تعذر تحديث المنتج"));
    } finally { setBusy(false); }
  }

  async function publish(id: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      await json(await fetch(`/api/products/${encodeURIComponent(id)}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      }));
      setMessage(translate(locale, "Product published.", "تم نشر المنتج."));
      toast.success(translate(locale, "Product published", "تم نشر المنتج"));
      await loadProducts(storeId, search);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate(locale, "Product could not be published.", "تعذر نشر المنتج."));
      toast.error(translate(locale, "Product could not be published", "تعذر نشر المنتج"));
    } finally { setBusy(false); }
  }

  const inputClass = "w-full rounded-xl border border-[#eee9e4] bg-white px-3.5 py-3 text-sm text-[#454545] shadow-sm outline-none transition placeholder:text-[#918a84] focus:border-[#FF8C1C] focus:ring-4 focus:ring-[#FF8C1C]/10";
  return <main className="min-h-screen bg-[#fffaf6] text-[#454545]">
    <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[1.75rem] border border-[#eee9e4] bg-[linear-gradient(110deg,#fff6ef_0%,#ffffff_58%,#fff1e8_100%)] p-5 text-[#454545] shadow-[0_12px_28px_rgba(69,69,69,.07)] sm:p-7">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-[#f6d8c5] bg-[#fff1e8] text-[#FF8C1C]" aria-hidden="true"><SellerIcon name="package" /></span>
          <div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#a94308]">{translate(locale, "CATALOG MANAGEMENT", "إدارة الكتالوج")}</p><h1 className="mt-1 text-2xl font-black tracking-tight text-[#454545] sm:text-3xl">{translate(locale, "Products", "المنتجات")}</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-[#77716c]">{translate(locale, "Create, organize and maintain your store listings. Category-specific fields and publication rules are applied from the catalog.", "أنشئ منتجات متجرك ونظّمها وأدرها. تُحمّل خصائص كل فئة وتُطبق قواعد النشر من الكتالوج.")}</p></div>
        </div>
        <Link href="#create-product" className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#FF8C1C] bg-[#FF8C1C] px-5 py-3 text-sm font-extrabold text-white shadow-[0_7px_16px_rgba(255,140,28,.18)] transition hover:-translate-y-0.5 hover:bg-[#E8750B]"><SellerIcon name="plus" />{translate(locale, "New product", "منتج جديد")}</Link>
      </header>
      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="mt-5 rounded-xl border border-[var(--color-sage-500)] bg-[var(--color-sage-100)] p-3 text-sm">{message}</p>}
      {loading ? <p className="py-12 text-sm text-[var(--muted)]">{translate(locale, "Loading catalog…", "جارٍ تحميل الكتالوج…")}</p> : <div className="mt-8 grid gap-6 2xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,.8fr)]">
        <section id="create-product" className="seller-product-create scroll-mt-24 rounded-2xl border border-[#eee9e4] bg-white p-5 shadow-[0_10px_28px_rgba(69,69,69,.06)] sm:p-7">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-[#eee9e4] pb-5">
            <div><p className="text-[10px] font-extrabold tracking-[.18em] text-[#a94308]">{translate(locale,"PRODUCT STUDIO","استوديو المنتجات")}</p><h2 className="mt-1 text-xl font-black tracking-tight text-[#454545]">{translate(locale, "Create product draft", "إنشاء مسودة منتج")}</h2><p className="mt-1 max-w-lg text-xs leading-5 text-[#918a84]">{translate(locale,"Build a complete listing with category-aware details, variants, pricing and a polished image gallery.","أنشئ إعلاناً متكاملاً يتضمن خصائص الفئة والمتغيرات والأسعار ومعرض صور احترافياً.")}</p></div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#eee9e4] bg-[#fffaf6] px-3 py-1.5 text-[10px] font-extrabold text-[#5f5a55]"><SellerIcon name="document" />{translate(locale,"DRAFT WORKFLOW","مسار المسودة")}</span>
          </div>
          <label className="mt-5 grid gap-2 text-sm font-semibold"><span className="flex items-center gap-2"><SellerIcon name="store" />{translate(locale, "Store", "المتجر")}</span><select className={inputClass} value={storeId} disabled={busy || uploadingImages} onChange={(e) => {
            const nextId = e.target.value;
            uploadedImages.forEach((image) => {
              URL.revokeObjectURL(image.previewUrl);
              if (image.deleteToken) void deleteTemporaryProductImage(image.deleteToken);
            });
            setStoreId(nextId);
            try { localStorage.setItem("mtjr.activeStoreId", nextId); window.dispatchEvent(new Event("mtjr:active-store-changed")); } catch { /* Storage can be unavailable in restricted browsers. */ }
            setProducts([]);
            setUploadedImages([]);
            const nextStore = stores.find((store) => store.id === nextId);
            const allowed = new Set(nextStore?.markets.map((entry) => entry.market.id) ?? []);
            const nextPrices = Object.fromEntries(markets.filter((market) => allowed.has(market.id)).map((market) => [market.id, { currencyCode: market.defaultCurrency.code, amount: "", compareAt: "" }]));
            setMarketPrices(nextPrices);
            setVariantRows((rows) => rows.map((row) => ({ ...row, prices: nextPrices, optionValues: {} })));
          }}>{stores.map((store) => <option key={store.id} value={store.id}>{store.name} · STR-{store.storeNumber.padStart(8, "0")}</option>)}</select></label>
          {!stores.length ? <p className="mt-4 rounded-xl bg-[var(--surface-soft)] p-4 text-sm">{translate(locale, "Create a store and activate its markets before adding products.", "أنشئ متجرًا وفعّل أسواقه قبل إضافة المنتجات.")}</p> : <form onSubmit={createProduct} className="seller-product-form mt-4 grid gap-5">
            <div
              className="seller-product-dropzone grid gap-4 rounded-xl border border-dashed border-[#f3b58f] bg-[#fffaf6] p-4 transition-colors hover:border-[#FF8C1C] sm:p-5"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); void uploadProductImageFiles(Array.from(event.dataTransfer.files)); }}
              aria-label={translate(locale, "Product image upload area", "منطقة رفع صور المنتج")}
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <SellerIcon name="media" />
                  <p className="text-sm font-extrabold text-[#454545]">{translate(locale, "Product image gallery", "معرض صور المنتج")}</p>
                  <span className="rounded-full bg-[#fff1e8] px-2.5 py-1 text-[10px] font-bold text-[#a94308]">{uploadedImages.length}/10</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{translate(locale, "Drag images here or browse. Add up to 10 JPG, PNG, WebP, GIF or AVIF files (10 MB each). The first image is the storefront cover. Imgur Client IDs rotate in order, then ImageKit and Cloudinary are used as fallbacks.", "اسحب الصور هنا أو اخترها. أضف حتى ١٠ صور بصيغ JPG أو PNG أو WebP أو GIF أو AVIF (١٠ ميغابايت للصورة). الصورة الأولى هي غلاف المتجر. يتم تدوير معرفات Imgur بالترتيب ثم استخدام ImageKit وCloudinary كبدائل.")}</p>
              </div>
              <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-[#eee9e4] bg-white px-4 py-2.5 text-sm font-bold text-[#454545] shadow-sm transition hover:border-[#FF8C1C] hover:-translate-y-0.5">
                <SellerIcon name="media" />
                {uploadingImages ? translate(locale, "Uploading images…", "جارٍ رفع الصور…") : translate(locale, "Choose images", "اختيار الصور")}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple disabled={!storeId || uploadingImages || uploadedImages.length >= 10} onChange={uploadProductImages} className="sr-only" />
              </label>
              {uploadedImages.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {uploadedImages.map((image, index) => <article key={image.id} className="overflow-hidden rounded-2xl border border-white/80 bg-[#fffaf6] shadow-[0_5px_14px_rgba(69,69,69,.08),inset_0_1px_0_white]">
                  <div className="relative aspect-square bg-[var(--surface-soft)]">
                    <button type="button" onClick={() => setImagePreview({ url: image.previewUrl, alt: `${translate(locale, "Product image", "صورة المنتج")} ${index + 1}` })} aria-label={translate(locale, "Preview image", "معاينة الصورة")} className="absolute inset-0 h-full w-full cursor-zoom-in"><img src={image.previewUrl} alt="" className={`h-full w-full object-cover ${image.status === "uploading" ? "opacity-60" : ""}`} /></button>
                    {index === 0 && <span className="absolute bottom-2 left-2 rounded-full bg-black/75 px-2.5 py-1 text-[10px] font-bold text-white">{translate(locale, "Primary image", "الصورة الرئيسية")}</span>}
                    {image.status === "uploading" && <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-xs font-semibold text-white">{translate(locale, "Uploading…", "جارٍ الرفع…")}</span>}
                    {image.status === "failed" && <span className="absolute inset-0 flex items-center justify-center bg-red-950/60 p-3 text-center text-xs font-semibold text-white">{translate(locale, "Upload failed", "فشل الرفع")}</span>}
                    <button type="button" aria-label={translate(locale, "Remove image", "إزالة الصورة")} disabled={uploadingImages || image.status === "uploading"} onClick={() => removeProductImage(image.id)} className="absolute right-2 top-2 rounded-full bg-black/70 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-40"><SellerIcon name="trash" /></button>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2 text-xs">
                    <span className={image.status === "ready" ? "text-emerald-700" : image.status === "failed" ? "text-red-700" : "text-[var(--muted)]"}>{image.status === "ready" ? image.provider : image.status === "failed" ? translate(locale, "Failed", "فشل") : translate(locale, "Processing", "قيد المعالجة")}</span>
                    {image.status === "failed" && <button type="button" disabled={uploadingImages} onClick={() => retryProductImage(image.id)} className="rounded-md border border-red-200 px-2 py-1 font-semibold text-red-700 disabled:opacity-40"><SellerIcon name="refresh" />{translate(locale, "Retry", "إعادة المحاولة")}</button>}
                    <label className="cursor-pointer rounded-md border border-[var(--border)] px-2 py-1 font-semibold">
                      {translate(locale, "Replace", "استبدال")}
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="sr-only" disabled={uploadingImages || image.status === "uploading"} onChange={(event) => void replaceProductImage(image.id, event)} />
                    </label>
                    <div className="flex gap-1">
                      <button type="button" disabled={index === 0} onClick={() => moveProductImage(image.id, -1)} className="rounded-md border border-[var(--border)] px-2 py-1 disabled:opacity-30" aria-label={translate(locale, "Move image left", "تحريك الصورة للأعلى")}><SellerIcon name="arrow-up" /></button>
                      <button type="button" disabled={index === uploadedImages.length - 1} onClick={() => moveProductImage(image.id, 1)} className="rounded-md border border-[var(--border)] px-2 py-1 disabled:opacity-30" aria-label={translate(locale, "Move image right", "تحريك الصورة للأسفل")}><SellerIcon name="arrow-down" /></button>
                    </div>
                  </div>
                </article>)}
              </div>}
              {!uploadedImages.length && <p className="text-xs text-[var(--muted)]">{translate(locale, "No images selected. Add a primary image to continue.", "لم يتم اختيار صور بعد. أضف صورة رئيسية للمتابعة.")}</p>}
            </div>
            <section className="grid gap-4 rounded-xl border border-[#eee9e4] bg-white p-4 sm:p-5">
              <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#fff1e8] text-[#e8750b]"><SellerIcon name="document" /></span><div><h3 className="text-sm font-extrabold text-[#454545]">{translate(locale, "Product information", "معلومات المنتج")}</h3><p className="mt-1 text-xs text-[#77716c]">{translate(locale, "Start with a clear title and a customer-friendly description.", "ابدأ بعنوان واضح ووصف مناسب للعملاء.")}</p></div></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">{translate(locale, "Product name", "اسم المنتج")}<input required minLength={2} maxLength={180} className={inputClass} value={name} onChange={(e) => { setName(e.target.value); setSlug(createProductSlug(e.target.value)); }} /></label>
                <label className="grid gap-1 text-sm">{translate(locale, "URL slug", "معرّف الرابط")}<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={inputClass} value={slug} onChange={(e) => setSlug(e.target.value)} /></label>
                <label className="grid gap-1 text-sm sm:col-span-2">{translate(locale, "Description", "الوصف")}<textarea maxLength={12000} rows={4} className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">{translate(locale, "Contact phone", "هاتف التواصل")}<input type="tel" maxLength={40} className={inputClass} value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} /></label>
              <label className="grid gap-1 text-sm">{translate(locale, "Video URL (HTTPS)", "رابط الفيديو (HTTPS)")}<input type="url" maxLength={2048} placeholder="https://" className={inputClass} value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} /></label>
              </div>
            </section>
            <section className="grid gap-3 rounded-2xl border border-[#eee9e4] bg-white p-4 sm:p-5"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#fff1e8] text-[#e8750b]"><SellerIcon name="catalog" /></span><div><h3 className="text-sm font-extrabold text-[#454545]">{translate(locale, "Category", "الفئة")}</h3><p className="mt-1 text-xs text-[#77716c]">{translate(locale, "Choose the most accurate category for your product.", "اختر الفئة الأكثر دقة لمنتجك.")}</p></div></div><label className="grid gap-2 text-sm font-semibold"><select className={inputClass} value={categoryId} onChange={(e) => { const nextCategoryId = e.target.value; setCategoryId(nextCategoryId); setCategoryAttributes([]); setAttributeValues({}); setVariantRows((rows) => rows.map((row) => ({ ...row, optionValues: {} }))); setLoadingCategoryAttributes(Boolean(nextCategoryId)); }}><option value="">{translate(locale, "Choose a category", "اختر الفئة")}</option>{categoryOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            {categoryId && <section className="grid gap-3 rounded-xl border border-[#eee9e4] bg-[#fffaf6] p-4 sm:p-5">
              <div>
                <h3 className="text-sm font-semibold">{translate(locale, "Category-specific details", "الخصائص الخاصة بالفئة")}</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">{translate(locale, "These fields are defined by the catalog and validated again on the server.", "هذه الحقول معرّفة في الكتالوج ويعاد التحقق منها في الخادم قبل الحفظ.")}</p>
              </div>
              {loadingCategoryAttributes ? <p className="text-xs text-[var(--muted)]">{translate(locale, "Loading category fields…", "جارٍ تحميل خصائص الفئة…")}</p>
                : categoryAttributes.length === 0 ? <p className="text-xs text-[var(--muted)]">{translate(locale, "No additional attributes are configured for this category yet.", "لم تُعرّف خصائص إضافية لهذه الفئة بعد.")}</p>
                : <div className="grid gap-3 sm:grid-cols-2">
                  {categoryAttributes.filter((attribute) => !attribute.variantLevel).map((attribute) => {
                    const current = attributeValues[attribute.id];
                    const label = <span>{attribute.label}{attribute.required && <span className="ms-1 text-red-600">*</span>}</span>;
                    if (attribute.valueType === "BOOLEAN") return <label key={attribute.id} className="flex items-center gap-2 rounded-xl border border-[#eee9e4] bg-white p-3 text-sm">{label}<input type="checkbox" checked={current === true} onChange={(event) => setAttributeValues((values) => ({ ...values, [attribute.id]: event.target.checked }))} /></label>;
                    if (attribute.valueType === "SELECT") return <label key={attribute.id} className="grid gap-1 text-sm">{label}<select required={attribute.required} className={inputClass} value={typeof current === "string" ? current : ""} onChange={(event) => setAttributeValues((values) => ({ ...values, [attribute.id]: event.target.value }))}><option value="">{translate(locale, "Choose…", "اختر…")}</option>{attribute.options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
                    if (attribute.valueType === "MULTI_SELECT") return <fieldset key={attribute.id} className="grid gap-2 rounded-xl border border-[#eee9e4] bg-white p-3"><legend className="px-1 text-sm font-medium">{label}</legend>{attribute.options.map((option) => <label key={option} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Array.isArray(current) && current.includes(option)} onChange={(event) => setAttributeValues((values) => { const selected = Array.isArray(values[attribute.id]) ? values[attribute.id] as string[] : []; return { ...values, [attribute.id]: event.target.checked ? [...selected, option] : selected.filter((item) => item !== option) }; })} />{option}</label>)}</fieldset>;
                    return <label key={attribute.id} className="grid gap-1 text-sm">{label}<input required={attribute.required} type={attribute.valueType === "NUMBER" ? "number" : "text"} step={attribute.valueType === "NUMBER" ? "any" : undefined} className={inputClass} value={current === undefined ? "" : String(current)} onChange={(event) => setAttributeValues((values) => ({ ...values, [attribute.id]: attribute.valueType === "NUMBER" ? (event.target.value === "" ? "" : Number(event.target.value)) : event.target.value }))} placeholder={attribute.description ?? ""} /></label>;
                  })}
                </div>}
            </section>}
            </section>
            <section className="grid gap-4 rounded-2xl border border-[#eee9e4] bg-white p-4 sm:p-5">
              <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#fff1e8] text-[#e8750b]"><SellerIcon name="sliders" /></span><div>
                <h3 className="text-sm font-extrabold text-[#454545]">{translate(locale, "Product specifications", "مواصفات المنتج")}</h3>
                <p className="mt-1 text-xs text-[#77716c]">{translate(locale, "Add the common details, then add any extra specification your product needs.", "أدخل المواصفات الأساسية ثم أضف أي مواصفات إضافية يحتاجها منتجك.")}</p>
              </div></div>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  ["model", "Model", "الموديل", "e.g. Galaxy S24"],
                  ["color", "Color", "اللون", "e.g. Black"],
                  ["material", "Material", "المادة", "e.g. Aluminum"],
                  ["weight", "Weight", "الوزن", "e.g. 180 g"],
                  ["dimensions", "Dimensions", "الأبعاد", "e.g. 15 × 7 × 0.8 cm"],
                  ["condition", "Condition", "الحالة", "New / Used"],
                  ["warranty", "Warranty", "الضمان", "e.g. 12 months"],
                  ["countryOfOrigin", "Country of origin", "بلد المنشأ", "e.g. Japan"]
                ] as const).map(([key, en, ar, placeholder]) => (
                  <label key={key} className="grid gap-1 text-sm font-semibold">
                    {translate(locale, en, ar)}
                    <input className={inputClass} value={basicSpecifications[key]} onChange={(event) => setBasicSpecifications((current) => ({ ...current, [key]: event.target.value }))} placeholder={translate(locale, placeholder, "أدخل القيمة")} maxLength={160} />
                  </label>
                ))}
              </div>
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><h4 className="text-sm font-bold">{translate(locale, "Additional specifications", "مواصفات إضافية")}</h4><p className="mt-1 text-xs text-[var(--muted)]">{translate(locale, "Examples: RAM — 8 GB, Internal storage — 256 GB, Battery — 5000 mAh.", "أمثلة: ذاكرة RAM — 8 GB، الذاكرة الداخلية — 256 GB، البطارية — 5000 mAh.")}</p></div>
                  <button type="button" onClick={() => setCustomSpecifications((items) => [...items, { id: crypto.randomUUID(), name: "", value: "" }])} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-bold text-black transition hover:border-[#FF8C1C] hover:shadow-sm">
                    <SellerIcon name="plus" />{translate(locale, "Add field", "إضافة حقل")}
                  </button>
                </div>
                {customSpecifications.length > 0 && <div className="grid gap-3">
                  {customSpecifications.map((item, index) => (
                    <div key={item.id} className="grid gap-2 rounded-xl border border-[var(--border)] bg-white p-3 sm:grid-cols-[1fr_1fr_auto]">
                      <label className="grid gap-1 text-xs font-semibold">{translate(locale, "Field name", "اسم الحقل")}<input className={inputClass} value={item.name} maxLength={80} placeholder={translate(locale, "e.g. RAM", "مثلاً: RAM")} onChange={(event) => setCustomSpecifications((items) => items.map((entry) => entry.id === item.id ? { ...entry, name: event.target.value } : entry))} /></label>
                      <label className="grid gap-1 text-xs font-semibold">{translate(locale, "Value", "القيمة")}<input className={inputClass} value={item.value} maxLength={240} placeholder={translate(locale, "e.g. 8 GB", "مثلاً: 8 GB")} onChange={(event) => setCustomSpecifications((items) => items.map((entry) => entry.id === item.id ? { ...entry, value: event.target.value } : entry))} /></label>
                      <button type="button" aria-label={translate(locale, "Remove field", "حذف الحقل")} onClick={() => setCustomSpecifications((items) => items.filter((entry) => entry.id !== item.id))} className="self-end rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50">{translate(locale, "Remove", "حذف")}</button>
                    </div>
                  ))}
                </div>}
              </div>
            </section>
            <section className="grid gap-3 rounded-2xl border border-[#eee9e4] bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#fff1e8] text-[#e8750b]"><SellerIcon name="inventory" /></span><div><h3 className="text-sm font-extrabold text-[#454545]">{translate(locale, "Product variants / SKUs", "متغيرات المنتج / رموز SKU")}</h3><p className="mt-1 text-xs leading-5 text-[#77716c]">{translate(locale, "Add a separate SKU for every size, color or configuration. Set the price separately for every SKU and enabled market.", "أضف رمز SKU مستقلاً لكل مقاس أو لون أو مواصفة. حدد السعر بشكل مستقل لكل SKU ولكل سوق مفعّل.")}</p></div></div><button type="button" disabled={variantRows.length >= 100} onClick={() => setVariantRows((rows) => [...rows, { id: crypto.randomUUID(), sku: "", barcode: "", name: "", optionValues: {}, prices: Object.fromEntries(availableMarkets.map((market) => [market.id, { currencyCode: market.defaultCurrency.code, amount: "", compareAt: "" }])) }])} className="rounded-xl border border-[#eee9e4] bg-white px-3 py-2 text-xs font-bold text-[#5f5a55] shadow-sm disabled:opacity-40"><SellerIcon name="plus" />{translate(locale, "Add variant", "إضافة متغير")}</button></div>
              {variantRows.map((variant, index) => <article key={variant.id} className="grid gap-3 rounded-xl border border-[#eee9e4] bg-[#fffaf6] p-4">
                <div className="flex items-center justify-between"><p className="text-xs font-extrabold text-[#8a583b]">{translate(locale, "Variant", "المتغير")} {index + 1}</p>{variantRows.length > 1 && <button type="button" onClick={() => setVariantRows((rows) => rows.filter((row) => row.id !== variant.id))} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700"><SellerIcon name="trash" />{translate(locale, "Remove", "حذف")}</button>}</div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="grid gap-1 text-xs font-semibold">SKU<input required maxLength={100} className={inputClass} value={variant.sku} onChange={(event) => updateVariant(variant.id, { sku: event.target.value })} placeholder={`MAT-00${index + 1}`} /></label>
                  <label className="grid gap-1 text-xs font-semibold">{translate(locale, "Barcode (optional)", "الباركود (اختياري)")}<input maxLength={100} className={inputClass} value={variant.barcode} onChange={(event) => updateVariant(variant.id, { barcode: event.target.value })} placeholder="EAN / UPC" /></label>
                  <label className="grid gap-1 text-xs font-semibold">{translate(locale, "Variant name (optional)", "اسم المتغير (اختياري)")}<input maxLength={180} className={inputClass} value={variant.name} onChange={(event) => updateVariant(variant.id, { name: event.target.value })} placeholder={translate(locale, "e.g. Blue / Large", "مثال: أزرق / كبير")} /></label>
                </div>
                <div className="grid gap-3 border-t border-[#eadfd5] pt-3">
                  <p className="text-xs font-extrabold text-[#5f5a55]">{translate(locale, "Market prices for this SKU", "أسعار الأسواق لهذا المتغير")}</p>
                  {!availableMarkets.length && <p className="text-xs text-amber-800">{translate(locale, "No active markets are enabled for this store.", "لا توجد أسواق مفعّلة لهذا المتجر.")}</p>}
                  {availableMarkets.map((market) => {
                    const price = variant.prices[market.id] ?? marketPrices[market.id] ?? { currencyCode: market.defaultCurrency.code, amount: "", compareAt: "" };
                    const currencies = market.currencies.map((entry) => entry.currency);
                    const currency = currencies.find((item) => item.code === price.currencyCode) ?? market.defaultCurrency;
                    return <div key={market.id} className="grid gap-2 rounded-xl border border-[#eee9e4] bg-[#fffaf6] p-3">
                      <p className="text-xs font-bold">{market.name}</p>
                      <label className="grid gap-1 text-xs">{translate(locale, "Currency", "العملة")}<select required className={inputClass} value={price.currencyCode} onChange={(event) => updateVariantPrice(variant.id, market.id, { currencyCode: event.target.value, amount: "", compareAt: "" })}>{currencies.map((item) => <option key={item.code} value={item.code}>{item.code} · {currencyLabel(item.code, item.name)}</option>)}</select></label>
                      <label className="grid gap-1 text-xs">{translate(locale, "Selling price", "سعر البيع")} ({currency.code})<input required inputMode="decimal" type="text" className={inputClass} value={price.amount} onChange={(event) => updateVariantPrice(variant.id, market.id, { amount: event.target.value })} placeholder={currency.minorUnit === 0 ? "1299" : "1299.00"} /><span className="text-[11px] text-[#918a84]">{translate(locale, "Enter the full customer-facing amount. Decimal places allowed", "أدخل المبلغ الكامل الذي سيظهر للعميل. عدد المنازل العشرية المسموح")} {currency.minorUnit}</span></label>
                      <label className="grid gap-1 text-xs">{translate(locale, "Compare-at price (optional)", "السعر قبل الخصم (اختياري)")} ({currency.code})<input inputMode="decimal" type="text" className={inputClass} value={price.compareAt} onChange={(event) => updateVariantPrice(variant.id, market.id, { compareAt: event.target.value })} placeholder={translate(locale, "Original price", "السعر الأصلي")} /></label>
                    </div>;
                  })}
                </div>
                {categoryAttributes.filter((attribute) => attribute.variantLevel).length > 0 && <div className="grid gap-3 border-t border-[#eadfd5] pt-3 sm:grid-cols-2">
                  <p className="flex items-center gap-2 text-xs font-extrabold text-[#5f5a55] sm:col-span-2"><SellerIcon name="tag" />{translate(locale, "Variant options", "خيارات المتغير")}</p>
                  {categoryAttributes.filter((attribute) => attribute.variantLevel).map((attribute) => {
                    const current = variant.optionValues[attribute.key];
                    const label = <span>{attribute.label}{attribute.required && <span className="ms-1 text-red-600">*</span>}</span>;
                    if (attribute.valueType === "BOOLEAN") return <label key={attribute.id} className="flex items-center gap-2 rounded-xl bg-[#fffaf6] p-3 text-sm">{label}<input type="checkbox" checked={current === true} onChange={(event) => updateVariantOption(variant.id, attribute.key, event.target.checked)} /></label>;
                    if (attribute.valueType === "SELECT") return <label key={attribute.id} className="grid gap-1 text-sm">{label}<select required={attribute.required} className={inputClass} value={typeof current === "string" ? current : ""} onChange={(event) => updateVariantOption(variant.id, attribute.key, event.target.value)}><option value="">{translate(locale, "Choose…", "اختر…")}</option>{attribute.options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
                    if (attribute.valueType === "MULTI_SELECT") return <fieldset key={attribute.id} className="grid gap-2 rounded-xl bg-[#fffaf6] p-3"><legend className="px-1 text-sm font-medium">{label}</legend>{attribute.options.map((option) => { const selected = Array.isArray(current) ? current : []; return <label key={option} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(option)} onChange={(event) => updateVariantOption(variant.id, attribute.key, event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} />{option}</label>; })}</fieldset>;
                    return <label key={attribute.id} className="grid gap-1 text-sm">{label}<input required={attribute.required} type={attribute.valueType === "NUMBER" ? "number" : "text"} step={attribute.valueType === "NUMBER" ? "any" : undefined} className={inputClass} value={current === undefined ? "" : String(current)} onChange={(event) => updateVariantOption(variant.id, attribute.key, attribute.valueType === "NUMBER" ? (event.target.value === "" ? "" : Number(event.target.value)) : event.target.value)} placeholder={attribute.description ?? ""} /></label>;
                  })}
                </div>}
              </article>)}
              {!variantSkusValid && <p className="text-xs font-semibold text-amber-800">{translate(locale, "Every variant needs a unique SKU.", "يجب أن يكون لكل متغير رمز SKU فريد.")}</p>}
            </section>
            <SyriaLocationPicker locale={locale} value={productLocation} onChange={setProductLocation} />
            {isRealEstate && <fieldset className="grid gap-3 rounded-2xl border border-[var(--border)] p-4">
              <legend className="px-1 text-sm font-semibold">{translate(locale, "Property details", "تفاصيل العقار")}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">{translate(locale, "Property type", "نوع العقار")}<select required className={inputClass} value={propertyType} onChange={(event) => setPropertyType(event.target.value as typeof propertyType)}>
                  <option value="APARTMENT">{translate(locale, "Apartment", "شقة")}</option><option value="HOUSE">{translate(locale, "House / villa", "منزل / فيلا")}</option><option value="LAND">{translate(locale, "Land", "أرض")}</option><option value="COMMERCIAL">{translate(locale, "Commercial", "تجاري")}</option>
                </select></label>
                <label className="grid gap-1 text-sm">{translate(locale, "Listing type", "نوع العرض")}<select required className={inputClass} value={listingType} onChange={(event) => setListingType(event.target.value as typeof listingType)}>
                  <option value="SALE">{translate(locale, "For sale", "للبيع")}</option><option value="RENT">{translate(locale, "For rent", "للإيجار")}</option>
                </select></label>
                <label className="grid gap-1 text-sm">{translate(locale, "Bedrooms", "غرف النوم")}<input type="number" min="0" max="100" step="1" className={inputClass} value={bedrooms} onChange={(event) => setBedrooms(event.target.value)} /></label>
                <label className="grid gap-1 text-sm">{translate(locale, "Bathrooms", "الحمامات")}<input type="number" min="0" max="100" step="1" className={inputClass} value={bathrooms} onChange={(event) => setBathrooms(event.target.value)} /></label>
                <label className="grid gap-1 text-sm sm:col-span-2">{translate(locale, "Floor area (m²)", "المساحة (م²)")}<input required type="number" min="0.01" max="999999999" step="0.01" className={inputClass} value={floorArea} onChange={(event) => setFloorArea(event.target.value)} /></label>
              </div>
            </fieldset>}
            <button disabled={busy || loadingCategoryAttributes || !requiredAttributesComplete || !requiredVariantAttributesComplete || !variantSkusValid || !variantPricesValid || uploadingImages || !uploadedImages.length || uploadedImages.some((image) => image.status !== "ready") || !storeId || !availableMarkets.length} className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF8C1C] px-5 py-3 text-sm font-extrabold text-white shadow-[0_8px_18px_rgba(255,140,28,.18)] transition hover:bg-[#E8750B] disabled:cursor-not-allowed disabled:opacity-50"><SellerIcon name="document" />{busy ? translate(locale, "Saving…", "جارٍ الحفظ…") : translate(locale, "Create draft product", "إنشاء مسودة منتج")}</button>
          </form>}
        </section>
        <section className="rounded-2xl border border-[#eee9e4] bg-white p-5 shadow-[0_10px_28px_rgba(30,57,83,.06)] sm:p-7">
          <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-[#454545]"><SellerIcon name="package" />{translate(locale, "Store catalog", "كتالوج المتجر")}</h2>
          {!loading && products.length > 0 && <section aria-label={translate(locale, "Seller catalog analytics", "تحليلات كتالوج البائع")} className="mt-5 grid gap-4 sm:grid-cols-2">
            <MetricBarChart title={translate(locale, "Product approval pipeline", "مسار اعتماد المنتجات")} description={translate(locale, "Counts reflect the currently loaded product list and active search.", "الأعداد للمنتجات المحمّلة حالياً ونتائج البحث النشط.")} rows={Object.entries(approvalCounts).map(([status, count], index) => ({
              label: productStatusLabel(status),
              value: count,
              color: ["bg-amber-500", "bg-emerald-500", "bg-rose-500", "bg-sky-500"][index % 4]
            }))} />
            <MetricBarChart title={translate(locale, "Product publication status", "حالة نشر المنتجات")} description={translate(locale, "Counts reflect the currently loaded product list and active search.", "الأعداد للمنتجات المحمّلة حالياً ونتائج البحث النشط.")} rows={Object.entries(publicationCounts).map(([status, count], index) => ({
              label: translateStatus(locale, status),
              value: count,
              color: ["bg-indigo-500", "bg-teal-500", "bg-slate-500", "bg-[var(--orange)]"][index % 4]
            }))} />
          </section>}<label className="mt-4 block text-xs font-medium">{translate(locale, "Search this store catalog", "البحث في كتالوج المتجر")}<input value={search} onChange={event=>setSearch(event.target.value)} maxLength={120} placeholder={translate(locale, "Product name, slug, SKU or barcode", "اسم المنتج أو المعرّف أو SKU أو الباركود")} className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm"/></label>
          {!products.length ? <p className="mt-4 rounded-xl bg-[var(--surface-soft)] p-5 text-sm text-[var(--muted)]">{search ? translate(locale, "No products match this search.", "لا توجد منتجات تطابق هذا البحث.") : translate(locale, "No products in this store yet.", "لا توجد منتجات في هذا المتجر بعد.")}</p> : <div className="mt-4 divide-y divide-[var(--border)]">{products.map((product) => <article key={product.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">{product.media[0]?.url && <img src={product.media[0].url} alt={product.media[0].altText ?? product.name} className="size-16 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] object-cover" />}<div className="min-w-0"><h3 className="font-semibold">{product.name}</h3><p className="mt-1 text-xs font-semibold text-[var(--color-copper-700)]">PRD-{product.productNumber.padStart(8, "0")}</p><p className="mt-1 text-xs text-[var(--muted)]">/{product.slug} · {product.variants.length} {translate(locale, "variants", "متغيرات")}</p>{(product.city || product.district || product.neighborhood || product.streetAddress) && <p className="mt-1 max-w-xl truncate text-xs text-[var(--muted)]">{[product.city, product.district, product.neighborhood, product.streetAddress].filter(Boolean).join(" · ")}</p>}<div className="mt-2 flex flex-wrap gap-2"><StatusBadge locale={locale} status={product.status} /><StatusBadge locale={locale} status={product.approvalStatus} /></div>{product.rejectionReason && <p className="mt-2 text-xs text-red-700">{translate(locale, "Review:", "ملاحظة المراجعة:")} {product.rejectionReason}</p>}</div></div>
            <div className="flex flex-wrap gap-2">
              {product.status === "DRAFT" && <button disabled={busy} onClick={() => { setEditingId(product.id); setEditName(product.name); setEditSlug(product.slug); setEditDescription(product.description ?? ""); setEditContactPhone(product.contactPhone ?? ""); setEditVideoUrl(product.videoUrl ?? "");
                setEditCategoryId(product.categories[0]?.category.id ?? "");
                setEditProductLocation({ city: product.city ?? undefined, district: product.district ?? undefined, localityId: product.localityId ?? undefined, neighborhood: product.neighborhood ?? undefined, streetAddress: product.streetAddress ?? undefined, latitude: product.latitude ?? undefined, longitude: product.longitude ?? undefined });
                setEditPropertyType(product.propertyDetails?.propertyType ?? "APARTMENT"); setEditListingType(product.propertyDetails?.listingType ?? "SALE");
                setEditBedrooms(product.propertyDetails?.bedrooms == null ? "" : String(product.propertyDetails.bedrooms)); setEditBathrooms(product.propertyDetails?.bathrooms == null ? "" : String(product.propertyDetails.bathrooms)); setEditFloorArea(product.propertyDetails?.floorArea ?? "");
                setEditMedia(product.media);
                setEditVariantRows(product.variants.map((variant) => ({
                  id: variant.id,
                  sku: variant.sku,
                  name: variant.name,
                  prices: Object.fromEntries(availableMarkets.map((market) => {
                    const price = variant.prices.find((entry) => entry.marketId === market.id);
                    return [market.id, {
                      currencyCode: price?.currencyCode ?? market.defaultCurrency.code,
                      amount: price ? minorUnitsToInput(price.amountMinor, price.currency.minorUnit) : "",
                      compareAt: price?.compareAtMinor ? minorUnitsToInput(price.compareAtMinor, price.currency.minorUnit) : ""
                    }];
                  }))
                }))); }} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold">{translate(locale, "Edit draft", "تعديل المسودة")}</button>}
              {product.status === "DRAFT" && product.approvalStatus === "APPROVED" && <button disabled={busy} onClick={() => publish(product.id)} className="rounded-lg bg-[var(--color-ink-800)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{translate(locale, "Publish", "نشر")}</button>}
            </div>
          </article>)}</div>}
          {editingId && <form onSubmit={saveProductEdit} className="mt-5 grid gap-3 rounded-2xl border border-[var(--border)] p-4">
            <h3 className="font-semibold">{translate(locale, "Edit draft product", "تعديل مسودة المنتج")}</h3>
            <label className="grid gap-1 text-sm">{translate(locale, "Name", "الاسم")}<input required minLength={2} maxLength={180} className={inputClass} value={editName} onChange={(e) => setEditName(e.target.value)} /></label>
            <label className="grid gap-1 text-sm">{translate(locale, "Slug", "المعرّف")}<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={inputClass} value={editSlug} onChange={(e) => setEditSlug(e.target.value)} /></label>
            <label className="grid gap-1 text-sm">{translate(locale, "Description", "الوصف")}<textarea maxLength={12000} rows={3} className={inputClass} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">{translate(locale, "Contact phone", "هاتف التواصل")}<input type="tel" maxLength={40} className={inputClass} value={editContactPhone} onChange={(event) => setEditContactPhone(event.target.value)} /></label>
              <label className="grid gap-1 text-sm">{translate(locale, "Video URL (HTTPS)", "رابط الفيديو (HTTPS)")}<input type="url" maxLength={2048} className={inputClass} value={editVideoUrl} onChange={(event) => setEditVideoUrl(event.target.value)} /></label>
            </div>
            {editIsRealEstate && <fieldset className="grid gap-3 rounded-2xl border border-[var(--border)] p-4">
              <legend className="px-1 text-sm font-semibold">{translate(locale, "Property details", "تفاصيل العقار")}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">{translate(locale, "Property type", "نوع العقار")}<select className={inputClass} value={editPropertyType} onChange={(event) => setEditPropertyType(event.target.value as typeof editPropertyType)}><option value="APARTMENT">شقة</option><option value="HOUSE">منزل / فيلا</option><option value="LAND">أرض</option><option value="COMMERCIAL">تجاري</option></select></label>
                <label className="grid gap-1 text-sm">{translate(locale, "Listing type", "نوع العرض")}<select className={inputClass} value={editListingType} onChange={(event) => setEditListingType(event.target.value as typeof editListingType)}><option value="SALE">للبيع</option><option value="RENT">للإيجار</option></select></label>
                <label className="grid gap-1 text-sm">{translate(locale, "Bedrooms", "غرف النوم")}<input type="number" min="0" max="100" className={inputClass} value={editBedrooms} onChange={(event) => setEditBedrooms(event.target.value)} /></label>
                <label className="grid gap-1 text-sm">{translate(locale, "Bathrooms", "الحمامات")}<input type="number" min="0" max="100" className={inputClass} value={editBathrooms} onChange={(event) => setEditBathrooms(event.target.value)} /></label>
                <label className="grid gap-1 text-sm sm:col-span-2">{translate(locale, "Floor area (m²)", "المساحة (م²)")}<input type="number" min="0.01" step="0.01" required className={inputClass} value={editFloorArea} onChange={(event) => setEditFloorArea(event.target.value)} /></label>
              </div>
            </fieldset>}
            {editVariantRows.length > 0 && <fieldset className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <legend className="px-1 text-sm font-semibold">{translate(locale, "SKU market prices", "أسعار المتغيرات حسب السوق")}</legend>
              {editVariantRows.map((variant) => <div key={variant.id} className="grid gap-3 rounded-xl border border-white bg-white/70 p-3">
                <p className="text-xs font-extrabold text-[#8a583b]">{variant.sku}{variant.name ? " · " + variant.name : ""}</p>
                {availableMarkets.map((market) => {
                  const price = variant.prices[market.id];
                  const currency = market.currencies.find((entry) => entry.currency.code === price.currencyCode)?.currency ?? market.defaultCurrency;
                  return <div key={market.id} className="grid gap-2 rounded-lg bg-[#fffaf6] p-3 sm:grid-cols-3">
                    <p className="self-center text-xs font-bold">{market.name}</p>
                    <label className="grid gap-1 text-xs">{translate(locale, "Currency", "العملة")}<select required className={inputClass} value={price.currencyCode} onChange={(event) => updateEditVariantPrice(variant.id, market.id, { currencyCode: event.target.value, amount: "", compareAt: "" })}>{market.currencies.map(({ currency: item }) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}</select></label>
                    <label className="grid gap-1 text-xs">{translate(locale, "Selling price", "سعر البيع")} ({currency.code})<input required type="text" inputMode="decimal" className={inputClass} value={price.amount} onChange={(event) => updateEditVariantPrice(variant.id, market.id, { amount: event.target.value })} placeholder={currency.minorUnit === 0 ? "1299" : "1299.00"} /></label>
                    <label className="grid gap-1 text-xs sm:col-start-2 sm:col-span-2">{translate(locale, "Compare-at price (optional)", "السعر قبل الخصم (اختياري)")} ({currency.code})<input type="text" inputMode="decimal" className={inputClass} value={price.compareAt} onChange={(event) => updateEditVariantPrice(variant.id, market.id, { compareAt: event.target.value })} /></label>
                  </div>;
                })}
              </div>)}
              {!editVariantPricesValid && <p className="text-xs text-amber-800">{translate(locale, "Enter a valid price for every SKU and enabled market. Compare-at prices cannot be lower than selling prices.", "أدخل سعراً صالحاً لكل متغير وسوق مفعّل. لا يجوز أن يكون السعر قبل الخصم أقل من سعر البيع.")}</p>}
            </fieldset>}
            <SyriaLocationPicker locale={locale} value={editProductLocation} onChange={setEditProductLocation} />
            <section className="grid gap-3 rounded-2xl border border-white/80 bg-[linear-gradient(145deg,#fffaf6,#f5eee7)] p-3 shadow-[inset_0_1px_0_white,0_4px_10px_rgba(119,86,62,.04)]" aria-label={translate(locale, "Product image gallery", "معرض صور المنتج")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h4 className="text-sm font-semibold">{translate(locale, "Product image gallery", "معرض صور المنتج")}</h4><p className="mt-1 text-xs text-[var(--muted)]">{translate(locale, "Preview, remove, replace and reorder up to 10 images. The first image is the cover.", "عاين الصور واحذفها واستبدلها ورتبها. الصورة الأولى هي الغلاف، بحد أقصى ١٠ صور.")}</p></div>
                <label className="cursor-pointer rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold">
                  {editMediaUploading ? translate(locale, "Uploading…", "جارٍ الرفع…") : translate(locale, "Add images", "إضافة صور")}
                  <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="sr-only" disabled={busy || editMediaUploading || editMedia.length >= 10} onChange={uploadEditProductImages} />
                </label>
              </div>
              {editMedia.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {editMedia.map((media, index) => <article key={media.id} className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]">
                  <div className="relative aspect-square">
                    <button type="button" onClick={() => setImagePreview({ url: media.url, alt: media.altText ?? editName })} aria-label={translate(locale, "Preview image", "معاينة الصورة")} className="absolute inset-0 h-full w-full cursor-zoom-in"><img src={media.url} alt="" className="h-full w-full object-cover" /></button>
                    {index === 0 && <span className="absolute bottom-2 left-2 rounded-full bg-black/75 px-2 py-1 text-[10px] font-bold text-white">{translate(locale, "Cover", "الغلاف")}</span>}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1 p-2">
                    <span className="text-[10px] text-[var(--muted)]">{index + 1} / {editMedia.length}</span>
                    <div className="flex gap-1">
                      <button type="button" disabled={index === 0 || busy || editMediaUploading} onClick={() => moveEditProductImage(media.id, -1)} aria-label={translate(locale, "Move image earlier", "تحريك الصورة للأعلى")} className="rounded-md border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-40"><SellerIcon name="arrow-up" /></button>
                      <button type="button" disabled={index === editMedia.length - 1 || busy || editMediaUploading} onClick={() => moveEditProductImage(media.id, 1)} aria-label={translate(locale, "Move image later", "تحريك الصورة للأسفل")} className="rounded-md border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-40"><SellerIcon name="arrow-down" /></button>
                      <label className="cursor-pointer rounded-md border border-[var(--border)] px-2 py-1 text-xs font-semibold">
                        {translate(locale, "Replace", "استبدال")}
                        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="sr-only" disabled={busy || editMediaUploading} onChange={(event) => void replaceEditProductImage(media.id, event)} />
                      </label>
                      <button type="button" disabled={busy || editMediaUploading} onClick={() => removeEditProductImage(media.id)} aria-label={translate(locale, "Remove image", "حذف الصورة")} className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 disabled:opacity-40"><SellerIcon name="trash" /></button>
                    </div>
                  </div>
                </article>)}
              </div> : <p className="rounded-lg bg-[var(--surface-soft)] p-4 text-xs text-[var(--muted)]">{translate(locale, "No images yet. Add at least one image to make the product easier to recognize.", "لا توجد صور بعد. أضف صورة واحدة على الأقل لتسهيل التعرف على المنتج.")}</p>}
            </section>
            <div className="flex gap-2"><button disabled={busy || editMediaUploading || !editVariantPricesValid} className="rounded-lg bg-[var(--color-ink-800)] px-4 py-2 text-xs font-semibold text-white">{translate(locale, "Save changes", "حفظ التغييرات")}</button><button type="button" disabled={busy || editMediaUploading} onClick={() => { editMedia.forEach((item) => { if (item.deleteToken) void deleteTemporaryProductImage(item.deleteToken); }); setEditingId(""); setEditMedia([]); setEditVariantRows([]); }} className="rounded-lg border border-[var(--border)] px-4 py-2 text-xs">{translate(locale, "Cancel", "إلغاء")}</button></div>
          </form>}
        </section>
      </div>}
    </div>
    {imagePreview && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#454545]/85 p-4 backdrop-blur-md">
      <button type="button" aria-label={translate(locale, "Close image preview", "إغلاق معاينة الصورة")} onClick={() => setImagePreview(null)} className="absolute inset-0 cursor-zoom-out bg-transparent" />
      <section role="dialog" aria-modal="true" aria-label={translate(locale, "Image preview", "معاينة الصورة")} className="relative z-10 flex max-h-[94dvh] w-full max-w-5xl flex-col items-center gap-3 rounded-[2rem] border border-white/30 bg-[linear-gradient(145deg,#f1eff8,#e1dfed)] p-3 shadow-[0_24px_70px_rgba(12,10,24,.42),inset_0_2px_0_rgba(255,255,255,.9)] sm:p-5">
        <div className="flex w-full items-center justify-between gap-3 px-1">
          <p className="min-w-0 truncate text-sm font-extrabold text-[#454545]">{imagePreview.alt}</p>
          <button type="button" autoFocus onClick={() => setImagePreview(null)} className="grid size-10 shrink-0 place-items-center rounded-full border border-white bg-white/80 text-xl font-bold text-[#8a583b] shadow-[0_4px_10px_rgba(65,59,86,.12)]" aria-label={translate(locale, "Close preview", "إغلاق المعاينة")}><SellerIcon name="close" /></button>
        </div>
        <img src={imagePreview.url} alt={imagePreview.alt} className="max-h-[calc(94dvh-90px)] max-w-full rounded-2xl object-contain shadow-[0_12px_30px_rgba(36,31,54,.18)]" />
        <p className="text-[11px] font-medium text-[#8790a5]">{translate(locale, "Click outside the image or press Escape to close.", "انقر خارج الصورة أو اضغط Escape للإغلاق.")}</p>
      </section>
    </div>}
  </main>
}
