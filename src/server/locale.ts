import "server-only";

import { cookies } from "next/headers";
import { defaultLocale, isLocale, localeCookieName, type Locale } from "@/lib/locale";

export async function getPreferredLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const savedLocale = cookieStore.get(localeCookieName)?.value;
  return isLocale(savedLocale) ? savedLocale : defaultLocale;
}
