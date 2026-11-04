import AuthPage from "@/features/identity/auth-page";

export const metadata = { title: "Verify email", referrer: "no-referrer" as const, robots: { index: false, follow: false } };

export default function VerifyEmailPage() {
  return <AuthPage mode="verify" />;
}
