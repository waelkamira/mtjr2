import type { ReactNode } from "react";
import SellerNavigation from "@/features/seller/seller-navigation";
import SellerTopbar from "@/features/seller/seller-topbar";

export default function SellerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,var(--color-lavender-50),transparent_42%),radial-gradient(ellipse_at_top_right,var(--color-mint-50),transparent_38%),var(--background)] lg:flex">
      <SellerNavigation />
      <div className="min-w-0 flex-1">
        <SellerTopbar />
        {children}
      </div>
    </div>
  );
}
