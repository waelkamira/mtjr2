import type { Metadata } from "next";
import SiteNavigation from "@/components/site-navigation";
import AuthJourney from "@/components/auth-journey";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Mtjr2 — Global Marketplace",
    template: "%s | Mtjr2"
  },
  description: "A global multi-vendor marketplace."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SiteNavigation />
        <AuthJourney />
        {children}
      </body>
    </html>
  );
}
