import { describe, expect, it } from "vitest";

import { BOTTLE_SIZES, isAdRestricted } from "../lib/catalogue";
import { type Localized, producers, seedCatalogue, wines } from "./data";

const localized = (l: Localized) => l.vi.trim() !== "" && l.en.trim() !== "";

describe("seed catalogue", () => {
  it("has about 16 wines, 16 of them published", () => {
    expect(wines.length).toBeGreaterThanOrEqual(14);
    expect(wines.length).toBeLessThanOrEqual(18);
    expect(seedCatalogue("vi")).toHaveLength(16);
  });

  it("gives every vintage an ABV and a bottle size in 375/750/1500, and whole VND prices", () => {
    for (const x of wines.flatMap((w) => w.vintages)) {
      expect(x.abvPct).toBeGreaterThan(0);
      expect(BOTTLE_SIZES).toContain(x.bottleMl);
      expect(Number.isInteger(x.priceVnd) && x.priceVnd > 0).toBe(true);
      expect(Number.isInteger(x.stock) && x.stock >= 0).toBe(true);
    }
  });

  it("has a published wine with no published vintage, and a draft vintage of a listed wine", () => {
    const listed = seedCatalogue("vi").map((w) => w.slug);
    const unlisted = wines.filter((w) => w.status === "published" && !listed.includes(w.slug));
    expect(unlisted.length).toBeGreaterThanOrEqual(1);
    expect(wines.some((w) => listed.includes(w.slug) && w.vintages.some((x) => x.status === "draft"))).toBe(true);
  });

  it("has at least 3 published wines with several published vintages or sizes", () => {
    const multi = seedCatalogue("vi").filter((w) => w.vintages.length > 1);
    expect(multi.length).toBeGreaterThanOrEqual(3);
  });

  it("has at least one published wine at or above 15% ABV, and the rest below", () => {
    const published = wines.filter((w) => w.status === "published");
    const strong = published.filter((w) => w.vintages.some((x) => x.status === "published" && isAdRestricted(x.abvPct)));
    expect(strong.length).toBeGreaterThanOrEqual(1);
    expect(strong.length).toBeLessThan(published.length / 4);
  });

  it("carries vi and en text for every localized field", () => {
    for (const p of producers) expect(localized(p.story), p.key).toBe(true);
    for (const w of wines) {
      for (const l of [w.name, w.tasting.nose, w.tasting.palate, w.tasting.finish]) expect(localized(l), w.slug).toBe(true);
    }
  });

  it("has unique, URL-safe slugs and resolvable producers", () => {
    const slugs = wines.map((w) => w.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    for (const w of wines) expect(producers.map((p) => p.key)).toContain(w.producer);
  });

  it("keeps the profile axes in 1..5 and grape shares at 100% when given", () => {
    for (const w of wines) {
      for (const axis of Object.values(w.profile)) expect(axis >= 1 && axis <= 5 && Number.isInteger(axis)).toBe(true);
      const pcts = w.grapes.map((g) => g.pct);
      if (pcts.every((p) => p !== undefined)) expect(pcts.reduce((a, b) => a! + b!, 0)).toBe(100);
    }
  });
});
