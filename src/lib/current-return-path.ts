import { safeReturnPath } from "@/lib/safe-return-path";
import { getAuthReturnPath } from "@/lib/auth-return";

type CurrentLocation = {
  pathname: string;
  search: string;
  hash: string;
  origin: string;
  referrer?: string;
};

const authPaths = new Set(["/login", "/register"]);

function safeAuthReturnPath(candidate: string | null, origin: string): string {
  const path = safeReturnPath(candidate, origin);
  return authPaths.has(new URL(path, origin).pathname) ? "/" : path;
}

export function getCurrentReturnPath(location: CurrentLocation): string {
  if (authPaths.has(location.pathname)) {
    const returnTo = new URLSearchParams(location.search).get("returnTo");
    if (returnTo) return safeAuthReturnPath(returnTo, location.origin);

    if (location.referrer) {
      try {
        const referrer = new URL(location.referrer);
        if (referrer.origin === location.origin && !authPaths.has(referrer.pathname)) {
          return safeAuthReturnPath(`${referrer.pathname}${referrer.search}${referrer.hash}`, location.origin);
        }
      } catch {
        return "/";
      }
    }

    return "/";
  }

  return safeReturnPath(`${location.pathname}${location.search}${location.hash}`, location.origin);
}

export function currentReturnPath(): string {
  if (typeof window === "undefined") return "/";
  if (authPaths.has(window.location.pathname)) return getAuthReturnPath("/");
  return getCurrentReturnPath({
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    origin: window.location.origin,
    referrer: document.referrer
  });
}
