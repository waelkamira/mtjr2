import type { ReactNode } from "react";
import AdminNavigation from "@/features/admin/admin-navigation";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)] lg:flex">
      <AdminNavigation />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
