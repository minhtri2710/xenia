import config from "@payload-config";
import { sql } from "@payloadcms/db-postgres";
import { commitTransaction, createLocalReq, getPayload, initTransaction, killTransaction } from "payload";

import type { PaymentMethod } from "@/lib/order";

async function executeInTransaction(
  payload: Awaited<ReturnType<typeof getPayload>>,
  req: Awaited<ReturnType<typeof createLocalReq>>,
  statement: ReturnType<typeof sql>,
) {
  const id = await req.transactionID;
  const db = id ? payload.db.sessions?.[id]?.db as NonNullable<Parameters<typeof payload.db.execute>[0]["db"]> | undefined : undefined;
  if (!db) throw new Error("The order transaction is unavailable.");
  return payload.db.execute({ db, sql: statement });
}

/** Expires due orders and restores their reserved stock on the caller's transaction. */
async function releaseExpiredInTransaction(
  payload: Awaited<ReturnType<typeof getPayload>>,
  req: Awaited<ReturnType<typeof createLocalReq>>,
  now: Date,
): Promise<number> {
  // One indexed query finds due, unpaid placed orders. Conditional writes below serialize against
  // payment; a competing update rechecks these predicates after obtaining the order row lock.
  const due = await executeInTransaction(payload, req, sql`
    SELECT id
    FROM orders
    WHERE status = 'placed'
      AND payment_status <> 'paid'
      AND payment_due_at <= ${now.toISOString()}::timestamptz
    ORDER BY id
  `);
  const orderIds = (due.rows as { id: number }[]).map(({ id }) => id);

  let released = 0;
  for (const orderId of orderIds) {
    const claim = await executeInTransaction(payload, req, sql`
      UPDATE orders
      SET status = 'expired', updated_at = ${now.toISOString()}::timestamptz
      WHERE id = ${orderId}
        AND status = 'placed'
        AND payment_status <> 'paid'
      RETURNING id
    `);
    if (claim.rows.length === 0) continue;
    released += 1;
    const { docs } = await payload.find({
      collection: "orders",
      where: { id: { equals: orderId } },
      depth: 0,
      limit: 1,
      req,
    });
    const order = docs[0];
    if (!order) throw new Error(`Expired order ${orderId} disappeared during stock release.`);
    const lines = [...order.lines].sort((a, b) => {
      const idOf = (vintage: number | { id: number } | null | undefined) => typeof vintage === "number" ? vintage : vintage?.id ?? 0;
      return idOf(a.vintage) - idOf(b.vintage);
    });
    for (const line of lines) {
      const vintageId = typeof line.vintage === "number" ? line.vintage : line.vintage?.id;
      if (vintageId === undefined || vintageId === null) throw new Error(`Expired order ${order.id} has a line without a vintage.`);
      await payload.db.updateOne({
        collection: "vintages",
        id: vintageId,
        data: { stock: { $inc: line.qty } },
        req,
        returning: false,
      });
    }
  }
  return released;
}

/** Finds every due unpaid placed order and atomically expires it and restores its stock. */
export async function releaseExpiredOrders(now: Date): Promise<number> {
  const payload = await getPayload({ config });
  const req = await createLocalReq({}, payload);
  await initTransaction(req);
  try {
    const released = await releaseExpiredInTransaction(payload, req, now);
    await commitTransaction(req);
    return released;
  } catch (error) {
    await killTransaction(req);
    throw error;
  }
}

/** Releases due orders, then conditionally records one mock payment attempt. */
export async function recordPayment(
  token: string,
  method: PaymentMethod,
  outcome: "success" | "failure",
): Promise<"paid" | "failed" | "expired" | "unavailable"> {
  const attemptAt = new Date();
  await releaseExpiredOrders(attemptAt);
  const payload = await getPayload({ config });
  const req = await createLocalReq({}, payload);
  await initTransaction(req);
  try {
    const row = await payload.find({ collection: "orders", where: { token: { equals: token } }, depth: 0, limit: 1, req });
    const order = row.docs[0];
    if (!order || order.status === "expired") {
      await commitTransaction(req);
      return order?.status === "expired" ? "expired" : "unavailable";
    }
    if (order.status !== "placed" || order.payment.status === "paid") {
      await commitTransaction(req);
      return "unavailable";
    }

    const result = outcome === "success"
      ? await executeInTransaction(payload, req, sql`
          UPDATE orders
          SET status = 'paid', payment_status = 'paid', payment_method = ${method}, payment_paid_at = ${attemptAt.toISOString()}::timestamptz, updated_at = ${attemptAt.toISOString()}::timestamptz
          WHERE id = ${order.id} AND status = 'placed' AND payment_status <> 'paid'
          RETURNING id
        `)
      : await executeInTransaction(payload, req, sql`
          UPDATE orders
          SET payment_status = 'failed', payment_method = ${method}, updated_at = ${attemptAt.toISOString()}::timestamptz
          WHERE id = ${order.id} AND status = 'placed' AND payment_status <> 'paid'
          RETURNING id
        `);
    if (result.rows.length > 0) {
      await commitTransaction(req);
      return outcome === "success" ? "paid" : "failed";
    }

    const current = await payload.find({ collection: "orders", where: { id: { equals: order.id } }, depth: 0, limit: 1, req });
    await commitTransaction(req);
    return current.docs[0]?.status === "expired" ? "expired" : "unavailable";
  } catch (error) {
    await killTransaction(req);
    throw error;
  }
}
