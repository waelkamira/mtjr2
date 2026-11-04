import { redirect } from "next/navigation";

/**
 * The Shop navigation entry must open the dedicated catalog/search experience,
 * not render the storefront homepage a second time.
 */
export default function ProductsPage() {
  redirect("/search");
}
