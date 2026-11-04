export function tokenizeSearchQuery(value: string): string[] {
  return [...new Set((value.normalize("NFKC").toLocaleLowerCase().match(/[\\p{L}\\p{N}]+/gu) ?? []).filter((token) => token.length > 1 || /^\\d+$/.test(token)))].slice(0, 8);
}
