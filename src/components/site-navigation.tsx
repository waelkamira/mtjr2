import { getCurrentSession } from "@/server/identity/current-session";
import { prisma } from "@/lib/db/prisma";
import SiteNavigationContent from "@/components/site-navigation-content";

function getAccountType(
  roleKeys: string[],
  sellerStatus: string | null
): string {
  const roles = new Set(roleKeys);
  if (roles.has("SUPER_ADMIN")) return "Super Admin";
  if (roles.has("ADMIN")) return "Admin";
  if (roles.has("SELLER") || sellerStatus === "ACTIVE") return "Seller";
  if (roles.has("SUPPORT_AGENT")) return "Support";
  if (sellerStatus === "PENDING") return "Seller applicant";
  if (roles.has("CUSTOMER")) return "Customer";
  return "User";
}

export default async function SiteNavigation() {
  let session = null;
  try {
    session = await getCurrentSession();
  } catch {
    // Keep public navigation available if the identity database is temporarily unavailable.
  }

  if (!session) {
    return <SiteNavigationContent account={null} />;
  }

  let accountType: string;
  let accountTypeError: string | null = null;
  try {
    const now = new Date();
    const account = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        roleAssignments: {
          where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          select: { role: { select: { key: true } } }
        },
        sellerProfile: { select: { status: true } }
      }
    });
    accountType = getAccountType(
      account?.roleAssignments.map(({ role }) => role.key) ?? [],
      account?.sellerProfile?.status ?? null
    );
  } catch (error) {
    console.error("Unable to load account type for navigation.", error);
    accountType = "Account type unavailable";
    accountTypeError = "Your account type could not be loaded.";
  }

  return (
    <SiteNavigationContent
      account={{
        name: session.user.displayName?.trim() || session.user.email,
        accountType,
        accountTypeError,
        profileImageUrl: null
      }}
    />
  );
}
