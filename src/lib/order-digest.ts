import { createHash } from "node:crypto";

import type { Totals } from "@/lib/order-totals";

export type DigestInput = {
  lines: { vintageId: number; qty: number; unitPriceVnd: number }[];
  zone: string;
  feeVnd: number;
  totals: Totals;
};

/**
 * SHA-256 (hex) of the canonical priced order: lines sorted by vintage id as [id, qty, unit
 * price], the zone, its fee, and goods, shipping, VAT included and total. The review posts the
 * digest of what it showed; placement recomputes it from what it would store and refuses on a
 * mismatch (Law 122 Art. 12). Not a secret: a forged digest can only fail to match.
 */
export function orderDigest({ lines, zone, feeVnd, totals }: DigestInput): string {
  const canonical = JSON.stringify([
    [...lines].sort((a, b) => a.vintageId - b.vintageId).map((l) => [l.vintageId, l.qty, l.unitPriceVnd]),
    zone,
    feeVnd,
    [totals.goodsVnd, totals.shippingVnd, totals.vatIncludedVnd, totals.totalVnd],
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}
