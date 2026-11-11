import type { ReactNode } from "react";
import "@/app/seller/seller-theme.css";
import SellerNavigation from "@/features/seller/seller-navigation";
import SellerTopbar from "@/features/seller/seller-topbar";

export default function SellerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="seller-dashboard min-h-screen overflow-x-clip bg-[var(--background)] lg:flex">
      <SellerNavigation />
      <div className="seller-dashboard__content min-w-0 flex-1 bg-[var(--background)]">
        <SellerTopbar />
        {children}
      </div>
    </div>
  );
}
