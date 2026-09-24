const PLACEHOLDER_ORIGIN = "http://xenia.invalid";

/**
 * Reduces an untrusted `next` value to a same-origin relative path, or `/`.
 * Rejects absolute URLs, protocol-relative `//host`, backslashes, control
 * characters and any value that normalises to one of those.
 */
export function safeReturnPath(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return "/";
  let url: URL;
  try {
    url = new URL(raw, PLACEHOLDER_ORIGIN);
  } catch {
    return "/";
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return "/";
  const path = url.pathname + url.search + url.hash;
  return path.startsWith("//") ? "/" : path;
}
