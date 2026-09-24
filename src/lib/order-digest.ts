import { createHash } from "node:crypto";

import type { Buyer } from "@/lib/buyer";
import type { Totals } from "@/lib/order-totals";

export type DigestInput = {
  lines: { vintageId: number; qty: number; unitPriceVnd: number }[];
  buyer: Buyer;
  zone: string;
  feeVnd: number;
  totals: Totals;
};

/**
 * SHA-256 (hex) of the canonical order step 4 shows: lines sorted by vintage id as [id, qty, unit
 * price], the buyer as [name, phone, email, address], the zone, its fee, and goods, shipping, VAT
 * included and total. The review posts the digest of what it showed; placement recomputes it from
 * what it would store and refuses on a mismatch (Law 122 Art. 12). The buyer is hashed exactly as
 * stored, with no normalization. Not a secret: a forged digest can only fail to match.
 */
export function orderDigest({ lines, buyer, zone, feeVnd, totals }: DigestInput): string {
  const canonical = JSON.stringify([
    [...lines].sort((a, b) => a.vintageId - b.vintageId).map((l) => [l.vintageId, l.qty, l.unitPriceVnd]),
    [buyer.name, buyer.phone, buyer.email, buyer.address],
    zone,
    feeVnd,
    [totals.goodsVnd, totals.shippingVnd, totals.vatIncludedVnd, totals.totalVnd],
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}
