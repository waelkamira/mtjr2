import AuthPage from "@/features/identity/auth-page";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const params = await searchParams;
  return <AuthPage mode="forgot" initialEmail={params.email ?? ""} />;
}
