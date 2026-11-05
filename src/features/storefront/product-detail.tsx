"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthReturnLink from "@/components/auth-return-link";
import ProductReviews from "@/features/storefront/product-reviews";
import StoreReviews from "@/features/storefront/store-reviews";
import ProductQuestions from "@/features/storefront/product-questions";

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

type Price = { marketId: string; currencyCode: string; amountMinor: string; compareAtMinor: string | null; currency: { minorUnit: number } };
type Market = { id: string; code: string; name: string; defaultCurrency: { code: string } };
type ProductAttribute = { key: string; name: string; valueType: string; values: unknown[] };
type VariantAttribute = { key: string; name: string; valueType: string; value: unknown };
type Product = {
  id: string; slug: string; name: string; description: string | null;
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

export default function ProductDetail({ slug }: { slug: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState("");
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarketId, setSelectedMarketId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
    fetch("/api/markets").then(async (response) => {
      if (!response.ok) throw new Error("Markets unavailable.");
      return response.json() as Promise<{ items: Market[] }>;
    }).then((result) => {
      if (!active) return;
      setMarkets(result.items);
    }).catch(() => { /* Product details remain available if market reference data is temporarily unavailable. */ });
    fetch(`/api/products/${encodeURIComponent(slug)}?locale=en`)
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 404 ? "This product is not available." : "Product details could not be loaded.");
        return response.json() as Promise<Product>;
      })
      .then((result) => {
        if (!active) return;
        setProduct(result);
        fetch(`/api/favorites/${encodeURIComponent(result.id)}`, { cache: "no-store" })
          .then(async (response) => {
            if (response.status === 401) return { guest: true as const, isFavorite: readGuestWishlist().includes(result.id) };
            if (!response.ok) return { guest: false as const, isFavorite: false };
            const favorite = await response.json() as { isFavorite: boolean };
            return { guest: false as const, isFavorite: favorite.isFavorite };
          })
          .then((favorite) => { if (active) { setGuestMode(favorite.guest); setIsFavorite(favorite.isFavorite); } })
          .catch(() => { if (active) { setGuestMode(false); setIsFavorite(false); } });
        setSelectedVariant(result.variants[0]?.id ?? "");
        setSelectedMarketId(result.variants[0]?.prices[0]?.marketId ?? "");
        setSelectedMediaIndex(Math.max(0, result.media.findIndex((item) => item.isPrimary)));
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Product details are unavailable."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  if (loading) return <main className="mx-auto min-h-screen max-w-6xl px-5 py-16"><div className="h-96 animate-pulse rounded-3xl bg-[var(--color-ivory-100)]" /></main>;
  if (error || !product) return <main className="mx-auto min-h-screen max-w-3xl px-5 py-24 text-center"><p role="alert" className="text-lg">{error || "Product not found."}</p><Link href="/" className="mt-6 inline-block text-sm text-[var(--color-petrol-800)] underline">Back to marketplace</Link></main>;

  const variant = product.variants.find((item) => item.id === selectedVariant) ?? product.variants[0];
  const selectedMarketInfo = markets.find((item) => item.id === selectedMarketId);
  const price = variant?.prices.find((item) =>
    item.marketId === selectedMarketId &&
    (!selectedMarketInfo || item.currencyCode === selectedMarketInfo.defaultCurrency.code)
  );
  const amount = price ? Number(price.amountMinor) / (10 ** (price.currency.minorUnit ?? 2)) : null;
  const selectedMedia = product.media[selectedMediaIndex] ?? product.media.find((item) => item.isPrimary) ?? product.media[0];
  const selectedMarket = selectedMarketInfo;

  async function contactStore() {
    if (!product) return;
    setMessageBusy(true); setMessageError("");
    try {
      const response = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId: product.store.id, subject: "Question about " + product.name, body: "Hello, I have a question about this product: " + product.name }) });
      const result = await response.json() as { conversation?: { id: string }; error?: string };
      if (!response.ok || !result.conversation) throw new Error(result.error || "Sign in to contact this store.");
      window.location.assign("/account/messages/" + result.conversation.id);
    } catch (cause) { setMessageError(cause instanceof Error ? cause.message : "Unable to contact this store."); }
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
      if (!response.ok) throw new Error(result.error || "Unable to save favorite.");
      setIsFavorite(Boolean(result.isFavorite));
    } catch (cause) {
      setFavoriteError(cause instanceof Error ? cause.message : "Unable to update your wishlist.");
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
      if (!response.ok) throw new Error(result.error || "Unable to add this item.");
      setCartMessage("Added to your cart.");
    } catch (cause) {
      setCartError(cause instanceof Error ? cause.message : "Unable to add this item.");
    } finally {
      setAddingToCart(false);
    }
  }

  return <main className="min-h-screen bg-[var(--background)]">
    <header className="border-b border-[var(--border)] px-5 py-5"><div className="mx-auto flex max-w-6xl justify-between"><Link href="/" className="text-xl font-semibold text-[var(--color-petrol-900)]">mtjr<span className="text-[var(--color-orange-600)]">.</span></Link><Link href="/" className="text-sm text-[var(--color-petrol-800)]">← Back to marketplace</Link></div></header>
    <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 md:grid-cols-2 md:py-16">
      <div className="space-y-3">
        {selectedMedia ? <img src={selectedMedia.url} alt={selectedMedia.altText ?? product.name} className="aspect-square w-full rounded-3xl bg-[var(--color-ivory-100)] object-cover" /> : <div className="flex aspect-square items-center justify-center rounded-3xl bg-[var(--color-ivory-100)] text-sm text-[var(--muted)]">No product image available</div>}
        {product.media.length > 1 && <div aria-label="Product images" className="grid grid-cols-5 gap-3">{product.media.map((media, index) => <button key={media.url} type="button" onClick={() => setSelectedMediaIndex(index)} aria-label={`View product image ${index + 1}`} aria-pressed={selectedMediaIndex === index} className={`overflow-hidden rounded-xl border-2 ${selectedMediaIndex === index ? "border-[var(--color-violet-600)]" : "border-transparent"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-violet-600)]`}><img src={media.url} alt="" className="aspect-square w-full object-cover" /></button>)}</div>}
      </div>
      <section className="flex flex-col pt-2">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">{product.brand?.name ?? "Marketplace selection"}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-forest-950)] sm:text-4xl">{product.name}</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">Sold by <Link href={`/stores/${encodeURIComponent(product.store.slug)}`} className="font-semibold text-[var(--color-forest-800)] underline">{product.store.name}</Link></p>

        {markets.length > 0 && <label className="mt-5 block text-sm font-medium">Delivery market<select aria-label="Choose delivery market" value={selectedMarketId} onChange={(event) => setSelectedMarketId(event.target.value)} className="mt-2 block w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3"><option value="">Select a market</option>{markets.map((market) => <option key={market.id} value={market.id}>{market.name} · {market.defaultCurrency.code}</option>)}</select></label>}
        <p className="mt-7 text-3xl font-bold tracking-tight text-[var(--color-petrol-900)]">{price && amount !== null ? new Intl.NumberFormat(undefined, { style: "currency", currency: price.currencyCode }).format(amount) : "Price unavailable"}</p>
        {product.description && <p className="mt-7 whitespace-pre-line text-sm leading-7 text-[var(--color-ink-700)]">{product.description}</p>}
        {product.attributes.some((attribute) => attribute.values.length > 0) && <dl className="mt-7 grid gap-3 border-t border-[var(--border)] pt-5 sm:grid-cols-2">{product.attributes.flatMap((attribute) => attribute.values.map((value, index) => <div key={`${attribute.key}-${index}`}><dt className="text-xs font-medium text-[var(--muted)]">{attribute.name}</dt><dd className="mt-1 text-sm text-[var(--color-ink-700)]">{formatAttributeValue(value)}</dd></div>))}</dl>}
        {product.variants.length > 1 && <label className="mt-8 text-sm font-medium">Choose an option<select value={selectedVariant} onChange={(event) => setSelectedVariant(event.target.value)} className="mt-2 block w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3">{product.variants.map((item) => <option key={item.id} value={item.id}>{item.name || item.sku || "Variant"}</option>)}</select></label>}
        {variant?.attributes.length ? <dl className="mt-5 grid gap-3 sm:grid-cols-2">{variant.attributes.map((attribute) => <div key={attribute.key}><dt className="text-xs font-medium text-[var(--muted)]">{attribute.name}</dt><dd className="mt-1 text-sm text-[var(--color-ink-700)]">{formatAttributeValue(attribute.value)}</dd></div>)}</dl> : null}
        <button type="button" onClick={() => void toggleFavorite()} disabled={favoriteBusy} aria-pressed={isFavorite} className="mt-6 inline-flex w-fit items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--color-forest-900)] disabled:opacity-50">{favoriteBusy ? "Saving…" : isFavorite ? "♥ Saved to wishlist" : "♡ Save to wishlist"}</button>

        {favoriteError && <p role="alert" className="mt-2 text-sm text-[var(--color-danger)]">{favoriteError} <AuthReturnLink href="/login" className="font-semibold underline">Sign in</AuthReturnLink></p>}
        {messageError && <p role="alert" className="mt-2 text-sm text-[var(--color-danger)]">{messageError}</p>}
        <button type="button" onClick={contactStore} disabled={messageBusy} className="mt-3 rounded-xl border border-[var(--border)] px-6 py-3 text-sm font-semibold text-[var(--color-forest-900)] disabled:opacity-50">{messageBusy ? "Opening…" : "Message this store"}</button>
        <button type="button" onClick={addSelectedVariantToCart} disabled={!variant || !price || !selectedMarket || addingToCart} className="mt-8 rounded-xl bg-[var(--color-forest-900)] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[var(--color-forest-950)] disabled:cursor-not-allowed disabled:opacity-50">{addingToCart ? "Adding…" : "Add to cart"}</button>
        {cartMessage && <p role="status" className="mt-3 text-sm text-[var(--color-success)]">{cartMessage} <Link href="/cart" className="font-semibold underline">View cart</Link></p>}
        {cartError && <p role="alert" className="mt-3 text-sm text-[var(--color-danger)]">{cartError}</p>}
        <p className="mt-5 text-xs leading-6 text-[var(--muted)]">Price and stock are checked again by the marketplace before an item is added.</p>
      </section>
    </div>
    <ProductReviews productId={product.id} />
    <StoreReviews storeId={product.store.id} storeName={product.store.name} />
    <ProductQuestions productId={product.id} />
  </main>;
}
