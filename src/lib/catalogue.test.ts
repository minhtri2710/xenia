import { describe, expect, it } from "vitest";

import { type CatalogueWine, facetOptions, type Filters, listWines, parseQuery, priceBandOf, toQuery } from "./catalogue";

const wine = (slug: string, over: Partial<CatalogueWine> = {}): CatalogueWine => ({
  slug,
  name: slug,
  producer: "P",
  type: "red",
  country: "FR",
  region: "Bordeaux",
  grapes: ["Merlot"],
  occasions: ["dinner"],
  vintages: [{ priceVnd: 500_000, bottleMl: 750, stock: 1 }],
  ...over,
});

const WINES = [
  wine("a-bordeaux"),
  wine("b-burgundy", { region: "Burgundy", grapes: ["Pinot Noir"], vintages: [{ priceVnd: 1_500_000, bottleMl: 750, stock: 0 }] }),
  wine("c-tuscany", { country: "IT", region: "Tuscany", grapes: ["Sangiovese", "Merlot"], occasions: ["gift"] }),
  wine("d-champagne", {
    type: "sparkling",
    region: "Champagne",
    grapes: ["Chardonnay"],
    occasions: ["gift", "tet"],
    vintages: [
      { priceVnd: 2_500_000, bottleMl: 750, stock: 5 },
      { priceVnd: 1_300_000, bottleMl: 375, stock: 0 },
      { priceVnd: 5_000_000, bottleMl: 1500, stock: 2 },
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
