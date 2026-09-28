import { describe, expect, it } from "vitest";

import { addLine, type CartStock, MAX_CART_LINES, normalizeCart, parseCart, parseQuantity, removeLine, serializeCart, setLine } from "./cart";

describe("parseQuantity", () => {
  it.each([
    ["1", 1],
    [" 12 ", 12],
    ["0", null],
    ["-1", null],
    ["1.5", null],
    ["1e3", null],
    ["abc", null],
    ["", null],
    ["9999999", null],
    [undefined, null],
    [3, null],
  ])("%j → %j", (value, qty) => {
    expect(parseQuantity(value)).toBe(qty);
  });
});

describe("parseCart", () => {
  it("round-trips ids and quantities", () => {
    const lines = [
      { vintageId: 4, qty: 2 },
      { vintageId: 9, qty: 1 },
    ];
    expect(parseCart(serializeCart(lines))).toEqual(lines);
  });

  it("stores no price and ignores a posted one", () => {
    expect(serializeCart([{ vintageId: 4, qty: 2 }])).toBe('[{"v":4,"q":2}]');
    expect(parseCart('[{"v":4,"q":2,"p":1,"priceVnd":1}]')).toEqual([{ vintageId: 4, qty: 2 }]);
  });

  it("refuses non-integer and non-positive quantities and ids, and repeated vintages", () => {
    expect(
      parseCart('[{"v":1,"q":0},{"v":2,"q":-1},{"v":3,"q":1.5},{"v":"4","q":1},{"v":5,"q":"2"},{"v":0,"q":1},{"v":6,"q":1},{"v":6,"q":5}]'),
    ).toEqual([{ vintageId: 6, qty: 1 }]);
  });

  it.each([undefined, "", "not json", "{}", "null", "[null]", "5"])("reads %j as empty", (raw) => {
    expect(parseCart(raw)).toEqual([]);
  });

  it(`keeps at most ${MAX_CART_LINES} lines`, () => {
    const raw = JSON.stringify(Array.from({ length: 25 }, (_, i) => ({ v: i + 1, q: 1 })));
    expect(parseCart(raw)).toHaveLength(MAX_CART_LINES);
  });
});

describe("normalizeCart", () => {
  const stock = new Map<number, CartStock>([
    [1, { purchasable: true, stock: 5 }],
    [2, { purchasable: false, stock: 5 }], // draft vintage or draft wine
    [3, { purchasable: true, stock: 0 }],
    [4, { purchasable: true, stock: 2 }],
  ]);

  it("drops unknown, draft and out-of-stock vintages and caps quantity at stock", () => {
    expect(
      normalizeCart(
        [
          { vintageId: 1, qty: 3 },
          { vintageId: 2, qty: 1 },
          { vintageId: 3, qty: 1 },
          { vintageId: 4, qty: 7 },
          { vintageId: 99, qty: 1 },
        ],
        stock,
      ),
    ).toEqual([
      { vintageId: 1, qty: 3 },
      { vintageId: 4, qty: 2 },
    ]);
  });
});

describe("line edits", () => {
  const cart = [
    { vintageId: 1, qty: 2 },
    { vintageId: 4, qty: 1 },
  ];

  it("adds to an existing line, capped at stock", () => {
    expect(addLine(cart, 1, 5, 4)).toEqual([
      { vintageId: 1, qty: 4 },
      { vintageId: 4, qty: 1 },
    ]);
  });

  it("appends a new line, capped at stock", () => {
    expect(addLine(cart, 7, 3, 2)).toEqual([...cart, { vintageId: 7, qty: 2 }]);
  });

  it("appends no new line to a cart of MAX_CART_LINES lines", () => {
    const full = Array.from({ length: MAX_CART_LINES }, (_, i) => ({ vintageId: i + 1, qty: 1 }));
    expect(addLine(full, 99, 1, 5)).toEqual(full);
  });

  it("sets a quantity, capped at stock", () => {
    expect(setLine(cart, 4, 9, 6)).toEqual([
      { vintageId: 1, qty: 2 },
      { vintageId: 4, qty: 6 },
    ]);
  });

  it("removes a line", () => {
    expect(removeLine(cart, 1)).toEqual([{ vintageId: 4, qty: 1 }]);
  });
});
