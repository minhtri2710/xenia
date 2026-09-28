/**
 * Checkout state between steps, kept server-side in a `checkout-drafts` row (src/lib/checkout-drafts.ts):
 * the idempotency key, the step 1 buyer and the instant the age check passed, the step 2 delivery
 * and the step 3 gift options. The `xenia_checkout` cookie carries only the draft's handle, never
 * state. The state never holds the date of birth. It is re-validated on every read, and placement
 * re-validates it again; a step that fails validation is dropped and asked again.
 */
import { randomBytes } from "node:crypto";

import { MAX_NAME_LENGTH } from "./age";
import { type Buyer, checkContact, checkRecipient, type Recipient } from "./buyer";
import { cookieOptions } from "./cookies";
import { type DeliveryMode, type DeliveryWindow, isDeliveryMode, isDeliveryWindow, isIsoDate } from "./delivery";
import { checkMessage, isCode } from "./gift";
import { isClientKey, isZone, newClientKey, type Zone } from "./order";

export const CHECKOUT_COOKIE = "xenia_checkout";

export type Delivery = { zone: Zone; mode: DeliveryMode; recipient: Recipient | null; date: string; window: DeliveryWindow };

/** Step 3. In self mode `card` and `sender` are null, `message` is empty and `hidePrices` false. */
export type GiftChoice = { packaging: string | null; card: string | null; message: string; sender: string | null; hidePrices: boolean };

export type Checkout = { clientKey: string; buyer?: Buyer; attestedAt?: string; delivery?: Delivery; gift?: GiftChoice };

export const newCheckout = (): Checkout => ({ clientKey: newClientKey() });

/** The draft handle, the only cookie value: 32 bytes from the CSPRNG as base64url (43 characters). */
export const newHandle = (): string => randomBytes(32).toString("base64url");

/** The checkout cookie: the handle and nothing else. */
export const checkoutCookie = (handle: string, production: boolean) => ({ name: CHECKOUT_COOKIE, value: handle, ...cookieOptions(production) });

const isInstant = (value: unknown): value is string => typeof value === "string" && !Number.isNaN(Date.parse(value));

type Raw = Record<string, unknown> | null | undefined;
const str = (value: unknown) => (typeof value === "string" ? value : "");

function parseDelivery(d: Raw): Delivery | undefined {
  if (!d || !isZone(d.zone) || !isDeliveryMode(d.mode) || !isIsoDate(d.date) || !isDeliveryWindow(d.window)) return undefined;
  if (d.mode === "self") return { zone: d.zone, mode: "self", recipient: null, date: d.date, window: d.window };
  const r = (d.recipient ?? {}) as Raw;
  const recipient = checkRecipient({ name: str(r?.name), phone: str(r?.phone), address: str(r?.address) });
  return recipient.ok ? { zone: d.zone, mode: "gift", recipient: recipient.recipient, date: d.date, window: d.window } : undefined;
}

function parseGift(g: Raw, mode: DeliveryMode): GiftChoice | undefined {
  if (!g || g.saved !== true) return undefined;
  const packaging = g.packaging ?? null;
  if (packaging !== null && !isCode(packaging)) return undefined;
  if (mode === "self") {
    const empty = (g.card ?? null) === null && !g.message && (g.sender ?? null) === null && g.hidePrices !== true;
    return empty ? { packaging, card: null, message: "", sender: null, hidePrices: false } : undefined;
  }
  const message = checkMessage(str(g.message));
  const sender = g.sender ?? null;
  const senderOk = sender === null || (typeof sender === "string" && sender === sender.trim() && sender !== "" && sender.length <= MAX_NAME_LENGTH);
  if (!isCode(g.card) || !message.ok || message.message !== str(g.message) || !senderOk || typeof g.hidePrices !== "boolean") return undefined;
  return { packaging, card: g.card, message: message.message, sender, hidePrices: g.hidePrices };
}

/** The draft's content, re-validated; `null` without a valid idempotency key. */
export function parseCheckout(data: Raw): Checkout | null {
  if (!data || typeof data !== "object" || !isClientKey(data.clientKey)) return null;
  const state: Checkout = { clientKey: data.clientKey };
  const b = (data.buyer ?? {}) as Raw;
  const contact = checkContact({ name: str(b?.name), phone: str(b?.phone), email: str(b?.email), address: str(b?.address) });
  if (contact.ok && isInstant(data.attestedAt)) {
    state.buyer = contact.buyer;
    state.attestedAt = data.attestedAt;
  }
  const delivery = parseDelivery(data.delivery as Raw);
  if (delivery) {
    state.delivery = delivery;
    const gift = parseGift(data.gift as Raw, delivery.mode);
    if (gift) state.gift = gift;
  }
  return state;
}
