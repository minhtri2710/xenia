/**
 * The cart: vintage ids and quantities only, never a price. It lives in the `xenia_cart` cookie;
 * every read resolves it against the database through `normalizeCart`, so a stale or tampered
 * cookie can never add an unpublished or unavailable vintage or exceed stock.
 */

export const CART_COOKIE = "xenia_cart";
/** Bounds the cookie well under the 4 KB browser limit. */
export const MAX_CART_LINES = 20;

export type CartLine = { vintageId: number; qty: number };

/** A vintage as the cart sees it: `purchasable` is a published vintage of a published wine. */
export type CartStock = { purchasable: boolean; stock: number };

const isPositiveInteger = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;

/** A quantity from a form: a whole number above zero, else `null`. */
export function parseQuantity(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{1,6}$/.test(value.trim())) return null;
  const qty = Number(value.trim());
  return qty > 0 ? qty : null;
}

/** Reads the cookie: well-formed `{v, q}` entries only, first entry per vintage, any other key ignored. */
export function parseCart(raw: string | undefined): CartLine[] {
  let data: unknown;
  try {
    data = JSON.parse(raw ?? "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const lines: CartLine[] = [];
  for (const entry of data) {
    const { v, q } = (entry ?? {}) as { v?: unknown; q?: unknown };
    if (!isPositiveInteger(v) || !isPositiveInteger(q) || lines.some((l) => l.vintageId === v)) continue;
    lines.push({ vintageId: v, qty: q });
    if (lines.length === MAX_CART_LINES) break;
  }
  return lines;
}

export function serializeCart(lines: CartLine[]): string {
  return JSON.stringify(lines.map((l) => ({ v: l.vintageId, q: l.qty })));
}

/** Drops unknown, unpurchasable and out-of-stock vintages and caps each quantity at stock. */
export function normalizeCart(lines: CartLine[], stock: ReadonlyMap<number, CartStock>): CartLine[] {
  return lines.flatMap((line) => {
    const s = stock.get(line.vintageId);
    if (!s || !s.purchasable || s.stock <= 0) return [];
    return [{ vintageId: line.vintageId, qty: Math.min(line.qty, s.stock) }];
  });
}

/** Adds `qty` to the vintage's line (a new line goes last), capped at `stock`. */
export function addLine(lines: CartLine[], vintageId: number, qty: number, stock: number): CartLine[] {
  const existing = lines.find((l) => l.vintageId === vintageId);
  if (!existing) return [...lines, { vintageId, qty: Math.min(qty, stock) }].slice(0, MAX_CART_LINES);
  return lines.map((l) => (l === existing ? { vintageId, qty: Math.min(l.qty + qty, stock) } : l));
}

/** Sets the vintage's quantity, capped at `stock`. A vintage not in the cart is left out. */
export function setLine(lines: CartLine[], vintageId: number, qty: number, stock: number): CartLine[] {
  return lines.map((l) => (l.vintageId === vintageId ? { vintageId, qty: Math.min(qty, stock) } : l));
}

export function removeLine(lines: CartLine[], vintageId: number): CartLine[] {
  return lines.filter((l) => l.vintageId !== vintageId);
}
