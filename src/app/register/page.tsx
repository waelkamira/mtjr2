import RegisterForm from "@/features/identity/register-form";
import { env, isPublicRegistrationEnabled } from "@/lib/env";

export default async function RegistrationPage({ searchParams }: { searchParams: Promise<{ oauth?: string }> }) {
  const { oauth } = await searchParams;
  const errors: Record<string, string> = {
    unavailable: "Google sign-in is not configured in this environment yet.",
    registration_unavailable: "New account registration is currently unavailable.",
    challenge_required: "Please complete the bot check before continuing with Google.",

    invalid: "Google sign-in could not be verified. Please try again.",
    failed: "Google sign-in failed. Please try again or use email and password.",
    inactive: "This Google account is not active. Contact support.",
    link_required: "An account with this email already exists. Sign in with your existing method; accounts are not linked automatically."
  };
  return <RegisterForm
    registrationAvailable={isPublicRegistrationEnabled(env)}
    initialOAuthError={oauth ? errors[oauth] ?? "Google sign-in could not be completed." : ""}
    turnstileSiteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""}
  />;
}
