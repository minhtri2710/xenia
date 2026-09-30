import config from "@payload-config";
import { type BasePayload, commitTransaction, createLocalReq, getPayload, initTransaction, killTransaction } from "payload";

import type { CartLine } from "@/lib/cart";
import type { BottleSize } from "@/lib/catalogue";
import { deleteDraft, readDraft } from "@/lib/checkout-drafts";
import type { DateError } from "@/lib/delivery";
import { newOrderNumber, newStatusToken, paymentDueAt } from "@/lib/order";
import { releaseExpiredOrders } from "@/lib/order-expiry";
import { reviewOrder } from "@/lib/order-review";
import { loadCards, loadDeliverySettings, loadPackaging } from "@/lib/shop-data";

export type LineProblem = { vintageId: number; problem: "unavailable" | "stock"; stock: number };

export type PlaceResult =
  | { ok: true; token: string }
  | { ok: false; reason: "expired" | "empty" | "buyer" | "changed" }
  | { ok: false; reason: "delivery"; error: "missing" | "zone" | DateError }
  | { ok: false; reason: "gift"; error: "missing" | "packaging" | "card" }
  | { ok: false; reason: "lines"; problems: LineProblem[] };

const CHECK_VIOLATION = "23514";

/** The Postgres error code anywhere in a (wrapped) driver error. */
function pgCode(error: unknown): string | undefined {
  for (let e = error as { code?: unknown; cause?: unknown } | undefined; e; e = e.cause as typeof e) {
    if (typeof e.code === "string") return e.code;
  }
  return undefined;
}

async function tokenForKey(payload: BasePayload, clientKey: string): Promise<string | undefined> {
  const { docs } = await payload.find({ collection: "orders", where: { clientKey: { equals: clientKey } }, depth: 0, limit: 1 });
  return docs[0]?.token;
}

async function stockOf(payload: BasePayload, id: number): Promise<number> {
  return (await payload.findByID({ collection: "vintages", id, depth: 0, disableErrors: true }))?.stock ?? 0;
}

/**
 * Places the order in one database transaction through the Local API. Money comes only from the
 * database, the packaging price and the zone fee; nothing the client posts is read here except the
 * cart's vintage ids and quantities, and the checkout draft, re-validated.
 *
 * - Idempotent on the client key posted with the review form: an order with that key is returned
 *   first, before the draft is read, so a replayed POST after placement deleted the draft still
 *   lands on the one order. A concurrent duplicate (double submit) loses on the unique `clientKey`
 *   index, rolls back and returns the winner. Every refusal after the transaction starts also
 *   returns the winner when one exists (a duplicate that lost at the stock edge must still land on
 *   the one order).
 * - The draft is read by the cookie's handle inside the transaction and must carry the posted key.
 * - Every line is re-read: a draft or missing vintage or wine, or a quantity above stock, refuses
 *   the whole order with a per-line problem. The delivery date is re-checked at `now`, and the
 *   packaging and card are re-read (active, fits, price); one that is no longer valid refuses back
 *   to its step.
 * - The order must be the one step 4 showed (Law 122 Art. 12): `reviewedDigest` is compared with
 *   the digest of everything about to be stored; a mismatch refuses with "changed".
 * - The order is saved to `customerId` (the signed-in account, or `null` for a guest order), which
 *   the digest also binds: signing in or out after the review refuses with "changed".
 * - Stock is decremented here, at placement, with an atomic `stock = stock - qty` in vintage-id
 *   order; the `vintages_stock_non_negative` CHECK refuses a concurrent oversell. The draft is
 *   deleted in the same transaction.
 */
export async function placeOrder(
  clientKey: string,
  reviewedDigest: string,
  lines: CartLine[],
  handle: string | undefined,
  now: Date,
  customerId: number | null,
): Promise<PlaceResult> {
  await releaseExpiredOrders(now);
  const payload = await getPayload({ config });
  const existing = await tokenForKey(payload, clientKey);
  if (existing) return { ok: true, token: existing };
  if (lines.length === 0) return { ok: false, reason: "empty" };

  const req = await createLocalReq({}, payload);
  await initTransaction(req);
  /** Rolls back and returns the token of an order a concurrent duplicate placed, if any. */
  const rollBack = async () => {
    await killTransaction(req);
    return tokenForKey(payload, clientKey);
  };
  const refuse = async (result: PlaceResult & { ok: false }): Promise<PlaceResult> => {
    const winner = await rollBack();
    return winner ? { ok: true, token: winner } : result;
  };
  try {
    const checkout = await readDraft(payload, handle, now, req);
    if (!checkout || checkout.clientKey !== clientKey) return await refuse({ ok: false, reason: "expired" });
    const { buyer, attestedAt, delivery, gift } = checkout;
    if (!buyer || !attestedAt) return await refuse({ ok: false, reason: "buyer" });
    if (!delivery) return await refuse({ ok: false, reason: "delivery", error: "missing" });
    if (!gift) return await refuse({ ok: false, reason: "gift", error: "missing" });

    // The account is the session's, checked again here: an account deleted since the review is a change.
    if (customerId !== null && !(await payload.findByID({ collection: "customers", id: customerId, depth: 0, req, disableErrors: true }))) {
      return await refuse({ ok: false, reason: "changed" });
    }

    const sorted = [...lines].sort((a, b) => a.vintageId - b.vintageId);
    const problems: LineProblem[] = [];
    const snapshots = [];
    for (const { vintageId, qty } of sorted) {
      const v = await payload.findByID({ collection: "vintages", id: vintageId, depth: 0, req, disableErrors: true });
      const wine =
        v && typeof v.wine === "number"
          ? await payload.findByID({ collection: "wines", id: v.wine, depth: 0, locale: "all", req, disableErrors: true })
          : null;
      if (!v || !wine || v.status !== "published" || wine.status !== "published") {
        problems.push({ vintageId, problem: "unavailable", stock: 0 });
      } else if (v.stock < qty) {
        problems.push({ vintageId, problem: "stock", stock: v.stock });
      } else {
        // `locale: "all"` returns every translation of a localized field.
        const name = wine.name as unknown as { vi: string; en: string };
        snapshots.push({
          vintage: v.id,
          wineNameVi: name.vi,
          wineNameEn: name.en,
          year: v.year ?? null,
          bottleMl: v.bottleMl,
          abvPct: v.abvPct,
          unitPriceVnd: v.priceVnd,
          qty,
        });
      }
    }
    if (problems.length > 0) return await refuse({ ok: false, reason: "lines", problems });

    const settings = await loadDeliverySettings(req);
    const isGift = delivery.mode === "gift";
    const review = reviewOrder({
      lines: snapshots.map((s) => ({ vintageId: s.vintage, qty: s.qty, unitPriceVnd: s.unitPriceVnd, bottleMl: Number(s.bottleMl) as BottleSize })),
      buyer,
      delivery,
      gift,
      zone: settings.zones.get(delivery.zone),
      blackoutDates: settings.blackoutDates,
      packaging: gift.packaging === null ? undefined : (await loadPackaging({ code: gift.packaging }, req))[0],
      card: isGift && gift.card !== null ? (await loadCards({ code: gift.card }, req))[0] : undefined,
      customerId,
      now,
    });
    if (!review.ok) {
      return await refuse(review.step === "delivery" ? { ok: false, reason: "delivery", error: review.error } : { ok: false, reason: "gift", error: review.error });
    }
    if (review.digest !== reviewedDigest) return await refuse({ ok: false, reason: "changed" });

    for (const s of snapshots) {
      try {
        await payload.db.updateOne({ collection: "vintages", id: s.vintage, data: { stock: { $inc: -s.qty } }, req, returning: false });
      } catch (error) {
        if (pgCode(error) !== CHECK_VIOLATION) throw error;
        const stock = await stockOf(payload, s.vintage);
        return await refuse({ ok: false, reason: "lines", problems: [{ vintageId: s.vintage, problem: "stock", stock }] });
      }
    }

    const { wrap, card, totals } = review;
    const token = newStatusToken();
    try {
      await payload.create({
        collection: "orders",
        req,
        data: {
          number: newOrderNumber(),
          status: "placed",
          paymentDueAt: paymentDueAt(now).toISOString(),
          token,
          clientKey,
          // Only the session's account, never a match on the buyer's email (G82: no retroactive claim).
          customer: customerId,
          buyer,
          ageAttestedAt: attestedAt,
          delivery: { zone: delivery.zone, mode: delivery.mode, recipient: delivery.recipient ?? undefined, date: delivery.date, window: delivery.window },
          gift: {
            packagingCode: wrap?.code ?? null,
            packagingNameVi: wrap?.nameVi ?? null,
            packagingNameEn: wrap?.nameEn ?? null,
            packagingUnits: wrap?.units ?? null,
            packagingUnitPriceVnd: wrap?.unitPriceVnd ?? null,
            cardCode: card?.code ?? null,
            cardNameVi: card?.name.vi ?? null,
            cardNameEn: card?.name.en ?? null,
            message: isGift ? gift.message : null,
            sender: isGift ? gift.sender : null,
            anonymous: isGift && gift.sender === null,
            hidePrices: isGift && gift.hidePrices,
          },
          lines: snapshots,
          totals,
          consents: { terms: true, privacy: true, at: now.toISOString() },
          payment: { status: "unpaid" },
        },
      });
    } catch (error) {
      const winner = await rollBack();
      if (winner) return { ok: true, token: winner };
      throw error;
    }
    await deleteDraft(payload, handle, req);
    await commitTransaction(req);
    return { ok: true, token };
  } catch (error) {
    await killTransaction(req);
    throw error;
  }
}
