"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasLocale } from "next-intl";

import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { type BuyerErrors, checkBuyer } from "@/lib/buyer";
import { removeLine, setLine } from "@/lib/cart";
import { newCheckout } from "@/lib/checkout";
import { AGE_COOKIE, EXIT_PATH } from "@/lib/gate";
import { isClientKey, isZone } from "@/lib/order";
import { type LineProblem, placeOrder } from "@/lib/place-order";
import { clearCheckout, loadZones, readCartLines, readCheckout, writeCart, writeCheckout } from "@/lib/shop-data";

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

export type DeliveryState = { error?: "zoneRequired" };

/** Step 2: delivery to the buyer, in a zone that has a fee in `site-settings`. */
export async function saveDelivery(_previous: DeliveryState, formData: FormData): Promise<DeliveryState> {
  const zone = field(formData, "zone");
  if (!isZone(zone) || !(await loadZones()).has(zone)) return { error: "zoneRequired" };
  const state = await readCheckout();
  if (!state?.buyer) go(formData, "/thanh-toan");
  await writeCheckout({ ...state!, zone });
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
  const result = await placeOrder(key, field(formData, "digest"), lines, await readCheckout(), new Date());
  if (result.ok) {
    await writeCart([]);
    await clearCheckout();
    return go(formData, `/don-hang/${result.token}`);
  }
  if (result.reason === "expired") return { errors: { expired: true } };
  if (result.reason === "empty") go(formData, "/gio-hang");
  if (result.reason === "buyer") go(formData, "/thanh-toan");
  if (result.reason === "zone") go(formData, "/thanh-toan/giao-hang");
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
