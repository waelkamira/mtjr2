import AuthPage from "@/features/identity/auth-page";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const params = await searchParams;
  return <AuthPage mode="login" />;
}
