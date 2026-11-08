import { notFound, redirect } from "next/navigation";
import AiAssistantSettingsPage from "@/features/admin/ai-assistant-settings-page";
import { MfaEnrollmentRequiredError, MfaVerificationRequiredError, StepUpRequiredError } from "@/server/identity/access-errors";
import {
  AuthenticationRequiredError,
  PermissionDeniedError,
  requirePlatformManagement
} from "@/server/identity/permission-guard";

export const metadata = { title: "AI assistant controls", robots: { index: false, follow: false } };

export default async function AdminAiAssistantRoute() {
  try {
    await requirePlatformManagement();
  } catch (error) {
    if (error instanceof MfaEnrollmentRequiredError) redirect("/account/security?mfa=setup&returnTo=%2Fadmin%2Fcontrol-panel%2Fai-assistant");
    if (error instanceof MfaVerificationRequiredError) redirect("/account/security?mfa=verify&returnTo=%2Fadmin%2Fcontrol-panel%2Fai-assistant");
    if (error instanceof StepUpRequiredError) redirect("/mfa/verify?returnTo=%2Fadmin%2Fcontrol-panel%2Fai-assistant");
    if (error instanceof AuthenticationRequiredError) redirect("/login?returnTo=%2Fadmin%2Fcontrol-panel%2Fai-assistant");
    if (error instanceof PermissionDeniedError) notFound();
    throw error;
  }
  return <AiAssistantSettingsPage />;
}
