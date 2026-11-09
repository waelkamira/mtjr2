import SellerFinanceOverviewPage from "@/features/seller/finance-overview-page";

export const metadata = { title: "Seller financial overview", robots: { index: false, follow: false } };

export default function SellerFinanceRoute() {
  return <SellerFinanceOverviewPage />;
}
