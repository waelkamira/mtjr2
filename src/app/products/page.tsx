import type { Metadata } from "next";
import StorefrontHomePage from "@/features/storefront/home-page";

export const metadata: Metadata = {
  title: "Shop",
  description: "Discover products from independent stores on Mtjr."
};

export default function ProductsPage() {
  return <StorefrontHomePage />;
}
