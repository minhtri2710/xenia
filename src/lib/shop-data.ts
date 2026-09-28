import config from "@payload-config";
import { cookies } from "next/headers";
import { getPayload, type PayloadRequest } from "payload";

import { CART_COOKIE, type CartLine, type CartStock, normalizeCart, parseCart, serializeCart } from "@/lib/cart";
import type { BottleSize } from "@/lib/catalogue";
import { type Checkout, CHECKOUT_COOKIE, checkoutCookie } from "@/lib/checkout";
import { deleteDraft, readDraft, writeDraft } from "@/lib/checkout-drafts";
import { cookieOptions } from "@/lib/cookies";
import type { CardDoc, PackagingDoc } from "@/lib/gift";
import type { Zone } from "@/lib/order";
import { releaseExpiredOrders } from "@/lib/order-expiry";
import type { Order, SiteSetting } from "@/payload-types";

const PRODUCTION = process.env.NODE_ENV === "production";
const COOKIE_OPTIONS = cookieOptions(PRODUCTION);

export type CartItem = CartLine & {
  slug: string;
  wineName: string;
  year: number | null;
  bottleMl: BottleSize;
  priceVnd: number;
  stock: number;
};

/** Current stock and purchasability of `ids`, with display data in `locale`. */
async function loadVintages(ids: number[], locale: "vi" | "en") {
  if (ids.length === 0) return new Map<number, CartStock & Omit<CartItem, keyof CartLine | "stock">>();
  const payload = await getPayload({ config });
  const { docs } = await payload.find({ collection: "vintages", where: { id: { in: ids } }, depth: 1, locale, pagination: false });
  return new Map(
    docs.flatMap((v) => {
      if (typeof v.wine !== "object") return [];
      const purchasable = v.status === "published" && v.wine.status === "published";
      return [
        [
          v.id,
          {
            purchasable,
            stock: v.stock,
            slug: v.wine.slug,
            wineName: v.wine.name,
            year: v.year ?? null,
            bottleMl: Number(v.bottleMl) as BottleSize,
            priceVnd: v.priceVnd,
          },
        ] as const,
      ];
    }),
  );
}

/** The cart cookie resolved against the database: unavailable lines dropped, quantities capped. */
export async function readCart(locale: "vi" | "en"): Promise<CartItem[]> {
  const lines = parseCart((await cookies()).get(CART_COOKIE)?.value);
  if (lines.length > 0) await releaseExpiredOrders(new Date());
  const vintages = await loadVintages(
    lines.map((l) => l.vintageId),
    locale,
  );
  return normalizeCart(lines, vintages).map((l) => ({ ...vintages.get(l.vintageId)!, ...l }));
}

/** The stock view of one vintage, or `undefined` when it does not exist. */
export async function vintageStock(id: number): Promise<CartStock | undefined> {
  await releaseExpiredOrders(new Date());
  return (await loadVintages([id], "vi")).get(id);
}

export async function readCartLines(): Promise<CartLine[]> {
  return parseCart((await cookies()).get(CART_COOKIE)?.value);
}

export async function writeCart(lines: CartLine[]) {
  const store = await cookies();
  if (lines.length === 0) store.delete(CART_COOKIE);
  else store.set(CART_COOKIE, serializeCart(lines), COOKIE_OPTIONS);
}

/** The draft handle from the checkout cookie. Placement reads the draft with it inside its transaction. */
export async function checkoutHandle(): Promise<string | undefined> {
  return (await cookies()).get(CHECKOUT_COOKIE)?.value;
}

/** The live checkout draft, re-validated, or `null`. */
export async function readCheckout(): Promise<Checkout | null> {
  return readDraft(await getPayload({ config }), await checkoutHandle(), new Date());
}

/** Saves the draft (purging expired drafts first) and points the cookie at it. */
export async function writeCheckout(state: Checkout) {
  const handle = await writeDraft(await getPayload({ config }), await checkoutHandle(), state, new Date());
  (await cookies()).set(checkoutCookie(handle, PRODUCTION));
}

export async function clearCheckout() {
  await deleteDraft(await getPayload({ config }), await checkoutHandle());
  (await cookies()).delete(CHECKOUT_COOKIE);
}

export type DeliverySettings = { zones: Map<Zone, { feeVnd: number; leadDays: number }>; blackoutDates: string[] };

/** Delivery zones (fee and lead days, in the admin's order) and blackout dates from `site-settings`. */
export async function loadDeliverySettings(req?: Partial<PayloadRequest>): Promise<DeliverySettings> {
  const payload = await getPayload({ config });
  const settings = await payload.findGlobal({ slug: "site-settings", depth: 0, req });
  return {
    zones: new Map((settings.zones ?? []).map((z) => [z.zone, { feeVnd: z.feeVnd, leadDays: z.leadDays }])),
    blackoutDates: (settings.blackoutDates ?? []).map((b) => b.date),
  };
}

export async function loadSiteSettings(req?: Partial<PayloadRequest>): Promise<SiteSetting> {
  const payload = await getPayload({ config });
  return payload.findGlobal({ slug: "site-settings", depth: 0, req });
}

type Localized = { vi: string; en: string };

/** Packaging, every translation; `active` only when asked. */
export async function loadPackaging(where: { code?: string; activeOnly?: boolean }, req?: Partial<PayloadRequest>): Promise<PackagingDoc[]> {
  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: "packaging",
    where: { and: [...(where.code ? [{ code: { equals: where.code } }] : []), ...(where.activeOnly ? [{ active: { equals: true } }] : [])] },
    locale: "all",
    depth: 0,
    pagination: false,
    sort: "priceVnd",
    req,
  });
  return docs.map((d) => ({
    code: d.code,
    name: d.name as unknown as Localized,
    description: d.description as unknown as Localized,
    capacity: d.capacity,
    fits: (d.fits ?? []).map(Number) as BottleSize[],
    priceVnd: d.priceVnd,
    active: d.active,
  }));
}

/** Card designs, every translation; `active` only when asked. */
export async function loadCards(where: { code?: string; activeOnly?: boolean }, req?: Partial<PayloadRequest>): Promise<CardDoc[]> {
  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: "card-designs",
    where: { and: [...(where.code ? [{ code: { equals: where.code } }] : []), ...(where.activeOnly ? [{ active: { equals: true } }] : [])] },
    locale: "all",
    depth: 0,
    pagination: false,
    sort: "code",
    req,
  });
  return docs.map((d) => ({ code: d.code, name: d.name as unknown as Localized, active: d.active }));
}

/** An order by its status token, or `null`. The caller checks the token's shape first. */
export async function loadOrder(token: string): Promise<Order | null> {
  await releaseExpiredOrders(new Date());
  const payload = await getPayload({ config });
  const { docs } = await payload.find({ collection: "orders", where: { token: { equals: token } }, depth: 0, limit: 1 });
  return docs[0] ?? null;
}
