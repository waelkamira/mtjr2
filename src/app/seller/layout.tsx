import type { ReactNode } from "react";
import SellerPortalShell from "@/features/seller/seller-portal-shell";

export default function SellerLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <SellerPortalShell>{children}</SellerPortalShell>;
}
