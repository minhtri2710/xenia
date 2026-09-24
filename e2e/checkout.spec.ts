import { execFileSync } from "node:child_process";

import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, type Page, test } from "@playwright/test";

import { blockThirdParty, seedCatalogue, vietnamDateYearsAgo } from "./support";

// Every money value below is written by hand from `src/seed/data.ts` (vintage prices) and its
// `ZONE_FEES` (HCMC 30 000, Hà Nội 45 000), never computed with `computeTotals` or the pages' code.
// VAT included = total × 10 / 110, rounded to the nearest whole VND.

const LEGAL_NOTICE = "Không bán rượu, bia cho người chưa đủ 18 tuổi";
const LOCALES = [
  { locale: "vi", prefix: "" },
  { locale: "en", prefix: "/en" },
] as const;
const ADMIN_EMAIL = "admin@xenia.test";
const ADMIN_PASSWORD = "e2e-dev-only-password";
const COD = /\bCOD\b|cash on delivery|thanh toán khi (nhận|giao) hàng|tiền mặt khi/i;

function sql(query: string): string {
  return execFileSync("docker", ["exec", "xenia-dev-postgres", "psql", "-U", "xenia", "-d", "xenia", "-tAc", query], { encoding: "utf8" }).trim();
}

const orderCount = () => Number(sql("SELECT count(*) FROM orders"));
const stockOf = (id: number) => Number(sql(`SELECT stock FROM vintages WHERE id = ${id}`));

function vintageId(slug: string, year: number | null, ml: number): number {
  const yearClause = year === null ? "v.year IS NULL" : `v.year = ${year}`;
  return Number(sql(`SELECT v.id FROM vintages v JOIN wines w ON w.id = v.wine_id WHERE w.slug = '${slug}' AND ${yearClause} AND v.bottle_ml = '${ml}'`));
}

const digits = async (page: Page, selector: string) => Number((await page.locator(selector).textContent())!.replace(/\D/g, ""));

/** Opens `path` through the gate: redirect, adult declaration, return to `next`. */
async function declareAdult(page: Page, path: string) {
  await page.goto(path);
  await expect(page).toHaveURL((url) => url.pathname.endsWith("/xac-minh-tuoi"));
  await page.locator("#gate-name").fill("Nguyễn Văn An");
  await page.locator("#gate-dob").fill(vietnamDateYearsAgo(30));
  await page.locator("form button[type=submit]").click();
  await expect(page).toHaveURL((url) => url.pathname === new URL(path, "http://x").pathname);
}

/** Adds the product page's default selection in `qty` and lands on the cart. */
async function addToCart(page: Page, prefix: string, slug: string, qty = 1) {
  await page.goto(`${prefix}/ruou-vang/${slug}`);
  const form = page.getByTestId("add-to-cart");
  await form.locator("input[name=qty]").fill(String(qty));
  await form.locator("button[type=submit]").click();
  await expect(page).toHaveURL((url) => url.pathname === `${prefix}/gio-hang`);
}

async function fillBuyer(page: Page, dob: string) {
  await page.locator("#buyer-name").fill("Nguyễn Văn An");
  await page.locator("#buyer-dob").fill(dob);
  await page.locator("#buyer-phone").fill("090 123 4567");
  await page.locator("#buyer-email").fill("an@example.test");
  await page.locator("#buyer-address").fill("12 Lê Lợi, Quận 1");
  await page.locator("form button[type=submit]").click();
}

/** From a filled cart, through steps 1 and 2, to the review. */
async function toReview(page: Page, prefix: string, zone: "hcmc" | "hanoi") {
  await page.goto(`${prefix}/thanh-toan`);
  await fillBuyer(page, vietnamDateYearsAgo(30));
  await expect(page).toHaveURL((url) => url.pathname === `${prefix}/thanh-toan/giao-hang`);
  await page.locator(`input[name=zone][value=${zone}]`).check();
  await page.locator("form button[type=submit]").click();
  await expect(page).toHaveURL((url) => url.pathname === `${prefix}/thanh-toan/xac-nhan`);
}

async function consentAndPlace(page: Page, prefix: string) {
  await page.locator("input[name=terms]").check();
  await page.locator("input[name=privacy]").check();
  await page.locator("form:has(input[name=clientKey]) button[type=submit]").click();
  await expect(page).toHaveURL((url) => url.pathname.startsWith(`${prefix}/don-hang/`));
  return new URL(page.url()).pathname.split("/").pop()!;
}

async function expectNoSeriousA11yViolations(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const blocking = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`), label).toEqual([]);
}

async function expectNotice(page: Page) {
  await expect(page.getByTestId("age-notice")).toContainText(LEGAL_NOTICE);
}

async function newPage(browser: Browser) {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  return context.newPage();
}

test.beforeAll(async ({ request }) => {
  await seedCatalogue(request);
});

test.describe("gate", () => {
  for (const { prefix } of LOCALES) {
    for (const path of ["/gio-hang", "/thanh-toan", "/thanh-toan/giao-hang", "/thanh-toan/xac-nhan", `/don-hang/${"A".repeat(43)}`]) {
      test(`${prefix}${path} redirects an undeclared visitor to the gate`, async ({ page }) => {
        await page.goto(prefix + path);
        await expect(page).toHaveURL((url) => url.pathname === `${prefix}/xac-minh-tuoi` && url.searchParams.get("next") === prefix + path);
      });
    }
  }
});

for (const { locale, prefix } of LOCALES) {
  const vi = locale === "vi";
  // vi delivers to HCMC, en to Hà Nội, so both fees are exercised.
  const zone = vi ? "hcmc" : "hanoi";
  const expected = vi
    ? { goods: 2_420_000, shipping: 30_000, total: 2_450_000, vat: 222_727 }
    : { goods: 2_420_000, shipping: 45_000, total: 2_465_000, vat: 224_091 };

  test(`an adult buys two vintages and pays with the mock (${locale})`, async ({ page }) => {
    test.setTimeout(300_000);
    const external = await blockThirdParty(page);
    const lune = vintageId("lune-grise-rouge", 2020, 750); // 850 000
    const colle = vintageId("colle-vento-rosso", 2021, 750); // 720 000
    const luneStock = stockOf(lune);
    const colleStock = stockOf(colle);

    await declareAdult(page, `${prefix}/ruou-vang/lune-grise-rouge`);
    await addToCart(page, prefix, "lune-grise-rouge");
    await addToCart(page, prefix, "colle-vento-rosso");

    // Change a quantity: Lune Grise 1 → 2.
    const luneLine = page.locator(`[data-vintage="${lune}"]`);
    await luneLine.locator("input[name=qty]").fill("2");
    await luneLine.getByRole("button", { name: vi ? "Cập nhật" : "Update" }).click();
    await expect.poll(() => digits(page, '[data-testid="cart-goods"]')).toBe(2_420_000); // 2 × 850 000 + 720 000
    await expect(luneLine.locator("input[name=qty]")).toHaveValue("2");
    await expect(page.getByTestId("cart-lines").locator("li")).toHaveCount(2);
    await expectNotice(page);
    await expectNoSeriousA11yViolations(page, "cart");

    // Step 1.
    await page.getByRole("link", { name: vi ? "Thanh toán" : "Check out" }).click();
    await expect(page).toHaveURL((url) => url.pathname === `${prefix}/thanh-toan`);
    await expectNotice(page);
    await expectNoSeriousA11yViolations(page, "step 1");
    await fillBuyer(page, vietnamDateYearsAgo(30));

    // Step 2.
    await expect(page).toHaveURL((url) => url.pathname === `${prefix}/thanh-toan/giao-hang`);
    await expect(page.getByTestId("id-check")).toContainText(vi ? "giấy tờ tùy thân" : "shows ID");
    await expectNotice(page);
    await expectNoSeriousA11yViolations(page, "step 2");
    await page.locator(`input[name=zone][value=${zone}]`).check();
    await page.locator("form button[type=submit]").click();

    // Step 4: review.
    await expect(page).toHaveURL((url) => url.pathname === `${prefix}/thanh-toan/xac-nhan`);
    await expectNotice(page);
    await expectNoSeriousA11yViolations(page, "review");
    const lines = page.getByTestId("review-lines").locator("li");
    await expect(lines).toHaveCount(2);
    await expect(page.locator(`[data-testid="review-lines"] [data-vintage="${lune}"]`)).toContainText(
      vi ? "2 × Lune Grise Đỏ 2020, 750 ml" : "2 × Lune Grise Rouge 2020, 750 ml",
    );
    await expect(page.locator(`[data-testid="review-lines"] [data-vintage="${colle}"]`)).toContainText("1 × Colle del Vento Rosso 2021, 750 ml");
    await expect(page.getByTestId("review-delivery")).toContainText(vi ? "TP. Hồ Chí Minh" : "Hà Nội");
    expect(await digits(page, '[data-total="goods"]')).toBe(expected.goods);
    expect(await digits(page, '[data-total="shipping"]')).toBe(expected.shipping);
    expect(await digits(page, '[data-total="total"]')).toBe(expected.total);
    expect(await digits(page, '[data-total="vat"]')).toBe(expected.vat);
    await expect(page.getByTestId("review-totals")).toContainText(vi ? "đã bao gồm VAT" : "VAT included");
    for (const href of ["/gio-hang", "/thanh-toan", "/thanh-toan/giao-hang"]) {
      await expect(page.locator(`main a[href="${prefix}${href}"]`).first()).toBeVisible();
    }
    await expect(page.locator("input[name=terms]")).not.toBeChecked();
    await expect(page.locator("input[name=privacy]")).not.toBeChecked();
    await expect(page.locator("main")).not.toContainText(COD);

    // Consent: without both boxes, nothing is placed.
    const before = orderCount();
    const submit = page.locator("form:has(input[name=clientKey]) button[type=submit]");
    await submit.click();
    await expect(page.locator("#consent-terms-error")).toBeVisible();
    await expect(page.locator("#consent-privacy-error")).toBeVisible();
    await page.locator("input[name=terms]").check();
    await submit.click();
    await expect(page.locator("#consent-privacy-error")).toBeVisible();
    await expect(page).toHaveURL((url) => url.pathname === `${prefix}/thanh-toan/xac-nhan`);
    expect(orderCount()).toBe(before);

    const token = await consentAndPlace(page, prefix);
    expect(orderCount()).toBe(before + 1);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    // Status page before payment; stock is reserved at placement.
    await expect(page.getByTestId("order-status")).toHaveText(vi ? "Đã đặt, chờ thanh toán" : "Placed, awaiting payment");
    expect(stockOf(lune)).toBe(luneStock - 2);
    expect(stockOf(colle)).toBe(colleStock - 1);
    const methods = page.locator("input[name=method]");
    await expect(methods).toHaveCount(2);
    expect(await methods.evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))).toEqual(["vietqr_mock", "card_mock"]);
    await expect(page.locator("main")).not.toContainText(COD);
    await expect(page.locator('main input:not([type="hidden"]):not([type="radio"])')).toHaveCount(0);
    await expectNotice(page);
    await expectNoSeriousA11yViolations(page, "status, unpaid");

    // Mock failure: still unpaid, retry offered, stock stays reserved.
    await page.locator("input[name=method][value=card_mock]").check();
    await page.getByRole("button", { name: vi ? "Mô phỏng thanh toán thất bại" : "Simulate a failed payment" }).click();
    await expect(page.getByTestId("payment-failed")).toBeVisible();
    await expect(page.getByTestId("order-status")).toHaveText(vi ? "Đã đặt, chờ thanh toán" : "Placed, awaiting payment");
    expect(sql(`SELECT status || '/' || payment_status FROM orders WHERE token = '${token}'`)).toBe("placed/failed");
    expect(stockOf(lune)).toBe(luneStock - 2);

    // Mock success.
    await page.locator("input[name=method][value=vietqr_mock]").check();
    await page.getByRole("button", { name: vi ? "Mô phỏng thanh toán thành công" : "Simulate a successful payment" }).click();
    await expect(page.getByTestId("order-status")).toHaveText(vi ? "Đã thanh toán" : "Paid");
    await expect(page.locator("input[name=method]")).toHaveCount(0);
    const number = sql(`SELECT number FROM orders WHERE token = '${token}'`);
    expect(number).toMatch(/^XN-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(number);
    await expect(page.getByTestId("status-link")).toHaveText(`/don-hang/${token}`);
    await expect(page.getByTestId("order-lines").locator("li")).toHaveCount(2);
    await expect(page.getByTestId("order-lines")).toContainText(vi ? "2 × Lune Grise Đỏ 2020, 750 ml, 14% vol" : "2 × Lune Grise Rouge 2020, 750 ml, 14% vol");
    expect(await digits(page, '[data-total="goods"]')).toBe(expected.goods);
    expect(await digits(page, '[data-total="shipping"]')).toBe(expected.shipping);
    expect(await digits(page, '[data-total="total"]')).toBe(expected.total);
    expect(await digits(page, '[data-total="vat"]')).toBe(expected.vat);
    await expectNoSeriousA11yViolations(page, "status, paid");

    // The stored order: server-computed totals, snapshot lines, consents, attestation, no DOB.
    expect(
      sql(
        `SELECT concat_ws('|', status, payment_status, payment_method, totals_goods_vnd, totals_shipping_vnd, totals_total_vnd, totals_vat_included_vnd, delivery_zone, buyer_name, buyer_phone, consents_terms, consents_privacy, age_attested_at IS NOT NULL) FROM orders WHERE token = '${token}'`,
      ),
    ).toBe(`paid|paid|vietqr_mock|${expected.goods}|${expected.shipping}|${expected.total}|${expected.vat}|${zone}|Nguyễn Văn An|0901234567|t|t|t`);
    expect(
      sql(
        `SELECT string_agg(concat_ws(':', l.wine_name_vi, l.qty, l.unit_price_vnd, l.abv_pct), ',' ORDER BY l.unit_price_vnd DESC) FROM orders_lines l JOIN orders o ON l._parent_id = o.id WHERE o.token = '${token}'`,
      ),
    ).toBe("Lune Grise Đỏ:2:850000:14,Colle del Vento Rosso:1:720000:13.5");
    expect(stockOf(lune)).toBe(luneStock - 2);
    expect(stockOf(colle)).toBe(colleStock - 1);
    // The cart and the checkout state are cleared.
    await page.goto(`${prefix}/gio-hang`);
    await expect(page.getByTestId("cart-lines")).toHaveCount(0);

    expect(external).toEqual([]);
  });

  test(`an under-18 date of birth places no order and ends at the exit page (${locale})`, async ({ page }) => {
    await declareAdult(page, `${prefix}/ruou-vang/colle-vento-rosso`);
    await addToCart(page, prefix, "colle-vento-rosso");
    const before = orderCount();
    await page.goto(`${prefix}/thanh-toan`);
    await fillBuyer(page, vietnamDateYearsAgo(17));
    await expect(page).toHaveURL((url) => url.pathname === `${prefix}/tam-biet`);
    const names = (await page.context().cookies()).map((c) => c.name);
    expect(names).not.toContain("xenia_age_ok");
    expect(names).not.toContain("xenia_checkout");
    expect(orderCount()).toBe(before);
    await page.goto(`${prefix}/thanh-toan`);
    await expect(page).toHaveURL((url) => url.pathname === `${prefix}/xac-minh-tuoi`);
  });

  test(`an unknown or malformed status token is a 404 (${locale})`, async ({ page }) => {
    await declareAdult(page, `${prefix}/ruou-vang`);
    for (const token of ["not-a-token", "A".repeat(43), `${"A".repeat(42)}=`]) {
      const response = await page.goto(`${prefix}/don-hang/${token}`);
      expect(response?.status(), token).toBe(404);
    }
  });
}

test("the 18th birthday passes step 1", async ({ page }) => {
  await declareAdult(page, "/ruou-vang/colle-vento-rosso");
  await addToCart(page, "", "colle-vento-rosso");
  await page.goto("/thanh-toan");
  await fillBuyer(page, vietnamDateYearsAgo(18));
  await expect(page).toHaveURL((url) => url.pathname === "/thanh-toan/giao-hang");
});

test("step 1 reports invalid fields on the server and keeps the visitor there", async ({ page }) => {
  await declareAdult(page, "/ruou-vang/colle-vento-rosso");
  await addToCart(page, "", "colle-vento-rosso");
  await page.goto("/thanh-toan");
  await page.locator("#buyer-name").fill("  ");
  await page.locator("#buyer-dob").fill(vietnamDateYearsAgo(30));
  await page.locator("#buyer-phone").fill("12345");
  await page.locator("#buyer-email").fill("an@example");
  await page.locator("#buyer-address").fill("12 Lê Lợi");
  await page.locator("form button[type=submit]").click();
  await expect(page.locator("#buyer-name-error")).toBeVisible();
  await expect(page.locator("#buyer-phone-error")).toBeVisible();
  await expect(page.locator("#buyer-email-error")).toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname === "/thanh-toan");
});

test("the cart caps quantity at stock, refuses a non-positive quantity and a draft vintage", async ({ page }) => {
  const carmenere = vintageId("cordillera-carmenere", 2022, 750); // stock 60
  const draft = vintageId("hollow-creek-cabernet", 2022, 750); // draft vintage
  await declareAdult(page, "/ruou-vang/cordillera-carmenere");
  await addToCart(page, "", "cordillera-carmenere");
  const line = page.locator(`[data-vintage="${carmenere}"]`);
  const qty = line.locator("input[name=qty]");

  await line.locator("form").first().evaluate((f) => ((f as HTMLFormElement).noValidate = true));
  await qty.fill("999");
  await line.getByRole("button", { name: "Cập nhật" }).click();
  await expect(qty).toHaveValue("60");

  await line.locator("form").first().evaluate((f) => ((f as HTMLFormElement).noValidate = true));
  await qty.fill("0");
  await line.getByRole("button", { name: "Cập nhật" }).click();
  await expect(page.getByTestId("cart-error")).toBeVisible();
  await expect(qty).toHaveValue("60");

  // A tampered add-to-cart for a draft vintage is refused.
  await page.goto("/ruou-vang/hollow-creek-cabernet");
  await page.getByTestId("add-to-cart").locator("input[name=vintageId]").evaluate((el, id) => ((el as HTMLInputElement).value = String(id)), draft);
  await page.getByTestId("add-to-cart").locator("button[type=submit]").click();
  await expect(page.getByTestId("cart-error")).toBeVisible();
  await expect(page.locator(`[data-vintage="${draft}"]`)).toHaveCount(0);

  await line.getByRole("button", { name: /^Bỏ / }).click();
  await expect(page.getByTestId("cart-lines")).toHaveCount(0);
});

test("a quantity above stock at placement is refused with a field error", async ({ page }) => {
  const sept = vintageId("sept-pierres-blanc", 2022, 750); // 1 250 000, stock 20
  await declareAdult(page, "/ruou-vang/sept-pierres-blanc");
  await addToCart(page, "", "sept-pierres-blanc", 5);
  await toReview(page, "", "hcmc");
  sql(`UPDATE vintages SET stock = 2 WHERE id = ${sept}`);

  const before = orderCount();
  await page.locator("input[name=terms]").check();
  await page.locator("input[name=privacy]").check();
  await page.locator("form:has(input[name=clientKey]) button[type=submit]").click();
  await expect(page.getByTestId("line-problems")).toContainText("Sept Pierres Trắng: chỉ còn 2 chai");
  await expect(page).toHaveURL((url) => url.pathname === "/thanh-toan/xac-nhan");
  expect(orderCount()).toBe(before);
  expect(stockOf(sept)).toBe(2);

  // The review now shows what is available; confirming it places the order.
  await expect(page.locator(`[data-testid="review-lines"] [data-vintage="${sept}"]`)).toContainText("2 × Sept Pierres Trắng");
  expect(await digits(page, '[data-total="total"]')).toBe(2_530_000); // 2 × 1 250 000 + 30 000
  await consentAndPlace(page, "");
  expect(orderCount()).toBe(before + 1);
  expect(stockOf(sept)).toBe(0);
});

test("concurrent orders for the last bottles never take stock below zero", async ({ browser }) => {
  test.setTimeout(300_000);
  const rose = vintageId("southern-light-rose", 2023, 750);
  sql(`UPDATE vintages SET stock = 3 WHERE id = ${rose}`);
  const pages = [await newPage(browser), await newPage(browser)];
  for (const page of pages) {
    await declareAdult(page, "/ruou-vang/southern-light-rose");
    await addToCart(page, "", "southern-light-rose", 2);
    await toReview(page, "", "hcmc");
    await page.locator("input[name=terms]").check();
    await page.locator("input[name=privacy]").check();
  }
  const before = orderCount();
  await Promise.all(pages.map((page) => page.locator("form:has(input[name=clientKey]) button[type=submit]").click()));
  const outcomes = await Promise.all(
    pages.map(async (page) => {
      await expect(page.getByTestId("line-problems").or(page.getByTestId("order-status"))).toBeVisible();
      return new URL(page.url()).pathname.startsWith("/don-hang/") ? "placed" : "refused";
    }),
  );
  expect(outcomes.sort()).toEqual(["placed", "refused"]);
  expect(orderCount()).toBe(before + 1);
  expect(stockOf(rose)).toBe(1);
  for (const page of pages) await page.context().close();
});

test("the same client key never creates a second order: double submit, replayed POST, back-and-resubmit", async ({ page }) => {
  test.setTimeout(300_000);
  await declareAdult(page, "/ruou-vang/colle-vento-rosso");
  await addToCart(page, "", "colle-vento-rosso");
  await toReview(page, "", "hcmc");
  const clientKey = await page.locator("input[name=clientKey]").inputValue();
  const before = orderCount();
  // A second tab holds the review form open; it is the stale page a buyer resubmits after going back.
  const stale = await page.context().newPage();
  await stale.goto("/thanh-toan/xac-nhan");
  await expect(stale.locator("input[name=clientKey]")).toHaveValue(clientKey);

  // The browser's place-order POST is captured and aborted; identical copies of it are replayed
  // with the context's cookies. Each answer redirects to the one order's status page.
  let captured: { url: string; headers: Record<string, string>; body: Buffer } | undefined;
  await page.route(
    (url) => url.pathname === "/thanh-toan/xac-nhan",
    async (route) => {
      const r = route.request();
      if (r.method() !== "POST") return route.continue();
      const headers = Object.fromEntries(Object.entries(await r.allHeaders()).filter(([k]) => !["host", "content-length", "cookie"].includes(k)));
      captured = { url: r.url(), headers, body: r.postDataBuffer()! };
      return route.abort();
    },
  );
  await page.locator("input[name=terms]").check();
  await page.locator("input[name=privacy]").check();
  await page.locator("form:has(input[name=clientKey]) button[type=submit]").click();
  await expect.poll(() => captured).toBeDefined();
  await page.unroute((url) => url.pathname === "/thanh-toan/xac-nhan");
  const replay = async () => {
    const response = await page.request.post(captured!.url, { headers: captured!.headers, data: captured!.body, maxRedirects: 0 });
    return JSON.stringify(response.headers());
  };

  // Double submit: two copies race each other.
  const raced = await Promise.all([replay(), replay()]);
  const token = sql(`SELECT token FROM orders WHERE client_key = '${clientKey}'`);
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  for (const headers of raced) expect(headers).toContain(`/don-hang/${token}`);
  expect(orderCount()).toBe(before + 1);

  // A replayed POST after the order exists (the cart and checkout cookies are now cleared).
  expect(await replay()).toContain(`/don-hang/${token}`);
  expect(orderCount()).toBe(before + 1);

  // Back-and-resubmit: the stale review form posts the same key after the order exists.
  await stale.locator("input[name=terms]").check();
  await stale.locator("input[name=privacy]").check();
  await stale.locator("form:has(input[name=clientKey]) button[type=submit]").click();
  await expect(stale).toHaveURL((url) => url.pathname === `/don-hang/${token}`);
  expect(orderCount()).toBe(before + 1);
  expect(Number(sql(`SELECT count(*) FROM orders WHERE client_key = '${clientKey}'`))).toBe(1);
});

test("a posted price, total or shipping fee and a price in the cart cookie are ignored", async ({ page }) => {
  const colle = vintageId("colle-vento-rosso", 2021, 750); // 720 000
  await declareAdult(page, "/ruou-vang/colle-vento-rosso");
  await page.context().addCookies([
    {
      name: "xenia_cart",
      value: encodeURIComponent(JSON.stringify([{ v: colle, q: 1, p: 1, priceVnd: 1, unitPriceVnd: 1 }])),
      url: test.info().project.use.baseURL!,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await toReview(page, "", "hcmc");
  await page.locator("form:has(input[name=clientKey])").evaluate((form) => {
    for (const [name, value] of [
      ["priceVnd", "1"],
      ["unitPriceVnd", "1"],
      ["goodsVnd", "1"],
      ["shippingVnd", "0"],
      ["totalVnd", "1"],
      ["vatIncludedVnd", "0"],
    ]) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
  });
  const token = await consentAndPlace(page, "");
  // 720 000 + 30 000 = 750 000; 750 000 / 11 = 68 181.8 → 68 182.
  expect(sql(`SELECT concat_ws('|', totals_goods_vnd, totals_shipping_vnd, totals_total_vnd, totals_vat_included_vnd) FROM orders WHERE token = '${token}'`)).toBe(
    "720000|30000|750000|68182",
  );
  expect(sql(`SELECT l.unit_price_vnd FROM orders_lines l JOIN orders o ON l._parent_id = o.id WHERE o.token = '${token}'`)).toBe("720000");
});

test("orders and site settings are admin-only over REST, nobody deletes an order, and the admin order view makes no third-party request", async ({
  page,
  request,
}) => {
  test.setTimeout(300_000);
  await declareAdult(page, "/ruou-vang/colle-vento-rosso");
  await addToCart(page, "", "colle-vento-rosso");
  await toReview(page, "", "hcmc");
  const token = await consentAndPlace(page, "");
  const id = Number(sql(`SELECT id FROM orders WHERE token = '${token}'`));
  const number = sql(`SELECT number FROM orders WHERE id = ${id}`);
  const count = orderCount();

  // Unauthenticated REST: no order or buyer data, nothing created or deleted.
  for (const response of [await request.get("/api/orders"), await request.get(`/api/orders/${id}`), await request.get("/api/globals/site-settings")]) {
    expect(response.ok(), `${response.url()} ${response.status()}`).toBe(false);
    const body = await response.text();
    for (const secret of [number, token, "Nguyễn Văn An", "0901234567", "hcmc"]) expect(body).not.toContain(secret);
  }
  const post = await request.post("/api/orders", { data: { number: "XN-TEST-0000", status: "paid" } });
  expect(post.ok(), `POST ${post.status()}`).toBe(false);
  const del = await request.delete(`/api/orders/${id}`);
  expect(del.ok(), `DELETE ${del.status()}`).toBe(false);
  expect(orderCount()).toBe(count);

  // An authenticated admin cannot delete an order, can change its status, and cannot rewrite its totals.
  execFileSync("docker", ["exec", "xenia-dev-postgres", "psql", "-U", "xenia", "-d", "xenia", "-c", "TRUNCATE users CASCADE"]);
  const admin = page.request;
  expect((await admin.post("/api/users/first-register", { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, "confirm-password": ADMIN_PASSWORD } })).ok()).toBe(true);
  expect((await admin.post("/api/users/login", { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).ok()).toBe(true);
  const adminDelete = await admin.delete(`/api/orders/${id}`);
  expect(adminDelete.ok(), `admin DELETE ${adminDelete.status()}`).toBe(false);
  expect(orderCount()).toBe(count);
  const patch = await admin.patch(`/api/orders/${id}`, { data: { status: "packed", totals: { totalVnd: 1 } } });
  expect(patch.ok(), `admin PATCH ${patch.status()}`).toBe(true);
  expect(sql(`SELECT status || '|' || totals_total_vnd FROM orders WHERE id = ${id}`)).toBe("packed|750000");

  const external = await blockThirdParty(page);
  await page.goto("/admin/collections/orders");
  await expect(page.locator(".collection-list table")).toContainText(number);
  await page.waitForLoadState("networkidle");
  await page.goto(`/admin/collections/orders/${id}`);
  await expect(page.locator('form[data-form-ready="true"]')).toBeVisible({ timeout: 90_000 });
  await expect(page.locator("#field-status")).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(external).toEqual([]);
});
