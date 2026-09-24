import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { type DigestInput, orderDigest } from "./order-digest";

// 1 × 720 000 (vintage 7) + 2 × 480 000 (vintage 3) = 1 680 000; wrap 2 × 200 000 = 400 000;
// + 30 000 = 2 110 000; 2 110 000 / 11 = 191 818.18… → 191 818.
const base: DigestInput = {
  lines: [
    { vintageId: 7, qty: 1, unitPriceVnd: 720_000 },
    { vintageId: 3, qty: 2, unitPriceVnd: 480_000 },
  ],
  buyer: { name: "Nguyễn Văn An", phone: "0901234567", email: "an@example.test", address: "12 Lê Lợi, Quận 1" },
  zone: "hcmc",
  feeVnd: 30_000,
  delivery: { mode: "gift", recipient: { name: "Trần Thị Bình", phone: "0912345678", address: "5 Hàng Bài, Hoàn Kiếm" }, date: "2026-10-02", window: "morning" },
  wrap: { code: "box-2", nameVi: "Hộp cứng đôi", nameEn: "Two-bottle box", units: 2, unitPriceVnd: 200_000 },
  gift: { card: { code: "tet", nameVi: "Tết", nameEn: "Tết" }, message: "Chúc mừng năm mới", sender: "An", hidePrices: true },
  totals: { goodsVnd: 1_680_000, wrapVnd: 400_000, shippingVnd: 30_000, vatIncludedVnd: 191_818, totalVnd: 2_110_000 },
};

const withLine = (i: number, change: Partial<DigestInput["lines"][number]>): DigestInput => ({
  ...base,
  lines: base.lines.map((l, j) => (j === i ? { ...l, ...change } : l)),
});
const withBuyer = (change: Partial<DigestInput["buyer"]>): DigestInput => ({ ...base, buyer: { ...base.buyer, ...change } });
const withDelivery = (change: Partial<DigestInput["delivery"]>): DigestInput => ({ ...base, delivery: { ...base.delivery, ...change } });
const withRecipient = (change: object): DigestInput => withDelivery({ recipient: { ...base.delivery.recipient!, ...change } });
const withWrap = (change: object): DigestInput => ({ ...base, wrap: { ...base.wrap!, ...change } });
const withGift = (change: object): DigestInput => ({ ...base, gift: { ...base.gift!, ...change } });
const withCard = (change: object): DigestInput => withGift({ card: { ...base.gift!.card, ...change } });
const withTotals = (change: Partial<DigestInput["totals"]>): DigestInput => ({ ...base, totals: { ...base.totals, ...change } });

describe("orderDigest", () => {
  it("is the SHA-256 hex of the canonical form written out by hand", () => {
    const canonical =
      '[[[3,2,480000],[7,1,720000]],["Nguyễn Văn An","0901234567","an@example.test","12 Lê Lợi, Quận 1"],"hcmc",30000,' +
      '["gift",["Trần Thị Bình","0912345678","5 Hàng Bài, Hoàn Kiếm"],"2026-10-02","morning"],' +
      '["box-2","Hộp cứng đôi","Two-bottle box",2,200000],' +
      '[["tet","Tết","Tết"],"Chúc mừng năm mới","An",true],' +
      "[1680000,400000,30000,191818,2110000]]";
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
    ["the buyer's name", withBuyer({ name: "Trần Thị Bình" })],
    ["the buyer's phone", withBuyer({ phone: "0912345678" })],
    ["the buyer's email", withBuyer({ email: "binh@example.test" })],
    ["the buyer's address", withBuyer({ address: "99 Nguyễn Huệ, Quận 3" })],
    ["the zone", { ...base, zone: "hanoi" }],
    ["the fee", { ...base, feeVnd: 45_000 }],
    ["the mode", withDelivery({ mode: "self", recipient: null })],
    ["the recipient's name", withRecipient({ name: "Lê Văn Cường" })],
    ["the recipient's phone", withRecipient({ phone: "0987654321" })],
    ["the recipient's address", withRecipient({ address: "7 Tràng Tiền, Hoàn Kiếm" })],
    ["the date", withDelivery({ date: "2026-10-03" })],
    ["the window", withDelivery({ window: "evening" })],
    ["the packaging code", withWrap({ code: "box-1" })],
    ["the packaging name (vi)", withWrap({ nameVi: "Hộp cứng" })],
    ["the packaging name (en)", withWrap({ nameEn: "Rigid box" })],
    ["the packaging units", withWrap({ units: 1 })],
    ["the packaging unit price", withWrap({ unitPriceVnd: 200_001 })],
    ["no packaging", { ...base, wrap: null }],
    ["the card code", withCard({ code: "plain" })],
    ["the card name (vi)", withCard({ nameVi: "Trơn" })],
    ["the card name (en)", withCard({ nameEn: "Plain" })],
    ["the message", withGift({ message: "Chúc mừng năm mới!" })],
    ["the sender", withGift({ sender: "Bình" })],
    ["an anonymous sender", withGift({ sender: null })],
    ["hide prices", withGift({ hidePrices: false })],
    ["no gift options", { ...base, gift: null }],
    ["goods", withTotals({ goodsVnd: 1_680_001 })],
    ["wrap", withTotals({ wrapVnd: 400_001 })],
    ["shipping", withTotals({ shippingVnd: 45_000 })],
    ["VAT included", withTotals({ vatIncludedVnd: 191_817 })],
    ["total", withTotals({ totalVnd: 2_110_001 })],
  ])("changes when %s changes", (_, changed) => {
    expect(orderDigest(changed)).not.toBe(orderDigest(base));
  });
});
