import { PAYMENT_HOLD_MINUTES } from "./order";

export function paymentDueAt(placedAt: Date): Date {
  return new Date(placedAt.getTime() + PAYMENT_HOLD_MINUTES * 60_000);
}

type ExpiryCandidate = { id: number; payment: { status: string }; paymentDueAt: string; status: string };

export function isPaymentExpired(order: ExpiryCandidate, now: Date): boolean {
  return order.status === "placed" && order.payment.status !== "paid" && Date.parse(order.paymentDueAt) <= now.getTime();
}

export function canAttemptPayment(order: ExpiryCandidate, now: Date): boolean {
  return order.status === "placed" && order.payment.status !== "paid" && Date.parse(order.paymentDueAt) > now.getTime();
}

export function selectExpiredOrders<T extends ExpiryCandidate>(orders: readonly T[], now: Date): T[] {
  return orders.filter((order) => isPaymentExpired(order, now)).sort((a, b) => a.id - b.id);
}
