import type { Metadata } from "next";
import BrandDirectoryPage from "@/features/storefront/brand-directory-page";

export const metadata: Metadata = {
  title: "Brands",
  description: "Discover active brands on the marketplace."
};

export default function BrandsPage() {
  return <BrandDirectoryPage />;
}
