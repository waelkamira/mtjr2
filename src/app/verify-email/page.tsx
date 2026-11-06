import VerifyEmailPage from "@/features/identity/verify-email-page";

export const metadata = {
  title: "Verify email",
  referrer: "no-referrer" as const,
  robots: { index: false, follow: false }
};

export default async function VerifyEmailRoute({ searchParams }: { searchParams: Promise<{ token?: string; email?: string }> }) {
  const params = await searchParams;
  return <VerifyEmailPage initialToken={params.token ?? ""} initialEmail={params.email ?? ""} />;
}
