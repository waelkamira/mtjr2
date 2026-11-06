import { redirect } from "next/navigation";
import { getCurrentSession } from "@/server/identity/current-session";
import { getRequestedPagePath } from "@/server/identity/requested-page-path";

export default async function AccountLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getCurrentSession();
  if (!session) {
    const returnTo = await getRequestedPagePath("/account", "/account");
    redirect(`/login?${new URLSearchParams({ returnTo }).toString()}`);
  }
  return children;
}
