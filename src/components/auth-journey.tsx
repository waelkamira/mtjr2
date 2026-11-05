"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { REGISTRATION_NOTICE_KEY, rememberAuthReturnPath } from "@/lib/auth-return";

export default function AuthJourney() {
  const pathname = usePathname();
  const [notice, setNotice] = useState<"sent" | "unavailable" | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.sessionStorage.getItem(REGISTRATION_NOTICE_KEY);
        if (saved === "sent" || saved === "unavailable") setNotice(saved);
        window.sessionStorage.removeItem(REGISTRATION_NOTICE_KEY);
      } catch { /* Storage can be disabled. */ }
    }, 0);
    // Persist the most recently visited application page, regardless of
    // whether navigation came from a link, router.push, or a server redirect.
    // auth-return.ts rejects auth/API routes, preventing the login page from
    // replacing the destination we are trying to restore.
    rememberAuthReturnPath(window.location.pathname + window.location.search + window.location.hash);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  }, []);
  if (!notice) return null;
  return <div role="status" className="mx-auto mt-4 flex max-w-4xl flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
    <span>{notice === "sent" ? "Account created. Check your email to verify your address before signing in." : "Account created, but the verification email could not be sent. Request another email later."}</span>
    <Link href="/verify-email" className="font-semibold underline">Verify or resend email</Link>
    <button type="button" onClick={() => setNotice(null)} className="ml-auto font-semibold">Dismiss</button>
  </div>;
}
