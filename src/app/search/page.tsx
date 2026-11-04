import type { Metadata } from "next";
import StorefrontHomePage from "@/features/storefront/home-page";

export const metadata: Metadata = {
  title: "Search",
  description: "Search products across the Mtjr marketplace."
};

export default function SearchPage() {
  return <StorefrontHomePage />;
}
