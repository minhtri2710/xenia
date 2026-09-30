import { afterEach, describe, expect, it, vi } from "vitest";

import { OUTBOX_TTL_HOURS } from "./accounts";
import { mockEmailAdapter, type OutboxRow, sendToOutbox } from "./outbox";

const NOW = new Date("2026-09-30T05:00:00.000Z");

function store() {
  const rows: OutboxRow[] = [];
  const cutoffs: Date[] = [];
  return {
    rows,
    cutoffs,
    deleteBefore: async (cutoff: Date) => void cutoffs.push(cutoff),
    add: async (row: OutboxRow) => void rows.push(row),
  };
}

describe("sendToOutbox", () => {
  it("writes exactly one row per message and no network call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const s = store();
    await sendToOutbox(s, { to: "a@example.com", subject: "Hi", html: "<p>x</p>" }, { production: false, now: NOW });
    expect(s.rows).toEqual([{ to: "a@example.com", subject: "Hi", body: "<p>x</p>", sentAt: "2026-09-30T05:00:00.000Z" }]);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("purges what is older than the TTL on every send, at a fixed instant", async () => {
    const s = store();
    await sendToOutbox(s, { to: "a@example.com", subject: "1", html: "" }, { production: false, now: NOW });
    await sendToOutbox(s, { to: "a@example.com", subject: "2", html: "" }, { production: false, now: NOW });
    expect(OUTBOX_TTL_HOURS).toBe(24);
    expect(s.cutoffs.map((c) => c.toISOString())).toEqual(["2026-09-29T05:00:00.000Z", "2026-09-29T05:00:00.000Z"]);
  });

  it("refuses in production before it touches the store", async () => {
    const s = store();
    await expect(sendToOutbox(s, { to: "a@example.com", subject: "x", html: "" }, { production: true, now: NOW })).rejects.toThrow(/production/);
    expect(s.rows).toEqual([]);
    expect(s.cutoffs).toEqual([]);
  });

  it("reads a recipient list and falls back to text", async () => {
    const s = store();
    await sendToOutbox(s, { to: [{ address: "a@example.com" }, "b@example.com"], subject: "x", text: "plain" }, { production: false, now: NOW });
    expect(s.rows[0]).toMatchObject({ to: "a@example.com, b@example.com", body: "plain" });
  });
});

describe("mockEmailAdapter", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  const adapterWith = () => {
    const payload = { delete: vi.fn(async () => ({})), create: vi.fn(async () => ({})) };
    return { payload, adapter: mockEmailAdapter({ payload: payload as never }) };
  };

  it("refuses in production through the wiring Payload uses: nothing is deleted or written", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { payload, adapter } = adapterWith();
    await expect(adapter.sendEmail({ to: "a@example.com", subject: "x", html: "<p>x</p>" })).rejects.toThrow(/production/);
    expect(payload.delete).not.toHaveBeenCalled();
    expect(payload.create).not.toHaveBeenCalled();
  });

  it("writes one row outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { payload, adapter } = adapterWith();
    await adapter.sendEmail({ to: "a@example.com", subject: "Hi", html: "<p>x</p>" });
    expect(payload.create).toHaveBeenCalledTimes(1);
    expect(payload.create).toHaveBeenCalledWith({ collection: "mock-outbox", data: expect.objectContaining({ to: "a@example.com", subject: "Hi", body: "<p>x</p>" }) });
  });

  it("deletes what is older than the TTL at the fixed instant, and makes no network call", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { payload, adapter } = adapterWith();
    await adapter.sendEmail({ to: "a@example.com", subject: "Hi", html: "<p>x</p>" });
    expect(payload.delete).toHaveBeenCalledTimes(1);
    expect(payload.delete).toHaveBeenCalledWith({ collection: "mock-outbox", where: { sentAt: { less_than: "2026-09-29T05:00:00.000Z" } } });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
