import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { type DigestInput, orderDigest } from "./order-digest";

// 1 × 720 000 (vintage 7) + 2 × 480 000 (vintage 3) = 1 680 000; + 30 000 = 1 710 000;
// 1 710 000 / 11 = 155 454.5… → 155 455.
const base: DigestInput = {
  lines: [
    { vintageId: 7, qty: 1, unitPriceVnd: 720_000 },
    { vintageId: 3, qty: 2, unitPriceVnd: 480_000 },
  ],
  zone: "hcmc",
  feeVnd: 30_000,
  totals: { goodsVnd: 1_680_000, shippingVnd: 30_000, vatIncludedVnd: 155_455, totalVnd: 1_710_000 },
};

const withLine = (i: number, change: Partial<DigestInput["lines"][number]>): DigestInput => ({
  ...base,
  lines: base.lines.map((l, j) => (j === i ? { ...l, ...change } : l)),
});
const withTotals = (change: Partial<DigestInput["totals"]>): DigestInput => ({ ...base, totals: { ...base.totals, ...change } });

describe("orderDigest", () => {
  it("is the SHA-256 hex of the canonical form written out by hand", () => {
    const canonical = '[[[3,2,480000],[7,1,720000]],"hcmc",30000,[1680000,30000,155455,1710000]]';
    expect(orderDigest(base)).toBe(createHash("sha256").update(canonical).digest("hex"));
    expect(orderDigest(base)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("does not depend on line order", () => {
    expect(orderDigest({ ...base, lines: [...base.lines].reverse() })).toBe(orderDigest(base));
  });

  it.each([
    ["a line's vintage id", withLine(0, { vintageId: 8 })],
    ["a line's qty", withLine(0, { qty: 2 })],
    ["a line's unit price", withLine(1, { unitPriceVnd: 480_001 })],
    ["an added line", { ...base, lines: [...base.lines, { vintageId: 9, qty: 1, unitPriceVnd: 850_000 }] }],
    ["a removed line", { ...base, lines: base.lines.slice(1) }],
    ["the zone", { ...base, zone: "hanoi" }],
    ["the fee", { ...base, feeVnd: 45_000 }],
    ["goods", withTotals({ goodsVnd: 1_680_001 })],
    ["shipping", withTotals({ shippingVnd: 45_000 })],
    ["VAT included", withTotals({ vatIncludedVnd: 155_454 })],
    ["total", withTotals({ totalVnd: 1_710_001 })],
  ])("changes when %s changes", (_, changed) => {
    expect(orderDigest(changed)).not.toBe(orderDigest(base));
  });
});
