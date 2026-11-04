import type { Metadata } from "next";
import CategoryDirectoryPage from "@/features/storefront/category-directory-page";

export const metadata: Metadata = {
  title: "Categories",
  description: "Browse active marketplace categories."
};

export default function CategoriesPage() {
  return <CategoryDirectoryPage />;
}
