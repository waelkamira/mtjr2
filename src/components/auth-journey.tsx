"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { REGISTRATION_NOTICE_KEY, rememberAuthReturnPath } from "@/lib/auth-return";

export default function AuthJourney() {
  const pathname = usePathname();
  const [notice, setNotice] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.sessionStorage.getItem(REGISTRATION_NOTICE_KEY);
        if (saved === "created") setNotice(true);
        window.sessionStorage.removeItem(REGISTRATION_NOTICE_KEY);
      } catch { /* Storage can be disabled. */ }
    }, 0);
    // Keep the most recently visited application route so both registration
    // and sign-in can return the user to it, regardless of navigation method.
    // safeAuthReturnPath rejects auth and API routes, so /login never replaces it.
    rememberAuthReturnPath(window.location.pathname + window.location.search + window.location.hash);
    return () => window.clearTimeout(timer);
  }, [pathname]);
  if (!notice) return null;
  return <div role="status" className="mx-auto mt-4 flex max-w-4xl flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
    <span>Account created. You are now signed in.</span>
    <button type="button" onClick={() => setNotice(false)} className="ml-auto font-semibold">Dismiss</button>
  </div>;
}
