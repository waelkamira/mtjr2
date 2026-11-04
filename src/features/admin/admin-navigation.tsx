"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin/dashboard", label: "Overview" },
  { href: "/admin/returns", label: "Returns" },
  { href: "/admin/support", label: "Customer support" },
  { href: "/admin/reviews", label: "Product reviews" },
  { href: "/admin/store-reviews", label: "Store reviews" },
  { href: "/admin/questions", label: "Product Q&A" },
  { href: "/admin/search-synonyms", label: "Search synonyms" },
  { href: "/admin/tax-rates", label: "Tax rates" }
];

export default function AdminNavigation() {
  const pathname = usePathname();

  return (
    <aside className="border-b border-[var(--border)] bg-[var(--color-forest-950)] text-white lg:min-h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between gap-4 px-5 py-5 lg:block">
        <Link href="/admin/dashboard" className="text-xl font-semibold">
          MATJAR<span className="text-[var(--color-copper-600)]">.</span>
        </Link>
        <span className="text-xs text-white/60">Administration</span>
      </div>
      <nav aria-label="Administration" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:px-3">
        {links.map((link) => {
          const active = link.href === "/admin/dashboard"
            ? pathname === link.href || pathname === "/admin/control-panel"
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm transition-colors lg:block ${
                active ? "bg-white/15 font-semibold text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="hidden px-6 pt-5 text-xs leading-5 text-white/50 lg:block">
        Navigation includes implemented admin areas only. Additional modules will appear as their workflows are built.
      </div>
    </aside>
  );
}
