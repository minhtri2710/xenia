import { describe, expect, it } from "vitest";

import { computeTotals, includedVat } from "./order-totals";

// Every expected value is worked out by hand.

describe("computeTotals", () => {
  it("adds goods, shipping and the VAT included in the total", () => {
    // 2 × 850 000 + 1 × 720 000 = 2 420 000; + 30 000 = 2 450 000; 2 450 000 / 11 = 222 727.27 → 222 727.
    expect(
      computeTotals(
        [
          { qty: 2, unitPriceVnd: 850_000 },
          { qty: 1, unitPriceVnd: 720_000 },
        ],
        0,
        30_000,
      ),
    ).toEqual({ goodsVnd: 2_420_000, wrapVnd: 0, shippingVnd: 30_000, vatIncludedVnd: 222_727, totalVnd: 2_450_000 });
  });

  it("includes shipping in the total and in the VAT base", () => {
    // 1 × 480 000 + 45 000 = 525 000; 525 000 / 11 = 47 727.27 → 47 727.
    expect(computeTotals([{ qty: 1, unitPriceVnd: 480_000 }], 0, 45_000)).toEqual({
      goodsVnd: 480_000,
      wrapVnd: 0,
      shippingVnd: 45_000,
      vatIncludedVnd: 47_727,
      totalVnd: 525_000,
    });
  });

  it("allows free shipping", () => {
    expect(computeTotals([{ qty: 3, unitPriceVnd: 1_100_000 }], 0, 0)).toEqual({
      goodsVnd: 3_300_000,
      wrapVnd: 0,
      shippingVnd: 0,
      vatIncludedVnd: 300_000,
      totalVnd: 3_300_000,
    });
  });

  it("adds wrap to the total and to the VAT base", () => {
    // 850 000 + 720 000 = 1 570 000; + wrap 200 000 + 30 000 = 1 800 000; 1 800 000 / 11 = 163 636.36 → 163 636.
    expect(
      computeTotals(
        [
          { qty: 1, unitPriceVnd: 850_000 },
          { qty: 1, unitPriceVnd: 720_000 },
        ],
        200_000,
        30_000,
      ),
    ).toEqual({ goodsVnd: 1_570_000, wrapVnd: 200_000, shippingVnd: 30_000, vatIncludedVnd: 163_636, totalVnd: 1_800_000 });
  });

  it.each([
    ["no lines", [], 0, 0],
    ["a zero quantity", [{ qty: 0, unitPriceVnd: 1 }], 0, 0],
    ["a negative quantity", [{ qty: -1, unitPriceVnd: 1 }], 0, 0],
    ["a fractional quantity", [{ qty: 1.5, unitPriceVnd: 1 }], 0, 0],
    ["a negative price", [{ qty: 1, unitPriceVnd: -850_000 }], 0, 0],
    ["a fractional price", [{ qty: 1, unitPriceVnd: 850_000.5 }], 0, 0],
    ["a NaN price", [{ qty: 1, unitPriceVnd: Number.NaN }], 0, 0],
    ["a negative shipping fee", [{ qty: 1, unitPriceVnd: 1 }], 0, -30_000],
    ["a fractional shipping fee", [{ qty: 1, unitPriceVnd: 1 }], 0, 0.5],
    ["an unsafe total", [{ qty: 2, unitPriceVnd: Number.MAX_SAFE_INTEGER }], 0, 0],
    ["a negative wrap", [{ qty: 1, unitPriceVnd: 1 }], -1, 0],
    ["a fractional wrap", [{ qty: 1, unitPriceVnd: 1 }], 0.5, 0],
  ])("rejects %s", (_label, lines, wrap, shipping) => {
    expect(() => computeTotals(lines, wrap, shipping)).toThrow(RangeError);
  });
});

describe("includedVat (10%, nearest whole VND)", () => {
  it.each([
    [0, 0],
    [5, 0], // 0.4545 → 0
    [6, 1], // 0.5454 → 1
    [11, 1],
    [1_100_000, 100_000],
    [2_465_000, 224_091], // 224 090.9 → 224 091
    [2_450_000, 222_727], // 222 727.27 → 222 727
  ])("%i VND contains %i VND VAT", (amount, vat) => {
    expect(includedVat(amount)).toBe(vat);
  });

  it("rejects negative and fractional amounts", () => {
    expect(() => includedVat(-1)).toThrow(RangeError);
    expect(() => includedVat(10.5)).toThrow(RangeError);
  });
});
