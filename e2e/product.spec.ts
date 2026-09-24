import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { blockThirdParty, seedCatalogue, vietnamDateYearsAgo } from "./support";

// Every expected value below is written by hand from `src/seed/data.ts`, never computed with
// `selectVintage` or the page's own code.

const LEGAL_NOTICE = "Không bán rượu, bia cho người chưa đủ 18 tuổi";
const IMPORTER = "Công ty TNHH Xenia Nhập khẩu (dữ liệu mẫu)";
const LOCALES = [
  { locale: "vi", prefix: "" },
  { locale: "en", prefix: "/en" },
] as const;

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

const spec = (page: Page, id: string) => page.locator(`[data-spec="${id}"] dd`);
const vnd = async (page: Page, id: string) => Number((await spec(page, id).textContent())!.replace(/\D/g, ""));

async function expectNoSeriousA11yViolations(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const blocking = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`), label).toEqual([]);
}

test.beforeAll(async ({ request }) => {
  await seedCatalogue(request);
});

for (const { locale, prefix } of LOCALES) {
  const vi = locale === "vi";

  test.describe(`product page (${locale})`, () => {
    test("shows the default selection's full spec list with no third-party request", async ({ page }) => {
      const external = await blockThirdParty(page);
      await declareAdult(page, `${prefix}/ruou-vang/lune-grise-rouge`);

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(vi ? "Lune Grise Đỏ" : "Lune Grise Rouge");
      // Default: the most recent vintage, 2020, in 750 ml.
      await expect(spec(page, "producer")).toHaveText("Domaine de la Lune Grise");
      await expect(spec(page, "vintage")).toHaveText("2020");
      await expect(spec(page, "country")).toHaveText(vi ? "Pháp" : "France");
      await expect(spec(page, "region")).toHaveText("Bordeaux");
      await expect(spec(page, "appellation")).toHaveText("Bordeaux Supérieur");
      await expect(spec(page, "grapes")).toHaveText("Merlot 70%, Cabernet Sauvignon 30%");
      await expect(spec(page, "abv")).toHaveText("14% vol");
      await expect(spec(page, "volume")).toHaveText("750 ml");
      await expect(spec(page, "drinking-window")).toHaveText("2023–2031");
      await expect(spec(page, "importer")).toHaveText(IMPORTER);
      await expect(spec(page, "serving-temp")).toHaveText("17 °C");
      expect(await vnd(page, "price")).toBe(850_000);
      await expect(spec(page, "price")).toContainText(vi ? "đã gồm VAT" : "VAT included");
      await expect(spec(page, "stock")).toHaveText(vi ? "Còn hàng" : "In stock");

      await expect(spec(page, "nose")).toHaveText(vi ? "Mận chín, lá thuốc lá khô và chút vani." : "Ripe plum, dried tobacco leaf and a touch of vanilla.");
      await expect(spec(page, "palate")).toHaveText(vi ? "Mềm mại, tannin tròn, quả đỏ đậm đà." : "Supple, with rounded tannin and generous red fruit.");
      await expect(spec(page, "finish")).toHaveText(vi ? "Dư vị vừa phải, thoảng gỗ tuyết tùng." : "Medium length with a hint of cedar.");

      // The four-axis profile is readable as text, not only as the bar.
      for (const [axis, value] of [
        ["body", 4],
        ["tannin", 3],
        ["sweetness", 1],
        ["acidity", 3],
      ] as const) {
        await expect(spec(page, axis)).toHaveText(vi ? `${value} trên 5` : `${value} of 5`);
      }
      const labels = page.getByTestId("profile").locator("dt");
      await expect(labels).toHaveText(vi ? ["Độ đậm", "Tannin", "Độ ngọt", "Độ chua"] : ["Body", "Tannin", "Sweetness", "Acidity"]);

      await expect(page.getByTestId("pairings").locator("li")).toHaveText(
        vi ? ["Thịt bò", "Bò lúc lắc", "Phô mai"] : ["Beef", "Bò lúc lắc (shaking beef)", "Cheese"],
      );

      // No occasions (dinner, gift) and no add-to-cart.
      const main = page.locator("main");
      for (const text of vi ? ["Bữa tối", "Quà tặng"] : ["Dinner", "Gift"]) await expect(main).not.toContainText(text);
      await expect(main.getByRole("button")).toHaveCount(0);

      await expect(page.getByTestId("age-notice")).toContainText(LEGAL_NOTICE);
      await page.waitForLoadState("networkidle");
      expect(external).toEqual([]);
    });

    test("the selector changes vintage and size through the URL, and each selection passes axe", async ({ page }) => {
      const external = await blockThirdParty(page);
      await declareAdult(page, `${prefix}/ruou-vang/lune-grise-rouge`);
      await expectNoSeriousA11yViolations(page, "default");

      const selector = page.getByRole("navigation", { name: vi ? "Chọn niên vụ và dung tích" : "Choose vintage and size" });
      await expect(selector.getByRole("link")).toHaveText(["2020", "2019", "750 ml"]);
      await expect(selector.getByRole("link", { name: "2020" })).toHaveAttribute("aria-current", "true");

      await selector.getByRole("link", { name: "2019" }).click();
      await expect(page).toHaveURL((url) => url.search === "?vintage=2019&size=750");
      await expect(spec(page, "vintage")).toHaveText("2019");
      await expect(spec(page, "abv")).toHaveText(vi ? "13,5% vol" : "13.5% vol");
      await expect(spec(page, "volume")).toHaveText("750 ml");
      expect(await vnd(page, "price")).toBe(890_000);
      await expect(spec(page, "drinking-window")).toHaveText("2022–2030");

      await selector.getByRole("link", { name: "1500 ml" }).click();
      await expect(page).toHaveURL((url) => url.search === "?vintage=2019&size=1500");
      await expect(spec(page, "volume")).toHaveText("1500 ml");
      await expect(spec(page, "abv")).toHaveText(vi ? "13,5% vol" : "13.5% vol");
      expect(await vnd(page, "price")).toBe(1_950_000);
      await expect(spec(page, "drinking-window")).toHaveText("2023–2034");
      await expect(selector.getByRole("link", { name: "1500 ml" })).toHaveAttribute("aria-current", "true");
      await expectNoSeriousA11yViolations(page, "2019 magnum");

      // 2020 has no magnum: its link falls back to 750 ml.
      await selector.getByRole("link", { name: "2020" }).click();
      await expect(page).toHaveURL((url) => url.search === "?vintage=2020&size=750");
      expect(await vnd(page, "price")).toBe(850_000);

      await page.waitForLoadState("networkidle");
      expect(external).toEqual([]);
    });

    test("the 20% tawny shows 20% vol, NV and its sizes", async ({ page }) => {
      await declareAdult(page, `${prefix}/ruou-vang/rio-velho-tawny-10?size=375`);
      await expect(spec(page, "abv")).toHaveText("20% vol");
      await expect(spec(page, "vintage")).toHaveText(vi ? "Không niên vụ (NV)" : "Non-vintage (NV)");
      await expect(spec(page, "appellation")).toHaveText("Porto");
      await expect(spec(page, "volume")).toHaveText("375 ml");
      expect(await vnd(page, "price")).toBe(1_050_000);
      await expect(page.locator('[data-spec="drinking-window"]')).toHaveCount(0);
      await expectNoSeriousA11yViolations(page, "tawny 375");
    });

    test("a draft vintage is never offered, and invalid query values fall back to the default", async ({ page }) => {
      await declareAdult(page, `${prefix}/ruou-vang/hollow-creek-cabernet?vintage=2022&size=750`);
      // 2022 is a draft: the default, 2021 at 2 950 000, is shown instead.
      await expect(spec(page, "vintage")).toHaveText("2021");
      expect(await vnd(page, "price")).toBe(2_950_000);
      const selector = page.getByRole("navigation", { name: vi ? "Chọn niên vụ và dung tích" : "Choose vintage and size" });
      await expect(selector.getByRole("link")).toHaveText(["2021", "2019", "750 ml"]);

      for (const query of ["?vintage=abc&size=9", "?vintage=1999", "?size=1500", "?vintage=nv"]) {
        const response = await page.goto(`${prefix}/ruou-vang/hollow-creek-cabernet${query}`);
        expect(response!.status(), query).toBe(200);
        await expect(spec(page, "vintage"), query).toHaveText("2021");
        await expect(spec(page, "volume"), query).toHaveText("750 ml");
      }
    });

    test("a draft wine, an unknown slug and a wine without a published vintage are not found", async ({ page }) => {
      await declareAdult(page, `${prefix}/ruou-vang/aubeline-brut`);
      for (const slug of ["lune-grise-reserve", "no-such-wine", "steinbach-riesling-spatlese"]) {
        const response = await page.goto(`${prefix}/ruou-vang/${slug}`);
        expect(response!.status(), slug).toBe(404);
        await expect(page.getByRole("heading", { level: 1 }), slug).toHaveText(vi ? "Không tìm thấy trang" : "Page not found");
        await expect(page.locator("main"), slug).not.toContainText("Steinbach Riesling Spätlese");
      }
    });
  });
}

test.describe("without client JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the selector works through plain links", async ({ page, context, baseURL }) => {
    // The gate form is covered elsewhere; here the marker cookie stands in for a declaration.
    await context.addCookies([{ name: "xenia_age_ok", value: "1", url: baseURL! }]);
    await page.goto("/en/ruou-vang/aubeline-brut");
    await expect(spec(page, "vintage")).toHaveText("Non-vintage (NV)");
    await expect(spec(page, "volume")).toHaveText("750 ml");
    expect(await vnd(page, "price")).toBe(2_450_000);

    await page.getByRole("link", { name: "375 ml" }).click();
    await expect(page).toHaveURL((url) => url.search === "?vintage=nv&size=375");
    await expect(spec(page, "volume")).toHaveText("375 ml");
    expect(await vnd(page, "price")).toBe(1_350_000);
  });
});
