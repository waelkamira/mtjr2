import type { Metadata } from "next";
import SiteNavigation from "@/components/site-navigation";
<<<<<<< HEAD
import SiteFooter from "@/components/site-footer";
=======
import AuthJourney from "@/components/auth-journey";
import MatjarAIAssistant from "@/components/ai/matjar-ai-assistant";
import { getAiAssistantRuntimeSettings } from "@/server/ai/assistant-config";
>>>>>>> 5dc32fe6055c1cf21876ac14f3888f1a16992696
import RegistrationNotice from "@/components/registration-notice";
import SonnerToaster from "@/components/sonner-toaster";
import { LocaleProvider } from "@/components/locale-provider";
import { cookies } from "next/headers";
import { defaultLocale, isLocale, localeCookieName } from "@/lib/locale";
import { env } from "@/lib/env";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const savedLocale = cookieStore.get(localeCookieName)?.value;
  const locale = isLocale(savedLocale) ? savedLocale : defaultLocale;
  const arabic = locale === "ar";

  return {
    title: {
      default: arabic ? "متجر — سوق عالمي" : "Mtjr2 — Global Marketplace",
      template: arabic ? "%s | متجر" : "%s | Mtjr2"
    },
    description: arabic ? "سوق عالمي متعدد البائعين." : "A global multi-vendor marketplace."
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const savedLocale = cookieStore.get(localeCookieName)?.value;
  const locale = isLocale(savedLocale) ? savedLocale : defaultLocale;
  const aiSettings = await getAiAssistantRuntimeSettings();

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <body>
        <LocaleProvider initialLocale={locale}>
          <SiteNavigation />
          <AuthJourney />
          <RegistrationNotice />
          {children}
<<<<<<< HEAD
          <SiteFooter locale={locale} contactEmail={env.CONTACT_EMAIL ?? env.RESEND_FROM_EMAIL ?? null} />
=======
          {aiSettings.enabled ? <MatjarAIAssistant /> : null}
>>>>>>> 5dc32fe6055c1cf21876ac14f3888f1a16992696
          <SonnerToaster />
        </LocaleProvider>
      </body>
    </html>
  );
}
