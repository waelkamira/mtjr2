import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { safeAuthReturnPath } from "@/lib/auth-return";
import { getCurrentSession } from "@/server/identity/current-session";
import { getMfaStatus } from "@/server/identity/mfa";
import MfaStepUpPage from "@/features/identity/mfa-step-up-page";

export const dynamic = "force-dynamic";
export default async function MfaVerifyPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const session = await getCurrentSession();
  const params = await searchParams;
  const returnTo = safeAuthReturnPath(params.returnTo, env.APP_URL) ?? "/admin/control-panel";
  if (!session) redirect(`/login?returnTo=${encodeURIComponent(`/mfa/verify?returnTo=${returnTo}`)}`);
  const status = await getMfaStatus(session.userId);
  if (!status.enabled) redirect(`/account/security?mfaRequired=1&returnTo=${encodeURIComponent(returnTo)}`);
  return <MfaStepUpPage initialReturnTo={returnTo} />;
}
