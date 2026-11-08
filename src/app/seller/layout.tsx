import type { ReactNode } from "react";
import SellerNavigation from "@/features/seller/seller-navigation";
import SellerTopbar from "@/features/seller/seller-topbar";

export default function SellerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,rgba(196,215,225,.48),transparent_34%),linear-gradient(145deg,#dbe6eb_0%,#cbd9e0_48%,#e5edf0_100%)] lg:flex">
      <SellerNavigation />
      <div className="min-w-0 flex-1">
        <SellerTopbar />
        {children}
      </div>
    </div>
  );
}
