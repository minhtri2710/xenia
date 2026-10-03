import { expect, type Page, test } from "@playwright/test";

import { blockThirdParty, expectNoSeriousA11yViolations, seedCatalogue, vietnamDateYearsAgo } from "./support";

// Every expected value below is written by hand from `src/seed/data.ts`, never computed with
// `giftListing`, `isRestrictedWine` or the page's own code.
//
// Gift occasions in the seed (published wines with a published vintage only), ABV in brackets:
//   gift:        lune-grise-rouge (14), sept-pierres-blanc (13), aubeline-brut (12), brio (11),
//                due-fiumi-nebbiolo (14.5), hollow-creek-cabernet (14.5), rio-velho-tawny-10 (20)
//   tet:         aubeline-brut, brio, due-fiumi-moscato (5.5), red-gum-shiraz (14.5), rio-velho-tawny-10 (20)
//   celebration: coteau-des-pierres (13), aubeline-brut, due-fiumi-nebbiolo, hollow-creek-cabernet,
//                southern-light-rose (12.5)
// `rio-velho-tawny-10` is at 20% ABV and is never listed. `lune-grise-reserve` (a draft wine, tagged
// gift) and the draft 2022 vintage of `hollow-creek-cabernet` are never read.
// The seed has no wine that mixes restricted and unrestricted vintages; `src/lib/catalogue.test.ts`
// owns that case.

const RESTRICTED = "rio-velho-tawny-10";
const LEGAL_NOTICE = "Không bán rượu, bia cho người chưa đủ 18 tuổi";
const WARNING = "Người dưới 18 tuổi không được uống rượu, bia";
const WARNING_EN = "People under 18 must not drink alcohol or beer";

const LOCALES = [
  { locale: "vi", prefix: "" },
  { locale: "en", prefix: "/en" },
] as const;

type Cards = [slug: string, fromPriceVnd: number][];

/** Query → the grid's cards, in name order, with the "from" price. */
const EXPECTED: [query: string, expected: Cards][] = [
  [
    "",
    [
      ["aubeline-brut", 1_350_000],
      ["brio", 420_000],
      ["coteau-des-pierres", 1_550_000],
      ["due-fiumi-moscato", 480_000],
      ["due-fiumi-nebbiolo", 4_600_000],
      ["hollow-creek-cabernet", 2_950_000],
      ["lune-grise-rouge", 850_000],
      ["red-gum-shiraz", 1_150_000],
      ["sept-pierres-blanc", 1_250_000],
      ["southern-light-rose", 820_000],
    ],
  ],
  [
    "?price=lt1m",
    [
      ["brio", 420_000],
      ["due-fiumi-moscato", 480_000],
      ["lune-grise-rouge", 850_000],
      ["southern-light-rose", 820_000],
    ],
  ],
  [
    // lune-grise-rouge: only its 1500 ml at 1 950 000 is in the band, so that is its "from" price.
    "?price=1m-2m",
    [
      ["aubeline-brut", 1_350_000],
      ["coteau-des-pierres", 1_550_000],
      ["lune-grise-rouge", 1_950_000],
      ["red-gum-shiraz", 1_150_000],
      ["sept-pierres-blanc", 1_250_000],
    ],
  ],
  [
    "?price=2m-4m",
    [
      ["aubeline-brut", 2_450_000],
      ["hollow-creek-cabernet", 2_950_000],
    ],
  ],
  [
    "?price=gte4m",
    [
      ["aubeline-brut", 5_200_000],
      ["due-fiumi-nebbiolo", 4_600_000],
    ],
  ],
  [
    "?occasion=gift",
    [
      ["aubeline-brut", 1_350_000],
      ["brio", 420_000],
      ["due-fiumi-nebbiolo", 4_600_000],
      ["hollow-creek-cabernet", 2_950_000],
      ["lune-grise-rouge", 850_000],
      ["sept-pierres-blanc", 1_250_000],
    ],
  ],
  [
    "?occasion=tet",
    [
      ["aubeline-brut", 1_350_000],
      ["brio", 420_000],
      ["due-fiumi-moscato", 480_000],
      ["red-gum-shiraz", 1_150_000],
    ],
  ],
  [
    "?occasion=celebration",
    [
      ["aubeline-brut", 1_350_000],
      ["coteau-des-pierres", 1_550_000],
      ["due-fiumi-nebbiolo", 4_600_000],
      ["hollow-creek-cabernet", 2_950_000],
      ["southern-light-rose", 820_000],
    ],
  ],
  ["?occasion=tet&price=2m-4m", [["aubeline-brut", 2_450_000]]],
  ["?occasion=celebration&price=lt1m", [["southern-light-rose", 820_000]]],
];

const ALL = EXPECTED[0][1];
const expected = (query: string) => EXPECTED.find(([q]) => q === query)![1];

/** Opens `path` through the gate: redirect, adult declaration, return to `next`. */
async function declareAdult(page: Page, path: string) {
  await page.goto(path);
  await expect(page).toHaveURL((url) => url.pathname.endsWith("/xac-minh-tuoi"));
  await page.locator("#gate-name").fill("Nguyễn Văn An");
  await page.locator("#gate-dob").fill(vietnamDateYearsAgo(30));
  await page.locator("form button[type=submit]").click();
  const target = new URL(path, "http://x");
  await expect(page).toHaveURL((url) => url.pathname === target.pathname && url.search === target.search);
}

async function readCards(page: Page): Promise<Cards> {
  const cards = page.getByTestId("wine-card");
  const slugs = await cards.evaluateAll((els) => els.map((e) => e.getAttribute("data-slug")!));
  const prices = (await cards.getByTestId("price").allTextContents()).map((text) => Number(text.replace(/\D/g, "")));
  return slugs.map((slug, i): [string, number] => [slug, prices[i]]);
}

test.beforeAll(async ({ request }) => {
  await seedCatalogue(request);
});

for (const { locale, prefix } of LOCALES) {
  const vi = locale === "vi";
  const occasionNav = (page: Page) => page.getByRole("navigation", { name: vi ? "Dịp tặng" : "Occasion" });
  const budgetNav = (page: Page) => page.getByRole("navigation", { name: vi ? "Ngân sách" : "Budget" });

  test.describe(`gift collections (${locale})`, () => {
    test("lists the hand-valued wines under every occasion and budget, and never the 20% wine", async ({ page }) => {
      const external = await blockThirdParty(page);
      await declareAdult(page, `${prefix}/qua-tang`);

      for (const [query, cards] of EXPECTED) {
        await page.goto(`${prefix}/qua-tang${query}`);
        expect(await readCards(page), query || "all").toEqual(cards);
        await expect(page.locator(`[data-slug="${RESTRICTED}"]`), query || "all").toHaveCount(0);
        await expect(page.locator(`a[href$="/ruou-vang/${RESTRICTED}"]`), query || "all").toHaveCount(0);
        await expect(page.getByTestId("collection-empty"), query || "all").toHaveCount(0);
      }
      // The wine exists and is published; only the gift collections leave it out.
      await page.goto(`${prefix}/ruou-vang`);
      await expect(page.locator(`[data-slug="${RESTRICTED}"]`)).toHaveCount(1);

      await page.waitForLoadState("networkidle");
      expect(external).toEqual([]);
    });

    test("a card shows its gift occasions, name, producer, type, region, the from-price and a details link to the product page", async ({ page }) => {
      await declareAdult(page, `${prefix}/qua-tang`);
      const card = page.locator('[data-testid="wine-card"][data-slug="aubeline-brut"]');
      await expect(card.getByTestId("card-occasions")).toHaveText(vi ? "Quà tặng · Tết · Tiệc mừng" : "Gifts · Tết · Celebrations");
      await expect(card.getByRole("heading", { level: 3 })).toHaveText("Aubeline Brut");
      await expect(card).toContainText("Maison Aubeline");
      await expect(card).toContainText(vi ? "Vang sủi · Champagne, Pháp" : "Sparkling · Champagne, France");
      await expect(card.getByTestId("price")).toHaveText(vi ? /^Từ 1\.350\.000\s₫$/ : /^From ₫1,350,000$/);
      await expect(page.locator('[data-testid="wine-card"][data-slug="due-fiumi-moscato"]').getByTestId("card-occasions")).toHaveText("Tết");

      const details = card.getByRole("link", { name: vi ? "Xem chi tiết Aubeline Brut" : "View details of Aubeline Brut" });
      await expect(details).toHaveText(vi ? "Xem chi tiết" : "View details");
      await expect(details).toHaveAttribute("href", `${prefix}/ruou-vang/aubeline-brut`);
      await details.click();
      await expect(page).toHaveURL((url) => url.pathname === `${prefix}/ruou-vang/aubeline-brut`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Aubeline Brut");
    });

    test("occasion and budget links write the URL, keep each other and narrow the grid", async ({ page }) => {
      await declareAdult(page, `${prefix}/qua-tang`);
      const occasions = occasionNav(page);
      const budget = budgetNav(page);
      await expect(occasions.getByRole("link")).toHaveText(vi ? ["Tất cả", "Quà tặng", "Tết", "Tiệc mừng"] : ["All", "Gifts", "Tết", "Celebrations"]);
      await expect(budget.getByRole("link")).toHaveCount(5);
      const all = occasions.getByRole("link", { name: vi ? "Tất cả" : "All" });
      const anyPrice = budget.getByRole("link", { name: vi ? "Mọi mức giá" : "Any price" });
      await expect(all).toHaveAttribute("aria-current", "true");
      await expect(anyPrice).toHaveAttribute("aria-current", "true");

      await occasions.getByRole("link", { name: "Tết" }).click();
      await expect(page).toHaveURL((url) => url.pathname === `${prefix}/qua-tang` && url.search === "?occasion=tet");
      await expect(occasions.getByRole("link", { name: "Tết" })).toHaveAttribute("aria-current", "true");
      await expect(all).not.toHaveAttribute("aria-current", /.*/);
      expect(await readCards(page)).toEqual(expected("?occasion=tet"));

      const band = budget.getByRole("link", { name: vi ? "2.000.000 – dưới 4.000.000 ₫" : /^₫2,000,000/ });
      await band.click();
      await expect(page).toHaveURL((url) => url.search === "?occasion=tet&price=2m-4m");
      await expect(band).toHaveAttribute("aria-current", "true");
      expect(await readCards(page)).toEqual(expected("?occasion=tet&price=2m-4m"));

      await all.click();
      await expect(page).toHaveURL((url) => url.search === "?price=2m-4m");
      expect(await readCards(page)).toEqual(expected("?price=2m-4m"));

      await anyPrice.click();
      await expect(page).toHaveURL((url) => url.pathname === `${prefix}/qua-tang` && url.search === "");
      expect(await readCards(page)).toEqual(ALL);
    });

    test("unknown occasion and budget values list every wine, never error", async ({ page }) => {
      await declareAdult(page, `${prefix}/qua-tang?occasion=dinner&price=cheap`);
      expect(await readCards(page)).toEqual(ALL);
      await expect(occasionNav(page).getByRole("link", { name: vi ? "Tất cả" : "All" })).toHaveAttribute("aria-current", "true");
    });

    test("shows the under-18 warning, the paid gift service link and the personalisation call to action", async ({ page }) => {
      await declareAdult(page, `${prefix}/qua-tang`);
      const warning = page.getByTestId("gift-warning");
      await expect(warning.locator("strong[lang=vi]")).toHaveText(WARNING);
      if (vi) await expect(warning).not.toContainText(WARNING_EN);
      else await expect(warning).toContainText(WARNING_EN);
      await expect(page.getByTestId("age-notice")).toContainText(LEGAL_NOTICE);
      expect(await page.locator("main").innerText()).not.toMatch(vi ? /miễn phí|giảm giá|khuyến mại/i : /\bfree\b|discount|promotion/i);

      await expect(page.getByRole("heading", { level: 2, name: vi ? "Chưa thấy bộ quà phù hợp?" : "Haven't found the right gift?" })).toBeVisible();
      await expect(page.getByRole("main").getByRole("link", { name: vi ? "Tìm hiểu cá nhân hoá" : "About personalisation" })).toHaveAttribute("href", `${prefix}/ca-nhan-hoa`);

      const service = page.getByRole("main").getByRole("link", { name: vi ? "Xem dịch vụ gói quà" : "See the gift service" });
      await expect(service).toHaveAttribute("href", `${prefix}/dich-vu-goi-qua`);
      await expect(page.getByRole("main")).toContainText(vi ? "Gói quà là dịch vụ có tính phí" : "Gift wrap is a paid service");
      await service.click();
      await expect(page).toHaveURL((url) => url.pathname === `${prefix}/dich-vu-goi-qua`);
    });

    test("the header and the home occasion cards link to it", async ({ page }) => {
      await declareAdult(page, `${prefix}/ruou-vang`);
      const nav = page.getByRole("navigation", { name: vi ? "Điều hướng chính" : "Primary navigation" });
      const link = nav.getByRole("link", { name: vi ? "Bộ sưu tập quà" : "Gift collections" });
      await expect(link).toHaveAttribute("href", `${prefix}/qua-tang`);
      await link.click();
      await expect(page).toHaveURL((url) => url.pathname === `${prefix}/qua-tang`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(vi ? "Bộ sưu tập quà" : "Gift collections");
      await expect(link).toHaveAttribute("aria-current", "page");

      await page.goto(prefix || "/");
      const cards = page.getByRole("list", { name: vi ? /dịp/i : /occasion/i }).getByRole("link");
      await expect(cards).toHaveCount(3);
      for (const [i, occasion] of ["gift", "tet", "celebration"].entries()) {
        await expect(cards.nth(i)).toHaveAttribute("href", `${prefix}/qua-tang?occasion=${occasion}`);
      }
      await cards.nth(1).click();
      await expect(page).toHaveURL((url) => url.pathname === `${prefix}/qua-tang` && url.search === "?occasion=tet");
      expect(await readCards(page)).toEqual(expected("?occasion=tet"));
    });

    test("has no serious accessibility violations under any filter", async ({ page }) => {
      const external = await blockThirdParty(page);
      await declareAdult(page, `${prefix}/qua-tang`);
      for (const [query] of EXPECTED) {
        await page.goto(`${prefix}/qua-tang${query}`);
        await expectNoSeriousA11yViolations(page, query || "all");
      }
      await page.waitForLoadState("networkidle");
      expect(external).toEqual([]);
    });
  });
}

test.describe("without client JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the occasion and budget options are plain links that change the listing", async ({ page, context, baseURL }) => {
    // The gate form is covered elsewhere; here the marker cookie stands in for a declaration.
    await context.addCookies([{ name: "xenia_age_ok", value: "1", url: baseURL! }]);
    await page.goto("/en/qua-tang");
    expect(await readCards(page)).toEqual(ALL);

    await page.getByRole("link", { name: "₫4,000,000 and over" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/en/qua-tang" && url.search === "?price=gte4m");
    expect(await readCards(page)).toEqual(expected("?price=gte4m"));
    await expect(page.locator(`[data-slug="${RESTRICTED}"]`)).toHaveCount(0);
    await expect(page.getByTestId("gift-warning")).toContainText(WARNING);

    await page.getByRole("navigation", { name: "Occasion" }).getByRole("link", { name: "Celebrations" }).click();
    await expect(page).toHaveURL((url) => url.search === "?occasion=celebration&price=gte4m");
    expect(await readCards(page)).toEqual([
      ["aubeline-brut", 5_200_000],
      ["due-fiumi-nebbiolo", 4_600_000],
    ]);

    await page.getByRole("link", { name: "Any price" }).click();
    await expect(page).toHaveURL((url) => url.search === "?occasion=celebration");
    expect(await readCards(page)).toEqual(expected("?occasion=celebration"));
  });
});
