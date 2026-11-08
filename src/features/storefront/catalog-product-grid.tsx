import Link from "next/link";
import SponsoredProductCard from "@/features/storefront/sponsored-product-card";
import { type Locale, translate } from "@/lib/locale";
import { formatMinorUnits } from "@/lib/money";

type Product = {
  id: string; slug: string; name: string; description: string | null;
  brand: { name: string } | null; store: { id: string; name: string; slug: string };
  media: Array<{ url: string; altText: string | null; isPrimary: boolean }>;
  variants: Array<{ prices: Array<{ amountMinor: string | bigint; currencyCode: string; currency: { minorUnit: number } }> }>;
};
type Sponsored = { campaignId: string; token: string; product: Product };

function productPrice(product: Product, locale: Locale) {
  const price = product.variants.flatMap((variant) => variant.prices)[0];
  if (!price) return translate(locale, "Price unavailable", "السعر غير متاح");
  return formatMinorUnits(price.amountMinor, price.currencyCode, price.currency.minorUnit, locale);
}

export default function CatalogProductGrid({ products, locale, sponsored = [] }: { products: Product[]; locale: Locale; sponsored?: Sponsored[] }) {
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const sponsoredIds = new Set(sponsored.map((item) => item.product.id));
  const organic = products.filter((product) => !sponsoredIds.has(product.id));
  if (!products.length && !sponsored.length) return <div className="clay-surface-inset mt-8 rounded-[var(--radius-panel)] border-white/70 bg-[var(--color-mint-50)] px-6 py-14 text-center">
    <h2 className="text-lg font-semibold text-[var(--color-forest-950)]">{t("No published products yet", "لا توجد منتجات منشورة بعد")}</h2>
    <p className="mt-2 text-sm text-[var(--muted)]">{t("New products appear here when approved and published.", "ستظهر المنتجات الجديدة هنا بعد الموافقة عليها ونشرها.")}</p>
    <Link href="/products" className="mt-5 inline-flex text-sm font-semibold text-[var(--color-forest-800)] underline">{t("Browse all products", "تصفّح كل المنتجات")}</Link>
  </div>;
  return <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
    {sponsored.map((item) => <SponsoredProductCard key={item.campaignId} product={item.product} token={item.token} locale={locale} />)}
    {organic.map((product) => {
      const image = product.media.find((item) => item.isPrimary) ?? product.media[0];
      return <article key={product.id} className="clay-surface clay-interactive group overflow-hidden rounded-[var(--radius-card)] border-white/80 bg-[var(--surface)] transition duration-200">
        <Link href={`/products/${encodeURIComponent(product.slug)}`} className="block">
          {image ? <img src={image.url} alt={image.altText ?? product.name} className="aspect-square w-full bg-[var(--color-lavender-50)] object-cover transition duration-300 group-hover:scale-[1.02]" /> : <div className="flex aspect-square items-center justify-center bg-[var(--surface-soft)] text-xs text-[var(--muted)]">{t("No image", "لا توجد صورة")}</div>}
          <div className="p-4 sm:p-5">
            {product.brand && <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-blush-800)]">{product.brand.name}</p>}
            <h2 className="mt-2 line-clamp-2 min-h-10 text-sm font-semibold text-[var(--color-forest-950)]">{product.name}</h2>
            <p className="mt-3 text-xl font-extrabold tracking-tight text-[var(--color-lavender-950)]">{productPrice(product, locale)}</p>
            <p className="mt-2 text-xs text-[var(--muted)]">{t("Sold by", "يُباع بواسطة")} {product.store.name}</p>
          </div>
        </Link>
      </article>;
    })}
  </div>;
}
