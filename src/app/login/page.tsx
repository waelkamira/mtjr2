import AuthPage from "@/features/identity/auth-page";

const oauthErrors: Record<string, string> = {
  unavailable: "Google sign-in is not configured in this environment.",
  invalid: "Google sign-in could not be verified. Please try again.",
  failed: "Google sign-in failed. Please try again or use your email and password.",
  inactive: "This account is not active. Contact marketplace support.",
  not_linked: "This Google account is not linked to a Mtjr2 account. Use your existing sign-in method or create an account."
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ oauth?: string }> }) {
  const { oauth } = await searchParams;
  return <AuthPage mode="login" initialOAuthError={oauth ? oauthErrors[oauth] ?? "Google sign-in could not be completed." : ""} />;
}
