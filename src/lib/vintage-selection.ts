/**
 * The product page's vintage and size selection, from the URL query `?vintage=<year|nv>&size=<ml>`.
 * Pure: the page loads a wine's vintages through Payload's Local API and hands them here.
 *
 * Only published vintages are selectable. Default: the most recent vintage (years newest first,
 * NV after every year), in 750 ml when it has one, otherwise its smallest size. An unknown or
 * unavailable value never errors; it resolves as if absent:
 * - a valid `vintage` is kept; otherwise the most recent vintage that has the requested `size`,
 *   or the default vintage when no vintage has it;
 * - `size` is kept when the chosen vintage has it; otherwise that vintage's default size.
 */
import { BOTTLE_SIZES, type BottleSize } from "./catalogue";

export type SelectableVintage = { year: number | null; bottleMl: BottleSize; status: "draft" | "published" };

/** `nv` or a year, as it appears in the query. */
export type VintageKey = string;

export type Selection<V extends SelectableVintage> = {
  selected: V;
  vintage: VintageKey;
  size: BottleSize;
  /** Newest first, NV last. `query` selects that vintage, keeping the current size when it can. */
  vintages: { key: VintageKey; year: number | null; query: string; current: boolean }[];
  /** The selected vintage's sizes, smallest first. */
  sizes: { ml: BottleSize; query: string; current: boolean }[];
};

type Query = Record<string, string | string[] | undefined>;

const PREFERRED_SIZE: BottleSize = 750;

export const vintageKey = (year: number | null): VintageKey => (year === null ? "nv" : String(year));

function first(query: Query, key: string): string | undefined {
  const value = query[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}

export function selectionQuery(vintage: VintageKey, size: BottleSize): string {
  return `?${new URLSearchParams({ vintage, size: String(size) })}`;
}

/** Returns `null` when the wine has no published vintage: the page is then not found. */
export function selectVintage<V extends SelectableVintage>(all: V[], query: Query): Selection<V> | null {
  const published = all.filter((v) => v.status === "published");
  if (published.length === 0) return null;

  const keys = [...new Set(published.map((v) => v.year))]
    .sort((a, b) => (a === null ? 1 : b === null ? -1 : b - a))
    .map(vintageKey);
  const sizesOf = (key: VintageKey) =>
    BOTTLE_SIZES.filter((ml) => published.some((v) => vintageKey(v.year) === key && v.bottleMl === ml));
  const sizeFor = (key: VintageKey, wanted: BottleSize | undefined): BottleSize => {
    const sizes = sizesOf(key);
    if (wanted !== undefined && sizes.includes(wanted)) return wanted;
    return sizes.includes(PREFERRED_SIZE) ? PREFERRED_SIZE : sizes[0];
  };

  const requestedSize = BOTTLE_SIZES.find((ml) => String(ml) === first(query, "size"));
  const requestedVintage = first(query, "vintage");
  const vintage =
    keys.find((k) => k === requestedVintage) ??
    keys.find((k) => requestedSize !== undefined && sizesOf(k).includes(requestedSize)) ??
    keys[0];
  const size = sizeFor(vintage, requestedSize);

  return {
    selected: published.find((v) => vintageKey(v.year) === vintage && v.bottleMl === size)!,
    vintage,
    size,
    vintages: keys.map((key) => ({
      key,
      year: key === "nv" ? null : Number(key),
      query: selectionQuery(key, sizeFor(key, size)),
      current: key === vintage,
    })),
    sizes: sizesOf(vintage).map((ml) => ({ ml, query: selectionQuery(vintage, ml), current: ml === size })),
  };
}
