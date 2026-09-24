/**
 * Server-side checkout drafts (`checkout-drafts`): the checkout state between steps, keyed by the
 * handle in the `xenia_checkout` cookie. A draft expires DRAFT_TTL_MS after its last write; a read
 * treats an expired draft exactly like a missing one, and every write first deletes every expired
 * draft. Placement and the under-18 refusal delete the draft. Drafts hold personal data (buyer,
 * recipient, message) and are never logged. The current instant is always a parameter.
 */
import type { BasePayload, PayloadRequest } from "payload";

import { type Checkout, newHandle, parseCheckout } from "./checkout";

export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

type Store = Pick<BasePayload, "find" | "create" | "update" | "delete">;

/**
 * The live draft for `handle`: the handle matched exactly and the expiry filtered in the same query,
 * so an unknown, altered or expired handle all come back as the same `null`.
 */
async function findLive(payload: Store, handle: string, now: Date, req?: Partial<PayloadRequest>) {
  const { docs } = await payload.find({
    collection: "checkout-drafts",
    where: { and: [{ handle: { equals: handle } }, { expiresAt: { greater_than: now.toISOString() } }] },
    depth: 0,
    limit: 1,
    pagination: false,
    req,
  });
  return docs[0] ?? null;
}

export async function readDraft(payload: Store, handle: string | undefined, now: Date, req?: Partial<PayloadRequest>): Promise<Checkout | null> {
  const doc = handle ? await findLive(payload, handle, now, req) : null;
  return parseCheckout(doc as Record<string, unknown> | null);
}

/** Deletes every draft whose `expiresAt` is at or before `now`. */
export async function purgeExpiredDrafts(payload: Store, now: Date) {
  await payload.delete({ collection: "checkout-drafts", where: { expiresAt: { less_than_equal: now.toISOString() } } });
}

function draftData(state: Checkout, now: Date) {
  const { buyer, delivery, gift } = state;
  return {
    clientKey: state.clientKey,
    expiresAt: new Date(now.getTime() + DRAFT_TTL_MS).toISOString(),
    buyer: buyer ?? { name: null, phone: null, email: null, address: null },
    attestedAt: state.attestedAt ?? null,
    delivery: delivery
      ? { ...delivery, recipient: delivery.recipient ?? { name: null, phone: null, address: null } }
      : { zone: null, mode: null, date: null, window: null, recipient: { name: null, phone: null, address: null } },
    gift: gift ? { saved: true, ...gift } : { saved: false, packaging: null, card: null, message: null, sender: null, hidePrices: null },
  };
}

/**
 * Writes `state` to the live draft for `handle`, or to a new draft under a fresh handle when there is
 * none (a handle is never reused for a new draft). Expired drafts are deleted first. Returns the
 * handle the cookie must carry.
 */
export async function writeDraft(payload: Store, handle: string | undefined, state: Checkout, now: Date): Promise<string> {
  await purgeExpiredDrafts(payload, now);
  const live = handle ? await findLive(payload, handle, now) : null;
  const data = draftData(state, now);
  if (live) {
    await payload.update({ collection: "checkout-drafts", id: live.id, data: data as never, depth: 0 });
    return live.handle;
  }
  const fresh = newHandle();
  await payload.create({ collection: "checkout-drafts", data: { ...data, handle: fresh } as never, depth: 0 });
  return fresh;
}

export async function deleteDraft(payload: Store, handle: string | undefined, req?: Partial<PayloadRequest>) {
  if (!handle) return;
  await payload.delete({ collection: "checkout-drafts", where: { handle: { equals: handle } }, req });
}
