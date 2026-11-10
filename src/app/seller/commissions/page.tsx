import SellerCommissionsPage from "@/features/seller/commissions-page";
import { getPreferredLocale } from "@/server/locale";
import { translate } from "@/lib/locale";

export async function generateMetadata() {
  const locale = await getPreferredLocale();
  return {
    title: translate(locale, "Seller commission statements", "كشوف عمولات البائع"),
    referrer: "no-referrer" as const,
    robots: { index: false, follow: false }
  };
}

export default function SellerCommissionsRoute() {
  return <SellerCommissionsPage />;
}
