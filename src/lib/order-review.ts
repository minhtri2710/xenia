/**
 * What step 4 shows and placement stores, computed one way for both: the delivery date re-checked
 * at `now`, the wrap line and card re-resolved from stored packaging and card designs, the totals
 * and the digest. The caller supplies stored prices only; nothing here reads a posted value.
 */
import type { Buyer } from "./buyer";
import type { BottleSize } from "./catalogue";
import type { Delivery, GiftChoice } from "./checkout";
import { checkDeliveryDate, type DateError } from "./delivery";
import { type CardDoc, type PackagingDoc, wrapLine, type WrapLine } from "./gift";
import { orderDigest } from "./order-digest";
import { computeTotals, type Totals } from "./order-totals";

export type ReviewLine = { vintageId: number; qty: number; unitPriceVnd: number; bottleMl: BottleSize };

export type ReviewInput = {
  lines: ReviewLine[];
  buyer: Buyer;
  delivery: Delivery;
  gift: GiftChoice;
  zone: { feeVnd: number; leadDays: number } | undefined;
  blackoutDates: readonly string[];
  /** The packaging and card designs named by `gift`, as stored now (undefined when missing). */
  packaging: PackagingDoc | undefined;
  card: CardDoc | undefined;
  now: Date;
};

export type Review =
  | { ok: true; wrap: WrapLine | null; card: CardDoc | null; totals: Totals; digest: string }
  | { ok: false; step: "delivery"; error: "zone" | DateError }
  | { ok: false; step: "gift"; error: "packaging" | "card" };

export function reviewOrder({ lines, buyer, delivery, gift, zone, blackoutDates, packaging, card, now }: ReviewInput): Review {
  if (!zone) return { ok: false, step: "delivery", error: "zone" };
  const dateError = checkDeliveryDate(delivery.date, now, zone.leadDays, blackoutDates);
  if (dateError) return { ok: false, step: "delivery", error: dateError };

  const wrap = gift.packaging === null ? null : wrapLine(packaging, lines);
  if (wrap === "unavailable") return { ok: false, step: "gift", error: "packaging" };
  const isGift = delivery.mode === "gift";
  if (isGift && (!card || !card.active || card.code !== gift.card)) return { ok: false, step: "gift", error: "card" };

  const totals = computeTotals(lines, wrap ? wrap.units * wrap.unitPriceVnd : 0, zone.feeVnd);
  const digest = orderDigest({
    lines: lines.map((l) => ({ vintageId: l.vintageId, qty: l.qty, unitPriceVnd: l.unitPriceVnd })),
    buyer,
    zone: delivery.zone,
    feeVnd: zone.feeVnd,
    delivery: { mode: delivery.mode, recipient: delivery.recipient, date: delivery.date, window: delivery.window },
    wrap,
    gift: isGift ? { card: { code: card!.code, nameVi: card!.name.vi, nameEn: card!.name.en }, message: gift.message, sender: gift.sender, hidePrices: gift.hidePrices } : null,
    totals,
  });
  return { ok: true, wrap, card: isGift ? card! : null, totals, digest };
}
