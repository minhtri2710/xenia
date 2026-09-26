import { describe, expect, it } from "vitest";

import {
  isClientKey,
  isStatusToken,
  newClientKey,
  newOrderNumber,
  newStatusToken,
  ADMIN_ORDER_STATUSES,
  ORDER_NUMBER_ALPHABET,
  ORDER_STATUSES,
  PAYMENT_METHODS,
} from "./order";

describe("payment methods (Law 44/2019 Art. 16.4: cashless only)", () => {
  it("are exactly the mock VietQR transfer and the mock card", () => {
    expect(PAYMENT_METHODS).toEqual(["vietqr_mock", "card_mock"]);
  });

  it("have no cash-on-delivery value", () => {
    expect(PAYMENT_METHODS.filter((m) => /cod|cash|delivery/i.test(m))).toEqual([]);
  });
});

describe("order statuses", () => {
  it("are the fixed lifecycle", () => {
    expect(ORDER_STATUSES).toEqual(["placed", "paid", "packed", "out_for_delivery", "delivered", "id_check_failed", "cancelled", "returned", "expired"]);
    expect(ADMIN_ORDER_STATUSES).not.toContain("expired");
  });
});

describe("status token", () => {
  it("is 43 base64url characters (256 bits) and differs every time", () => {
    const tokens = Array.from({ length: 200 }, newStatusToken);
    for (const t of tokens) {
      expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(t, "base64url")).toHaveLength(32);
      expect(isStatusToken(t)).toBe(true);
    }
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it.each(["", "short", `${"a".repeat(42)}=`, "a".repeat(44), `${"a".repeat(42)}/`, `${"a".repeat(42)}.`])("rejects %j", (value) => {
    expect(isStatusToken(value)).toBe(false);
  });
});

describe("order number", () => {
  it("is XN-XXXX-XXXX in Crockford base32", () => {
    expect(ORDER_NUMBER_ALPHABET).toHaveLength(32);
    expect(ORDER_NUMBER_ALPHABET).not.toMatch(/[ILOU]/);
    for (let i = 0; i < 200; i++) expect(newOrderNumber()).toMatch(/^XN-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
  });
});

describe("client key", () => {
  it("is a v4 UUID", () => {
    expect(isClientKey(newClientKey())).toBe(true);
    expect(isClientKey("not-a-key")).toBe(false);
    expect(isClientKey(undefined)).toBe(false);
  });
});
