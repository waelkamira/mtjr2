import SellerCommissionsPage from "@/features/seller/commissions-page";

export const metadata = { title: "Seller commission statements", robots: { index: false, follow: false } };

export default function SellerCommissionsRoute() {
  return <SellerCommissionsPage />;
}
