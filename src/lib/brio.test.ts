import { describe, expect, it } from "vitest";

import { isBrioPromotable } from "./brio";

const v = (abvPct: number, status: "draft" | "published" = "published") => ({ priceVnd: 500_000, bottleMl: 750 as const, stock: 1, abvPct, status });

describe("isBrioPromotable", () => {
  it("shows Brio while every published vintage is under 15%", () => {
    expect(isBrioPromotable([v(11), v(14.9)])).toBe(true);
  });

  it.each([
    ["one published vintage at exactly 15", [v(11), v(15)]],
    ["a single vintage above 15", [v(18)]],
  ])("hides Brio with %s", (_, vintages) => {
    expect(isBrioPromotable(vintages)).toBe(false);
  });

  it("ignores draft vintages, and hides Brio with no published vintage", () => {
    expect(isBrioPromotable([v(11), v(20, "draft")])).toBe(true);
    expect(isBrioPromotable([v(11, "draft")])).toBe(false);
    expect(isBrioPromotable([])).toBe(false);
  });
});
