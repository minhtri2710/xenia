/**
 * The catalogue's vocabularies and the collection page's facet and sort logic.
 * Pure: the page loads published wines through Payload's Local API and hands them here.
 */

export const WINE_TYPES = ["red", "white", "rose", "sparkling", "sweet"] as const;
export type WineType = (typeof WINE_TYPES)[number];

/** ISO 3166-1 alpha-2 codes; display names live in messages (`Catalogue.countries`). */
export const COUNTRIES = ["FR", "IT", "ES", "PT", "DE", "AT", "US", "CL", "AR", "AU", "NZ", "ZA", "VN"] as const;
export type Country = (typeof COUNTRIES)[number];

export const OCCASIONS = ["gift", "tet", "celebration", "dinner", "everyday"] as const;
export type Occasion = (typeof OCCASIONS)[number];

export const PAIRINGS = [
  "beef",
  "pork",
  "poultry",
  "seafood",
  "fish",
  "cheese",
  "spicy",
  "dessert",
  "bun-cha",
  "pho",
  "bo-luc-lac",
  "goi-cuon",
  "cha-gio",
  "vit-quay",
] as const;

export const BOTTLE_SIZES = [375, 750, 1500] as const;
export type BottleSize = (typeof BOTTLE_SIZES)[number];

export const STATUSES = ["draft", "published"] as const;

/**
 * Law 44/2019 Art. 5.7 and 5.9: a vintage at 15% ABV or above may not be advertised or promoted.
 * Derived from `abvPct` wherever it is needed; never stored.
 */
export function isAdRestricted(abvPct: number): boolean {
  return abvPct >= 15;
}

/**
 * Price bands in integer VND, VAT included. `min` is inclusive, `max` exclusive,
 * so a bottle at exactly 1 000 000 is in "1m-2m", not "lt1m".
 */
export const PRICE_BANDS = [
  { id: "lt1m", min: 0, max: 1_000_000 },
  { id: "1m-2m", min: 1_000_000, max: 2_000_000 },
  { id: "2m-4m", min: 2_000_000, max: 4_000_000 },
  { id: "gte4m", min: 4_000_000, max: Infinity },
] as const;
export type PriceBand = (typeof PRICE_BANDS)[number]["id"];

export const SORTS = ["name", "price-asc", "price-desc"] as const;
export type Sort = (typeof SORTS)[number];

export type CatalogueVintage = { priceVnd: number; bottleMl: BottleSize; stock: number; abvPct: number };

/** A published wine with its published vintages, in the requested locale. */
export type CatalogueWine = {
  slug: string;
  name: string;
  producer: string;
  type: WineType;
  country: Country;
  region: string;
  grapes: string[];
  occasions: Occasion[];
  /** Admin-set: offered for the home page's featured wines (`featuredWines`). */
  featured: boolean;
  vintages: CatalogueVintage[];
};

export type Filters = {
  type?: WineType;
  country?: string;
  /** Only meaningful under a country: `parseQuery` drops a region without one. */
  region?: string;
  grape?: string;
  price?: PriceBand;
  occasion?: string;
  size?: BottleSize;
  sort: Sort;
};

export type Listing = {
  wine: CatalogueWine;
  /** The lowest price among the vintages that match the filters: the card's "from" price. */
  fromPriceVnd: number;
  inStock: boolean;
};

type Query = Record<string, string | string[] | undefined>;

function first(query: Query, key: string): string | undefined {
  const value = query[key];
  const text = (Array.isArray(value) ? value[0] : value)?.trim();
  return text || undefined;
}

function oneOf<T extends string | number>(values: readonly T[], raw: string | undefined): T | undefined {
  return values.find((v) => String(v) === raw);
}

/** Reads facet and sort state from a URL query. Unknown values are ignored, never errors. */
export function parseQuery(query: Query): Filters {
  const country = first(query, "country");
  return {
    type: oneOf(WINE_TYPES, first(query, "type")),
    country,
    region: country ? first(query, "region") : undefined,
    grape: first(query, "grape"),
    price: oneOf(
      PRICE_BANDS.map((b) => b.id),
      first(query, "price"),
    ),
    occasion: first(query, "occasion"),
    size: oneOf(BOTTLE_SIZES, first(query, "size")),
    sort: oneOf(SORTS, first(query, "sort")) ?? "name",
  };
}

/** Serialises filters back to a query string, omitting defaults, in a stable key order. */
export function toQuery(filters: Filters): string {
  const params = new URLSearchParams();
  for (const key of ["type", "country", "region", "grape", "price", "occasion", "size"] as const) {
    const value = filters[key];
    if (value !== undefined) params.set(key, String(value));
  }
  if (filters.sort !== "name") params.set("sort", filters.sort);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function priceBandOf(priceVnd: number): PriceBand {
  return PRICE_BANDS.find((b) => priceVnd >= b.min && priceVnd < b.max)!.id;
}

function vintageMatches(v: CatalogueVintage, filters: Filters): boolean {
  return (filters.size === undefined || v.bottleMl === filters.size) && (filters.price === undefined || priceBandOf(v.priceVnd) === filters.price);
}

function wineMatches(w: CatalogueWine, filters: Filters): boolean {
  return (
    (filters.type === undefined || w.type === filters.type) &&
    (filters.country === undefined || w.country === filters.country) &&
    (filters.region === undefined || w.region === filters.region) &&
    (filters.grape === undefined || w.grapes.includes(filters.grape)) &&
    (filters.occasion === undefined || (w.occasions as string[]).includes(filters.occasion))
  );
}

/**
 * Applies facets and sort. Size and price band are vintage facets: a wine matches when one of
 * its vintages satisfies both, and its "from" price is the lowest among those vintages.
 */
export function listWines(wines: CatalogueWine[], filters: Filters, locale: string): Listing[] {
  const collator = new Intl.Collator(locale);
  const listings = wines.flatMap((wine): Listing[] => {
    if (!wineMatches(wine, filters)) return [];
    const vintages = wine.vintages.filter((v) => vintageMatches(v, filters));
    if (vintages.length === 0) return [];
    return [
      {
        wine,
        fromPriceVnd: Math.min(...vintages.map((v) => v.priceVnd)),
        inStock: vintages.some((v) => v.stock > 0),
      },
    ];
  });
  const byName = (a: Listing, b: Listing) => collator.compare(a.wine.name, b.wine.name);
  return listings.sort((a, b) => {
    if (filters.sort === "price-asc") return a.fromPriceVnd - b.fromPriceVnd || byName(a, b);
    if (filters.sort === "price-desc") return b.fromPriceVnd - a.fromPriceVnd || byName(a, b);
    return byName(a, b);
  });
}

/**
 * A surface that promotes a whole wine treats it as restricted when any of its published
 * vintages is (Law 44/2019 Art. 5.7 and 5.9). The only place that reads `isAdRestricted` for a wine.
 */
export function isRestrictedWine(wine: Pick<CatalogueWine, "vintages">): boolean {
  return wine.vintages.some((v) => isAdRestricted(v.abvPct));
}

/** The occasions that make a gift collection: the rest of `OCCASIONS` are browse occasions only. */
export const GIFT_OCCASIONS = ["gift", "tet", "celebration"] as const satisfies readonly Occasion[];
export type GiftOccasion = (typeof GIFT_OCCASIONS)[number];

/** The occasion facet of `/qua-tang`: one of `GIFT_OCCASIONS`, anything else is ignored. */
export function parseGiftOccasion(raw: string | string[] | undefined): GiftOccasion | undefined {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return GIFT_OCCASIONS.find((o) => o === value);
}

/** A wine's gift occasions, in `GIFT_OCCASIONS` order (its browse occasions left out). */
export const giftOccasionsOf = (wine: Pick<CatalogueWine, "occasions">): GiftOccasion[] => GIFT_OCCASIONS.filter((o) => wine.occasions.includes(o));

/**
 * The gift listing of `/qua-tang`: one name-ordered grid of the wines tagged with a gift occasion
 * (only `occasion` when one is chosen), narrowed by an optional price band with `/ruou-vang`'s card
 * semantics. A promotional surface, so a restricted wine is never in it, whatever the band.
 */
export function giftListing(wines: CatalogueWine[], { occasion, price }: { occasion?: GiftOccasion; price?: PriceBand }, locale: string): Listing[] {
  const promotable = wines.filter((w) => !isRestrictedWine(w) && giftOccasionsOf(w).some((o) => !occasion || o === occasion));
  return listWines(promotable, { sort: "name", price }, locale);
}

/** How many featured wines the home page shows. */
export const FEATURED_LIMIT = 3;

/**
 * The home page's featured wines: the admin-set `featured` wines, in name order, at most
 * `FEATURED_LIMIT`. A promotional surface, so a restricted wine is never among them.
 */
export function featuredWines(wines: CatalogueWine[], locale: string): Listing[] {
  const promotable = wines.filter((w) => w.featured && !isRestrictedWine(w));
  return listWines(promotable, { sort: "name" }, locale).slice(0, FEATURED_LIMIT);
}

export type FacetOptions = {
  types: WineType[];
  countries: Country[];
  /** Regions of the selected country; empty until a country is chosen. */
  regions: string[];
  grapes: string[];
  occasions: Occasion[];
  sizes: BottleSize[];
};

/** The values present in the published catalogue, in a stable order. */
export function facetOptions(wines: CatalogueWine[], filters: Filters): FacetOptions {
  const present = <T>(all: readonly T[], values: T[]) => all.filter((v) => values.includes(v));
  const sorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "en"));
  return {
    types: present(
      WINE_TYPES,
      wines.map((w) => w.type),
    ),
    countries: present(
      COUNTRIES,
      wines.map((w) => w.country),
    ),
    regions: filters.country ? sorted(wines.filter((w) => w.country === filters.country).map((w) => w.region)) : [],
    grapes: sorted(wines.flatMap((w) => w.grapes)),
    occasions: present(
      OCCASIONS,
      wines.flatMap((w) => w.occasions),
    ),
    sizes: present(
      BOTTLE_SIZES,
      wines.flatMap((w) => w.vintages.map((v) => v.bottleMl)),
    ),
  };
}
