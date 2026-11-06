import type { Metadata } from "next";
import SiteNavigation from "@/components/site-navigation";
import AuthJourney from "@/components/auth-journey";
import MatjarAIAssistant from "@/components/ai/matjar-ai-assistant";
import { env } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Mtjr2 — Global Marketplace",
    template: "%s | Mtjr2"
  },
  description: "A global multi-vendor marketplace."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const assistantEnabled = env.AI_ASSISTANT_ENABLED === "true" && Boolean(env.GROQ_API_KEY);

  return (
    <html lang="en">
      <body>
        <SiteNavigation />
        <AuthJourney />
        {children}
        {assistantEnabled ? <MatjarAIAssistant /> : null}
      </body>
    </html>
  );
}
