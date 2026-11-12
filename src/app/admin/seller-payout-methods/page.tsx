import { notFound, redirect } from "next/navigation";
import SellerPayoutReviewPage from "@/features/admin/seller-payout-review-page";
import { AuthenticationRequiredError, PermissionDeniedError, requirePlatformManagement } from "@/server/identity/permission-guard";
import { MfaEnrollmentRequiredError, MfaVerificationRequiredError, StepUpRequiredError } from "@/server/identity/access-errors";

export default async function SellerPayoutMethodsRoute() {
  try {
    await requirePlatformManagement();
  } catch (error) {
    if (error instanceof MfaEnrollmentRequiredError) redirect("/account/security?mfa=setup&returnTo=%2Fadmin%2Fseller-payout-methods");
    if (error instanceof StepUpRequiredError) redirect("/mfa/verify?returnTo=%2Fadmin%2Fseller-payout-methods");
    if (error instanceof MfaVerificationRequiredError) redirect("/account/security?mfa=verify&returnTo=%2Fadmin%2Fseller-payout-methods");
    if (error instanceof AuthenticationRequiredError) redirect("/login?returnTo=%2Fadmin%2Fseller-payout-methods");
    if (error instanceof PermissionDeniedError) notFound();
    throw error;
  }
  return <SellerPayoutReviewPage />;
}
