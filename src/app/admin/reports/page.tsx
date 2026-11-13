import AdminReportsPage from "@/features/admin/reports-page";
import { notFound, redirect } from "next/navigation";
import {
  AuthenticationRequiredError,
  PermissionDeniedError,
  requirePlatformManagement
} from "@/server/identity/permission-guard";
import {
  MfaEnrollmentRequiredError,
  MfaVerificationRequiredError,
  StepUpRequiredError
} from "@/server/identity/access-errors";

export default async function AdminReportsRoute() {
  try {
    await requirePlatformManagement();
  } catch (error) {
    if (error instanceof MfaEnrollmentRequiredError) redirect("/account/security?mfa=setup&returnTo=%2Fadmin%2Freports");
    if (error instanceof MfaVerificationRequiredError) redirect("/account/security?mfa=verify&returnTo=%2Fadmin%2Freports");
    if (error instanceof StepUpRequiredError) redirect("/mfa/verify?returnTo=%2Fadmin%2Freports");
    if (error instanceof AuthenticationRequiredError) redirect("/login?returnTo=%2Fadmin%2Freports");
    if (error instanceof PermissionDeniedError) notFound();
    throw error;
  }
  return <AdminReportsPage />;
}
