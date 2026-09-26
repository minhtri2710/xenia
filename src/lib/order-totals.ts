/**
 * Order totals in whole VND, VAT included. The one place that adds money up: the review step
 * shows these values and order placement stores them, both recomputed on the server from stored
 * prices, the packaging price and the zone fee, never taken from the client.
 */

export const VAT_RATE_PCT = 10;

/** Display format for whole VND amounts. */
export const VND_FORMAT = { style: "currency", currency: "VND", maximumFractionDigits: 0 } as const;

export type TotalsLine = { qty: number; unitPriceVnd: number };

export type Totals = { goodsVnd: number; wrapVnd: number; shippingVnd: number; vatIncludedVnd: number; totalVnd: number };

function assertInteger(value: number, what: string, min: number) {
  if (!Number.isSafeInteger(value) || value < min) throw new RangeError(`${what} must be a whole number of at least ${min}, got ${value}.`);
}

/**
 * The VAT contained in a VAT-inclusive amount at VAT_RATE_PCT: amount × rate / (100 + rate),
 * rounded to the nearest whole VND. A tie cannot occur for whole-VND amounts at this rate.
 */
export function includedVat(amountVnd: number): number {
  assertInteger(amountVnd, "amount", 0);
  const divisor = 100 + VAT_RATE_PCT;
  return Math.floor((2 * amountVnd * VAT_RATE_PCT + divisor) / (2 * divisor));
}

/**
 * goods = Σ qty × unit price; wrap = packaging units × unit price (0 without packaging);
 * total = goods + wrap + shipping; VAT is the part of the total that is VAT.
 */
export function computeTotals(lines: TotalsLine[], wrapVnd: number, shippingVnd: number): Totals {
  if (lines.length === 0) throw new RangeError("An order needs at least one line.");
  let goodsVnd = 0;
  for (const { qty, unitPriceVnd } of lines) {
    assertInteger(qty, "qty", 1);
    assertInteger(unitPriceVnd, "unit price", 0);
    goodsVnd += qty * unitPriceVnd;
  }
  assertInteger(wrapVnd, "wrap", 0);
  assertInteger(shippingVnd, "shipping", 0);
  const totalVnd = goodsVnd + wrapVnd + shippingVnd;
  assertInteger(totalVnd, "total", 0);
  return { goodsVnd, wrapVnd, shippingVnd, vatIncludedVnd: includedVat(totalVnd), totalVnd };
}
