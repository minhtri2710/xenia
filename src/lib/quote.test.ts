import { describe, expect, it } from "vitest";

import { MAX_COMPANY_LENGTH, MAX_QUANTITY, MAX_QUOTE_MESSAGE_CODE_POINTS, checkQuote, type QuoteFields } from "./quote";

const VALID: QuoteFields = {
  company: "  Công ty Mẫu  ",
  name: " Trần Thị Bình ",
  email: " Binh@Example.TEST ",
  phone: "090 123 4567",
  occasion: "tet",
  quantity: "120",
  budget: "1m-2m",
  message: "Giao trước Tết.\r\nCảm ơn.",
  privacy: true,
};

const errorsOf = (over: Partial<QuoteFields>) => {
  const result = checkQuote({ ...VALID, ...over });
  return result.ok ? {} : result.errors;
};

describe("checkQuote", () => {
  it("accepts a complete request and normalizes it", () => {
    expect(checkQuote(VALID)).toEqual({
      ok: true,
      quote: {
        company: "Công ty Mẫu",
        name: "Trần Thị Bình",
        email: "binh@example.test",
        phone: "0901234567",
        occasion: "tet",
        quantity: 120,
        budget: "1m-2m",
        message: "Giao trước Tết.\nCảm ơn.",
      },
    });
  });

  it("treats the budget and the message as optional", () => {
    const result = checkQuote({ ...VALID, budget: "", message: "   " });
    expect(result.ok && [result.quote.budget, result.quote.message]).toEqual([null, ""]);
  });

  it("reports every problem at once", () => {
    expect(errorsOf({ company: " ", name: "", email: "", phone: "", occasion: "", quantity: "", privacy: false })).toEqual({
      company: "companyRequired",
      name: "nameRequired",
      email: "emailRequired",
      phone: "phoneRequired",
      occasion: "occasionRequired",
      quantity: "quantityInvalid",
      privacy: "privacyRequired",
    });
  });

  it.each(["0", "-3", "1.5", "abc", String(MAX_QUANTITY + 1), "1e3"])("refuses the quantity %s", (quantity) => {
    expect(errorsOf({ quantity })).toEqual({ quantity: "quantityInvalid" });
  });

  it.each(["1", String(MAX_QUANTITY)])("accepts the quantity %s", (quantity) => {
    expect(errorsOf({ quantity })).toEqual({});
  });

  it("refuses an unknown occasion, budget, email or phone", () => {
    expect(errorsOf({ occasion: "birthday", budget: "cheap", email: "a@b", phone: "12345" })).toEqual({
      occasion: "occasionRequired",
      budget: "budgetInvalid",
      email: "emailInvalid",
      phone: "phoneInvalid",
    });
  });

  it("limits the company name and the message", () => {
    expect(errorsOf({ company: "x".repeat(MAX_COMPANY_LENGTH + 1) })).toEqual({ company: "companyTooLong" });
    expect(errorsOf({ message: "ạ".repeat(MAX_QUOTE_MESSAGE_CODE_POINTS) })).toEqual({});
    expect(errorsOf({ message: "ạ".repeat(MAX_QUOTE_MESSAGE_CODE_POINTS + 1) })).toEqual({ message: "messageTooLong" });
  });

  it("refuses control characters other than a line feed in the message", () => {
    expect(errorsOf({ message: "a\u0007b" })).toEqual({ message: "messageControl" });
    expect(errorsOf({ message: "a\nb" })).toEqual({});
  });
});
