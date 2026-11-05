import Link from "next/link";

type Product = {
  id: string; slug: string; name: string; description: string | null;
  brand: { name: string } | null; store: { id: string; name: string; slug: string };
  media: Array<{ url: string; altText: string | null; isPrimary: boolean }>;
  variants: Array<{ prices: Array<{ amountMinor: string | bigint; currencyCode: string; currency: { minorUnit: number } }> }>;
};

function productPrice(product: Product) {
  const price = product.variants.flatMap((variant) => variant.prices)[0];
  if (!price) return "Price unavailable";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: price.currencyCode })
    .format(Number(price.amountMinor) / (10 ** price.currency.minorUnit));
}

export default function CatalogProductGrid({ products }: { products: Product[] }) {
  if (!products.length) return <div className="clay-surface-inset mt-8 rounded-[var(--radius-panel)] border-white/70 bg-[var(--color-mint-50)] px-6 py-14 text-center">

    <h2 className="text-lg font-semibold text-[var(--color-forest-950)]">No published products yet</h2>
    <p className="mt-2 text-sm text-[var(--muted)]">New products appear here when approved and published.</p>
    <Link href="/products" className="mt-5 inline-flex text-sm font-semibold text-[var(--color-forest-800)] underline">Browse all products</Link>
  </div>;
  return <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
    {products.map((product) => {
      const image = product.media.find((item) => item.isPrimary) ?? product.media[0];
      return <article key={product.id} className="clay-surface clay-interactive group overflow-hidden rounded-[var(--radius-card)] border-white/80 bg-[var(--surface)] transition duration-200">
        <Link href={`/products/${encodeURIComponent(product.slug)}`} className="block">
          {image ? <img src={image.url} alt={image.altText ?? product.name} className="aspect-square w-full bg-[var(--color-lavender-50)] object-cover transition duration-300 group-hover:scale-[1.02]" /> : <div className="flex aspect-square items-center justify-center bg-[var(--surface-soft)] text-xs text-[var(--muted)]">No image</div>}
          <div className="p-4 sm:p-5">
            {product.brand && <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-blush-800)]">{product.brand.name}</p>}
            <h2 className="mt-2 line-clamp-2 min-h-10 text-sm font-semibold text-[var(--color-forest-950)]">{product.name}</h2>
            <p className="mt-3 text-xl font-extrabold tracking-tight text-[var(--color-lavender-950)]">{productPrice(product)}</p>

            <p className="mt-2 text-xs text-[var(--muted)]">Sold by {product.store.name}</p>
          </div>
        </Link>
      </article>;
    })}
  </div>;
}
