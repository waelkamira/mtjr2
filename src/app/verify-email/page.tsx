import AuthPage from "@/features/identity/auth-page";

export const metadata = { title: "Verify email", referrer: "no-referrer" as const, robots: { index: false, follow: false } };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string; email?: string }> }) {
  const params = await searchParams;
  return <AuthPage mode="verify" initialToken={params.token ?? ""} initialEmail={params.email ?? ""} />;
}
