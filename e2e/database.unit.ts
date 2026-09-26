import { afterEach, describe, expect, it, vi } from "vitest";

import { databaseName } from "./database";

describe("databaseName", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("fails fast when DATABASE_URI names no database", () => {
    vi.stubEnv("DATABASE_URI", "postgres://xenia:dev@127.0.0.1:5437/");
    expect(() => databaseName()).toThrow("DATABASE_URI names no database");
  });

  it("fails fast when DATABASE_URI is missing", () => {
    vi.stubEnv("DATABASE_URI", undefined);
    expect(() => databaseName()).toThrow("DATABASE_URI is not set");
  });
});
