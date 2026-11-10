import SellerPayoutMethodsPage from "@/features/seller/payout-methods-page";
import { getPreferredLocale } from "@/server/locale";
import { translate } from "@/lib/locale";

export async function generateMetadata() {
  const locale = await getPreferredLocale();
  return { title: translate(locale, "Seller bank accounts", "الحسابات البنكية للبائع"), robots: { index: false, follow: false } };
}

export default function SellerPayoutsRoute() {
  return <SellerPayoutMethodsPage />;
}
