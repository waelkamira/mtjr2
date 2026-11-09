import VerifyEmailPage from "@/features/identity/verify-email-page";

export const metadata = {
  title: "Verify email",
  referrer: "no-referrer" as const,
  robots: { index: false, follow: false }
};

export default function VerifyEmailRoute() {
  return <VerifyEmailPage />;
}
