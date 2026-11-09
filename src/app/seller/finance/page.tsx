import SellerFinanceOverviewPage from "@/features/seller/finance-overview-page";
import { getPreferredLocale } from "@/server/locale";
import { translate } from "@/lib/locale";

export async function generateMetadata() {
  const locale = await getPreferredLocale();
  return { title: translate(locale, "Seller financial overview", "النظرة المالية للبائع"), robots: { index: false, follow: false } };
}

export default function SellerFinanceRoute() {
  return <SellerFinanceOverviewPage />;
}
