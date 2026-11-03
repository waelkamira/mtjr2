/**
 * Produces the canonical lookup form for an email address.
 * This is normalization, not full email validation; validate input at the boundary.
 */
export function normalizeEmail(email: string): string {
  return email.trim().normalize("NFKC").toLowerCase();
}
