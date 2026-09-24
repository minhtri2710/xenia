import { describe, expect, it } from "vitest";

import { checkMessage, fitsEverySize, isCode, MAX_MESSAGE_CODE_POINTS, wrapUnits } from "./gift";

describe("checkMessage", () => {
  const a = (n: number) => "a".repeat(n);

  it("allows an empty message", () => {
    expect(checkMessage("")).toEqual({ ok: true, message: "" });
  });

  it("accepts 250 code points and refuses 251", () => {
    expect(MAX_MESSAGE_CODE_POINTS).toBe(250);
    expect(checkMessage(a(250))).toEqual({ ok: true, message: a(250) });
    expect(checkMessage(a(251))).toEqual({ ok: false, error: "messageTooLong" });
  });

  it("counts an emoji (two UTF-16 units) as one code point", () => {
    const fits = `${a(249)}🍷`;
    expect(fits.length).toBe(251);
    expect(checkMessage(fits)).toEqual({ ok: true, message: fits });
    expect(checkMessage(`${a(250)}🍷`)).toEqual({ ok: false, error: "messageTooLong" });
  });

  it("counts after NFC: a decomposed Vietnamese input over 250 code points that fits after NFC is stored composed", () => {
    // "ệ" decomposed is e + U+0323 + U+0302 (3 code points); composed it is U+1EC7 (1).
    const decomposed = "ệ".normalize("NFD").repeat(100);
    expect([...decomposed].length).toBe(300);
    const result = checkMessage(decomposed);
    expect(result).toEqual({ ok: true, message: "ệ".repeat(100) });
    expect(checkMessage("ệ".normalize("NFD").repeat(251))).toEqual({ ok: false, error: "messageTooLong" });
  });

  it("keeps line feeds and turns CRLF and CR into LF", () => {
    expect(checkMessage("Chúc mừng\r\nnăm mới\rAn\n")).toEqual({ ok: true, message: "Chúc mừng\nnăm mới\nAn\n" });
  });

  it.each(["\u0000", "\t", "\u0007", "\u001b", "\u007f", "\u0085"])("refuses the control character %j", (c) => {
    expect(checkMessage(`Chúc${c}mừng`)).toEqual({ ok: false, error: "messageControl" });
  });
});

describe("wrapUnits", () => {
  it.each([
    [1, 1, 1],
    [3, 1, 3],
    [1, 2, 1],
    [2, 2, 1],
    [3, 2, 2],
    [4, 2, 2],
    [5, 2, 3],
  ])("%i bottles, capacity %i: %i units", (bottles, capacity, units) => {
    expect(wrapUnits(bottles, capacity)).toBe(units);
  });

  it("counts every bottle of a mix of lines", () => {
    // 2 + 1 bottles in a two-bottle box: ceil(3 / 2) = 2 units; 2 × 200 000 = 400 000.
    const bottles = [2, 1].reduce((a, b) => a + b, 0);
    expect(wrapUnits(bottles, 2) * 200_000).toBe(400_000);
  });

  it.each([
    [0, 1],
    [1, 0],
    [1.5, 1],
    [1, -2],
  ])("rejects %s bottles at capacity %s", (bottles, capacity) => {
    expect(() => wrapUnits(bottles, capacity)).toThrow(RangeError);
  });
});

describe("fitsEverySize", () => {
  it("fits only when every bottle size in the cart is one it takes", () => {
    expect(fitsEverySize([375, 750, 1500], [750, 1500])).toBe(true);
    expect(fitsEverySize([750], [750, 750])).toBe(true);
    expect(fitsEverySize([750], [750, 1500])).toBe(false);
    expect(fitsEverySize([750], [375])).toBe(false);
  });
});

describe("isCode", () => {
  it("accepts lower-case codes only", () => {
    expect(["box-2", "chuc-mung", "silk", "", "Box", "a b", "x".repeat(41), 1].map(isCode)).toEqual([true, true, true, false, false, false, false, false]);
  });
});
