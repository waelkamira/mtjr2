const ARABIC_LATIN: Record<string, string> = {
  "ء": "", "آ": "a", "أ": "a", "ؤ": "u", "إ": "i", "ئ": "i", "ا": "a",
  "ب": "b", "ت": "t", "ث": "th", "ج": "j", "ح": "h", "خ": "kh",
  "د": "d", "ذ": "dh", "ر": "r", "ز": "z", "س": "s", "ش": "sh",
  "ص": "s", "ض": "d", "ط": "t", "ظ": "z", "ع": "a", "غ": "gh",
  "ف": "f", "ق": "q", "ك": "k", "ل": "l", "م": "m", "ن": "n",
  "ه": "h", "و": "w", "ى": "a", "ي": "y", "ة": "h",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9"
};

/** Produces a stable ASCII URL slug for Latin, Arabic, and mixed product names. */
export function createProductSlug(value: string): string {
  const transliterated = Array.from(value.normalize("NFKD"))
    .map((character) => ARABIC_LATIN[character] ?? character)
    .join("")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180)
    .replace(/-+$/g, "");

  return transliterated || "product";
}
