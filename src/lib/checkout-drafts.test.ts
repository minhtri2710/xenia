import { describe, expect, it } from "vitest";

import { DRAFT_TTL_MS, purgeExpiredDrafts, readDraft, writeDraft } from "./checkout-drafts";

const KEY = "0b6f3a52-6a61-4c1e-9d2e-3f1f6f0b9a11";
const BUYER = { name: "Nguyễn Văn An", phone: "0901234567", email: "an@example.test", address: "12 Lê Lợi, Quận 1" };
const AT = "2026-09-24T03:00:00.000Z";
const NOW = new Date("2026-09-24T03:00:00.000Z");
const at = (ms: number) => new Date(NOW.getTime() + ms);

type Row = Record<string, unknown> & { id: number; handle: string; expiresAt: string };
type Where = Record<string, unknown>;

/**
 * An in-memory stand-in for the Payload Local API calls the store makes. It evaluates the `where`
 * clauses the store sends (and, equals, greater_than, less_than_equal on ISO instants and strings),
 * so a store that drops or widens a condition behaves differently here too.
 */
function fakePayload(rows: Row[] = []) {
  let nextId = rows.length + 1;
  const matches = (row: Row, where: Where): boolean =>
    Object.entries(where).every(([field, cond]) => {
      if (field === "and") return (cond as Where[]).every((w) => matches(row, w));
      const value = row[field] as string;
      return Object.entries(cond as Where).every(([op, operand]) => {
        if (op === "equals") return value === operand;
        if (op === "greater_than") return value > (operand as string);
        if (op === "less_than_equal") return value <= (operand as string);
        throw new Error(`unsupported operator ${op}`);
      });
    });
  const api = {
    rows,
    find: async ({ where }: { where: Where }) => ({ docs: rows.filter((r) => matches(r, where)) }),
    create: async ({ data }: { data: Row }) => {
      const row = { ...data, id: nextId++ };
      rows.push(row);
      return row;
    },
    update: async ({ id, data }: { id: number; data: Partial<Row> }) => {
      const row = rows.find((r) => r.id === id)!;
      Object.assign(row, data);
      return row;
    },
    delete: async ({ where }: { where: Where }) => {
      const keep = rows.filter((r) => !matches(r, where));
      rows.splice(0, rows.length, ...keep);
      return { docs: [] };
    },
  };
  return api as typeof api & Parameters<typeof readDraft>[0];
}

const draftRow = (id: number, handle: string, expiresAt: Date): Row => ({ id, handle, clientKey: KEY, expiresAt: expiresAt.toISOString(), buyer: BUYER, attestedAt: AT });

describe("checkout drafts", () => {
  it("writes a new draft under a fresh 256-bit handle and reads it back", async () => {
    const payload = fakePayload();
    const handle = await writeDraft(payload, undefined, { clientKey: KEY, buyer: BUYER, attestedAt: AT }, NOW);
    expect(handle).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(payload.rows).toHaveLength(1);
    expect(payload.rows[0].expiresAt).toBe(at(DRAFT_TTL_MS).toISOString());
    expect(await readDraft(payload, handle, NOW)).toEqual({ clientKey: KEY, buyer: BUYER, attestedAt: AT });
  });

  it("updates the live draft in place and moves its expiry to 24 h after the last write", async () => {
    const payload = fakePayload();
    const handle = await writeDraft(payload, undefined, { clientKey: KEY }, NOW);
    const later = at(60 * 60 * 1000);
    expect(await writeDraft(payload, handle, { clientKey: KEY, buyer: BUYER, attestedAt: AT }, later)).toBe(handle);
    expect(payload.rows).toHaveLength(1);
    expect(payload.rows[0].expiresAt).toBe(new Date(later.getTime() + DRAFT_TTL_MS).toISOString());
  });

  it("never reuses a handle it did not find live: an unknown cookie handle gets a new draft under a fresh handle", async () => {
    const payload = fakePayload();
    const planted = "A".repeat(43);
    const handle = await writeDraft(payload, planted, { clientKey: KEY }, NOW);
    expect(handle).not.toBe(planted);
    expect(payload.rows.map((r) => r.handle)).toEqual([handle]);
  });

  it("reads a draft live at expiresAt − 1 ms and absent at expiresAt", async () => {
    const handle = "h".repeat(43);
    const payload = fakePayload([draftRow(1, handle, at(DRAFT_TTL_MS))]);
    expect(await readDraft(payload, handle, at(DRAFT_TTL_MS - 1))).toMatchObject({ clientKey: KEY, buyer: BUYER });
    expect(await readDraft(payload, handle, at(DRAFT_TTL_MS))).toBeNull();
  });

  it("reads an unknown handle, a handle one character off and a missing cookie as the same absent value", async () => {
    const handle = "h".repeat(43);
    const payload = fakePayload([draftRow(1, handle, at(DRAFT_TTL_MS))]);
    expect(await readDraft(payload, "u".repeat(43), NOW)).toBeNull();
    expect(await readDraft(payload, `${"h".repeat(42)}i`, NOW)).toBeNull();
    expect(await readDraft(payload, handle.slice(1), NOW)).toBeNull();
    expect(await readDraft(payload, undefined, NOW)).toBeNull();
  });

  it("purges exactly the drafts whose expiresAt is at or before now", async () => {
    const payload = fakePayload([
      draftRow(1, "a".repeat(43), at(-DRAFT_TTL_MS)),
      draftRow(2, "b".repeat(43), at(-1)),
      draftRow(3, "c".repeat(43), at(0)),
      draftRow(4, "d".repeat(43), at(1)),
      draftRow(5, "e".repeat(43), at(DRAFT_TTL_MS)),
    ]);
    await purgeExpiredDrafts(payload, NOW);
    expect(payload.rows.map((r) => r.id)).toEqual([4, 5]);
  });

  it("purges expired drafts on every write", async () => {
    const payload = fakePayload([draftRow(1, "a".repeat(43), at(-1)), draftRow(2, "b".repeat(43), at(1))]);
    const handle = await writeDraft(payload, undefined, { clientKey: KEY }, NOW);
    expect(payload.rows.map((r) => r.handle)).toEqual(["b".repeat(43), handle]);
  });
});
