export const supportedLocales = ["ar", "en"] as const;

export type Locale = (typeof supportedLocales)[number];

export const defaultLocale: Locale = "ar";
export const localeCookieName = "mtjr-locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && supportedLocales.includes(value as Locale);
}

export function translate(locale: Locale, english: string, arabic: string): string {
  return locale === "ar" ? arabic : english;
}
