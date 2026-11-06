import AuthPage from "@/features/identity/auth-page";
import { getPreferredLocale } from "@/server/locale";
import { translate } from "@/lib/locale";

export async function generateMetadata() {
  const locale = await getPreferredLocale();
  return {
    title: translate(locale, "Reset password", "إعادة تعيين كلمة المرور"),
    referrer: "no-referrer" as const,
    robots: { index: false, follow: false }
  };
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  return <AuthPage mode="reset" initialToken={params.token ?? ""} />;
}
