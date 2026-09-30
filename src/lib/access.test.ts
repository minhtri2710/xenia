import type { PayloadRequest } from "payload";
import { beforeAll, describe, expect, it } from "vitest";

// V1 (unit half): every collection and global Payload is configured with, read from the sanitized
// config, answers a customer with `false` and an administrator with `true`, operation by operation.
// The HTTP half, with the real cookie and JWT header, is in e2e/account.spec.ts.
process.env.PAYLOAD_SECRET ??= "unit-test-secret";
process.env.DATABASE_URI ??= "postgres://unused:unused@127.0.0.1:1/unused";

const asUser = (collection: string) => ({ req: { user: { collection, id: 1 } } as unknown as PayloadRequest });
const anonymous = { req: { user: null } as unknown as PayloadRequest };

type Rule = (args: { req: PayloadRequest }) => unknown;
let collections: { slug: string; access: Record<string, Rule | undefined> }[];
let globals: { slug: string; access: Record<string, Rule | undefined> }[];

beforeAll(async () => {
  const config = await (await import("../payload.config")).default;
  collections = config.collections as never;
  globals = config.globals as never;
});

const COLLECTION_OPS = ["create", "read", "update", "delete", "readVersions"] as const;
const GLOBAL_OPS = ["read", "update", "readVersions"] as const;
// Payload's own collections (preferences, migrations, kv) are not ours to configure.
const ours = <T extends { slug: string }>(rows: T[]) => rows.filter((row) => !row.slug.startsWith("payload-"));

describe("access, from the configured slugs", () => {
  it("covers every collection the shop defines", () => {
    expect(ours(collections).map((c) => c.slug).sort()).toEqual(
      ["card-designs", "checkout-drafts", "customers", "mock-outbox", "orders", "packaging", "producers", "users", "vintages", "wines"].sort(),
    );
    expect(globals.map((g) => g.slug)).toEqual(["site-settings"]);
  });

  it("has no document-lock collection, whose default access would let any signed-in user in", () => {
    expect(collections.map((c) => c.slug)).not.toContain("payload-locked-documents");
  });

  it("gives a customer and an anonymous visitor false on every operation, and an administrator true", async () => {
    // Closed for everyone: `create`/`delete` on orders and customers, and the outbox's writes.
    const closed = new Set(["orders:create", "orders:delete", "customers:create", "customers:update", "customers:delete", "mock-outbox:create", "mock-outbox:update", "mock-outbox:delete"]);
    for (const c of ours(collections)) {
      for (const op of [...COLLECTION_OPS, ...(c.slug === "users" || c.slug === "customers" ? (["admin", "unlock"] as const) : [])]) {
        const rule = c.access[op];
        expect(rule, `${c.slug}.${op} has an explicit rule`).toBeTypeOf("function");
        const key = `${c.slug}:${op}`;
        expect(await rule!(asUser("customers")), `${key} for a customer`).toBe(false);
        expect(await rule!(anonymous), `${key} anonymous`).toBe(false);
        const admin = await rule!(asUser("users"));
        expect(admin, `${key} for an administrator`).toBe(op === "admin" && c.slug === "customers" ? false : !closed.has(key));
      }
    }
    for (const g of globals) {
      for (const op of GLOBAL_OPS) {
        expect(await g.access[op]!(asUser("customers")), `${g.slug}.${op} customer`).toBe(false);
        expect(await g.access[op]!(asUser("users")), `${g.slug}.${op} admin`).toBe(true);
      }
    }
  });
});
