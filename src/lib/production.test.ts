import { describe, expect, it } from "vitest";

import { assertMockPaymentAllowed, DEV_PAYLOAD_SECRET, productionEnvProblems } from "./production";

const REAL_SECRET = "k".repeat(32);
const REAL_DB = "postgres://xenia:s3cret-from-the-host@db.internal:5432/xenia";

describe("productionEnvProblems", () => {
  it("checks nothing outside a running production server", () => {
    expect(productionEnvProblems({ NODE_ENV: "development", PAYLOAD_SECRET: DEV_PAYLOAD_SECRET })).toEqual([]);
    expect(productionEnvProblems({ NODE_ENV: "test" })).toEqual([]);
    expect(productionEnvProblems({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build", PAYLOAD_SECRET: DEV_PAYLOAD_SECRET })).toEqual([]);
  });

  it("refuses the .env.example placeholders in production", () => {
    expect(
      productionEnvProblems({
        NODE_ENV: "production",
        PAYLOAD_SECRET: DEV_PAYLOAD_SECRET,
        DATABASE_URI: "postgres://xenia:xenia-dev-only@127.0.0.1:5437/xenia",
      }),
    ).toEqual([
      "PAYLOAD_SECRET is the development placeholder from .env.example.",
      "DATABASE_URI uses the development password from .env.example.",
    ]);
  });

  it("refuses a short or missing secret", () => {
    expect(productionEnvProblems({ NODE_ENV: "production", PAYLOAD_SECRET: "k".repeat(31), DATABASE_URI: REAL_DB })).toEqual([
      "PAYLOAD_SECRET must be at least 32 characters.",
    ]);
    expect(productionEnvProblems({ NODE_ENV: "production", DATABASE_URI: REAL_DB })).toEqual(["PAYLOAD_SECRET must be at least 32 characters."]);
  });

  it("accepts real values", () => {
    expect(productionEnvProblems({ NODE_ENV: "production", PAYLOAD_SECRET: REAL_SECRET, DATABASE_URI: REAL_DB })).toEqual([]);
  });
});

describe("assertMockPaymentAllowed", () => {
  it("allows the mock outside production and refuses it in production", () => {
    expect(() => assertMockPaymentAllowed(false)).not.toThrow();
    expect(() => assertMockPaymentAllowed(true)).toThrow(/production/);
  });
});
