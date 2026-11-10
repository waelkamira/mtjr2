import VerifyEmailPage from "@/features/identity/verify-email-page";
import { getPreferredLocale } from "@/server/locale";
import { translate } from "@/lib/locale";

export async function generateMetadata() {
  const locale = await getPreferredLocale();
  return {
    title: translate(locale, "Verify email", "تأكيد البريد الإلكتروني"),
    referrer: "no-referrer" as const,
    robots: { index: false, follow: false }
  };
}

export default function VerifyEmailRoute() {
  return <VerifyEmailPage />;
}
