/** Matches one word, optionally joined by apostrophes or hyphens ("don't", "well-known"). */
export const WORD_PATTERN = /^[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*$/u;

/** Lowercase, strip diacritics, unify apostrophes, collapse whitespace. */
export function normalizeText(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[’‘`´]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
