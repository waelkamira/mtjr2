import { notFound, redirect } from "next/navigation";
import {
  AuthenticationRequiredError, MfaEnrollmentRequiredError, PermissionDeniedError,
  StepUpRequiredError, requirePlatformManagement
} from "@/server/identity/permission-guard";

export async function requireSuperAdminPage(returnTo: string) {
  try {
    await requirePlatformManagement();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    if (error instanceof MfaEnrollmentRequiredError) redirect(`/account/security?mfaRequired=1&returnTo=${encodeURIComponent(returnTo)}`);
    if (error instanceof StepUpRequiredError) redirect(`/mfa/verify?returnTo=${encodeURIComponent(returnTo)}`);
    if (error instanceof PermissionDeniedError) notFound();
    throw error;
  }
}
