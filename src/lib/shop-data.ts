import config from "@payload-config";
import { cookies } from "next/headers";
import { getPayload } from "payload";

import { CART_COOKIE, type CartLine, type CartStock, normalizeCart, parseCart, serializeCart } from "@/lib/cart";
import type { BottleSize } from "@/lib/catalogue";
import { type Checkout, CHECKOUT_COOKIE, parseCheckout, serializeCheckout } from "@/lib/checkout";
import type { Zone } from "@/lib/order";
import type { Order } from "@/payload-types";

/** The cart and checkout cookies: HttpOnly, SameSite=Lax, Secure in production, browser session. */
const COOKIE_OPTIONS = { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" } as const;

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
  const vintages = await loadVintages(
    lines.map((l) => l.vintageId),
    locale,
  );
  return normalizeCart(lines, vintages).map((l) => ({ ...vintages.get(l.vintageId)!, ...l }));
}

/** The stock view of one vintage, or `undefined` when it does not exist. */
export async function vintageStock(id: number): Promise<CartStock | undefined> {
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

export async function readCheckout(): Promise<Checkout | null> {
  return parseCheckout((await cookies()).get(CHECKOUT_COOKIE)?.value);
}

export async function writeCheckout(state: Checkout) {
  (await cookies()).set(CHECKOUT_COOKIE, serializeCheckout(state), COOKIE_OPTIONS);
}

export async function clearCheckout() {
  (await cookies()).delete(CHECKOUT_COOKIE);
}

/** Delivery zones and their flat fee from the `site-settings` global, in the admin's order. */
export async function loadZones(): Promise<Map<Zone, number>> {
  const payload = await getPayload({ config });
  const settings = await payload.findGlobal({ slug: "site-settings", depth: 0 });
  return new Map((settings.zones ?? []).map((z) => [z.zone, z.feeVnd]));
}

/** An order by its status token, or `null`. The caller checks the token's shape first. */
export async function loadOrder(token: string): Promise<Order | null> {
  const payload = await getPayload({ config });
  const { docs } = await payload.find({ collection: "orders", where: { token: { equals: token } }, depth: 0, limit: 1 });
  return docs[0] ?? null;
}
