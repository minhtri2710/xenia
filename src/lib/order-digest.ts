import { createHash } from "node:crypto";

import type { Buyer, Recipient } from "@/lib/buyer";
import type { Totals } from "@/lib/order-totals";

export type DigestInput = {
  lines: { vintageId: number; qty: number; unitPriceVnd: number }[];
  buyer: Buyer;
  zone: string;
  feeVnd: number;
  delivery: { mode: string; recipient: Recipient | null; date: string; window: string };
  wrap: { code: string; nameVi: string; nameEn: string; units: number; unitPriceVnd: number } | null;
  gift: { card: { code: string; nameVi: string; nameEn: string }; message: string; sender: string | null; hidePrices: boolean } | null;
  totals: Totals;
};

/**
 * SHA-256 (hex) of the canonical order step 4 shows: lines sorted by vintage id as [id, qty, unit
 * price], the buyer as [name, phone, email, address], the zone, its fee, the delivery as [mode,
 * recipient [name, phone, address] or null, date, window], the packaging as [code, name vi, name
 * en, units, unit price] or null, the gift as [card [code, name vi, name en], message, sender or
 * null for anonymous, hide prices] or null, and goods, wrap, shipping, VAT included and total.
 * The review posts the digest of what it showed; placement recomputes it from what it would store
 * and refuses on a mismatch (Law 122 Art. 12). Every value is hashed exactly as stored, with no
 * normalization. Not a secret: a forged digest can only fail to match.
 */
export function orderDigest({ lines, buyer, zone, feeVnd, delivery, wrap, gift, totals }: DigestInput): string {
  const r = delivery.recipient;
  const canonical = JSON.stringify([
    [...lines].sort((a, b) => a.vintageId - b.vintageId).map((l) => [l.vintageId, l.qty, l.unitPriceVnd]),
    [buyer.name, buyer.phone, buyer.email, buyer.address],
    zone,
    feeVnd,
    [delivery.mode, r ? [r.name, r.phone, r.address] : null, delivery.date, delivery.window],
    wrap ? [wrap.code, wrap.nameVi, wrap.nameEn, wrap.units, wrap.unitPriceVnd] : null,
    gift ? [[gift.card.code, gift.card.nameVi, gift.card.nameEn], gift.message, gift.sender, gift.hidePrices] : null,
    [totals.goodsVnd, totals.wrapVnd, totals.shippingVnd, totals.vatIncludedVnd, totals.totalVnd],
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}
