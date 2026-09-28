import { describe, expect, it } from "vitest";

import { cookieOptions } from "./cookies";

describe("cookieOptions", () => {
  it("is HttpOnly, SameSite=Lax, Path=/, Secure in production only, and sets no lifetime", () => {
    expect(cookieOptions(true)).toEqual({ httpOnly: true, sameSite: "lax", secure: true, path: "/" });
    expect(cookieOptions(false)).toEqual({ httpOnly: true, sameSite: "lax", secure: false, path: "/" });
  });
});
