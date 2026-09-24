import { describe, expect, it } from "vitest";

import type { BottleSize } from "./catalogue";
import { type SelectableVintage, selectVintage } from "./vintage-selection";

type V = SelectableVintage & { id: string };
const v = (id: string, year: number | null, bottleMl: BottleSize, status: V["status"] = "published"): V => ({
  id,
  year,
  bottleMl,
  status,
});

// Shaped like the seed's multi-vintage red: two years, one of them also in magnum, plus a draft.
const RED = [v("19-750", 2019, 750), v("20-750", 2020, 750), v("19-1500", 2019, 1500), v("22-750", 2022, 750, "draft")];
// Shaped like the seed's NV sparkling: one NV, three sizes.
const NV = [v("nv-750", null, 750), v("nv-375", null, 375), v("nv-1500", null, 1500)];

const pick = (vintages: V[], query: Record<string, string | string[] | undefined>) => {
  const s = selectVintage(vintages, query);
  return s && { id: s.selected.id, vintage: s.vintage, size: s.size };
};

describe("selectVintage default", () => {
  it("is the most recent published vintage in 750 ml", () => {
    expect(pick(RED, {})).toEqual({ id: "20-750", vintage: "2020", size: 750 });
  });

  it("is 750 ml for an NV wine with several sizes", () => {
    expect(pick(NV, {})).toEqual({ id: "nv-750", vintage: "nv", size: 750 });
  });

  it("is the smallest size when the default vintage has no 750 ml", () => {
    expect(pick([v("a", 2020, 1500), v("b", 2020, 375)], {})).toEqual({ id: "b", vintage: "2020", size: 375 });
  });

  it("ranks NV after every year", () => {
    expect(pick([v("nv", null, 750), v("old", 1998, 750)], {})).toEqual({ id: "old", vintage: "1998", size: 750 });
  });
});

describe("selectVintage options", () => {
  it("offers each published vintage newest first, and the chosen vintage's sizes smallest first", () => {
    const s = selectVintage(RED, { vintage: "2019" })!;
    expect(s.vintages.map((o) => [o.key, o.year, o.query, o.current])).toEqual([
      ["2020", 2020, "?vintage=2020&size=750", false],
      ["2019", 2019, "?vintage=2019&size=750", true],
    ]);
    expect(s.sizes.map((o) => [o.ml, o.query, o.current])).toEqual([
      [750, "?vintage=2019&size=750", true],
      [1500, "?vintage=2019&size=1500", false],
    ]);
  });

  it("links each vintage with the current size when that vintage has it, else its default", () => {
    const s = selectVintage(RED, { vintage: "2019", size: "1500" })!;
    expect(s.selected.id).toBe("19-1500");
    expect(s.vintages.map((o) => o.query)).toEqual(["?vintage=2020&size=750", "?vintage=2019&size=1500"]);
  });

  it("offers NV as the key nv with a null year", () => {
    const s = selectVintage(NV, { vintage: "nv", size: "375" })!;
    expect(s.vintages).toEqual([{ key: "nv", year: null, query: "?vintage=nv&size=375", current: true }]);
    expect(s.sizes.map((o) => o.ml)).toEqual([375, 750, 1500]);
    expect(s.selected.id).toBe("nv-375");
  });
});

describe("selectVintage query values", () => {
  it("honours a valid vintage and size", () => {
    expect(pick(RED, { vintage: "2019", size: "1500" })).toEqual({ id: "19-1500", vintage: "2019", size: 1500 });
  });

  it("takes the first value of a repeated parameter", () => {
    expect(pick(RED, { vintage: ["2019", "2020"] })).toEqual({ id: "19-750", vintage: "2019", size: 750 });
  });

  it.each([
    ["an unknown year", { vintage: "1999" }],
    ["a non-numeric vintage", { vintage: "abc" }],
    ["nv on a wine without NV", { vintage: "nv" }],
    ["an empty vintage", { vintage: "" }],
    ["a size outside the vocabulary", { size: "700" }],
    ["a size no vintage has", { size: "375" }],
    ["a non-numeric size", { size: "big" }],
    ["both invalid", { vintage: "<script>", size: "-1" }],
  ])("resolves %s to the default", (_label, query) => {
    expect(pick(RED, query)).toEqual({ id: "20-750", vintage: "2020", size: 750 });
  });

  it("falls back to the chosen vintage's default size when it lacks the requested size", () => {
    expect(pick(RED, { vintage: "2020", size: "1500" })).toEqual({ id: "20-750", vintage: "2020", size: 750 });
  });

  it("picks the most recent vintage that has the requested size when no vintage is given", () => {
    expect(pick(RED, { size: "1500" })).toEqual({ id: "19-1500", vintage: "2019", size: 1500 });
  });

  it("keeps an explicit NV", () => {
    expect(pick([v("y", 2021, 750), v("nv", null, 750)], { vintage: "nv" })).toEqual({ id: "nv", vintage: "nv", size: 750 });
  });
});

describe("selectVintage drafts", () => {
  it("never selects or offers a draft vintage, even when the query names it", () => {
    for (const query of [{}, { vintage: "2022" }, { vintage: "2022", size: "750" }]) {
      const s = selectVintage(RED, query)!;
      expect(s.selected.status).toBe("published");
      expect(s.vintages.map((o) => o.key)).not.toContain("2022");
    }
  });

  it("never offers a draft size of a published vintage", () => {
    const s = selectVintage([v("a", 2020, 750), v("b", 2020, 1500, "draft")], { size: "1500" })!;
    expect(s.selected.id).toBe("a");
    expect(s.sizes.map((o) => o.ml)).toEqual([750]);
  });

  it("returns null when every vintage is a draft, and for no vintages", () => {
    expect(selectVintage([v("d", 2023, 750, "draft")], {})).toBeNull();
    expect(selectVintage([], { vintage: "2023" })).toBeNull();
  });
});
