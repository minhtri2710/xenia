import { describe, expect, it } from "vitest";

import { checkDeclaration, isAdult, parseDateOfBirth, vietnamToday } from "./age";

// 2026-09-23T17:30:00Z is 2026-09-24 00:30 in Asia/Ho_Chi_Minh (UTC+7).
const UTC_DAY_BEFORE_VN = new Date("2026-09-23T17:30:00Z");

describe("vietnamToday", () => {
  it("uses the Vietnamese calendar date while the UTC date is still the day before", () => {
    expect(vietnamToday(UTC_DAY_BEFORE_VN)).toEqual({ year: 2026, month: 9, day: 24 });
  });
});

describe("isAdult", () => {
  it("allows an 18th birthday today in Vietnam while the UTC date is still the day before", () => {
    expect(isAdult({ year: 2008, month: 9, day: 24 }, UTC_DAY_BEFORE_VN)).toBe(true);
  });

  it("refuses the day before the 18th birthday", () => {
    expect(isAdult({ year: 2008, month: 9, day: 25 }, UTC_DAY_BEFORE_VN)).toBe(false);
  });

  it("allows someone well over 18", () => {
    expect(isAdult({ year: 1980, month: 1, day: 1 }, UTC_DAY_BEFORE_VN)).toBe(true);
  });

  it("makes a 29 February birthday reach 18 on 1 March in a non-leap year", () => {
    const dob = { year: 2008, month: 2, day: 29 };
    expect(isAdult(dob, new Date("2026-02-28T12:00:00+07:00"))).toBe(false);
    expect(isAdult(dob, new Date("2026-03-01T00:00:00+07:00"))).toBe(true);
  });

  it("makes a 29 February birthday reach 18 on 29 February in a leap year", () => {
    const dob = { year: 2010, month: 2, day: 29 };
    expect(isAdult(dob, new Date("2028-02-28T12:00:00+07:00"))).toBe(false);
    expect(isAdult(dob, new Date("2028-02-29T00:00:00+07:00"))).toBe(true);
  });
});

describe("parseDateOfBirth", () => {
  it.each(["", "2000-1-1", "01/02/2000", "2000-13-01", "2000-02-30", "2001-02-29", "1899-12-31", "abc"])(
    "rejects %j",
    (value) => {
      expect(parseDateOfBirth(value)).toBeNull();
    },
  );

  it("accepts a leap day in a leap year", () => {
    expect(parseDateOfBirth("2000-02-29")).toEqual({ year: 2000, month: 2, day: 29 });
  });
});

describe("checkDeclaration", () => {
  it("accepts an adult", () => {
    expect(checkDeclaration("Nguyễn Văn An", "2000-05-01", UTC_DAY_BEFORE_VN)).toEqual({ ok: true, adult: true });
  });

  it("returns a minor as valid but not adult", () => {
    expect(checkDeclaration("Trần Thị Bình", "2010-05-01", UTC_DAY_BEFORE_VN)).toEqual({ ok: true, adult: false });
  });

  it.each(["", "   ", "\t\n"])("rejects the blank or whitespace name %j", (name) => {
    expect(checkDeclaration(name, "2000-05-01", UTC_DAY_BEFORE_VN)).toEqual({
      ok: false,
      errors: { name: "nameRequired" },
    });
  });

  it("rejects an over-long name", () => {
    expect(checkDeclaration("a".repeat(201), "2000-05-01", UTC_DAY_BEFORE_VN)).toEqual({
      ok: false,
      errors: { name: "nameTooLong" },
    });
  });

  it("rejects a future date of birth as invalid input, not a refusal", () => {
    expect(checkDeclaration("An", "2026-09-25", UTC_DAY_BEFORE_VN)).toEqual({
      ok: false,
      errors: { dob: "dobFuture" },
    });
  });

  it("judges the future on the Vietnamese date, not UTC", () => {
    // Already 24 September in Vietnam, so a DOB of 24 September is not in the future.
    expect(checkDeclaration("An", "2026-09-24", UTC_DAY_BEFORE_VN)).toEqual({ ok: true, adult: false });
  });

  it("rejects an unparseable date", () => {
    expect(checkDeclaration("An", "not-a-date", UTC_DAY_BEFORE_VN)).toEqual({
      ok: false,
      errors: { dob: "dobInvalid" },
    });
  });

  it("rejects a missing date and a blank name together", () => {
    expect(checkDeclaration(" ", "", UTC_DAY_BEFORE_VN)).toEqual({
      ok: false,
      errors: { name: "nameRequired", dob: "dobRequired" },
    });
  });
});
