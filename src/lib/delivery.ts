/**
 * Delivery for every order (step 2): self or gift, a date and a window. Dates are calendar dates
 * on the Asia/Ho_Chi_Minh calendar, as `YYYY-MM-DD`. The current instant is always a parameter;
 * nothing here reads the clock.
 */
import { vietnamToday } from "./age";

export const DELIVERY_MODES = ["self", "gift"] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export const DELIVERY_WINDOWS = ["morning", "afternoon", "evening"] as const;
export type DeliveryWindow = (typeof DELIVERY_WINDOWS)[number];

/** The latest date offered is the earliest plus this many days. */
export const HORIZON_DAYS = 30;

export const DATE_ERRORS = ["dateRequired", "dateInvalid", "dateTooEarly", "dateTooLate", "dateBlackout"] as const;
export type DateError = (typeof DATE_ERRORS)[number];

export const isDeliveryMode = (value: unknown): value is DeliveryMode => DELIVERY_MODES.includes(value as DeliveryMode);
export const isDeliveryWindow = (value: unknown): value is DeliveryWindow => DELIVERY_WINDOWS.includes(value as DeliveryWindow);

const DAY_MS = 86_400_000;

/** Days since 1970-01-01 of a real `YYYY-MM-DD` calendar date, or `null`. */
function dayNumber(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const ms = Date.UTC(year, month - 1, day);
  const date = new Date(ms);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return ms / DAY_MS;
}

const isoDate = (days: number) => new Date(days * DAY_MS).toISOString().slice(0, 10);

export const isIsoDate = (value: unknown): value is string => typeof value === "string" && dayNumber(value) !== null;

/** Earliest = today in Asia/Ho_Chi_Minh at `now` + `leadDays`; latest = earliest + HORIZON_DAYS. */
export function deliveryRange(now: Date, leadDays: number): { earliest: string; latest: string } {
  if (!Number.isSafeInteger(leadDays) || leadDays < 1) throw new RangeError(`leadDays must be a whole number of at least 1, got ${leadDays}.`);
  const { year, month, day } = vietnamToday(now);
  const earliest = Date.UTC(year, month - 1, day) / DAY_MS + leadDays;
  return { earliest: isoDate(earliest), latest: isoDate(earliest + HORIZON_DAYS) };
}

/** `null` when `value` is a date inside the range at `now` and not a blackout date. */
export function checkDeliveryDate(value: string, now: Date, leadDays: number, blackoutDates: readonly string[]): DateError | null {
  if (!value.trim()) return "dateRequired";
  const day = dayNumber(value.trim());
  if (day === null) return "dateInvalid";
  const { earliest, latest } = deliveryRange(now, leadDays);
  if (day < dayNumber(earliest)!) return "dateTooEarly";
  if (day > dayNumber(latest)!) return "dateTooLate";
  if (blackoutDates.includes(isoDate(day))) return "dateBlackout";
  return null;
}
