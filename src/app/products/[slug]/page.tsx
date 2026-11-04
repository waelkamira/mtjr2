import type { Metadata } from "next";
import ProductDetail from "@/features/storefront/product-detail";
import { getDiscoverableProduct } from "@/server/catalog/discovery";

type ProductPageProps = { params: Promise<{ slug: string }> };

function toDecimalPrice(amountMinor: bigint | string, minorUnit: number): string {
  const amount = typeof amountMinor === "bigint" ? amountMinor : BigInt(amountMinor);
  const divisor = BigInt(10) ** BigInt(minorUnit);
  const whole = amount / divisor;
  if (minorUnit === 0) return whole.toString();
  const fraction = (amount % divisor).toString().padStart(minorUnit, "0");
  return `${whole}.${fraction}`;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getDiscoverableProduct(slug, "en");
  if (!product) {
    return {
      title: "Product not found",
      robots: { index: false, follow: false }
    };
  }

  const description = product.description?.trim().slice(0, 300) ||
    `Discover ${product.name} from ${product.store.name} on Mtjr, the global marketplace.`;
  const image = product.media.find((item) => item.isPrimary) ?? product.media[0];

  return {
    title: product.name,
    description,
    alternates: { canonical: `/products/${encodeURIComponent(product.slug)}` },
    openGraph: {
      title: product.name,
      description,
      type: "website",
      images: image ? [{ url: image.url, alt: image.altText ?? product.name }] : []
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: product.name,
      description,
      images: image ? [{ url: image.url, alt: image.altText ?? product.name }] : []
    }
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getDiscoverableProduct(slug, "en");
  const structuredData = product ? {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    image: product.media.map((item) => item.url),
    sku: product.variants.length === 1 ? product.variants[0].sku : undefined,
    brand: product.brand ? { "@type": "Brand", name: product.brand.name } : undefined,
    offers: product.variants.flatMap((variant) => variant.prices.map((price) => ({
      "@type": "Offer",
      price: toDecimalPrice(price.amountMinor, price.currency.minorUnit),
      priceCurrency: price.currencyCode
    })))
  } : null;

  return (
    <>
      {structuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        />
      ) : null}
      <ProductDetail slug={slug} />
    </>
  );
}
