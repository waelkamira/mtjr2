import AuthPage from "@/features/identity/auth-page";

const oauthErrors: Record<string, string> = {
  unavailable: "Google sign-in is not configured in this environment yet.",
  invalid: "Google sign-in could not be verified. Please try again.",
  failed: "Google sign-in failed. Please try again or use your email and password.",
  inactive: "This Google account is not active. Contact support.",
  link_required: "This email already has a password account. Sign in with your password; accounts are not linked automatically.",
  not_linked: "No Mtjr2 account is linked to that Google account. Create an account first."
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ oauth?: string; mfa?: string }> }) {
  const { oauth, mfa } = await searchParams;
  return (
    <AuthPage
      mode="login"
      initialOAuthError={oauth ? oauthErrors[oauth] ?? "Google sign-in could not be completed." : ""}
      initialMfaRequired={mfa === "required"}
    />
  );
}
