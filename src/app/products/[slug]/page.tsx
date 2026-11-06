import type { Metadata } from "next";
import ProductDetail from "@/features/storefront/product-detail";
import { getDiscoverableProduct } from "@/server/catalog/discovery";
import { getPreferredLocale } from "@/server/locale";
import { translate } from "@/lib/locale";

type ProductPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getPreferredLocale();
  const product = await getDiscoverableProduct(slug, locale);
  if (!product) {
    return {
      title: translate(locale, "Product not found", "المنتج غير موجود"),
      robots: { index: false, follow: false }
    };
  }

  const description = product.seoDescription?.trim().slice(0, 300) ||
    product.description?.trim().slice(0, 300) ||
    `Discover ${product.name} from ${product.store.name} on Mtjr, the global marketplace.`;
  const image = product.media.find((item) => item.isPrimary) ?? product.media[0];

  return {
    title: product.seoTitle,
    description,
    alternates: { canonical: `/products/${encodeURIComponent(product.slug)}` },
    openGraph: {
      title: product.seoTitle,
      description,
      type: "website",
      images: image ? [{ url: image.url, alt: image.altText ?? product.name }] : []
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: product.seoTitle,
      description,
      images: image ? [{ url: image.url, alt: image.altText ?? product.name }] : []
    }
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  return <ProductDetail slug={slug} />;
}
