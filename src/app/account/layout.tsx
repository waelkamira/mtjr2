import { redirect } from "next/navigation";
import { getCurrentSession } from "@/server/identity/current-session";

export default async function AccountLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getCurrentSession();
  if (!session) redirect("/login?returnTo=/account");
  return children;
}
