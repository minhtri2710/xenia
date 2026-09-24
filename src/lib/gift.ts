/**
 * Gift options (step 3): packaging for any order; card, message, sender and hide prices for a
 * gift. Wrap is a paid service with no free tier (Law 44/2019 Art. 5.9): every packaging price is
 * at least 1 VND, and units and price are computed on the server from stored values.
 */
import type { BottleSize } from "./catalogue";

export const MAX_MESSAGE_CODE_POINTS = 250;

/** Packaging and card codes: lower-case letters, digits and hyphens. */
export const isCode = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9-]{1,40}$/.test(value);

export type MessageError = "messageTooLong" | "messageControl";

/**
 * The message as stored: line breaks as sent by a form (CRLF or CR) become LF, then NFC. At most
 * MAX_MESSAGE_CODE_POINTS code points after NFC; no control character except line feed.
 */
export function checkMessage(raw: string): { ok: true; message: string } | { ok: false; error: MessageError } {
  const message = raw.replace(/\r\n?/g, "\n").normalize("NFC");
  if (/[^\P{Cc}\n]/u.test(message)) return { ok: false, error: "messageControl" };
  if ([...message].length > MAX_MESSAGE_CODE_POINTS) return { ok: false, error: "messageTooLong" };
  return { ok: true, message };
}

function assertCount(value: number, what: string) {
  if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${what} must be a whole number of at least 1, got ${value}.`);
}

/** Packaging units for the whole order: ceil(bottles / capacity). */
export function wrapUnits(bottles: number, capacity: number): number {
  assertCount(bottles, "bottles");
  assertCount(capacity, "capacity");
  return Math.ceil(bottles / capacity);
}

/** A packaging fits the order when it fits every bottle size in the cart. */
export const fitsEverySize = (fits: readonly BottleSize[], sizes: readonly BottleSize[]): boolean => sizes.every((s) => fits.includes(s));

export type PackagingDoc = {
  code: string;
  name: { vi: string; en: string };
  description: { vi: string; en: string };
  capacity: number;
  fits: BottleSize[];
  priceVnd: number;
  active: boolean;
};

export type CardDoc = { code: string; name: { vi: string; en: string }; active: boolean };

export type WrapLine = { code: string; nameVi: string; nameEn: string; units: number; unitPriceVnd: number };

/**
 * The wrap line for the whole order, or `null` without packaging. A packaging that is missing,
 * inactive or does not fit every bottle size in the cart is refused (`"unavailable"`).
 */
export function wrapLine(packaging: PackagingDoc | undefined, lines: readonly { qty: number; bottleMl: BottleSize }[]): WrapLine | "unavailable" {
  if (!packaging || !packaging.active) return "unavailable";
  if (!fitsEverySize(packaging.fits, lines.map((l) => l.bottleMl))) return "unavailable";
  const bottles = lines.reduce((sum, l) => sum + l.qty, 0);
  return {
    code: packaging.code,
    nameVi: packaging.name.vi,
    nameEn: packaging.name.en,
    units: wrapUnits(bottles, packaging.capacity),
    unitPriceVnd: packaging.priceVnd,
  };
}
