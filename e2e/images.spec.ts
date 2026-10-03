import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { declareAdult, expectNoSeriousA11yViolations, seedCatalogue } from "./support";

// A 1×1 PNG stands in for real photos. The spec only writes a file that is not there yet and removes
// only what it wrote, so a real photo at the same name is never touched.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
const WINE = "aubeline-brut";
const FILES = [`images/wines/${WINE}.png`, "images/site/home-hero.png"];
const written: string[] = [];

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  await seedCatalogue(request);
  for (const relative of FILES) {
    const file = path.join("public", relative);
    if (existsSync(file)) continue;
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, PNG);
    written.push(file);
  }
});

test.afterAll(() => {
  for (const file of written) rmSync(file);
});

test("a photo is behind the age gate like every storefront path", async ({ request }) => {
  const response = await request.get(`/${FILES[1]}`, { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  const location = new URL(response.headers()["location"], "http://x");
  expect(location.pathname).toBe("/xac-minh-tuoi");
  expect(location.searchParams.get("next")).toBe(`/${FILES[1]}`);
});

test("after the declaration the photo is served as a file and replaces the placeholders that name it", async ({ page }) => {
  await declareAdult(page, "/");
  const file = await page.request.get(`/${FILES[1]}`);
  expect(file.status()).toBe(200);
  expect(file.headers()["content-type"]).toBe("image/png");

  await expect(page.getByTestId("home-hero-photo")).toHaveAttribute("src", `/${FILES[1]}`);

  for (const prefix of ["", "/en"]) {
    await page.goto(`${prefix}/ruou-vang/${WINE}`);
    const photo = page.getByTestId("product-photo");
    await expect(photo).toHaveAttribute("src", `/${FILES[0]}`);
    await expect(photo).toHaveAttribute("alt", "Aubeline Brut");
    await expectNoSeriousA11yViolations(page, `product photo ${prefix || "vi"}`);
  }

  await page.goto("/ruou-vang");
  await expect(page.locator(`[data-testid="wine-card"][data-slug="${WINE}"] img`)).toHaveAttribute("src", `/${FILES[0]}`);
  // A wine without a photo keeps its CSS placeholder.
  await expect(page.locator('[data-testid="wine-card"][data-slug="lune-grise-rouge"] img')).toHaveCount(0);
});
