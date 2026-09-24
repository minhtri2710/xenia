/**
 * Checkout state between steps, kept in the `xenia_checkout` cookie (HttpOnly, SameSite=Lax,
 * browser session): the idempotency key, the step 1 buyer and the instant the age check passed,
 * and the step 2 zone. It never holds the date of birth. It is re-validated on every read, and
 * placement re-validates it again; a tampered buyer or zone is dropped and that step is asked again.
 */
import { type Buyer, checkContact } from "./buyer";
import { isClientKey, isZone, newClientKey, type Zone } from "./order";

export const CHECKOUT_COOKIE = "xenia_checkout";

export type Checkout = { key: string; buyer?: Buyer; attestedAt?: string; zone?: Zone };

export const newCheckout = (): Checkout => ({ key: newClientKey() });

const isInstant = (value: unknown): value is string => typeof value === "string" && !Number.isNaN(Date.parse(value));

export function parseCheckout(raw: string | undefined): Checkout | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw ?? "null") ?? {};
  } catch {
    return null;
  }
  if (typeof data !== "object" || !isClientKey(data.key)) return null;
  const state: Checkout = { key: data.key };
  const b = (data.buyer ?? {}) as Partial<Record<keyof Buyer, unknown>>;
  const contact = checkContact({
    name: String(b.name ?? ""),
    phone: String(b.phone ?? ""),
    email: String(b.email ?? ""),
    address: String(b.address ?? ""),
  });
  if (contact.ok && isInstant(data.attestedAt)) {
    state.buyer = contact.buyer;
    state.attestedAt = data.attestedAt;
  }
  if (isZone(data.zone)) state.zone = data.zone;
  return state;
}

export const serializeCheckout = (state: Checkout): string => JSON.stringify(state);
