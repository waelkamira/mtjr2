export function tokenizeSearchQuery(value: string): string[] {
  return [...new Set((value.normalize("NFKC").toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []))].slice(0, 8);
}
