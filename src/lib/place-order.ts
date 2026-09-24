import config from "@payload-config";
import { type BasePayload, commitTransaction, createLocalReq, getPayload, initTransaction, killTransaction } from "payload";

import type { CartLine } from "@/lib/cart";
import type { Checkout } from "@/lib/checkout";
import { newOrderNumber, newStatusToken } from "@/lib/order";
import { computeTotals } from "@/lib/order-totals";

export type LineProblem = { vintageId: number; problem: "unavailable" | "stock"; stock: number };

export type PlaceResult =
  | { ok: true; token: string }
  | { ok: false; reason: "expired" | "empty" | "buyer" | "zone" }
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
 * database and the zone fee; nothing the client posts is read here except the cart's vintage ids
 * and quantities and the checkout state, both re-validated.
 *
 * - Idempotent on the client key posted with the review form, which is the checkout state's key:
 *   an order with that key is returned instead of a second one, even after the cookies are
 *   cleared (back-and-resubmit, replayed POST). A concurrent duplicate (double submit) loses on
 *   the unique `clientKey` index, rolls back and returns the winner.
 * - Every line is re-read: a draft or missing vintage or wine, or a quantity above stock, refuses
 *   the whole order with a per-line problem.
 * - Stock is decremented here, at placement, with an atomic `stock = stock - qty` in vintage-id
 *   order; the `vintages_stock_non_negative` CHECK refuses a concurrent oversell.
 */
export async function placeOrder(clientKey: string, lines: CartLine[], checkout: Checkout | null, now: Date): Promise<PlaceResult> {
  const payload = await getPayload({ config });
  const existing = await tokenForKey(payload, clientKey);
  if (existing) return { ok: true, token: existing };

  if (!checkout || checkout.key !== clientKey) return { ok: false, reason: "expired" };
  if (lines.length === 0) return { ok: false, reason: "empty" };
  const { buyer, attestedAt, zone } = checkout;
  if (!buyer || !attestedAt) return { ok: false, reason: "buyer" };
  const settings = await payload.findGlobal({ slug: "site-settings", depth: 0 });
  const fee = settings.zones?.find((z) => z.zone === zone)?.feeVnd;
  if (!zone || fee === undefined) return { ok: false, reason: "zone" };

  const req = await createLocalReq({}, payload);
  await initTransaction(req);
  try {
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
    if (problems.length > 0) {
      await killTransaction(req);
      return { ok: false, reason: "lines", problems };
    }

    const totals = computeTotals(snapshots, fee);

    for (const s of snapshots) {
      try {
        await payload.db.updateOne({ collection: "vintages", id: s.vintage, data: { stock: { $inc: -s.qty } }, req, returning: false });
      } catch (error) {
        if (pgCode(error) !== CHECK_VIOLATION) throw error;
        await killTransaction(req);
        return { ok: false, reason: "lines", problems: [{ vintageId: s.vintage, problem: "stock", stock: await stockOf(payload, s.vintage) }] };
      }
    }

    const token = newStatusToken();
    try {
      await payload.create({
        collection: "orders",
        req,
        data: {
          number: newOrderNumber(),
          status: "placed",
          token,
          clientKey,
          buyer,
          ageAttestedAt: attestedAt,
          delivery: { zone },
          lines: snapshots,
          totals,
          consents: { terms: true, privacy: true, at: now.toISOString() },
          payment: { status: "unpaid" },
        },
      });
    } catch (error) {
      await killTransaction(req);
      const winner = await tokenForKey(payload, clientKey);
      if (winner) return { ok: true, token: winner };
      throw error;
    }
    await commitTransaction(req);
    return { ok: true, token };
  } catch (error) {
    await killTransaction(req);
    throw error;
  }
}
