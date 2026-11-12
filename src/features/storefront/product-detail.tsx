"use client";

import { formatMinorUnits } from "@/lib/money";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AuthReturnLink from "@/components/auth-return-link";
import ProductReviews from "@/features/storefront/product-reviews";
import StoreReviews from "@/features/storefront/store-reviews";
import ProductQuestions from "@/features/storefront/product-questions";
import SponsoredProductCard from "@/features/storefront/sponsored-product-card";
import ProductLocationMap from "@/components/maps/product-location-map";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

const GUEST_WISHLIST_KEY = "mtjr:guest-wishlist:v1";
function readGuestWishlist(): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(GUEST_WISHLIST_KEY) ?? "[]");
    return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))].slice(0, 100) : [];
  } catch { return []; }
}
function writeGuestFavorite(productId: string, saved: boolean) {
  const ids = readGuestWishlist().filter((id) => id !== productId);
  if (saved) ids.unshift(productId);
  try {
    if (ids.length) window.localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(ids.slice(0, 100)));
    else window.localStorage.removeItem(GUEST_WISHLIST_KEY);
  } catch { /* Browser storage may be unavailable. */ }
}

type Price = { marketId: string; currencyCode: string; amountMinor: string | bigint; compareAtMinor: string | bigint | null; currency: { minorUnit: number } };
type ProductAttribute = { key: string; name: string; valueType: string; values: unknown[] };
type VariantAttribute = { key: string; name: string; valueType: string; value: unknown };
export type ProductDetailInitialSponsored = { campaignId: string; token: string; product: { id: string; slug: string; name: string; description: string | null; brand: { name: string } | null; store: { id: string; name: string; slug: string }; media: Array<{ url: string; altText: string | null; isPrimary: boolean }>; variants: Array<{ prices: Array<{ amountMinor: string; currencyCode: string; currency: { minorUnit: number } }> }> } };
export type ProductDetailInitialProduct = {
  id: string; slug: string; name: string; description: string | null;
  city: string | null; district: string | null; contactPhone: string | null; videoUrl: string | null;
  location: { latitude: number; longitude: number } | null;
  propertyDetails: { propertyType: string; listingType: string; bedrooms: number | null; bathrooms: number | null; floorArea: string } | null;
  brand: { name: string } | null; store: { id: string; name: string; slug: string };
  media: Array<{ url: string; altText: string | null; isPrimary: boolean }>;
  attributes: ProductAttribute[];
  variants: Array<{ id: string; name: string | null; sku: string | null; optionValues: unknown; attributes: VariantAttribute[]; prices: Price[] }>;
};

function formatAttributeValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null) return "";
  return JSON.stringify(value) ?? "";
}

export default function ProductDetail({ initialProduct, initialMarketId, initialCurrencyCode, initialSponsored }: { initialProduct: ProductDetailInitialProduct; initialMarketId: string; initialCurrencyCode: string; initialSponsored: ProductDetailInitialSponsored[] }) {
  const { locale } = useLocale();
  const t = useCallback((english: string, arabic: string) => translate(locale, english, arabic), [locale]);
  const product = initialProduct;
  const [sponsored, setSponsored] = useState<ProductDetailInitialSponsored[]>(initialSponsored);
  const [selectedVariant, setSelectedVariant] = useState(initialProduct.variants[0]?.id ?? "");
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(Math.max(0, initialProduct.media.findIndex((item) => item.isPrimary)));
  const [selectedMarketId] = useState(initialMarketId || initialProduct.variants[0]?.prices[0]?.marketId || "");
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartMessage, setCartMessage] = useState("");
  const [cartError, setCartError] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [favoriteError, setFavoriteError] = useState("");
  const [messageBusy, setMessageBusy] = useState(false);
  const [messageError, setMessageError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/favorites/${encodeURIComponent(product.id)}`, { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) return { guest: true as const, isFavorite: readGuestWishlist().includes(product.id) };
        if (!response.ok) return { guest: false as const, isFavorite: false };
        const favorite = await response.json() as { isFavorite: boolean };
        return { guest: false as const, isFavorite: favorite.isFavorite };
      })
      .then((favorite) => { if (active) { setGuestMode(favorite.guest); setIsFavorite(favorite.isFavorite); } })
      .catch(() => { if (active) { setGuestMode(false); setIsFavorite(false); } });
    return () => { active = false; };
  }, [product.id]);

  useEffect(() => {
    if (!product || !selectedMarketId) return;
    let active = true;
    const currentProductId = product.id;
    const currentProductName = product.name;
    fetch(`/api/advertising/sponsored?marketId=${encodeURIComponent(selectedMarketId)}&q=${encodeURIComponent(currentProductName)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Sponsored products unavailable.");
        return response.json() as Promise<{ items: ProductDetailInitialSponsored[] }>;
      })
      .then((result) => { if (active) setSponsored(result.items.filter((item) => item.product.id !== currentProductId)); })
      .catch(() => { if (active) setSponsored([]); });
    return () => { active = false; };
  }, [product?.id, product?.name, selectedMarketId]);


  const variant = product.variants.find((item) => item.id === selectedVariant) ?? product.variants[0];
  const price = variant?.prices.find((item) =>
    item.marketId === selectedMarketId && item.currencyCode === initialCurrencyCode
  ) ?? variant?.prices.find((item) => item.marketId === selectedMarketId);
  const amount = price ? formatMinorUnits(price.amountMinor, price.currencyCode, price.currency.minorUnit ?? 2, locale) : null;
  const selectedMedia = product.media[selectedMediaIndex] ?? product.media.find((item) => item.isPrimary) ?? product.media[0];

  async function contactStore() {
    if (!product) return;
    setMessageBusy(true); setMessageError("");
    try {
      const response = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId: product.store.id, subject: "Question about " + product.name, body: "Hello, I have a question about this product: " + product.name }) });
      const result = await response.json() as { conversation?: { id: string }; error?: string };
      if (!response.ok || !result.conversation) throw new Error(result.error || t("Sign in to contact this store.", "سجّل الدخول للتواصل مع هذا المتجر."));
      window.location.assign("/account/messages/" + result.conversation.id);
    } catch (cause) { setMessageError(cause instanceof Error ? cause.message : t("Unable to contact this store.", "تعذّر التواصل مع هذا المتجر.")); }
    finally { setMessageBusy(false); }
  }

  async function toggleFavorite() {
    if (!product) return;
    setFavoriteBusy(true); setFavoriteError("");
    try {
      if (guestMode) {
        writeGuestFavorite(product.id, !isFavorite);
        setIsFavorite(!isFavorite);
        return;
      }
      const response = await fetch(`/api/favorites/${encodeURIComponent(product.id)}`, {
        method: isFavorite ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" }, body: "{}"
      });
      const result = await response.json() as { isFavorite?: boolean; error?: string };
      if (response.status === 401) {
        setGuestMode(true);
        writeGuestFavorite(product.id, !isFavorite);
        setIsFavorite(!isFavorite);
        return;
      }
      if (!response.ok) throw new Error(result.error || t("Unable to save favorite.", "تعذّر حفظ المنتج في المفضلة."));
      setIsFavorite(Boolean(result.isFavorite));
    } catch (cause) {
      setFavoriteError(cause instanceof Error ? cause.message : t("Unable to update your wishlist.", "تعذّر تحديث قائمة الرغبات."));
    } finally { setFavoriteBusy(false); }
  }

  async function addSelectedVariantToCart() {
    if (!variant || !price || !selectedMarketId) return;
    setAddingToCart(true);
    setCartError("");
    setCartMessage("");
    try {
      const response = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: selectedMarketId, currencyCode: price.currencyCode, variantId: variant.id, quantity: 1 })
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || t("Unable to add this item.", "تعذّرت إضافة هذا المنتج."));
      setCartMessage(t("Added to your cart.", "أُضيف إلى سلة التسوق."));
    } catch (cause) {
      setCartError(cause instanceof Error ? cause.message : t("Unable to add this item.", "تعذّرت إضافة هذا المنتج."));
    } finally {
      setAddingToCart(false);
    }
  }

  return <main className="min-h-screen bg-[var(--background)]">
    <header className="border-b border-[var(--border)] px-5 py-5"><div className="mx-auto flex max-w-6xl justify-between"><Link href="/" className="text-xl font-semibold text-[var(--color-petrol-900)]">mtjr<span className="text-[var(--color-orange-600)]">.</span></Link><Link href="/" className="text-sm text-[var(--color-petrol-800)]">← {t("Back to marketplace", "العودة إلى السوق")}</Link></div></header>
    <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 md:grid-cols-2 md:py-16">
      <div className="space-y-3">
        {selectedMedia ? <img src={selectedMedia.url} alt={selectedMedia.altText ?? product.name} className="aspect-square w-full rounded-3xl bg-[var(--color-ivory-100)] object-cover" /> : <div className="flex aspect-square items-center justify-center rounded-3xl bg-[var(--color-ivory-100)] text-sm text-[var(--muted)]">{t("No product image available", "لا تتوفر صورة للمنتج")}</div>}
        {product.media.length > 1 && <div aria-label={t("Product images", "صور المنتج")} className="grid grid-cols-5 gap-3">{product.media.map((media, index) => <button key={media.url} type="button" onClick={() => setSelectedMediaIndex(index)} aria-label={t(`View product image ${index + 1}`, `عرض صورة المنتج ${index + 1}`)} aria-pressed={selectedMediaIndex === index} className={`overflow-hidden rounded-xl border-2 ${selectedMediaIndex === index ? "border-[var(--color-violet-600)]" : "border-transparent"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-violet-600)]`}><img src={media.url} alt="" className="aspect-square w-full object-cover" /></button>)}</div>}
      </div>
      <section className="flex flex-col pt-2">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">{product.brand?.name ?? t("Marketplace selection", "اختيار السوق")}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-forest-950)] sm:text-4xl">{product.name}</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">{t("Sold by", "يُباع بواسطة")} <Link href={`/stores/${encodeURIComponent(product.store.slug)}`} className="font-semibold text-[var(--color-forest-800)] underline">{product.store.name}</Link></p>

        <p className="mt-7 text-3xl font-bold tracking-tight text-[var(--color-petrol-900)]">{price && amount !== null ? amount : t("Price unavailable", "السعر غير متاح")}</p>
        {product.description && <p className="mt-7 whitespace-pre-line text-sm leading-7 text-[var(--color-ink-700)]">{product.description}</p>}
        {(product.propertyDetails || product.location || product.contactPhone || product.videoUrl || product.city || product.district) && <section className="mt-7 grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
          {product.propertyDetails && <>
            <h2 className="text-sm font-semibold">{t("Property details", "تفاصيل العقار")}</h2>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div><dt className="text-xs text-[var(--muted)]">{t("Property type", "نوع العقار")}</dt><dd className="mt-1 text-sm font-semibold">{product.propertyDetails.propertyType === "APARTMENT" ? t("Apartment", "شقة") : product.propertyDetails.propertyType === "HOUSE" ? t("House / villa", "منزل / فيلا") : product.propertyDetails.propertyType === "LAND" ? t("Land", "أرض") : t("Commercial", "تجاري")}</dd></div>
              <div><dt className="text-xs text-[var(--muted)]">{t("Listing", "نوع العرض")}</dt><dd className="mt-1 text-sm font-semibold">{product.propertyDetails.listingType === "SALE" ? t("For sale", "للبيع") : t("For rent", "للإيجار")}</dd></div>
              <div><dt className="text-xs text-[var(--muted)]">{t("Area", "المساحة")}</dt><dd className="mt-1 text-sm font-semibold">{product.propertyDetails.floorArea} m²</dd></div>
              {product.propertyDetails.bedrooms != null && <div><dt className="text-xs text-[var(--muted)]">{t("Bedrooms", "غرف النوم")}</dt><dd className="mt-1 text-sm font-semibold">{product.propertyDetails.bedrooms}</dd></div>}
              {product.propertyDetails.bathrooms != null && <div><dt className="text-xs text-[var(--muted)]">{t("Bathrooms", "الحمامات")}</dt><dd className="mt-1 text-sm font-semibold">{product.propertyDetails.bathrooms}</dd></div>}
            </dl>
          </>}
          {(product.city || product.district) && <p className="text-sm text-[var(--color-ink-700)]">{[product.city, product.district].filter(Boolean).join(" · ")}</p>}
          {product.location && <div className="mt-2"><ProductLocationMap value={product.location} locale={locale} /></div>}
          {product.contactPhone && <a className="w-fit text-sm font-semibold underline" href={`tel:${product.contactPhone}`}>{t("Call seller", "اتصل بالبائع")}: {product.contactPhone}</a>}
          {product.videoUrl && <a className="w-fit text-sm font-semibold underline" href={product.videoUrl} target="_blank" rel="noreferrer">{t("Watch product video", "مشاهدة فيديو المنتج")}</a>}
        </section>}
        {product.attributes.some((attribute) => attribute.values.length > 0) && <dl className="mt-7 grid gap-3 border-t border-[var(--border)] pt-5 sm:grid-cols-2">{product.attributes.flatMap((attribute) => attribute.values.map((value, index) => <div key={`${attribute.key}-${index}`}><dt className="text-xs font-medium text-[var(--muted)]">{attribute.name}</dt><dd className="mt-1 text-sm text-[var(--color-ink-700)]">{formatAttributeValue(value)}</dd></div>))}</dl>}
        {product.variants.length > 1 && <label className="mt-8 text-sm font-medium">{t("Choose an option", "اختر خيارًا")}<select value={selectedVariant} onChange={(event) => setSelectedVariant(event.target.value)} className="mt-2 block w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3">{product.variants.map((item) => <option key={item.id} value={item.id}>{item.name || item.sku || t("Variant", "الخيار")}</option>)}</select></label>}
        {variant?.attributes.length ? <dl className="mt-5 grid gap-3 sm:grid-cols-2">{variant.attributes.map((attribute) => <div key={attribute.key}><dt className="text-xs font-medium text-[var(--muted)]">{attribute.name}</dt><dd className="mt-1 text-sm text-[var(--color-ink-700)]">{formatAttributeValue(attribute.value)}</dd></div>)}</dl> : null}
        <button type="button" onClick={() => void toggleFavorite()} disabled={favoriteBusy} aria-pressed={isFavorite} className="mt-6 inline-flex w-fit items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--color-forest-900)] disabled:opacity-50">{favoriteBusy ? t("Saving…", "جارٍ الحفظ…") : isFavorite ? `♥ ${t("Saved to wishlist", "أُضيف إلى قائمة الرغبات")}` : `♡ ${t("Save to wishlist", "أضف إلى قائمة الرغبات")}`}</button>

        {favoriteError && <p role="alert" className="mt-2 text-sm text-[var(--color-danger)]">{favoriteError} <AuthReturnLink href="/login" className="font-semibold underline">{t("Sign in", "تسجيل الدخول")}</AuthReturnLink></p>}
        {messageError && <p role="alert" className="mt-2 text-sm text-[var(--color-danger)]">{messageError}</p>}
        <button type="button" onClick={contactStore} disabled={messageBusy} className="mt-3 rounded-xl border border-[var(--border)] px-6 py-3 text-sm font-semibold text-[var(--color-forest-900)] disabled:opacity-50">{messageBusy ? t("Opening…", "جارٍ الفتح…") : t("Message this store", "راسل هذا المتجر")}</button>
        <button type="button" onClick={addSelectedVariantToCart} disabled={!variant || !price || !selectedMarketId || addingToCart} className="mt-8 rounded-md bg-[#FF8C1C] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#F47B0B] disabled:cursor-not-allowed disabled:opacity-50">{addingToCart ? t("Adding…", "جارٍ الإضافة…") : t("Add to cart", "أضف إلى السلة")}</button>
        {cartMessage && <p role="status" className="mt-3 text-sm text-[var(--color-success)]">{cartMessage} <Link href="/cart" className="font-semibold underline">{t("View cart", "عرض السلة")}</Link></p>}
        {cartError && <p role="alert" className="mt-3 text-sm text-[var(--color-danger)]">{cartError}</p>}
        <p className="mt-5 text-xs leading-6 text-[var(--muted)]">{t("Price and stock are checked again by the marketplace before an item is added.", "يتحقق السوق مجددًا من السعر والمخزون قبل إضافة المنتج.")}</p>
      </section>
    </div>
    <ProductReviews productId={product.id} />
    <StoreReviews storeId={product.store.id} storeName={product.store.name} />
    <ProductQuestions productId={product.id} />
    {sponsored.length > 0 && <section className="mx-auto max-w-6xl px-5 pb-12">
      <h2 className="mb-4 text-xl font-semibold">{t("Sponsored products you may like", "منتجات ممولة قد تعجبك")}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {sponsored.map((item) => <SponsoredProductCard key={item.campaignId} product={item.product} token={item.token} locale={locale} />)}
      </div>
    </section>}
  </main>;
}
