import AuthPage from "@/features/identity/auth-page";

export const metadata = { title: "Reset password", referrer: "no-referrer" as const, robots: { index: false, follow: false } };

export default function ResetPasswordPage() {
  return <AuthPage mode="reset" />;
}
