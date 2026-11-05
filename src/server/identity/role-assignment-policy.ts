const PLATFORM_MANAGEMENT_PERMISSION = "platform:manage";

/**
 * Platform-wide management is a protected capability, not an ordinary
 * delegated role. Only the controlled first-admin bootstrap (and a future
 * separately reviewed break-glass workflow) may grant it.
 */
export function isProtectedPlatformRole(
  roleKey: string,
  permissionKeys: readonly string[]
): boolean {
  return roleKey === "SUPER_ADMIN" || permissionKeys.includes(PLATFORM_MANAGEMENT_PERMISSION);
}
