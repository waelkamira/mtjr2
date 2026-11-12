import type { Metadata } from "next";
import SiteNavigation from "@/components/site-navigation";
import SiteFooter from "@/components/site-footer";
import { env } from "@/lib/env";
import AuthJourney from "@/components/auth-journey";
import MatjarAIAssistant from "@/components/ai/matjar-ai-assistant";
import { getAiAssistantRuntimeSettings } from "@/server/ai/assistant-config";
import RegistrationNotice from "@/components/registration-notice";
import SonnerToaster from "@/components/sonner-toaster";
import PaginationScrollReset from "@/components/pagination-scroll-reset";
import { LocaleProvider } from "@/components/locale-provider";
import { cookies } from "next/headers";
import MfaStepUpPage from "@/features/identity/mfa-step-up-page";
import { getCurrentSession } from "@/server/identity/current-session";
import { getUserAuthorizationGrants } from "@/server/identity/permission-repository";
import { defaultLocale, isLocale, localeCookieName } from "@/lib/locale";
import "leaflet/dist/leaflet.css";
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
  const [aiSettings, session] = await Promise.all([
    getAiAssistantRuntimeSettings(),
    getCurrentSession()
  ]);
  let showPlatformMfaGate = false;
  if (session) {
    const grants = await getUserAuthorizationGrants(session.userId);
    const isPlatformAdministrator = grants.some((grant) =>
      grant.permissionKey === "platform:manage" && grant.scopeType === "GLOBAL" && grant.scopeId === "GLOBAL"
    );
    if (isPlatformAdministrator) {
      const verifiedAt = session.stepUpVerifiedAt?.getTime();
      const expiresAt = session.stepUpExpiresAt?.getTime();
      const now = Date.now();
      showPlatformMfaGate = !(verifiedAt !== undefined && expiresAt !== undefined && verifiedAt <= now && now - verifiedAt <= 10 * 60 * 1000 && expiresAt > now && expiresAt <= verifiedAt + 10 * 60 * 1000);
    }
  }

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <body>
        <LocaleProvider initialLocale={locale}>
          <PaginationScrollReset />
          <SiteNavigation />
          <AuthJourney />
          <RegistrationNotice />
          {showPlatformMfaGate ? <MfaStepUpPage overlay /> : null}
          {children}
          <SiteFooter locale={locale} contactEmail={env.RESEND_FROM_EMAIL ?? null} />
          {aiSettings.enabled ? <MatjarAIAssistant /> : null}
          <SonnerToaster />
        </LocaleProvider>
      </body>
    </html>
  );
}
