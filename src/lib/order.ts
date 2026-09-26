/**
 * Order vocabularies and identifiers. Payment is cashless only (Law 44/2019 Art. 16.4): the method
 * enum has a mock VietQR bank transfer and a mock card and nothing else; there is no cash on
 * delivery. The mock never asks for a card or bank account number.
 */
import { randomBytes, randomUUID } from "node:crypto";

export const PAYMENT_METHODS = ["vietqr_mock", "card_mock"] as const;
export const ORDER_RETENTION_YEARS = 3;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ["unpaid", "failed", "paid"] as const;

export const ORDER_STATUSES = [
  "placed",
  "paid",
  "packed",
  "out_for_delivery",
  "delivered",
  "id_check_failed",
  "cancelled",
  "returned",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Delivery zones with a flat fee each; the fees live in the `site-settings` global. */
export const ZONES = ["hcmc", "hanoi"] as const;
export type Zone = (typeof ZONES)[number];

export const isZone = (value: unknown): value is Zone => ZONES.includes(value as Zone);
export const isPaymentMethod = (value: unknown): value is PaymentMethod => PAYMENT_METHODS.includes(value as PaymentMethod);

/** The status link's secret: 256 bits from the CSPRNG, base64url (43 characters). */
export function newStatusToken(): string {
  return randomBytes(32).toString("base64url");
}

export const isStatusToken = (value: string): boolean => /^[A-Za-z0-9_-]{43}$/.test(value);

/** Crockford base32: no I, L, O or U, so a number read aloud or copied by hand stays unambiguous. */
export const ORDER_NUMBER_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * A human-readable order number, `XN-XXXX-XXXX`: 40 random bits. The `number` column is unique;
 * a collision fails the placement closed instead of retrying.
 */
export function newOrderNumber(): string {
  // 256 is a multiple of 32, so `byte % 32` is unbiased.
  const chars = [...randomBytes(8)].map((b) => ORDER_NUMBER_ALPHABET[b % 32]).join("");
  return `XN-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** The idempotency key for one checkout: a v4 UUID, created with the checkout state. */
export const newClientKey = (): string => randomUUID();

export const isClientKey = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
