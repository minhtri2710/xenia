import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { type Filters, listWines, parseQuery } from "../src/lib/catalogue";
import { seedCatalogue as seedData, wines as seedWines } from "../src/seed/data";
import { blockThirdParty, seedCatalogue, vietnamDateYearsAgo } from "./support";

const LEGAL_NOTICE = "Không bán rượu, bia cho người chưa đủ 18 tuổi";
const LOCALES = [
  { locale: "vi", prefix: "" },
  { locale: "en", prefix: "/en" },
] as const;

/** What the page must list for a query, from the same seed and the unit-tested module. */
function expected(locale: "vi" | "en", query: string): string[] {
  const filters: Filters = parseQuery(Object.fromEntries(new URLSearchParams(query)));
  return listWines(seedData(locale), filters, locale).map((l) => l.wine.slug);
}

/** Opens the collection through the gate: redirect, adult declaration, return to `next`. */
async function declareAdult(page: Page, prefix = "") {
  await page.goto(`${prefix}/ruou-vang`);
  await expect(page).toHaveURL((url) => url.pathname === `${prefix}/xac-minh-tuoi`);
  await page.locator("#gate-name").fill("Nguyễn Văn An");
  await page.locator("#gate-dob").fill(vietnamDateYearsAgo(30));
  await page.locator("form button[type=submit]").click();
  await expect(page).toHaveURL((url) => url.pathname === `${prefix}/ruou-vang`);
}

const cardSlugs = (page: Page) => page.getByTestId("wine-card").evaluateAll((els) => els.map((e) => e.getAttribute("data-slug")));

test.beforeAll(async ({ request }) => {
  await seedCatalogue(request);
});

test.describe("catalogue access without admin auth (D4: /api is outside the age gate)", () => {
  const secrets = seedWines.flatMap((w) => [w.slug, w.name.vi, w.name.en]);

  for (const path of ["/api/wines", "/api/wines?locale=en&depth=2", "/api/vintages", "/api/producers", "/api/wines?where[slug][equals]=aubeline-brut", "/api/vintages?depth=1"]) {
    test(`GET ${path} returns no catalogue data`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.ok(), `status ${response.status()}`).toBe(false);
      const body = await response.text();
      for (const s of secrets) expect(body).not.toContain(s);
      expect(body).not.toContain("priceVnd");
    });
  }

  test("GraphQL is not routed, so it returns no catalogue data", async ({ request }) => {
    const response = await request.post("/api/graphql", { data: { query: "{ Wines { docs { slug name } } }" } });
    expect(response.ok(), `status ${response.status()}`).toBe(false);
    const body = await response.text();
    for (const s of secrets) expect(body).not.toContain(s);
  });
});

test.describe("unverified visitor", () => {
  for (const { prefix } of LOCALES) {
    test(`is redirected from ${prefix}/ruou-vang to the gate`, async ({ request }) => {
      const path = `${prefix}/ruou-vang?type=red`;
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(307);
      const location = new URL(response.headers()["location"], "http://x");
      expect(location.pathname).toBe(`${prefix}/xac-minh-tuoi`);
      expect(location.searchParams.get("next")).toBe(path);
    });
  }
});

for (const { locale, prefix } of LOCALES) {
  test.describe(`collection page (${locale})`, () => {
    test("lists the seeded published wines with name, producer, type, region and a from-price", async ({ page }) => {
      const external = await blockThirdParty(page);
      await declareAdult(page, prefix);
      await page.goto(`${prefix}/ruou-vang`);

      expect(await cardSlugs(page)).toEqual(expected(locale, ""));
      expect(await cardSlugs(page)).toHaveLength(16);
      expect(await cardSlugs(page)).not.toContain("lune-grise-reserve");

      const card = page.locator('[data-testid="wine-card"][data-slug="aubeline-brut"]');
      await expect(card.getByRole("heading")).toHaveText("Aubeline Brut");
      await expect(card).toContainText("Maison Aubeline");
      await expect(card).toContainText(locale === "vi" ? "Vang sủi · Champagne, Pháp" : "Sparkling · Champagne, France");
      // The lowest published price across its sizes: the 375 ml at 1 350 000 VND.
      await expect(card.getByTestId("price")).toHaveText(locale === "vi" ? /^Từ 1\.350\.000\s₫$/ : /^From ₫1,350,000$/);
      await expect(card.getByRole("link")).toHaveAttribute("href", `${prefix}/ruou-vang/aubeline-brut`);
      await expect(page.locator('[data-slug="sol-alto-rosado"]')).toContainText(locale === "vi" ? "Tạm hết hàng" : "Out of stock");

      await expect(page.getByTestId("age-notice")).toContainText(LEGAL_NOTICE);
      await page.waitForLoadState("networkidle");
      expect(external).toEqual([]);
    });

    test("each facet and sort narrows or orders on the server, from the URL", async ({ page }) => {
      await declareAdult(page, prefix);
      for (const query of [
        "type=sparkling",
        "type=rose",
        "country=IT",
        "country=FR&region=Burgundy",
        "grape=Pinot+Noir",
        "price=lt1m",
        "price=1m-2m",
        "price=2m-4m",
        "price=gte4m",
        "occasion=tet",
        "size=375",
        "size=1500",
        "country=FR&type=red&price=lt1m",
        "size=1500&sort=price-desc",
        "sort=price-asc",
        "sort=price-desc",
      ]) {
        await page.goto(`${prefix}/ruou-vang?${query}`);
        const slugs = await cardSlugs(page);
        expect(slugs, query).toEqual(expected(locale, query));
        expect(slugs.length, query).toBeGreaterThan(0);
        if (!query.startsWith("sort=")) expect(slugs.length, query).toBeLessThan(16);
      }
    });

    test("facet and sort links write their state to the URL", async ({ page }) => {
      await declareAdult(page, prefix);
      await page.goto(`${prefix}/ruou-vang`);
      const filters = page.getByRole("navigation", { name: locale === "vi" ? "Bộ lọc" : "Filters" });

      await filters.getByRole("link", { name: locale === "vi" ? "Pháp" : "France", exact: true }).click();
      await expect(page).toHaveURL((url) => url.search === "?country=FR");
      await filters.getByRole("link", { name: "Bordeaux", exact: true }).click();
      await expect(page).toHaveURL((url) => url.search === "?country=FR&region=Bordeaux");
      await page.getByRole("link", { name: locale === "vi" ? "Giá giảm dần" : "Price, high to low" }).click();
      await expect(page).toHaveURL((url) => url.search === "?country=FR&region=Bordeaux&sort=price-desc");
      expect(await cardSlugs(page)).toEqual(expected(locale, "country=FR&region=Bordeaux&sort=price-desc"));
    });

    test("an empty result says so and clears the filters", async ({ page }) => {
      await declareAdult(page, prefix);
      await page.goto(`${prefix}/ruou-vang?country=NZ&type=sweet`);
      await expect(page.getByTestId("empty-result")).toContainText(locale === "vi" ? "Không có loại vang phù hợp" : "No wines match");
      await page.getByTestId("empty-result").getByRole("link").click();
      await expect(page).toHaveURL((url) => url.pathname === `${prefix}/ruou-vang` && url.search === "");
      expect(await cardSlugs(page)).toHaveLength(16);
    });

    test("has no serious accessibility violations, and home links to it", async ({ page }) => {
      await declareAdult(page, prefix);
      await page.goto(prefix || "/");
      await page.getByRole("link", { name: locale === "vi" ? "Xem bộ sưu tập rượu vang" : "Browse the wine collection" }).click();
      await expect(page).toHaveURL((url) => url.pathname === `${prefix}/ruou-vang`);
      for (const query of ["", "?country=FR&size=750", "?country=NZ&type=sweet"]) {
        await page.goto(`${prefix}/ruou-vang${query}`);
        const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        const blocking = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`), query).toEqual([]);
      }
    });
  });
}
