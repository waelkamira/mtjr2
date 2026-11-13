import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { getRequestedPagePath } from "@/server/identity/requested-page-path";
import AdminNavigation from "@/features/admin/admin-navigation";
import {
  AuthenticationRequiredError,
  MfaEnrollmentRequiredError,
  MfaVerificationRequiredError,
  PermissionDeniedError
} from "@/server/identity/current-session";
import { requireAnyPermission } from "@/server/identity/permission-guard";
import { userHasPermission, getUserAuthorizationGrants } from "@/server/identity/permission-repository";
import { StepUpRequiredError } from "@/server/identity/access-errors";

const ADMIN_AREA_PERMISSIONS = [
  "users:read",
  "users:manage",
  "store:read",
  "store:manage",
  "catalog:read",
  "catalog:manage",
  "inventory:manage",
  "orders:read",
  "orders:manage",
  "payments:read",
  "payments:refund",
  "support:read",
  "support:manage",
  "returns:manage",
  "reviews:manage",
  "roles:read",
  "roles:assign",
  "audit:read",
  "platform:manage",
  "ads:moderate"
] as const;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  let canManagePlatform = false;
  let navigationPermissions: string[] = [];
  try {
    const session = await requireAnyPermission(
      ADMIN_AREA_PERMISSIONS.map((permissionKey) => ({ permissionKey }))
    );
    const grants = await getUserAuthorizationGrants(session.userId);
    navigationPermissions = [...new Set(grants
      .filter((grant) => grant.scopeType === "GLOBAL" && grant.scopeId === "GLOBAL")
      .map((grant) => grant.permissionKey))];
    canManagePlatform = await userHasPermission(session.userId, { permissionKey: "platform:manage" });
  } catch (error) {
    if (error instanceof MfaEnrollmentRequiredError) {
      const returnTo = await getRequestedPagePath("/admin", "/admin/dashboard");
      const params = new URLSearchParams({ mfa: "setup", returnTo });
      redirect(`/account/security?${params.toString()}`);
    }
    if (error instanceof StepUpRequiredError) {
      const returnTo = await getRequestedPagePath("/admin", "/admin/control-panel");
      redirect(`/mfa/verify?${new URLSearchParams({ returnTo }).toString()}`);
    }
    if (error instanceof MfaVerificationRequiredError) {
      const returnTo = await getRequestedPagePath("/admin", "/admin/dashboard");
      const params = new URLSearchParams({ mfa: "verify", returnTo });
      redirect(`/account/security?${params.toString()}`);
    }
    if (error instanceof AuthenticationRequiredError) {
      const returnTo = await getRequestedPagePath("/admin", "/admin/dashboard");
      redirect(`/login?${new URLSearchParams({ returnTo }).toString()}`);
    }
    if (error instanceof PermissionDeniedError) notFound();
    throw error;
  }

  return (
    <div className="admin-dashboard min-h-screen min-w-0 bg-[var(--background)] lg:flex">
      <AdminNavigation canManagePlatform={canManagePlatform} permissions={navigationPermissions} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
