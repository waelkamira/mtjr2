import type { Metadata } from "next";
import CategoryDirectoryPage from "@/features/storefront/category-directory-page";
import { getPreferredLocale } from "@/server/locale";
import { translate } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getPreferredLocale();
  return {
    title: translate(locale, "Categories", "الفئات"),
    description: translate(locale, "Browse active marketplace categories.", "تصفّح فئات السوق النشطة.")
  };
}

export default function CategoriesPage() {
  return <CategoryDirectoryPage />;
}
