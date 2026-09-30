import { describe, expect, it } from "vitest";

import {
  ACCOUNT_COOKIE,
  ACCOUNT_ROUTES,
  checkEmail,
  checkPassword,
  checkProfile,
  checkRegistration,
  PASSWORD_MAX_CODE_POINTS,
  PASSWORD_MIN_CODE_POINTS,
} from "./accounts";

// 2026-09-24 in Asia/Ho_Chi_Minh.
const NOW = new Date("2026-09-24T03:00:00Z");
const ADULT = "1990-05-17";
const UNDER = "2010-01-01";
const good = { email: "Buyer@Example.com ", password: "a".repeat(PASSWORD_MIN_CODE_POINTS), name: "An Nguyen", dob: ADULT, terms: true, privacy: true };

describe("checkPassword", () => {
  it("counts code points, not UTF-16 units: an emoji is one", () => {
    expect(checkPassword("😀".repeat(PASSWORD_MIN_CODE_POINTS))).toBeNull();
    expect(checkPassword("😀".repeat(PASSWORD_MIN_CODE_POINTS - 1))).toBe("passwordTooShort");
    expect(checkPassword("😀".repeat(PASSWORD_MAX_CODE_POINTS))).toBeNull();
    expect(checkPassword("😀".repeat(PASSWORD_MAX_CODE_POINTS + 1))).toBe("passwordTooLong");
  });

  it("has its bounds at exactly 15 and 128", () => {
    expect(PASSWORD_MIN_CODE_POINTS).toBe(15);
    expect(PASSWORD_MAX_CODE_POINTS).toBe(128);
    expect(checkPassword("a".repeat(14))).toBe("passwordTooShort");
    expect(checkPassword("a".repeat(15))).toBeNull();
    expect(checkPassword("a".repeat(128))).toBeNull();
    expect(checkPassword("a".repeat(129))).toBe("passwordTooLong");
  });

  it("does not trim: spaces count", () => {
    expect(checkPassword(" ".repeat(15))).toBeNull();
  });
});

describe("checkEmail", () => {
  it("trims and lowercases, and refuses empty and malformed values", () => {
    expect(checkEmail("  Buyer@Example.COM ")).toEqual({ ok: true, email: "buyer@example.com" });
    expect(checkEmail("  ")).toEqual({ ok: false, error: "emailRequired" });
    expect(checkEmail("no-at-sign")).toEqual({ ok: false, error: "emailInvalid" });
  });
});

describe("checkRegistration", () => {
  it("accepts an adult with both consents and returns the normalised email but no date of birth", () => {
    const result = checkRegistration(good, NOW);
    expect(result).toEqual({ ok: true, email: "buyer@example.com", password: good.password, name: "An Nguyen" });
    expect(JSON.stringify(result)).not.toContain(ADULT);
  });

  it("refuses under 18 as `underage`, whatever else is wrong", () => {
    expect(checkRegistration({ ...good, dob: UNDER }, NOW)).toMatchObject({ ok: false, underage: true });
    expect(checkRegistration({ ...good, dob: UNDER, password: "x", email: "", terms: false, privacy: false }, NOW)).toMatchObject({ ok: false, underage: true });
  });

  it("accepts the 18th birthday itself and refuses the day before", () => {
    expect(checkRegistration({ ...good, dob: "2008-09-24" }, NOW)).toMatchObject({ ok: true });
    expect(checkRegistration({ ...good, dob: "2008-09-25" }, NOW)).toMatchObject({ ok: false, underage: true });
  });

  it("requires each consent on its own", () => {
    expect(checkRegistration({ ...good, terms: false }, NOW)).toMatchObject({ ok: false, underage: false, errors: { terms: "consentRequired" } });
    expect(checkRegistration({ ...good, privacy: false }, NOW)).toMatchObject({ ok: false, underage: false, errors: { privacy: "consentRequired" } });
  });

  it("reports a bad date, name, email and password as field errors, not as underage", () => {
    const result = checkRegistration({ ...good, dob: "", name: "", email: "x", password: "short" }, NOW);
    expect(result).toMatchObject({ ok: false, underage: false, errors: { dob: "dobRequired", name: "nameRequired", email: "emailInvalid", password: "passwordTooShort" } });
  });
});

describe("checkProfile", () => {
  it("allows an empty profile and refuses a bad phone or a long name", () => {
    expect(checkProfile({ name: "", phone: "", address: "" }, 10)).toMatchObject({ ok: true });
    expect(checkProfile({ name: "n".repeat(11), phone: "abc", address: "" }, 10)).toMatchObject({ ok: false, errors: { name: "nameTooLong", phone: "phoneInvalid" } });
  });
});

describe("account constants", () => {
  it("keeps the account cookie apart from Payload's and every route under /tai-khoan", () => {
    expect(ACCOUNT_COOKIE).not.toBe("payload-token");
    for (const route of Object.values(ACCOUNT_ROUTES)) expect(route.startsWith("/tai-khoan/")).toBe(true);
  });
});
