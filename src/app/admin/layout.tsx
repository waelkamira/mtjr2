import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import AdminNavigation from "@/features/admin/admin-navigation";
import {
  AuthenticationRequiredError,
  PermissionDeniedError,
  requireAnyPermission
} from "@/server/identity/permission-guard";

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
  "platform:manage"
] as const;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  try {
    await requireAnyPermission(
      ADMIN_AREA_PERMISSIONS.map((permissionKey) => ({ permissionKey }))
    );
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/login?returnTo=%2Fadmin%2Fdashboard");
    }
    if (error instanceof PermissionDeniedError) notFound();
    throw error;
  }

  return (
    <div className="min-h-screen bg-[var(--background)] lg:flex">
      <AdminNavigation />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
