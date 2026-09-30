import { afterEach, describe, expect, it, vi } from "vitest";

import { ACCOUNT_COOKIE } from "./accounts";

// V11 (unit half): the account cookie `signIn` sets carries the shared attributes, is a session
// cookie (no `maxAge`, no `expires`; the token itself expires on the server), and is Secure only in
// production. The HTTP half, in a real browser, is in e2e/account.spec.ts.
const { set } = vi.hoisted(() => ({ set: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: async () => ({ set, get: () => undefined, delete: vi.fn() }) }));
vi.mock("@payload-config", () => ({ default: {} }));
vi.mock("payload", () => ({
  getPayload: async () => ({ login: async () => ({ token: "a-token" }) }),
  commitTransaction: vi.fn(),
  createLocalReq: vi.fn(),
  initTransaction: vi.fn(),
  killTransaction: vi.fn(),
  logoutOperation: vi.fn(),
  UnverifiedEmail: class UnverifiedEmail extends Error {},
}));

afterEach(() => {
  vi.unstubAllEnvs();
  set.mockClear();
});

// The options are read when the module loads, so each environment gets a fresh copy of it.
async function signInIn(nodeEnv: string) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", nodeEnv);
  const { signIn } = await import("./account-data");
  return signIn("a@example.test", "a long enough password");
}

describe("signIn's account cookie", () => {
  it.each([
    ["production", true],
    ["development", false],
  ] as const)("in %s is a session cookie with the shared attributes, Secure: %s", async (nodeEnv, secure) => {
    expect(await signInIn(nodeEnv)).toBe(true);
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(ACCOUNT_COOKIE, "a-token", { httpOnly: true, sameSite: "lax", secure, path: "/" });
  });
});
