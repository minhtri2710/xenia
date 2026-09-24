import { describe, expect, it } from "vitest";

import { newCheckout, parseCheckout, serializeCheckout } from "./checkout";

const KEY = "0b6f3a52-6a61-4c1e-9d2e-3f1f6f0b9a11";
const BUYER = { name: "Nguyễn Văn An", phone: "0901234567", email: "an@example.test", address: "12 Lê Lợi, Quận 1" };
const AT = "2026-09-24T03:00:00.000Z";

describe("parseCheckout", () => {
  it("round-trips the key, buyer, attestation and zone", () => {
    const state = { key: KEY, buyer: BUYER, attestedAt: AT, zone: "hcmc" as const };
    expect(parseCheckout(serializeCheckout(state))).toEqual(state);
  });

  it("starts a checkout with a fresh key only", () => {
    const state = newCheckout();
    expect(Object.keys(state)).toEqual(["key"]);
    expect(parseCheckout(serializeCheckout(state))).toEqual(state);
  });

  it.each([undefined, "", "{", "null", "[]", '{"key":"nope"}', '{"key":"0b6f3a52-6a61-1c1e-9d2e-3f1f6f0b9a11"}'])("rejects %j", (raw) => {
    expect(parseCheckout(raw)).toBeNull();
  });

  it("drops an invalid buyer together with its attestation, and an unknown zone", () => {
    expect(parseCheckout(JSON.stringify({ key: KEY, buyer: { ...BUYER, phone: "12" }, attestedAt: AT, zone: "danang" }))).toEqual({ key: KEY });
  });

  it("drops a buyer without a valid attestation instant", () => {
    expect(parseCheckout(JSON.stringify({ key: KEY, buyer: BUYER, attestedAt: "yesterday" }))).toEqual({ key: KEY });
    expect(parseCheckout(JSON.stringify({ key: KEY, buyer: BUYER }))).toEqual({ key: KEY });
  });

  it("keeps no field it does not know, such as a date of birth", () => {
    expect(parseCheckout(JSON.stringify({ key: KEY, buyer: { ...BUYER, dob: "1990-01-01" }, attestedAt: AT, dob: "1990-01-01" }))).toEqual({
      key: KEY,
      buyer: BUYER,
      attestedAt: AT,
    });
  });
});
