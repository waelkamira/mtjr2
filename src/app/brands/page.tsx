import type { Metadata } from "next";
import BrandDirectoryPage from "@/features/storefront/brand-directory-page";
import { getPreferredLocale } from "@/server/locale";
import { translate } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getPreferredLocale();
  return {
    title: translate(locale, "Brands", "العلامات التجارية"),
    description: translate(locale, "Discover active brands on the marketplace.", "اكتشف العلامات التجارية النشطة في السوق.")
  };
}

export default function BrandsPage() {
  return <BrandDirectoryPage />;
}
