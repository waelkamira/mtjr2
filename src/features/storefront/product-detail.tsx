"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Price = { marketId: string; currencyCode: string; amountMinor: string; compareAtMinor: string | null };
type Product = {
  id: string; slug: string; name: string; description: string | null;
  brand: { name: string } | null; store: { name: string; slug: string };
  media: Array<{ url: string; altText: string | null; isPrimary: boolean }>;
  variants: Array<{ id: string; name: string | null; sku: string | null; optionValues: unknown; prices: Price[] }>;
};

export default function ProductDetail({ slug }: { slug: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/products/${encodeURIComponent(slug)}?locale=en`)
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 404 ? "This product is not available." : "Product details could not be loaded.");
        return response.json() as Promise<Product>;
      })
      .then((result) => {
        if (!active) return;
        setProduct(result);
        setSelectedVariant(result.variants[0]?.id ?? "");
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Product details are unavailable."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  if (loading) return <main className="mx-auto min-h-screen max-w-6xl px-5 py-16"><div className="h-96 animate-pulse rounded-3xl bg-[var(--color-ivory-100)]" /></main>;
  if (error || !product) return <main className="mx-auto min-h-screen max-w-3xl px-5 py-24 text-center"><p role="alert" className="text-lg">{error || "Product not found."}</p><Link href="/" className="mt-6 inline-block text-sm text-[var(--color-forest-800)] underline">Back to marketplace</Link></main>;

  const variant = product.variants.find((item) => item.id === selectedVariant) ?? product.variants[0];
  const price = variant?.prices[0];
  const amount = price ? Number(price.amountMinor) / 100 : null;

  return <main className="min-h-screen bg-[var(--background)]">
    <header className="border-b border-[var(--border)] px-5 py-5"><div className="mx-auto flex max-w-6xl justify-between"><Link href="/" className="text-xl font-semibold text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link><Link href="/" className="text-sm text-[var(--color-forest-800)]">← Back to marketplace</Link></div></header>
    <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 md:grid-cols-2 md:py-16">
      <div className="space-y-3">{product.media.length ? product.media.map((media) => <img key={media.url} src={media.url} alt={media.altText ?? product.name} className="aspect-square w-full rounded-3xl bg-[var(--color-ivory-100)] object-cover" />) : <div className="flex aspect-square items-center justify-center rounded-3xl bg-[var(--color-ivory-100)] text-sm text-[var(--muted)]">No product image available</div>}</div>
      <section className="flex flex-col pt-2">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">{product.brand?.name ?? "Marketplace selection"}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-forest-950)] sm:text-4xl">{product.name}</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">Sold by {product.store.name}</p>
        <p className="mt-7 text-3xl font-semibold">{price && amount !== null ? new Intl.NumberFormat(undefined, { style: "currency", currency: price.currencyCode }).format(amount) : "Price unavailable"}</p>
        {product.description && <p className="mt-7 whitespace-pre-line text-sm leading-7 text-[var(--color-ink-700)]">{product.description}</p>}
        {product.variants.length > 1 && <label className="mt-8 text-sm font-medium">Choose an option<select value={selectedVariant} onChange={(event) => setSelectedVariant(event.target.value)} className="mt-2 block w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3">{product.variants.map((item) => <option key={item.id} value={item.id}>{item.name || item.sku || "Variant"}</option>)}</select></label>}
        <p className="mt-8 rounded-xl bg-[var(--color-sage-100)] p-4 text-sm leading-6 text-[var(--color-forest-950)]">This listing is connected to the live marketplace catalog. Cart and checkout actions will be enabled in the Buying Core phase.</p>
      </section>
    </div>
  </main>;
}
