import { describe, expect, it } from "vitest";

import { canAttemptPayment, isPaymentExpired, paymentDueAt, selectExpiredOrders } from "./order-expiry-pure";
import { PAYMENT_HOLD_MINUTES } from "./order";

describe("payment hold", () => {
  it("sets the deadline exactly once from placement", () => {
    const placedAt = new Date("2026-09-24T12:34:56.000Z");
    expect(paymentDueAt(placedAt).toISOString()).toBe(new Date(placedAt.getTime() + PAYMENT_HOLD_MINUTES * 60_000).toISOString());
    expect(PAYMENT_HOLD_MINUTES).toBe(60);
  });

  it("selects exactly due, unpaid, placed orders at the boundary, excluding paid and later deadlines", () => {
    const now = new Date("2026-09-24T13:34:56.000Z");
    const orders = [
      { id: 5, status: "placed", payment: { status: "unpaid" }, paymentDueAt: "2026-09-24T13:34:56.001Z" },
      { id: 4, status: "placed", payment: { status: "failed" }, paymentDueAt: "2026-09-24T13:34:56.000Z" },
      { id: 3, status: "placed", payment: { status: "unpaid" }, paymentDueAt: "2026-09-24T13:34:55.999Z" },
      { id: 2, status: "placed", payment: { status: "paid" }, paymentDueAt: "2026-09-24T12:00:00.000Z" },
      { id: 1, status: "paid", payment: { status: "unpaid" }, paymentDueAt: "2026-09-24T12:00:00.000Z" },
    ] as const;
    expect(selectExpiredOrders(orders, new Date(now.getTime() - 1)).map(({ id }) => id)).toEqual([3]);
    expect(isPaymentExpired(orders[1], now)).toBe(true);
    expect(canAttemptPayment(orders[0], now)).toBe(true);
    expect(canAttemptPayment(orders[1], now)).toBe(false);
    expect(selectExpiredOrders(orders, now).map(({ id }) => id)).toEqual([3, 4]);
    expect(selectExpiredOrders(orders, now).some(({ id }) => id === 2)).toBe(false);
  });
});
