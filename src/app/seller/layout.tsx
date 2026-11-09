import SellerPortalShell from "@/features/seller/seller-portal-shell";

export default function SellerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <SellerPortalShell>{children}</SellerPortalShell>;
}
