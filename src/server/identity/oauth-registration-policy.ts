import { isPublicRegistrationEnabled, type ApplicationEnvironment } from "@/lib/env";

/**
 * Existing linked Google identities may sign in when public registration is
 * disabled. Creating a brand-new local account must obey the same policy as
 * email/password registration.
 */
export function canCreateOAuthAccount(
  environment: ApplicationEnvironment,
  hasLinkedAccount: boolean
): boolean {
  return hasLinkedAccount || isPublicRegistrationEnabled(environment);
}
