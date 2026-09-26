export const LEGAL_AGE = 18;
export const MAX_NAME_LENGTH = 200;
const MIN_BIRTH_YEAR = 1900;

type CalendarDate = { year: number; month: number; day: number };

export type DeclarationError = {
  name?: "nameRequired" | "nameTooLong";
  dob?: "dobRequired" | "dobInvalid" | "dobFuture";
};

export type DeclarationResult =
  | { ok: true; adult: boolean }
  | { ok: false; errors: DeclarationError };

const vietnamDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The calendar date in Asia/Ho_Chi_Minh at the instant `now`. */
export function vietnamToday(now: Date): CalendarDate {
  const parts = vietnamDateFormat.formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day") };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

function ordinal({ year, month, day }: CalendarDate): number {
  return year * 10_000 + month * 100 + day;
}

/** Parses a strict `YYYY-MM-DD` value (what `<input type="date">` submits). */
export function parseDateOfBirth(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  if (year < MIN_BIRTH_YEAR || month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/**
 * Whether someone born on `dob` is at least LEGAL_AGE on the Vietnamese calendar date at `now`.
 * The 18th birthday counts as adult. A 29 February birthday reaches 18 on 1 March
 * when the 18th year is not a leap year.
 */
export function isAdult(dob: CalendarDate, now: Date): boolean {
  const year = dob.year + LEGAL_AGE;
  const leapDayInCommonYear = dob.month === 2 && dob.day === 29 && !isLeapYear(year);
  const birthday = leapDayInCommonYear ? { year, month: 3, day: 1 } : { ...dob, year };
  return ordinal(vietnamToday(now)) >= ordinal(birthday);
}

/** Validates the gate declaration. Invalid input is an error, never a refusal. */
export function checkDeclaration(name: string, dobValue: string, now: Date): DeclarationResult {
  const errors: DeclarationError = {};
  const trimmedName = name.trim();
  if (!trimmedName) errors.name = "nameRequired";
  else if (trimmedName.length > MAX_NAME_LENGTH) errors.name = "nameTooLong";

  const dob = parseDateOfBirth(dobValue.trim());
  if (!dobValue.trim()) errors.dob = "dobRequired";
  else if (!dob) errors.dob = "dobInvalid";
  else if (ordinal(dob) > ordinal(vietnamToday(now))) errors.dob = "dobFuture";

  if (errors.name || errors.dob || !dob) return { ok: false, errors };
  return { ok: true, adult: isAdult(dob, now) };
}
