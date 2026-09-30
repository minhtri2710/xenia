import { describe, expect, it } from "vitest";

import type { CardDoc, PackagingDoc } from "./gift";
import { orderDigest } from "./order-digest";
import { type ReviewInput, reviewOrder } from "./order-review";

const box2: PackagingDoc = {
  code: "box-2",
  name: { vi: "Hộp cứng đôi", en: "Two-bottle box" },
  description: { vi: "", en: "" },
  capacity: 2,
  fits: [750],
  priceVnd: 200_000,
  active: true,
};
const tet: CardDoc = { code: "tet", name: { vi: "Tết", en: "Tết" }, active: true };

// 10:00 in Hồ Chí Minh City on 25 September; lead 1 day → earliest 26 September, latest 26 October.
const base: ReviewInput = {
  lines: [
    { vintageId: 7, qty: 1, unitPriceVnd: 720_000, bottleMl: 750 },
    { vintageId: 3, qty: 2, unitPriceVnd: 480_000, bottleMl: 750 },
  ],
  buyer: { name: "Nguyễn Văn An", phone: "0901234567", email: "an@example.test", address: "12 Lê Lợi, Quận 1" },
  delivery: { zone: "hcmc", mode: "gift", recipient: { name: "Trần Thị Bình", phone: "0912345678", address: "5 Hàng Bài" }, date: "2026-10-02", window: "morning" },
  gift: { packaging: "box-2", card: "tet", message: "Chúc mừng", sender: "An", hidePrices: true },
  zone: { feeVnd: 30_000, leadDays: 1 },
  blackoutDates: [],
  packaging: box2,
  card: tet,
  customerId: null,
  now: new Date("2026-09-25T03:00:00Z"),
};

describe("reviewOrder", () => {
  it("prices the wrap from stored packaging: 3 bottles in a 2-bottle box is 2 units", () => {
    const review = reviewOrder(base);
    expect(review).toMatchObject({
      ok: true,
      wrap: { code: "box-2", units: 2, unitPriceVnd: 200_000 },
      card: tet,
      totals: { goodsVnd: 1_680_000, wrapVnd: 400_000, shippingVnd: 30_000, totalVnd: 2_110_000, vatIncludedVnd: 191_818 },
    });
  });

  it("digests exactly what step 4 shows", () => {
    const review = reviewOrder(base);
    if (!review.ok) throw new Error("expected ok");
    expect(review.digest).toBe(
      orderDigest({
        lines: base.lines.map(({ vintageId, qty, unitPriceVnd }) => ({ vintageId, qty, unitPriceVnd })),
        buyer: base.buyer,
        zone: "hcmc",
        feeVnd: 30_000,
        delivery: { mode: "gift", recipient: base.delivery.recipient, date: "2026-10-02", window: "morning" },
        wrap: { code: "box-2", nameVi: "Hộp cứng đôi", nameEn: "Two-bottle box", units: 2, unitPriceVnd: 200_000 },
        gift: { card: { code: "tet", nameVi: "Tết", nameEn: "Tết" }, message: "Chúc mừng", sender: "An", hidePrices: true },
        totals: review.totals,
        customerId: null,
      }),
    );
  });

  it("digests the account the order will be saved to", () => {
    const guest = reviewOrder(base);
    const account = reviewOrder({ ...base, customerId: 5 });
    if (!guest.ok || !account.ok) throw new Error("expected ok");
    expect(account.digest).not.toBe(guest.digest);
  });

  it("has no wrap and no gift part in self mode without packaging", () => {
    const review = reviewOrder({
      ...base,
      delivery: { ...base.delivery, mode: "self", recipient: null },
      gift: { packaging: null, card: null, message: "", sender: null, hidePrices: false },
      packaging: undefined,
      card: undefined,
    });
    expect(review).toMatchObject({ ok: true, wrap: null, card: null, totals: { wrapVnd: 0, totalVnd: 1_710_000 } });
  });

  it("refuses a missing zone, an out-of-range date and a blackout date at `now`", () => {
    expect(reviewOrder({ ...base, zone: undefined })).toEqual({ ok: false, step: "delivery", error: "zone" });
    expect(reviewOrder({ ...base, now: new Date("2026-10-02T03:00:00Z") })).toEqual({ ok: false, step: "delivery", error: "dateTooEarly" });
    expect(reviewOrder({ ...base, blackoutDates: ["2026-10-02"] })).toEqual({ ok: false, step: "delivery", error: "dateBlackout" });
  });

  it("refuses packaging that is missing, inactive or does not fit every bottle size", () => {
    const refused = { ok: false, step: "gift", error: "packaging" };
    expect(reviewOrder({ ...base, packaging: undefined })).toEqual(refused);
    expect(reviewOrder({ ...base, packaging: { ...box2, active: false } })).toEqual(refused);
    expect(reviewOrder({ ...base, lines: [...base.lines, { vintageId: 9, qty: 1, unitPriceVnd: 900_000, bottleMl: 1500 }] })).toEqual(refused);
  });

  it("refuses a gift whose card is missing, inactive or another code", () => {
    const refused = { ok: false, step: "gift", error: "card" };
    expect(reviewOrder({ ...base, card: undefined })).toEqual(refused);
    expect(reviewOrder({ ...base, card: { ...tet, active: false } })).toEqual(refused);
    expect(reviewOrder({ ...base, card: { ...tet, code: "plain" } })).toEqual(refused);
  });
});
