import type { ReactNode } from "react";
import SellerNavigation from "@/features/seller/seller-navigation";
import SellerTopbar from "@/features/seller/seller-topbar";

export default function SellerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="seller-dashboard min-h-screen bg-[radial-gradient(ellipse_at_top_left,rgba(177,210,222,.48),transparent_34%),linear-gradient(145deg,#d7e3e9_0%,#c6d7df_48%,#e1e9ed_100%)] lg:flex">
      <SellerNavigation />
      <div className="min-w-0 flex-1">
        <SellerTopbar />
        {children}
      </div>
    </div>
  );
}
