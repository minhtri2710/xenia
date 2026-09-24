import { describe, expect, it } from "vitest";

import { CHECKOUT_COOKIE, checkoutCookie, cookieOptions, newCheckout, newHandle, parseCheckout } from "./checkout";

const KEY = "0b6f3a52-6a61-4c1e-9d2e-3f1f6f0b9a11";
const BUYER = { name: "Nguyễn Văn An", phone: "0901234567", email: "an@example.test", address: "12 Lê Lợi, Quận 1" };
const AT = "2026-09-24T03:00:00.000Z";
const RECIPIENT = { name: "Trần Thị Bình", phone: "0912345678", address: "5 Hàng Bài, Hoàn Kiếm" };
const GIFT_DELIVERY = { zone: "hanoi", mode: "gift", recipient: RECIPIENT, date: "2026-10-02", window: "morning" } as const;
const SELF_DELIVERY = { zone: "hcmc", mode: "self", recipient: null, date: "2026-10-02", window: "evening" } as const;
const GIFT = { packaging: "box-2", card: "tet", message: "Chúc mừng\nnăm mới", sender: "An", hidePrices: true };
const SELF_GIFT = { packaging: "silk", card: null, message: "", sender: null, hidePrices: false };
const saved = (g: object) => ({ saved: true, ...g });

describe("parseCheckout", () => {
  it("round-trips the key, buyer, attestation, gift delivery and gift options", () => {
    const state = { clientKey: KEY, buyer: BUYER, attestedAt: AT, delivery: GIFT_DELIVERY, gift: GIFT };
    expect(parseCheckout({ ...state, gift: saved(GIFT) })).toEqual(state);
  });

  it("round-trips self delivery with packaging only", () => {
    const state = { clientKey: KEY, buyer: BUYER, attestedAt: AT, delivery: SELF_DELIVERY, gift: SELF_GIFT };
    expect(parseCheckout({ ...state, gift: saved(SELF_GIFT) })).toEqual(state);
    const none = { ...SELF_GIFT, packaging: null };
    expect(parseCheckout({ ...state, gift: saved(none) })?.gift).toEqual(none);
  });

  it("reads a draft row whose empty groups are nulls, as Payload returns them", () => {
    const row = {
      id: 1,
      handle: "h",
      clientKey: KEY,
      buyer: { name: null, phone: null, email: null, address: null },
      attestedAt: null,
      delivery: { zone: null, mode: null, date: null, window: null, recipient: { name: null, phone: null, address: null } },
      gift: { saved: false, packaging: null, card: null, message: null, sender: null, hidePrices: null },
    };
    expect(parseCheckout(row)).toEqual({ clientKey: KEY });
    expect(parseCheckout({ ...row, delivery: { ...SELF_DELIVERY, recipient: { name: null, phone: null, address: null } } })).toMatchObject({
      delivery: SELF_DELIVERY,
    });
  });

  it("starts a checkout with a fresh key only", () => {
    const state = newCheckout();
    expect(Object.keys(state)).toEqual(["clientKey"]);
    expect(parseCheckout(state)).toEqual(state);
  });

  it.each([undefined, null, {}, { clientKey: "nope" }, { clientKey: "0b6f3a52-6a61-1c1e-9d2e-3f1f6f0b9a11" }])("rejects %j", (raw) => {
    expect(parseCheckout(raw as never)).toBeNull();
  });

  it("drops an invalid buyer together with its attestation", () => {
    expect(parseCheckout({ clientKey: KEY, buyer: { ...BUYER, phone: "12" }, attestedAt: AT })).toEqual({ clientKey: KEY });
    expect(parseCheckout({ clientKey: KEY, buyer: BUYER, attestedAt: "yesterday" })).toEqual({ clientKey: KEY });
  });

  it.each([
    ["an unknown zone", { ...GIFT_DELIVERY, zone: "danang" }],
    ["an unknown mode", { ...GIFT_DELIVERY, mode: "pickup" }],
    ["a malformed date", { ...GIFT_DELIVERY, date: "2026-02-30" }],
    ["an unknown window", { ...GIFT_DELIVERY, window: "night" }],
    ["a gift without a recipient phone", { ...GIFT_DELIVERY, recipient: { ...RECIPIENT, phone: "" } }],
  ])("drops the delivery, and the gift options with it, on %s", (_, delivery) => {
    expect(parseCheckout({ clientKey: KEY, buyer: BUYER, attestedAt: AT, delivery, gift: saved(GIFT) })).toEqual({ clientKey: KEY, buyer: BUYER, attestedAt: AT });
  });

  it.each([
    ["an unsaved step", { ...GIFT, saved: false }],
    ["a malformed packaging code", saved({ ...GIFT, packaging: "Box 2" })],
    ["no card", saved({ ...GIFT, card: null })],
    ["a message over 250 code points", saved({ ...GIFT, message: "a".repeat(251) })],
    ["a message with a control character", saved({ ...GIFT, message: "a\tb" })],
    ["a message not in NFC", saved({ ...GIFT, message: "ệ".normalize("NFD") })],
    ["an untrimmed sender", saved({ ...GIFT, sender: " An" })],
    ["a missing hide-prices flag", saved({ ...GIFT, hidePrices: undefined })],
  ])("drops gift-mode options with %s", (_, gift) => {
    expect(parseCheckout({ clientKey: KEY, buyer: BUYER, attestedAt: AT, delivery: GIFT_DELIVERY, gift })?.gift).toBeUndefined();
  });

  it.each([
    ["a card", { card: "tet" }],
    ["a message", { message: "Chúc mừng" }],
    ["a sender", { sender: "An" }],
    ["hide prices", { hidePrices: true }],
  ])("drops self-mode options that carry %s", (_, extra) => {
    expect(parseCheckout({ clientKey: KEY, buyer: BUYER, attestedAt: AT, delivery: SELF_DELIVERY, gift: saved({ ...SELF_GIFT, ...extra }) })?.gift).toBeUndefined();
  });

  it("keeps no field it does not know, such as a date of birth", () => {
    expect(parseCheckout({ clientKey: KEY, buyer: { ...BUYER, dob: "1990-01-01" }, attestedAt: AT, dob: "1990-01-01" })).toEqual({
      clientKey: KEY,
      buyer: BUYER,
      attestedAt: AT,
    });
  });
});

describe("the checkout cookie", () => {
  it("carries the handle and nothing else", () => {
    const handle = newHandle();
    const cookie = checkoutCookie(handle, false);
    expect(cookie.name).toBe(CHECKOUT_COOKIE);
    expect(cookie.value).toBe(handle);
    expect(Object.keys(cookie).sort()).toEqual(["httpOnly", "name", "path", "sameSite", "secure", "value"]);
  });

  it("is HttpOnly, SameSite=Lax, Path=/, and Secure in production only", () => {
    expect(cookieOptions(true)).toEqual({ httpOnly: true, sameSite: "lax", secure: true, path: "/" });
    expect(cookieOptions(false)).toEqual({ httpOnly: true, sameSite: "lax", secure: false, path: "/" });
    expect(checkoutCookie(newHandle(), true)).toMatchObject({ httpOnly: true, sameSite: "lax", secure: true, path: "/" });
  });

  it("uses a 256-bit handle from the CSPRNG, base64url", () => {
    const handles = new Set(Array.from({ length: 100 }, newHandle));
    expect(handles.size).toBe(100);
    for (const h of handles) expect(h).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
