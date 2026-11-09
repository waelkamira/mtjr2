import type { ReactNode } from "react";
import SellerNavigation from "@/features/seller/seller-navigation";
import SellerTopbar from "@/features/seller/seller-topbar";

export default function SellerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="seller-dashboard min-h-screen overflow-x-clip bg-[#edf1f4] lg:flex">
      <SellerNavigation />
      <div className="min-w-0 flex-1 bg-[#edf1f4]">
        <SellerTopbar />
        {children}
      </div>
    </div>
  );
}
