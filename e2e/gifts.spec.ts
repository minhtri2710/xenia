import { expect, type Page, test } from "@playwright/test";

import { blockThirdParty, expectNoSeriousA11yViolations, seedCatalogue, vietnamDateYearsAgo } from "./support";

// Every expected value below is written by hand from `src/seed/data.ts`, never computed with
// `giftCollections`, `isRestrictedWine` or the page's own code.
//
// Gift occasions in the seed (published wines with a published vintage only), ABV in brackets:
//   gift:        lune-grise-rouge (14), sept-pierres-blanc (13), aubeline-brut (12),
//                due-fiumi-nebbiolo (14.5), hollow-creek-cabernet (14.5), rio-velho-tawny-10 (20)
//   tet:         aubeline-brut, due-fiumi-moscato (5.5), red-gum-shiraz (14.5), rio-velho-tawny-10 (20)
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

type Collections = Record<"gift" | "tet" | "celebration", [slug: string, fromPriceVnd: number][]>;

/** Budget query (empty = any price) → each collection's cards, in name order, with the "from" price. */
const EXPECTED: [query: string, expected: Collections][] = [
  [
    "",
    {
      gift: [
        ["aubeline-brut", 1_350_000],
        ["due-fiumi-nebbiolo", 4_600_000],
        ["hollow-creek-cabernet", 2_950_000],
        ["lune-grise-rouge", 850_000],
        ["sept-pierres-blanc", 1_250_000],
      ],
      tet: [
        ["aubeline-brut", 1_350_000],
        ["due-fiumi-moscato", 480_000],
        ["red-gum-shiraz", 1_150_000],
      ],
      celebration: [
        ["aubeline-brut", 1_350_000],
        ["coteau-des-pierres", 1_550_000],
        ["due-fiumi-nebbiolo", 4_600_000],
        ["hollow-creek-cabernet", 2_950_000],
        ["southern-light-rose", 820_000],
      ],
    },
  ],
  [
    "?price=lt1m",
    {
      gift: [["lune-grise-rouge", 850_000]],
      tet: [["due-fiumi-moscato", 480_000]],
      celebration: [["southern-light-rose", 820_000]],
    },
  ],
  [
    "?price=1m-2m",
    {
      // lune-grise-rouge: only its 1500 ml at 1 950 000 is in the band, so that is its "from" price.
      gift: [
        ["aubeline-brut", 1_350_000],
        ["lune-grise-rouge", 1_950_000],
        ["sept-pierres-blanc", 1_250_000],
      ],
      tet: [
        ["aubeline-brut", 1_350_000],
        ["red-gum-shiraz", 1_150_000],
      ],
      celebration: [
        ["aubeline-brut", 1_350_000],
        ["coteau-des-pierres", 1_550_000],
      ],
    },
  ],
  [
    "?price=2m-4m",
    {
      gift: [
        ["aubeline-brut", 2_450_000],
        ["hollow-creek-cabernet", 2_950_000],
      ],
      tet: [["aubeline-brut", 2_450_000]],
      celebration: [
        ["aubeline-brut", 2_450_000],
        ["hollow-creek-cabernet", 2_950_000],
      ],
    },
  ],
  [
    "?price=gte4m",
    {
      gift: [
        ["aubeline-brut", 5_200_000],
        ["due-fiumi-nebbiolo", 4_600_000],
      ],
      tet: [["aubeline-brut", 5_200_000]],
      celebration: [
        ["aubeline-brut", 5_200_000],
        ["due-fiumi-nebbiolo", 4_600_000],
      ],
    },
  ],
];

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

const collection = (page: Page, occasion: string) => page.locator(`[data-testid="gift-collection"][data-occasion="${occasion}"]`);

async function readCollections(page: Page): Promise<Collections> {
  const read = async (occasion: keyof Collections) => {
    const cards = collection(page, occasion).getByTestId("wine-card");
    const slugs = await cards.evaluateAll((els) => els.map((e) => e.getAttribute("data-slug")!));
    const prices = (await cards.getByTestId("price").allTextContents()).map((text) => Number(text.replace(/\D/g, "")));
    return slugs.map((slug, i): [string, number] => [slug, prices[i]]);
  };
  return { gift: await read("gift"), tet: await read("tet"), celebration: await read("celebration") };
}

test.beforeAll(async ({ request }) => {
  await seedCatalogue(request);
});

for (const { locale, prefix } of LOCALES) {
  const vi = locale === "vi";

  test.describe(`gift collections (${locale})`, () => {
    test("lists the hand-valued wines per collection under every budget, and never the 20% wine", async ({ page }) => {
      const external = await blockThirdParty(page);
      await declareAdult(page, `${prefix}/qua-tang`);

      const titles = page.getByTestId("gift-collection").getByRole("heading", { level: 2 });
      await expect(titles).toHaveText(vi ? ["Quà tặng", "Tết", "Tiệc mừng"] : ["Gifts", "Tết", "Celebrations"]);

      for (const [query, expected] of EXPECTED) {
        await page.goto(`${prefix}/qua-tang${query}`);
        expect(await readCollections(page), query || "any price").toEqual(expected);
        await expect(page.locator(`[data-slug="${RESTRICTED}"]`), query || "any price").toHaveCount(0);
        await expect(page.locator(`a[href$="/ruou-vang/${RESTRICTED}"]`), query || "any price").toHaveCount(0);
        await expect(page.getByTestId("collection-empty"), query || "any price").toHaveCount(0);
      }
      // The wine exists and is published; only the gift collections leave it out.
      await page.goto(`${prefix}/ruou-vang`);
      await expect(page.locator(`[data-slug="${RESTRICTED}"]`)).toHaveCount(1);

      await page.waitForLoadState("networkidle");
      expect(external).toEqual([]);
    });

    test("a card shows name, producer, type, region and the from-price, and links to the locale's product page", async ({ page }) => {
      await declareAdult(page, `${prefix}/qua-tang`);
      const card = collection(page, "gift").locator('[data-slug="aubeline-brut"]');
      await expect(card.getByRole("heading", { level: 3 })).toHaveText("Aubeline Brut");
      await expect(card).toContainText("Maison Aubeline");
      await expect(card).toContainText(vi ? "Vang sủi · Champagne, Pháp" : "Sparkling · Champagne, France");
      await expect(card.getByTestId("price")).toHaveText(vi ? /^Từ 1\.350\.000\s₫$/ : /^From ₫1,350,000$/);
      await expect(card.getByRole("link")).toHaveAttribute("href", `${prefix}/ruou-vang/aubeline-brut`);

      // The same wine sits in every collection it is tagged with.
      for (const occasion of ["tet", "celebration"]) {
        await expect(collection(page, occasion).locator('[data-slug="aubeline-brut"]')).toHaveCount(1);
      }

      await card.getByRole("link").click();
      await expect(page).toHaveURL((url) => url.pathname === `${prefix}/ruou-vang/aubeline-brut`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Aubeline Brut");
    });

    test("budget links write the band to the URL and narrow every collection", async ({ page }) => {
      await declareAdult(page, `${prefix}/qua-tang`);
      const budget = page.getByRole("navigation", { name: vi ? "Ngân sách" : "Budget" });
      await expect(budget.getByRole("link")).toHaveCount(5);
      await expect(budget.getByRole("link", { name: vi ? "Mọi mức giá" : "Any price" })).toHaveAttribute("aria-current", "true");

      await budget.getByRole("link", { name: vi ? "Từ 4.000.000 ₫" : "₫4,000,000 and over" }).click();
      await expect(page).toHaveURL((url) => url.pathname === `${prefix}/qua-tang` && url.search === "?price=gte4m");
      await expect(budget.getByRole("link", { name: vi ? "Từ 4.000.000 ₫" : "₫4,000,000 and over" })).toHaveAttribute("aria-current", "true");
      expect(await readCollections(page)).toEqual(EXPECTED[4][1]);

      await budget.getByRole("link", { name: vi ? "Mọi mức giá" : "Any price" }).click();
      await expect(page).toHaveURL((url) => url.pathname === `${prefix}/qua-tang` && url.search === "");
      expect(await readCollections(page)).toEqual(EXPECTED[0][1]);
    });

    test("an unknown budget value lists every collection, never errors", async ({ page }) => {
      await declareAdult(page, `${prefix}/qua-tang?price=cheap`);
      expect(await readCollections(page)).toEqual(EXPECTED[0][1]);
    });

    test("shows the under-18 warning and the paid gift service link", async ({ page }) => {
      await declareAdult(page, `${prefix}/qua-tang`);
      const warning = page.getByTestId("gift-warning");
      await expect(warning.locator("strong[lang=vi]")).toHaveText(WARNING);
      if (vi) await expect(warning).not.toContainText(WARNING_EN);
      else await expect(warning).toContainText(WARNING_EN);
      await expect(page.getByTestId("age-notice")).toContainText(LEGAL_NOTICE);

      const service = page.getByRole("main").getByRole("link", { name: vi ? "Xem dịch vụ gói quà" : "See the gift service" });
      await expect(service).toHaveAttribute("href", `${prefix}/dich-vu-goi-qua`);
      await expect(page.getByRole("main")).toContainText(vi ? "Gói quà là dịch vụ có tính phí" : "Gift wrap is a paid service");
      await service.click();
      await expect(page).toHaveURL((url) => url.pathname === `${prefix}/dich-vu-goi-qua`);
    });

    test("the header links to it", async ({ page }) => {
      await declareAdult(page, `${prefix}/ruou-vang`);
      const nav = page.getByRole("navigation", { name: vi ? "Điều hướng chính" : "Primary navigation" });
      const link = nav.getByRole("link", { name: vi ? "Bộ sưu tập quà" : "Gift collections" });
      await expect(link).toHaveAttribute("href", `${prefix}/qua-tang`);
      await link.click();
      await expect(page).toHaveURL((url) => url.pathname === `${prefix}/qua-tang`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(vi ? "Bộ sưu tập quà" : "Gift collections");
      // The existing links stay.
      await expect(nav.getByRole("link", { name: vi ? "Rượu vang" : "Wine" })).toHaveAttribute("href", `${prefix}/ruou-vang`);
      await expect(nav.getByRole("link", { name: vi ? "Dịch vụ gói quà" : "Gift service" })).toHaveAttribute("href", `${prefix}/dich-vu-goi-qua`);
      await expect(nav.getByRole("link", { name: vi ? "Giỏ hàng" : "Cart" })).toHaveAttribute("href", `${prefix}/gio-hang`);
    });

    test("has no serious accessibility violations at any budget", async ({ page }) => {
      const external = await blockThirdParty(page);
      await declareAdult(page, `${prefix}/qua-tang`);
      for (const [query] of EXPECTED) {
        await page.goto(`${prefix}/qua-tang${query}`);
        await expectNoSeriousA11yViolations(page, query || "any price");
      }
      await page.waitForLoadState("networkidle");
      expect(external).toEqual([]);
    });
  });
}

test.describe("without client JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the budget options are plain links that change the listing", async ({ page, context, baseURL }) => {
    // The gate form is covered elsewhere; here the marker cookie stands in for a declaration.
    await context.addCookies([{ name: "xenia_age_ok", value: "1", url: baseURL! }]);
    await page.goto("/en/qua-tang");
    expect(await readCollections(page)).toEqual(EXPECTED[0][1]);

    await page.getByRole("link", { name: "₫4,000,000 and over" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/en/qua-tang" && url.search === "?price=gte4m");
    expect(await readCollections(page)).toEqual(EXPECTED[4][1]);
    await expect(page.locator(`[data-slug="${RESTRICTED}"]`)).toHaveCount(0);
    await expect(page.getByTestId("gift-warning")).toContainText(WARNING);

    await page.getByRole("link", { name: "Any price" }).click();
    await expect(page).toHaveURL((url) => url.search === "");
    expect(await readCollections(page)).toEqual(EXPECTED[0][1]);
  });
});
