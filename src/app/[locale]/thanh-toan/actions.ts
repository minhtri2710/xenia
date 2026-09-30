"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasLocale } from "next-intl";

import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { currentCustomer } from "@/lib/account-data";
import { MAX_NAME_LENGTH } from "@/lib/age";
import { type BuyerErrors, checkBuyer, checkRecipient, type RecipientErrors } from "@/lib/buyer";
import { removeLine, setLine } from "@/lib/cart";
import { CHECKOUT_COOKIE, type Delivery, newCheckout } from "@/lib/checkout";
import { checkDeliveryDate, type DateError, isDeliveryMode, isDeliveryWindow } from "@/lib/delivery";
import { AGE_COOKIE, EXIT_PATH } from "@/lib/gate";
import { checkMessage, isCode, type MessageError, wrapLine } from "@/lib/gift";
import { isClientKey, isZone } from "@/lib/order";
import { type LineProblem, placeOrder } from "@/lib/place-order";
import {
  checkoutHandle,
  clearCheckout,
  loadCards,
  loadDeliverySettings,
  loadPackaging,
  readCart,
  readCartLines,
  readCheckout,
  writeCart,
  writeCheckout,
} from "@/lib/shop-data";

const field = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

const localeOf = (formData: FormData) => {
  const value = field(formData, "locale");
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
};

const go = (formData: FormData, href: string): never => redirect(getPathname({ href, locale: localeOf(formData) }));

export type BuyerState = { errors: BuyerErrors; values: Record<"name" | "dob" | "phone" | "email" | "address", string> };

/**
 * Step 1 (Decree 24/2020 Art. 6.1). The date of birth is read only to re-check age: it is never
 * stored, logged or put in a cookie. Under 18: no order, the marker cookie and the checkout state
 * are removed, and the visitor goes to the exit page.
 */
export async function saveBuyer(_previous: BuyerState, formData: FormData): Promise<BuyerState> {
  const values = {
    name: field(formData, "name"),
    dob: field(formData, "dob"),
    phone: field(formData, "phone"),
    email: field(formData, "email"),
    address: field(formData, "address"),
  };
  const now = new Date();
  const result = checkBuyer(values, now);
  if (!result.ok) return { errors: result.errors, values };

  if (!result.adult) {
    (await cookies()).delete(AGE_COOKIE);
    await clearCheckout();
    go(formData, EXIT_PATH);
  }

  const state = (await readCheckout()) ?? newCheckout();
  await writeCheckout({ ...state, buyer: result.buyer, attestedAt: now.toISOString() });
  return go(formData, "/thanh-toan/giao-hang");
}

export type DeliveryValues = Record<"zone" | "mode" | "recipientName" | "recipientPhone" | "recipientAddress" | "date" | "window", string>;

export type DeliveryErrors = {
  zone?: "zoneRequired";
  mode?: "modeRequired";
  recipient?: RecipientErrors;
  date?: DateError;
  window?: "windowRequired";
};

export type DeliveryState = { errors: DeliveryErrors; values: DeliveryValues };

/**
 * Step 2, one path for every order: self delivery to the buyer or a gift to a recipient (name,
 * phone and address under the buyer's rules), a zone with a fee and lead days in `site-settings`,
 * a date in the zone's range that is not a blackout date, and a window. A change of mode clears
 * step 3, whose options depend on it.
 */
export async function saveDelivery(_previous: DeliveryState, formData: FormData): Promise<DeliveryState> {
  const values: DeliveryValues = {
    zone: field(formData, "zone"),
    mode: field(formData, "mode"),
    recipientName: field(formData, "recipientName"),
    recipientPhone: field(formData, "recipientPhone"),
    recipientAddress: field(formData, "recipientAddress"),
    date: field(formData, "date"),
    window: field(formData, "window"),
  };
  const settings = await loadDeliverySettings();
  const zone = isZone(values.zone) ? settings.zones.get(values.zone) : undefined;
  const errors: DeliveryErrors = {};
  if (!zone) errors.zone = "zoneRequired";
  if (!isDeliveryMode(values.mode)) errors.mode = "modeRequired";
  const recipient =
    values.mode === "gift" ? checkRecipient({ name: values.recipientName, phone: values.recipientPhone, address: values.recipientAddress }) : null;
  if (recipient && !recipient.ok) errors.recipient = recipient.errors;
  // Without a valid zone there are no lead days; the date is checked once a zone is chosen.
  const dateError = zone ? checkDeliveryDate(values.date, new Date(), zone.leadDays, settings.blackoutDates) : null;
  if (dateError) errors.date = dateError;
  if (!isDeliveryWindow(values.window)) errors.window = "windowRequired";
  if (Object.keys(errors).length > 0) return { errors, values };

  const state = await readCheckout();
  if (!state?.buyer) go(formData, "/thanh-toan");
  const delivery: Delivery = {
    zone: values.zone as Delivery["zone"],
    mode: values.mode as Delivery["mode"],
    recipient: recipient?.ok ? recipient.recipient : null,
    date: values.date.trim(),
    window: values.window as Delivery["window"],
  };
  const gift = state!.delivery?.mode === delivery.mode ? state!.gift : undefined;
  await writeCheckout({ ...state!, delivery, gift });
  return go(formData, "/thanh-toan/goi-qua");
}

export type GiftValues = Record<"packaging" | "card" | "message" | "sender", string> & { anonymous: boolean; hidePrices: boolean };

export type GiftErrors = {
  packaging?: "packagingUnavailable";
  card?: "cardRequired";
  message?: MessageError;
  sender?: "senderRequired" | "senderTooLong";
  form?: "giftOnly";
};

export type GiftState = { errors: GiftErrors; values: GiftValues };

const GIFT_ONLY = ["card", "message", "sender", "anonymous", "hidePrices"] as const;

/**
 * Step 3. Packaging for any order: none, or one active packaging that fits every bottle size in the
 * cart. Gift mode only: a card design, a message (normalized to NFC here, once, and stored so), a
 * sender name or anonymous, and hide prices. A self-mode post that carries any gift-only field is
 * refused; so is a packaging or card that is unknown, inactive or does not fit.
 */
export async function saveGift(_previous: GiftState, formData: FormData): Promise<GiftState> {
  const values: GiftValues = {
    packaging: field(formData, "packaging"),
    card: field(formData, "card"),
    message: field(formData, "message"),
    sender: field(formData, "sender"),
    anonymous: formData.get("anonymous") === "on",
    hidePrices: formData.get("hidePrices") === "on",
  };
  const state = await readCheckout();
  if (!state?.buyer) go(formData, "/thanh-toan");
  if (!state!.delivery) go(formData, "/thanh-toan/giao-hang");
  const isGift = state!.delivery!.mode === "gift";
  const errors: GiftErrors = {};

  const packagingCode = values.packaging === "" || values.packaging === "none" ? null : values.packaging;
  if (packagingCode !== null) {
    const lines = await readCart(localeOf(formData));
    const found = isCode(packagingCode) ? (await loadPackaging({ code: packagingCode }))[0] : undefined;
    if (wrapLine(found, lines) === "unavailable") errors.packaging = "packagingUnavailable";
  }

  if (!isGift) {
    if (GIFT_ONLY.some((name) => formData.has(name))) errors.form = "giftOnly";
    if (Object.keys(errors).length > 0) return { errors, values };
    await writeCheckout({ ...state!, gift: { packaging: packagingCode, card: null, message: "", sender: null, hidePrices: false } });
    return go(formData, "/thanh-toan/xac-nhan");
  }

  const card = isCode(values.card) ? (await loadCards({ code: values.card, activeOnly: true }))[0] : undefined;
  if (!card) errors.card = "cardRequired";
  const message = checkMessage(values.message);
  if (!message.ok) errors.message = message.error;
  const sender = values.sender.trim();
  if (!values.anonymous && !sender) errors.sender = "senderRequired";
  else if (!values.anonymous && sender.length > MAX_NAME_LENGTH) errors.sender = "senderTooLong";
  if (Object.keys(errors).length > 0 || !message.ok) return { errors, values };

  await writeCheckout({
    ...state!,
    gift: { packaging: packagingCode, card: card!.code, message: message.message, sender: values.anonymous ? null : sender, hidePrices: values.hidePrices },
  });
  return go(formData, "/thanh-toan/xac-nhan");
}

export type ReviewState = {
  errors: { terms?: true; privacy?: true; expired?: true; problems?: LineProblem[] };
};

/**
 * Step 4: explicit consent (Law 122 Art. 12), then placement. The posted client key and the
 * review's digest are the only posted values placement uses; prices, fees and totals come from the
 * database. An order that no longer matches the digest re-shows the review with the change notice
 * and unticked consents. A refused line (placement found no order for the key) rewrites the cart
 * to what is available, so the review the buyer confirms next is accurate.
 */
export async function submitOrder(_previous: ReviewState, formData: FormData): Promise<ReviewState> {
  const key = field(formData, "clientKey");
  const errors: ReviewState["errors"] = {};
  if (formData.get("terms") !== "on") errors.terms = true;
  if (formData.get("privacy") !== "on") errors.privacy = true;
  if (!isClientKey(key)) errors.expired = true;
  if (Object.keys(errors).length > 0) return { errors };

  const lines = await readCartLines();
  const result = await placeOrder(key, field(formData, "digest"), lines, await checkoutHandle(), new Date(), (await currentCustomer())?.id ?? null);
  if (result.ok) {
    await writeCart([]);
    // Placement deleted the draft in its transaction; only the cookie is left.
    (await cookies()).delete(CHECKOUT_COOKIE);
    return go(formData, `/don-hang/${result.token}`);
  }
  if (result.reason === "expired") return { errors: { expired: true } };
  if (result.reason === "empty") go(formData, "/gio-hang");
  if (result.reason === "buyer") go(formData, "/thanh-toan");
  if (result.reason === "delivery") go(formData, `/thanh-toan/giao-hang?invalid=${result.error}`);
  if (result.reason === "gift") go(formData, `/thanh-toan/goi-qua?invalid=${result.error}`);
  if (result.reason === "changed") go(formData, "/thanh-toan/xac-nhan?changed=1");

  const problems = result.reason === "lines" ? result.problems : [];
  await writeCart(
    problems.reduce(
      (cart, p) => (p.stock > 0 && p.problem === "stock" ? setLine(cart, p.vintageId, p.stock, p.stock) : removeLine(cart, p.vintageId)),
      lines,
    ),
  );
  return { errors: { problems } };
}
