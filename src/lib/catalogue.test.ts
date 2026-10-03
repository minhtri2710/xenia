import { describe, expect, it } from "vitest";

import {
  type CatalogueWine,
  FEATURED_LIMIT,
  facetOptions,
  featuredWines,
  type Filters,
  giftCollections,
  isAdRestricted,
  isRestrictedWine,
  listWines,
  parseQuery,
  type PriceBand,
  priceBandOf,
  toQuery,
} from "./catalogue";

const wine = (slug: string, over: Partial<CatalogueWine> = {}): CatalogueWine => ({
  slug,
  name: slug,
  producer: "P",
  type: "red",
  country: "FR",
  region: "Bordeaux",
  grapes: ["Merlot"],
  occasions: ["dinner"],
  featured: false,
  vintages: [{ priceVnd: 500_000, bottleMl: 750, stock: 1, abvPct: 13 }],
  ...over,
});

const WINES = [
  wine("a-bordeaux"),
  wine("b-burgundy", { region: "Burgundy", grapes: ["Pinot Noir"], vintages: [{ priceVnd: 1_500_000, bottleMl: 750, stock: 0, abvPct: 13 }] }),
  wine("c-tuscany", { country: "IT", region: "Tuscany", grapes: ["Sangiovese", "Merlot"], occasions: ["gift"] }),
  wine("d-champagne", {
    type: "sparkling",
    region: "Champagne",
    grapes: ["Chardonnay"],
    occasions: ["gift", "tet"],
    vintages: [
      { priceVnd: 2_500_000, bottleMl: 750, stock: 5, abvPct: 12 },
      { priceVnd: 1_300_000, bottleMl: 375, stock: 0, abvPct: 12 },
      { priceVnd: 5_000_000, bottleMl: 1500, stock: 2, abvPct: 12 },
    ],
  }),
];

const all: Filters = { sort: "name" };
const slugs = (f: Partial<Filters>) => listWines(WINES, { ...all, ...f }, "en").map((l) => l.wine.slug);

describe("price bands", () => {
  it.each([
    [0, "lt1m"],
    [999_999, "lt1m"],
    [1_000_000, "1m-2m"],
    [1_999_999, "1m-2m"],
    [2_000_000, "2m-4m"],
    [3_999_999, "2m-4m"],
    [4_000_000, "gte4m"],
    [50_000_000, "gte4m"],
  ])("%i VND is %s", (price, band) => {
    expect(priceBandOf(price)).toBe(band);
  });
});

describe("parseQuery", () => {
  it("reads every facet and the sort", () => {
    expect(
      parseQuery({ type: "red", country: "FR", region: "Bordeaux", grape: "Merlot", price: "lt1m", occasion: "gift", size: "750", sort: "price-desc" }),
    ).toEqual({ type: "red", country: "FR", region: "Bordeaux", grape: "Merlot", price: "lt1m", occasion: "gift", size: 750, sort: "price-desc" });
  });

  it("ignores unknown enum values and defaults the sort to name", () => {
    expect(parseQuery({ type: "beer", price: "cheap", size: "700", sort: "random" })).toEqual({
      type: undefined,
      country: undefined,
      region: undefined,
      grape: undefined,
      price: undefined,
      occasion: undefined,
      size: undefined,
      sort: "name",
    });
  });

  it("drops a region without a country (country → region nesting)", () => {
    expect(parseQuery({ region: "Bordeaux" }).region).toBeUndefined();
  });

  it("takes the first value of a repeated key", () => {
    expect(parseQuery({ type: ["white", "red"] }).type).toBe("white");
  });

  it("round-trips through toQuery", () => {
    const f = parseQuery({ country: "FR", region: "Burgundy", size: "375", sort: "price-asc" });
    expect(toQuery(f)).toBe("?country=FR&region=Burgundy&size=375&sort=price-asc");
    expect(parseQuery(Object.fromEntries(new URLSearchParams(toQuery(f))))).toEqual(f);
    expect(toQuery(all)).toBe("");
  });
});

describe("each facet narrows", () => {
  it("unfiltered lists everything by name", () => {
    expect(slugs({})).toEqual(["a-bordeaux", "b-burgundy", "c-tuscany", "d-champagne"]);
  });
  it("type", () => expect(slugs({ type: "sparkling" })).toEqual(["d-champagne"]));
  it("country", () => expect(slugs({ country: "IT" })).toEqual(["c-tuscany"]));
  it("region within a country", () => expect(slugs({ country: "FR", region: "Burgundy" })).toEqual(["b-burgundy"]));
  it("grape, including blends", () => expect(slugs({ grape: "Merlot" })).toEqual(["a-bordeaux", "c-tuscany"]));
  it("price band", () => expect(slugs({ price: "1m-2m" })).toEqual(["b-burgundy", "d-champagne"]));
  it("occasion", () => expect(slugs({ occasion: "gift" })).toEqual(["c-tuscany", "d-champagne"]));
  it("bottle size", () => expect(slugs({ size: 1500 })).toEqual(["d-champagne"]));
});

describe("facets combine", () => {
  it("as an AND across facets", () => {
    expect(slugs({ country: "FR", grape: "Merlot" })).toEqual(["a-bordeaux"]);
    expect(slugs({ occasion: "gift", type: "red" })).toEqual(["c-tuscany"]);
  });

  it("size and price must hold on the same vintage", () => {
    // d-champagne has a 375 ml bottle and a 2m-4m bottle, but not a 375 ml in 2m-4m.
    expect(slugs({ size: 375, price: "2m-4m" })).toEqual([]);
    expect(slugs({ size: 375, price: "1m-2m" })).toEqual(["d-champagne"]);
  });

  it("to an empty result", () => {
    expect(slugs({ country: "IT", type: "sparkling" })).toEqual([]);
  });
});

describe("price basis and stock", () => {
  it("is the lowest price among the matching vintages", () => {
    const find = (f: Partial<Filters>) => listWines(WINES, { ...all, ...f }, "en").find((l) => l.wine.slug === "d-champagne")!;
    expect(find({}).fromPriceVnd).toBe(1_300_000);
    expect(find({ size: 1500 }).fromPriceVnd).toBe(5_000_000);
    expect(find({ size: 375 }).inStock).toBe(false);
    expect(find({}).inStock).toBe(true);
  });

  it("marks a wine with no stock left", () => {
    expect(listWines(WINES, all, "en").find((l) => l.wine.slug === "b-burgundy")!.inStock).toBe(false);
  });
});

describe("sort", () => {
  it("price ascending, ties by name", () => {
    expect(slugs({ sort: "price-asc" })).toEqual(["a-bordeaux", "c-tuscany", "d-champagne", "b-burgundy"]);
  });
  it("price descending, ties by name", () => {
    expect(slugs({ sort: "price-desc" })).toEqual(["b-burgundy", "d-champagne", "a-bordeaux", "c-tuscany"]);
  });
  it("by name with the locale's collation", () => {
    const vi = [wine("x", { name: "Đỏ" }), wine("y", { name: "Dâu" }), wine("z", { name: "Em" })];
    expect(listWines(vi, all, "vi").map((l) => l.wine.name)).toEqual(["Dâu", "Đỏ", "Em"]);
  });
});

describe("facetOptions", () => {
  it("lists present values in a stable order, and regions only under a country", () => {
    expect(facetOptions(WINES, all)).toEqual({
      types: ["red", "sparkling"],
      countries: ["FR", "IT"],
      regions: [],
      grapes: ["Chardonnay", "Merlot", "Pinot Noir", "Sangiovese"],
      occasions: ["gift", "tet", "dinner"],
      sizes: [375, 750, 1500],
    });
    expect(facetOptions(WINES, { ...all, country: "FR" }).regions).toEqual(["Bordeaux", "Burgundy", "Champagne"]);
  });
});

describe("isAdRestricted (Law 44/2019 Art. 5.7, 5.9: 15% ABV and above)", () => {
  it.each([
    [14.9, false],
    [14.99, false],
    [15, true],
    [15.0, true],
    [15.1, true],
    [20, true],
  ])("ABV %s is restricted: %s", (abv, restricted) => {
    expect(isAdRestricted(abv)).toBe(restricted);
  });
});

const vintage = (priceVnd: number, abvPct: number) => ({ priceVnd, bottleMl: 750 as const, stock: 1, abvPct });
const gifted = (slug: string, vintages: CatalogueWine["vintages"], occasions: CatalogueWine["occasions"] = ["gift"]) => wine(slug, { occasions, vintages });
const listed = (wines: CatalogueWine[], price?: PriceBand) => Object.fromEntries(giftCollections(wines, price, "en").map((c) => [c.occasion, c.listings.map((l) => l.wine.slug)]));

describe("isRestrictedWine (a whole wine is restricted when any published vintage is)", () => {
  it.each([
    ["exactly 15", [vintage(1_000_000, 15)]],
    ["above 15", [vintage(1_000_000, 15.1)]],
    ["well above 15", [vintage(1_000_000, 20)]],
  ])("drops a wine at %s", (_, vintages) => {
    expect(isRestrictedWine({ vintages })).toBe(true);
  });

  it("keeps a wine whose vintages are all below 15", () => {
    expect(isRestrictedWine({ vintages: [vintage(1_000_000, 14.9)] })).toBe(false);
    expect(isRestrictedWine({ vintages: [vintage(1_000_000, 14.9), vintage(2_000_000, 12), vintage(3_000_000, 14.99)] })).toBe(false);
  });

  it.each([
    ["first", [vintage(2_000_000, 15), vintage(1_000_000, 13), vintage(3_000_000, 13)]],
    ["last", [vintage(2_000_000, 13), vintage(1_000_000, 13), vintage(3_000_000, 15)]],
    ["cheapest, in the middle", [vintage(2_000_000, 13), vintage(1_000_000, 15), vintage(3_000_000, 13)]],
    ["most expensive, in the middle", [vintage(1_000_000, 13), vintage(3_000_000, 15), vintage(2_000_000, 13)]],
    ["first and cheapest below the rest", [vintage(1_000_000, 14.9), vintage(2_000_000, 20)]],
  ])("drops a mixed wine whose restricted vintage is the %s", (_, vintages) => {
    expect(isRestrictedWine({ vintages })).toBe(true);
  });
});

describe("giftCollections", () => {
  const WINES_BY_ABV = [
    gifted("safe-149", [vintage(900_000, 14.9)], ["gift", "tet"]),
    gifted("edge-15", [vintage(900_000, 15)], ["gift", "tet"]),
    gifted("strong-20", [vintage(900_000, 20)], ["gift", "celebration"]),
    gifted("mixed-cheap-restricted", [vintage(900_000, 15), vintage(2_500_000, 13)], ["gift"]),
    gifted("mixed-dear-restricted", [vintage(900_000, 13), vintage(2_500_000, 15.1)], ["gift"]),
  ];

  it("lists a wine only when none of its vintages is restricted", () => {
    expect(listed(WINES_BY_ABV)).toEqual({ gift: ["safe-149"], tet: ["safe-149"], celebration: [] });
  });

  it("keeps a wine out of every budget even when the band holds only its unrestricted vintage", () => {
    expect(listed(WINES_BY_ABV, "2m-4m").gift).toEqual([]);
    expect(listed(WINES_BY_ABV, "lt1m").gift).toEqual(["safe-149"]);
  });

  it("makes one collection per gift occasion, in a fixed order, and none for a browse occasion", () => {
    const all = [gifted("a", [vintage(500_000, 12)], ["dinner", "everyday"])];
    expect(giftCollections(all, undefined, "en").map((c) => c.occasion)).toEqual(["gift", "tet", "celebration"]);
    expect(listed(all)).toEqual({ gift: [], tet: [], celebration: [] });
  });

  it("puts a wine in every gift collection it is tagged with", () => {
    const all = [gifted("a", [vintage(500_000, 12)], ["celebration", "gift", "dinner"]), gifted("b", [vintage(500_000, 12)], ["tet"])];
    expect(listed(all)).toEqual({ gift: ["a"], tet: ["b"], celebration: ["a"] });
  });

  it("narrows every collection by budget with the collection page's card semantics", () => {
    const all = [gifted("a", [vintage(500_000, 12), vintage(1_500_000, 12)], ["gift", "tet"]), gifted("b", [vintage(1_000_000, 12)], ["gift"])];
    expect(listed(all, "lt1m")).toEqual({ gift: ["a"], tet: ["a"], celebration: [] });
    expect(listed(all, "1m-2m")).toEqual({ gift: ["a", "b"], tet: ["a"], celebration: [] });
    const a = giftCollections(all, "1m-2m", "en")[0].listings.find((l) => l.wine.slug === "a")!;
    expect(a.fromPriceVnd).toBe(1_500_000);
    expect(listed(all, "gte4m")).toEqual({ gift: [], tet: [], celebration: [] });
  });

  it("is derived from the vintages handed in, with nothing stored", () => {
    const w = gifted("a", [vintage(500_000, 14.9)]);
    expect(listed([w]).gift).toEqual(["a"]);
    expect(listed([{ ...w, vintages: [{ ...w.vintages[0], abvPct: 15 }] }]).gift).toEqual([]);
  });
});

describe("featuredWines (the home page's featured wines)", () => {
  const featured = (slug: string, vintages: CatalogueWine["vintages"]) => wine(slug, { featured: true, vintages });
  const slugs = (wines: CatalogueWine[]) => featuredWines(wines, "en").map((l) => l.wine.slug);

  it("lists only admin-featured wines, in name order", () => {
    expect(slugs([featured("c", [vintage(900_000, 13)]), wine("a"), featured("b", [vintage(900_000, 12)])])).toEqual(["b", "c"]);
  });

  it.each([
    ["at exactly 15", [vintage(900_000, 15)]],
    ["above 15", [vintage(900_000, 20)]],
    ["with one restricted vintage among unrestricted ones", [vintage(900_000, 13), vintage(2_000_000, 15)]],
  ])("never lists a featured wine %s", (_, vintages) => {
    expect(slugs([featured("restricted", vintages), featured("safe", [vintage(900_000, 14.9)])])).toEqual(["safe"]);
  });

  it(`stops at ${FEATURED_LIMIT}, skipping restricted wines before counting`, () => {
    const wines = [
      featured("a-strong", [vintage(900_000, 20)]),
      featured("b", [vintage(900_000, 13)]),
      featured("c", [vintage(900_000, 13)]),
      featured("d", [vintage(900_000, 13)]),
      featured("e", [vintage(900_000, 13)]),
    ];
    expect(slugs(wines)).toEqual(["b", "c", "d"]);
  });

  it("gives each card the lowest price and the stock state, like the collection page", () => {
    const [listing] = featuredWines([featured("x", [{ priceVnd: 2_000_000, bottleMl: 750, stock: 0, abvPct: 13 }, { priceVnd: 900_000, bottleMl: 375, stock: 0, abvPct: 13 }])], "en");
    expect(listing).toMatchObject({ fromPriceVnd: 900_000, inStock: false });
  });
});
