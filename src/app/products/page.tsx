<<<<<<< HEAD
import type { Metadata } from "next";
import StorefrontHomePage from "@/features/storefront/home-page";

export const metadata: Metadata = {
  title: "Shop",
  description: "Discover products from independent stores on Mtjr."
};

export default function ProductsPage() {
  return <StorefrontHomePage />;
=======
import { redirect } from "next/navigation";

/**
 * The Shop navigation entry must open the dedicated catalog/search experience,
 * not render the storefront homepage a second time.
 */
export default function ProductsPage() {
  redirect("/search");
>>>>>>> 442aae41dfb67a4b1bc8871948cab095bcdb9ade
}
