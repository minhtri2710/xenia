const PLACEHOLDER_ORIGIN = "http://xenia.invalid";

/**
 * Reduces an untrusted `next` value to a same-origin relative path, or to `home`
 * (the gate locale's home, from next-intl's `getPathname`). Rejects absolute URLs,
 * protocol-relative `//host`, backslashes, control characters and any value that
 * normalises to one of those.
 */
export function safeReturnPath(raw: unknown, home: string): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) return home;
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return home;
  let url: URL;
  try {
    url = new URL(raw, PLACEHOLDER_ORIGIN);
  } catch {
    return home;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return home;
  const path = url.pathname + url.search + url.hash;
  return path.startsWith("//") ? home : path;
}
