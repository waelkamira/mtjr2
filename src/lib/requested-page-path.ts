import { safeReturnPath } from "@/lib/safe-return-path";

export function resolveRequestedPagePath(
  candidate: string | null | undefined,
  allowedRoot: "/account" | "/admin",
  fallback: string,
  origin: string
): string {
  const path = safeReturnPath(candidate, origin, fallback);
  const pathname = new URL(path, origin).pathname;
  return pathname === allowedRoot || pathname.startsWith(`${allowedRoot}/`)
    ? path
    : fallback;
}
