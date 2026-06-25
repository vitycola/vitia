/**
 * Shared text normalization helper for accent-insensitive search.
 *
 * Uses NFKD decomposition to separate base characters from combining diacritical
 * marks, then strips the marks so that "jamon" matches "Jamón" and "noquis"
 * matches "Ñoquis". Lowercases and trims the result.
 *
 * All search paths (SQLite repo, Dexie adapter) MUST use this single helper to
 * prevent drift between backends.
 */
export function normalizeForSearch(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
