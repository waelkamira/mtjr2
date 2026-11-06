const AUTH_PATHS = new Set(["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"]);
const RETURN_KEY = "mtjr2.auth.returnTo";
export const REGISTRATION_NOTICE_KEY = "mtjr2.auth.registrationNotice";

/** Only return to application pages, never another origin or an auth/API loop. */
export function safeAuthReturnPath(candidate: string | null | undefined, origin: string): string | null {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(candidate)) return null;
  try {
    const url = new URL(candidate, origin);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (url.origin !== new URL(origin).origin || AUTH_PATHS.has(path) || path === "/api" || path.startsWith("/api/")) return null;
    return url.pathname + url.search + url.hash;
  } catch { return null; }
}

export function rememberAuthReturnPath(path: string): void {
  const safe = safeAuthReturnPath(path, window.location.origin);
  if (!safe) return;
  try { window.sessionStorage.setItem(RETURN_KEY, safe); } catch { /* Storage can be disabled. */ }
}

export function getAuthReturnPath(fallback: string): string {
  const origin = window.location.origin;
  const explicit = safeAuthReturnPath(new URLSearchParams(window.location.search).get("returnTo"), origin);
  if (explicit) return explicit;
  try {
    const stored = safeAuthReturnPath(window.sessionStorage.getItem(RETURN_KEY), origin);
    if (stored) return stored;
  } catch { /* Storage can be disabled. */ }
  try {
    const referrer = new URL(document.referrer);
    if (referrer.origin === origin) {
      const previous = safeAuthReturnPath(referrer.pathname + referrer.search + referrer.hash, origin);
      if (previous) return previous;
    }
  } catch { /* Direct visits have no usable referrer. */ }
  return fallback;
}

export function clearAuthReturnPath(): void {
  try { window.sessionStorage.removeItem(RETURN_KEY); } catch { /* Storage can be disabled. */ }
}
