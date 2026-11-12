import FinancialPoliciesPage from "@/features/admin/financial-policies-page";
import { notFound, redirect } from "next/navigation";
import { MfaEnrollmentRequiredError, MfaVerificationRequiredError, StepUpRequiredError } from "@/server/identity/access-errors";
import {
  AuthenticationRequiredError,
  PermissionDeniedError,
  requirePlatformManagement
} from "@/server/identity/permission-guard";

export default async function AdminFinancialPoliciesRoute() {
  try {
    await requirePlatformManagement();
  } catch (error) {
    if (error instanceof MfaEnrollmentRequiredError) redirect("/account/security?mfa=setup&returnTo=%2Fadmin%2Ffinancial-policies");
    if (error instanceof MfaVerificationRequiredError) redirect("/account/security?mfa=verify&returnTo=%2Fadmin%2Ffinancial-policies");
    if (error instanceof StepUpRequiredError) redirect("/mfa/verify?returnTo=%2Fadmin%2Ffinancial-policies");
    if (error instanceof AuthenticationRequiredError) redirect("/login?returnTo=%2Fadmin%2Ffinancial-policies");
    if (error instanceof PermissionDeniedError) notFound();
    throw error;
  }
  return <FinancialPoliciesPage />;
}
