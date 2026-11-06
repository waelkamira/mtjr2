export function safeReturnPath(
  candidate: string | null | undefined,
  origin: string,
  fallback = "/"
): string {
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return fallback;
  }

  try {
    const base = new URL(origin);
    const destination = new URL(candidate, base);
    if (destination.origin !== base.origin) return fallback;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}
