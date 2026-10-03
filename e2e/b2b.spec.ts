import { expect, type Page, test } from "@playwright/test";

import { blockThirdParty, declareAdult, expectNoSeriousA11yViolations, seedCatalogue, sql } from "./support";

// Featured wines in the seed (`featured: true` in src/seed/data.ts), ABV in brackets:
//   aubeline-brut (12), lune-grise-rouge (14), rio-velho-tawny-10 (20), southern-light-rose (12.5).
// The tawny is at 20% ABV and never shown; the other three are, in name order (same in vi and en).
const FEATURED = ["aubeline-brut", "lune-grise-rouge", "southern-light-rose"];
const RESTRICTED = "rio-velho-tawny-10";
const WARNING = "Người dưới 18 tuổi không được uống rượu, bia";

const LOCALES = [
  { locale: "vi", prefix: "" },
  { locale: "en", prefix: "/en" },
] as const;

const quoteRows = () => Number(sql("SELECT count(*) FROM quote_requests"));

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  await seedCatalogue(request);
});

for (const { locale, prefix } of LOCALES) {
  const vi = locale === "vi";

  test.describe(`home, header and B2B pages (${locale})`, () => {
    test("home lists the featured wines in name order, never a restricted one, beside the under-18 warning", async ({ page }) => {
      await declareAdult(page, prefix || "/");
      const slugs = await page.getByTestId("featured-card").evaluateAll((cards) => cards.map((c) => c.getAttribute("data-slug")));
      expect(slugs).toEqual(FEATURED);
      expect(slugs).not.toContain(RESTRICTED);
      await expect(page.getByTestId("featured-warning").locator('strong[lang="vi"]')).toHaveText(WARNING);
      await page.getByTestId("featured-card").first().getByRole("link").click();
      await expect(page).toHaveURL((url) => url.pathname === `${prefix}/ruou-vang/${FEATURED[0]}`);
      await page.goto(prefix || "/");
      await expectNoSeriousA11yViolations(page, "home");
    });

    test("the header marks the current section and nothing else", async ({ page }) => {
      await declareAdult(page, `${prefix}/ruou-vang/${FEATURED[0]}`);
      const nav = page.getByRole("navigation", { name: vi ? "Điều hướng chính" : "Primary navigation" });
      const wines = nav.getByRole("link", { name: vi ? "Rượu vang" : "Wine", exact: true });
      const cart = nav.getByRole("link", { name: vi ? "Giỏ hàng" : "Cart", exact: true });
      await expect(wines).toHaveAttribute("aria-current", "page");
      await expect(cart).not.toHaveAttribute("aria-current", /.*/);
      await page.goto(`${prefix}/gio-hang`);
      await expect(cart).toHaveAttribute("aria-current", "page");
      await expect(wines).not.toHaveAttribute("aria-current", /.*/);
    });

    test("the personalisation page states a paid service and answers questions without third-party requests", async ({ page }) => {
      const external = await blockThirdParty(page);
      await declareAdult(page, `${prefix}/ca-nhan-hoa`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByTestId("personalise-paid")).toContainText(vi ? "có tính phí" : "paid service");
      const first = page.getByTestId("personalise-faq").locator("details").first();
      await first.locator("summary").click();
      await expect(first).toHaveAttribute("open", "");
      expect(await page.locator("main").innerText()).not.toMatch(vi ? /miễn phí|giảm giá|khuyến mại/i : /\bfree\b|discount|promotion/i);
      await page.getByRole("link", { name: vi ? "Gửi yêu cầu báo giá" : "Send a quote request" }).click();
      await expect(page).toHaveURL((url) => url.pathname === `${prefix}/lien-he`);
      await page.goto(`${prefix}/ca-nhan-hoa`);
      await expectNoSeriousA11yViolations(page, "personalise");
      expect(external).toEqual([]);
    });

    test("the quote form refuses an incomplete request, stores a complete one and confirms it", async ({ page }) => {
      await declareAdult(page, `${prefix}/lien-he`);
      await expectNoSeriousA11yViolations(page, "quote form");
      const before = quoteRows();

      await page.getByTestId("quote-form").getByRole("button").click();
      await expect(page.locator("#quote-company-error")).toHaveText(vi ? "Vui lòng nhập tên doanh nghiệp." : "Enter the company name.");
      await expect(page.locator("#quote-privacy-error")).toBeVisible();
      await expectNoSeriousA11yViolations(page, "quote form with errors");
      expect(quoteRows()).toBe(before);

      const company = `E2E ${locale} ${Date.now()}`;
      await page.locator("#quote-company").fill(company);
      await page.locator("#quote-name").fill("Trần Thị Bình");
      await page.locator("#quote-phone").fill("090 123 4567");
      await page.locator("#quote-email").fill("Binh@Example.TEST");
      await page.locator("#quote-occasion").selectOption("tet");
      await page.locator("#quote-quantity").fill("120");
      await page.locator("#quote-budget").selectOption("1m-2m");
      await page.locator("#quote-message").fill("Giao trước Tết.");
      await page.locator("#quote-privacy").check();
      await page.getByTestId("quote-form").getByRole("button").click();

      await expect(page).toHaveURL((url) => url.pathname === `${prefix}/lien-he` && url.search === "?sent=1");
      await expect(page.getByTestId("quote-sent")).toBeVisible();
      expect(quoteRows()).toBe(before + 1);
      const row = sql(
        `SELECT name || '|' || email || '|' || phone || '|' || occasion || '|' || quantity || '|' || budget || '|' || message || '|' || status || '|' || (privacy_accepted_at IS NOT NULL) FROM quote_requests WHERE company = '${company}'`,
      );
      expect(row).toBe("Trần Thị Bình|binh@example.test|0901234567|tet|120|1m-2m|Giao trước Tết.|new|true");
      await expectNoSeriousA11yViolations(page, "quote sent");
    });
  });
}

// The seed's sample Brio (src/seed/data.ts) is published with one 750 ml vintage at 11% ABV. The tests
// below change it with SQL and `pnpm seed` puts it back after each one.
test.describe("Brio page", () => {
  const footerBrio = (page: Page) => page.locator("footer").getByRole("link", { name: "Brio", exact: true });
  const brioWine = "(SELECT id FROM wines WHERE slug = 'brio')";

  test.afterEach(async ({ request }) => {
    await seedCatalogue(request);
  });

  test("shows the story and the selected vintage's details while Brio is under 15%, in both locales", async ({ page }) => {
    await declareAdult(page, "/");
    for (const prefix of ["", "/en"]) {
      expect((await page.goto(`${prefix}/brio`))?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Brio");
      await expect(page.getByTestId("brio-specs").locator('[data-spec="abv"] dd')).toHaveText("11% vol");
      await expect(page.getByTestId("brio-warning").locator('strong[lang="vi"]')).toHaveText(WARNING);
      await expect(footerBrio(page)).toHaveCount(1);
      await expectNoSeriousA11yViolations(page, `brio ${prefix || "vi"}`);
    }
  });

  test("is not found and not linked once a published vintage is at 15% or above", async ({ page }) => {
    sql(`UPDATE vintages SET abv_pct = 15 WHERE wine_id = ${brioWine}`);
    await declareAdult(page, "/");
    expect((await page.goto("/brio"))?.status()).toBe(404);
    await expect(footerBrio(page)).toHaveCount(0);
  });

  test("is not found and not linked while the Brio wine is a draft", async ({ page }) => {
    sql("UPDATE wines SET status = 'draft' WHERE slug = 'brio'");
    await declareAdult(page, "/");
    expect((await page.goto("/brio"))?.status()).toBe(404);
    await expect(footerBrio(page)).toHaveCount(0);
  });
});

test("quote requests have no public REST surface", async ({ request }) => {
  const list = await request.get("/api/quote-requests");
  expect(list.status()).toBe(403);
  const create = await request.post("/api/quote-requests", { data: { company: "x", name: "x", email: "x@example.test", phone: "0901234567", occasion: "tet", quantity: 1 } });
  expect(create.status()).toBe(403);
});
