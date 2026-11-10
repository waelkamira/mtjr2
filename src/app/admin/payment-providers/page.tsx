import { notFound, redirect } from "next/navigation";
import PaymentProvidersPage from "@/features/admin/payment-providers-page";
import { AuthenticationRequiredError, PermissionDeniedError, requirePlatformManagement } from "@/server/identity/permission-guard";
import { MfaEnrollmentRequiredError, MfaVerificationRequiredError, StepUpRequiredError } from "@/server/identity/access-errors";

export default async function PaymentProvidersRoute() {
  try {
    await requirePlatformManagement();
  } catch (error) {
    if (error instanceof MfaEnrollmentRequiredError) redirect("/account/security?mfa=setup&returnTo=%2Fadmin%2Fpayment-providers");
    if (error instanceof MfaVerificationRequiredError) redirect("/account/security?mfa=verify&returnTo=%2Fadmin%2Fpayment-providers");
    if (error instanceof StepUpRequiredError) redirect("/mfa/verify?returnTo=%2Fadmin%2Fpayment-providers");
    if (error instanceof AuthenticationRequiredError) redirect("/login?returnTo=%2Fadmin%2Fpayment-providers");
    if (error instanceof PermissionDeniedError) notFound();
    throw error;
  }
  return <PaymentProvidersPage />;
}
