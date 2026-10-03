import { expect, type Page, test } from "@playwright/test";

import { wines as seedWines } from "../src/seed/data";
import { blockThirdParty, expectNoSeriousA11yViolations, seedCatalogue, vietnamDateYearsAgo } from "./support";

const LEGAL_NOTICE = "Không bán rượu, bia cho người chưa đủ 18 tuổi";
const LOCALES = [
  { locale: "vi", prefix: "" },
  { locale: "en", prefix: "/en" },
] as const;

/**
 * What the page must list, written by hand from `src/seed/data.ts` (never computed with `listWines`).
 * Name order is the same in vi and en. "Steinbach Riesling Spätlese" (only a draft vintage) and
 * "Lune Grise Réserve" (a draft wine) are never listed.
 */
const ALL_BY_NAME = [
  "aubeline-brut",
  "brio",
  "colle-vento-rosso",
  "cordillera-carmenere",
  "coteau-des-pierres",
  "due-fiumi-moscato",
  "due-fiumi-nebbiolo",
  "hollow-creek-cabernet",
  "lune-grise-rouge",
  "red-gum-shiraz",
  "rio-velho-tawny-10",
  "sept-pierres-blanc",
  "sol-alto-crianza",
  "sol-alto-rosado",
  "southern-light-rose",
  "southern-light-sauvignon",
  "steinbach-riesling-kabinett",
];

/** Each wine's lowest published price, ascending: [slug, from-price in VND]. */
const BY_PRICE_ASC: [string, number][] = [
  ["sol-alto-crianza", 360_000],
  ["brio", 420_000],
  ["cordillera-carmenere", 450_000],
  ["due-fiumi-moscato", 480_000],
  ["sol-alto-rosado", 540_000],
  ["southern-light-sauvignon", 690_000],
  ["colle-vento-rosso", 720_000],
  ["steinbach-riesling-kabinett", 780_000],
  ["southern-light-rose", 820_000],
  ["lune-grise-rouge", 850_000],
  ["rio-velho-tawny-10", 1_050_000],
  ["red-gum-shiraz", 1_150_000],
  ["sept-pierres-blanc", 1_250_000],
  ["aubeline-brut", 1_350_000],
  ["coteau-des-pierres", 1_550_000],
  ["hollow-creek-cabernet", 2_950_000],
  ["due-fiumi-nebbiolo", 4_600_000],
];

/** Query → expected slugs, in order. Prices are VND "from" prices of the matching vintages. */
const EXPECTED: Record<string, { slugs: string[]; prices?: number[] }> = {
  "type=sparkling": { slugs: ["aubeline-brut"] },
  "type=rose": { slugs: ["sol-alto-rosado", "southern-light-rose"] },
  "country=IT": { slugs: ["colle-vento-rosso", "due-fiumi-moscato", "due-fiumi-nebbiolo"] },
  "country=FR&region=Burgundy": { slugs: ["coteau-des-pierres", "sept-pierres-blanc"] },
  "grape=Pinot+Noir": { slugs: ["aubeline-brut", "coteau-des-pierres", "southern-light-rose"] },
  "price=lt1m": {
    slugs: [
      "brio",
      "colle-vento-rosso",
      "cordillera-carmenere",
      "due-fiumi-moscato",
      "lune-grise-rouge",
      "sol-alto-crianza",
      "sol-alto-rosado",
      "southern-light-rose",
      "southern-light-sauvignon",
      "steinbach-riesling-kabinett",
    ],
  },
  "price=1m-2m": {
    slugs: ["aubeline-brut", "coteau-des-pierres", "lune-grise-rouge", "red-gum-shiraz", "rio-velho-tawny-10", "sept-pierres-blanc"],
    // Aubeline's 375 ml; Lune Grise's magnum, not its 750 ml under 1 000 000.
    prices: [1_350_000, 1_550_000, 1_950_000, 1_150_000, 1_050_000, 1_250_000],
  },
  "price=2m-4m": { slugs: ["aubeline-brut", "hollow-creek-cabernet"], prices: [2_450_000, 2_950_000] },
  "price=gte4m": { slugs: ["aubeline-brut", "due-fiumi-nebbiolo"], prices: [5_200_000, 4_600_000] },
  "occasion=tet": { slugs: ["aubeline-brut", "brio", "due-fiumi-moscato", "red-gum-shiraz", "rio-velho-tawny-10"] },
  "size=375": { slugs: ["aubeline-brut", "rio-velho-tawny-10", "sol-alto-crianza"], prices: [1_350_000, 1_050_000, 360_000] },
  "size=1500": { slugs: ["aubeline-brut", "lune-grise-rouge"], prices: [5_200_000, 1_950_000] },
  "country=FR&type=red&price=lt1m": { slugs: ["lune-grise-rouge"], prices: [850_000] },
  "size=1500&sort=price-desc": { slugs: ["aubeline-brut", "lune-grise-rouge"], prices: [5_200_000, 1_950_000] },
  "sort=price-asc": { slugs: BY_PRICE_ASC.map(([slug]) => slug), prices: BY_PRICE_ASC.map(([, p]) => p) },
  "sort=price-desc": { slugs: BY_PRICE_ASC.map(([slug]) => slug).reverse(), prices: BY_PRICE_ASC.map(([, p]) => p).reverse() },
};

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
/** Card prices as whole VND, from the displayed text in either locale's format. */
const cardPrices = async (page: Page) =>
  (await page.getByTestId("price").allTextContents()).map((text) => Number(text.replace(/\D/g, "")));

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

// Query values are locale-independent codes, so one locale covers the table.
test("each facet and sort narrows or orders on the server, from the URL", async ({ page }) => {
  await declareAdult(page);
  for (const [query, { slugs, prices }] of Object.entries(EXPECTED)) {
    await page.goto(`/ruou-vang?${query}`);
    expect(await cardSlugs(page), query).toEqual(slugs);
    if (prices) expect(await cardPrices(page), query).toEqual(prices);
  }
});

for (const { locale, prefix } of LOCALES) {
  test.describe(`collection page (${locale})`, () => {
    test("lists the seeded published wines with name, producer, type, region and a from-price", async ({ page }) => {
      const external = await blockThirdParty(page);
      await declareAdult(page, prefix);
      await page.goto(`${prefix}/ruou-vang`);

      expect(await cardSlugs(page)).toEqual(ALL_BY_NAME);

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
      expect(await cardSlugs(page)).toEqual(["lune-grise-rouge"]);
    });

    test("a card opens its product page, carrying the active size facet", async ({ page }) => {
      await declareAdult(page, prefix);
      await page.goto(`${prefix}/ruou-vang?size=1500`);
      await page.locator('[data-slug="lune-grise-rouge"]').getByRole("link").click();
      await expect(page).toHaveURL((url) => url.pathname === `${prefix}/ruou-vang/lune-grise-rouge` && url.search === "?size=1500");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(locale === "vi" ? "Lune Grise Đỏ" : "Lune Grise Rouge");
      // The most recent vintage with a magnum: 2019, 1500 ml at 1 950 000 VND.
      await expect(page.locator('[data-spec="vintage"] dd')).toHaveText("2019");
      await expect(page.locator('[data-spec="volume"] dd')).toHaveText("1500 ml");
      expect(Number((await page.locator('[data-spec="price"] dd').textContent())!.replace(/\D/g, ""))).toBe(1_950_000);
    });

    test("an empty result says so and clears the filters", async ({ page }) => {
      await declareAdult(page, prefix);
      await page.goto(`${prefix}/ruou-vang?country=NZ&type=sweet`);
      await expect(page.getByTestId("empty-result")).toContainText(locale === "vi" ? "Không có loại vang phù hợp" : "No wines match");
      await page.getByTestId("empty-result").getByRole("link").click();
      await expect(page).toHaveURL((url) => url.pathname === `${prefix}/ruou-vang` && url.search === "");
      expect(await cardSlugs(page)).toEqual(ALL_BY_NAME);
    });

    test("has no serious accessibility violations, and home links to it", async ({ page }) => {
      await declareAdult(page, prefix);
      await page.goto(prefix || "/");
      await page.getByRole("link", { name: locale === "vi" ? "Xem bộ sưu tập rượu vang" : "Browse the wine collection" }).click();
      await expect(page).toHaveURL((url) => url.pathname === `${prefix}/ruou-vang`);
      for (const query of ["", "?country=FR&size=750", "?country=NZ&type=sweet"]) {
        await page.goto(`${prefix}/ruou-vang${query}`);
        await expectNoSeriousA11yViolations(page, query);
      }
    });
  });
}
