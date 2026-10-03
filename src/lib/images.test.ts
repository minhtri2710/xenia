import { describe, expect, it } from "vitest";

import { imageUrl, isImagePath } from "./images";

describe("imageUrl", () => {
  const files = (...present: string[]) => (relative: string) => present.includes(relative);

  it("finds a wine photo and a site photo, preferring the first extension in order", () => {
    expect(imageUrl("wines/aubeline-brut", files("images/wines/aubeline-brut.jpg", "images/wines/aubeline-brut.webp"))).toBe("/images/wines/aubeline-brut.webp");
    expect(imageUrl("site/home-hero", files("images/site/home-hero.png"))).toBe("/images/site/home-hero.png");
  });

  it("is null when no file exists", () => {
    expect(imageUrl("wines/aubeline-brut", files())).toBeNull();
  });

  it.each(["wines/../secret", "wines/Aubeline", "wines/a--b", "wines/", "site/../x", "other/x", "wines/a/b"])("never looks up %s", (name) => {
    let asked = false;
    expect(imageUrl(name, () => (asked = true))).toBeNull();
    expect(asked).toBe(false);
  });
});

describe("isImagePath", () => {
  it.each([
    ["/images/wines/a.webp", true],
    ["/images/site/home-hero.JPG", true],
    ["/images/wines/a.svg", false],
    ["/images/../proxy.webp", false],
    ["/ruou-vang/a.webp", false],
    ["/images", false],
  ])("%s → %s", (path, expected) => {
    expect(isImagePath(path)).toBe(expected);
  });
});
