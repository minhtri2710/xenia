import type { EmailAdapter } from "payload";

import { OUTBOX_TTL_HOURS } from "./accounts";

export const OUTBOX_SLUG = "mock-outbox";

export type OutboxRow = { to: string; subject: string; body: string; sentAt: string };

/** The two things the adapter does to the outbox; the Payload-backed store is below. */
export type OutboxStore = {
  deleteBefore(cutoff: Date): Promise<void>;
  add(row: OutboxRow): Promise<void>;
};

/** What the adapter is given (Payload's `SendEmailOptions`): only `to`, `subject`, `html` and `text` are read. */
export type Message = Record<string, unknown>;

const recipient = (to: unknown): string => {
  if (typeof to === "string") return to;
  if (Array.isArray(to)) return to.map(recipient).join(", ");
  if (to && typeof to === "object" && "address" in to && typeof to.address === "string") return to.address;
  return "";
};

/**
 * The mock outbox (F8 D3): a message is one row, and that is all. No network call, no provider, no
 * key. Every send first deletes what is older than `OUTBOX_TTL_HOURS`. It refuses in production
 * (fails closed) until a real provider is gated by the Human.
 */
export async function sendToOutbox(store: OutboxStore, message: Message, { production, now }: { production: boolean; now: Date }) {
  if (production) throw new Error("The mock outbox never sends in production: no email provider is configured.");
  await store.deleteBefore(new Date(now.getTime() - OUTBOX_TTL_HOURS * 60 * 60 * 1000));
  const body = typeof message.html === "string" ? message.html : typeof message.text === "string" ? message.text : "";
  await store.add({ to: recipient(message.to), subject: typeof message.subject === "string" ? message.subject : "", body, sentAt: now.toISOString() });
}

/** Payload's email adapter (`email` in `payload.config.ts`); all Payload mail goes through it. */
export const mockEmailAdapter: EmailAdapter = ({ payload }) => ({
  name: "mock-outbox",
  defaultFromAddress: "no-reply@xenia.invalid",
  defaultFromName: "Xenia",
  sendEmail: (message) =>
    sendToOutbox(
      {
        deleteBefore: async (cutoff) => {
          await payload.delete({ collection: OUTBOX_SLUG, where: { sentAt: { less_than: cutoff.toISOString() } } });
        },
        add: async (row) => {
          await payload.create({ collection: OUTBOX_SLUG, data: row });
        },
      },
      message,
      { production: process.env.NODE_ENV === "production", now: new Date() },
    ),
});
