import { describe, expect, it } from "vitest";

import { paymentDueAt, PAYMENT_HOLD_MINUTES } from "./order";

describe("payment hold", () => {
  it("sets the deadline exactly once from placement", () => {
    const placedAt = new Date("2026-09-24T12:34:56.000Z");
    expect(paymentDueAt(placedAt).toISOString()).toBe("2026-09-24T13:34:56.000Z");
    expect(PAYMENT_HOLD_MINUTES).toBe(60);
  });

});
