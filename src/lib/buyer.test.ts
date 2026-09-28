import { describe, expect, it } from "vitest";

import { checkBuyer, checkContact, checkRecipient, normalizePhone } from "./buyer";

// 2026-09-24 10:00 in Asia/Ho_Chi_Minh.
const NOW = new Date("2026-09-24T03:00:00Z");

const VALID = {
  name: " Nguyễn Văn An ",
  dob: "1990-05-01",
  phone: "090 123 4567",
  email: " an@example.test ",
  address: " 12 Lê Lợi, Quận 1, TP.HCM ",
};

describe("checkBuyer", () => {
  it("accepts an adult and trims and normalises the contact fields, without the date of birth", () => {
    const result = checkBuyer(VALID, NOW);
    expect(result).toEqual({
      ok: true,
      adult: true,
      buyer: { name: "Nguyễn Văn An", phone: "0901234567", email: "an@example.test", address: "12 Lê Lợi, Quận 1, TP.HCM" },
    });
    expect(JSON.stringify(result)).not.toContain("1990");
  });

  it("is not adult the day before the 18th birthday", () => {
    expect(checkBuyer({ ...VALID, dob: "2008-09-25" }, NOW)).toMatchObject({ ok: true, adult: false });
  });

  it("reports every blank field", () => {
    expect(checkBuyer({ name: " ", dob: "", phone: "", email: " ", address: "\t" }, NOW)).toEqual({
      ok: false,
      errors: {
        name: "nameRequired",
        dob: "dobRequired",
        phone: "phoneRequired",
        email: "emailRequired",
        address: "addressRequired",
      },
    });
  });

  it("reports invalid and future dates of birth as field errors", () => {
    expect(checkBuyer({ ...VALID, dob: "1990-02-30" }, NOW)).toEqual({ ok: false, errors: { dob: "dobInvalid" } });
    expect(checkBuyer({ ...VALID, dob: "2026-09-25" }, NOW)).toEqual({ ok: false, errors: { dob: "dobFuture" } });
  });

  it("reports invalid phone and email", () => {
    expect(checkBuyer({ ...VALID, phone: "12345", email: "an@example" }, NOW)).toEqual({
      ok: false,
      errors: { phone: "phoneInvalid", email: "emailInvalid" },
    });
  });

  it("reports an address that is too long", () => {
    expect(checkBuyer({ ...VALID, address: "x".repeat(501) }, NOW)).toEqual({ ok: false, errors: { address: "addressTooLong" } });
  });
});

describe("checkContact", () => {
  it("validates without a date of birth", () => {
    expect(checkContact({ name: "An", phone: "+84 90 123 4567", email: "a@b.vn", address: "Hà Nội" })).toEqual({
      ok: true,
      buyer: { name: "An", phone: "0901234567", email: "a@b.vn", address: "Hà Nội" },
    });
  });

  it("accepts a 254-character email and refuses a 255-character one", () => {
    const contact = { name: "An", phone: "0901234567", address: "Hà Nội" };
    const email = (length: number) => `a@${"b".repeat(length - 7)}.test`;
    expect(checkContact({ ...contact, email: email(254) }).ok).toBe(true);
    expect(checkContact({ ...contact, email: email(255) })).toEqual({ ok: false, errors: { email: "emailInvalid" } });
  });
});

describe("normalizePhone", () => {
  it.each([
    ["0901234567", "0901234567"],
    ["+84901234567", "0901234567"],
    ["090.123.4567", "0901234567"],
    ["090-123-4567", "0901234567"],
    ["0012345678", null],
    ["090123456", null],
    ["09012345678", null],
    ["84901234567", null],
    ["090123456a", null],
  ])("%s → %s", (value, phone) => {
    expect(normalizePhone(value)).toBe(phone);
  });
});

describe("checkRecipient", () => {
  it("trims and normalises under the buyer's rules, without an email", () => {
    expect(checkRecipient({ name: " Trần Thị Bình ", phone: "+84 912.345.678", address: " 5 Hàng Bài " })).toEqual({
      ok: true,
      recipient: { name: "Trần Thị Bình", phone: "0912345678", address: "5 Hàng Bài" },
    });
  });

  it("requires name, phone and address", () => {
    expect(checkRecipient({ name: " ", phone: "", address: "" })).toEqual({
      ok: false,
      errors: { name: "nameRequired", phone: "phoneRequired", address: "addressRequired" },
    });
  });

  it("applies the buyer's length and phone rules", () => {
    expect(checkRecipient({ name: "ệ".repeat(201), phone: "12345", address: "ệ".repeat(501) })).toEqual({
      ok: false,
      errors: { name: "nameTooLong", phone: "phoneInvalid", address: "addressTooLong" },
    });
    expect(checkRecipient({ name: "ệ".repeat(200), phone: "0912345678", address: "ệ".repeat(500) }).ok).toBe(true);
  });
});
