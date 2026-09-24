import { describe, expect, it } from "vitest";

import { safeReturnPath } from "./return-path";

describe("safeReturnPath", () => {
  it.each([
    ["/", "/"],
    ["/ruou-vang/vang-do?vintage=2019", "/ruou-vang/vang-do?vintage=2019"],
    ["/en", "/en"],
    ["/en/qua-tang#top", "/en/qua-tang#top"],
  ])("keeps the same-origin path %j", (raw, expected) => {
    expect(safeReturnPath(raw)).toBe(expected);
  });

  it.each([
    "https://evil.example/",
    "http://evil.example",
    "//evil.example",
    "//evil.example/path",
    "/\\evil.example",
    "\\\\evil.example",
    "/\t/evil.example",
    "/.//evil.example",
    "javascript:alert(1)",
    "evil.example",
    "",
  ])("rejects %j in favour of /", (raw) => {
    expect(safeReturnPath(raw)).toBe("/");
  });

  it.each([undefined, null, 42, ["/a"]])("rejects the non-string %j", (raw) => {
    expect(safeReturnPath(raw)).toBe("/");
  });
});
