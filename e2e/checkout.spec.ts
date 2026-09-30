import { type Browser, expect, type Page, test } from "@playwright/test";

import { blockThirdParty, expectNoSeriousA11yViolations, seedCatalogue, spawnPsqlTransaction, sql, vietnamDateYearsAgo } from "./support";

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
const BUYER_EMAIL = "An.Nguyen@Example.TEST";
const BUYER_ADDRESS = "12  Lê Lợi,  Quận 1";
const COD = /\bCOD\b|cash on delivery|thanh toán khi (nhận|giao) hàng|tiền mặt khi/i;

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

async function fillBuyer(page: Page, dob: string, address = "12 Lê Lợi, Quận 1", email = "an@example.test") {
  await page.locator("#buyer-name").fill("Nguyễn Văn An");
  await page.locator("#buyer-dob").fill(dob);
  await page.locator("#buyer-phone").fill("090 123 4567");
  await page.locator("#buyer-email").fill(email);
  await page.locator("#buyer-address").fill(address);
  await page.locator("form button[type=submit]").click();
}

/** Step 2 in self mode: the zone, the prefilled earliest date, the morning window; lands on step 3. */
async function submitDelivery(page: Page, prefix: string, zone: "hcmc" | "hanoi") {
  await page.locator(`input[name=zone][value=${zone}]`).check();
  await page.locator("input[name=window][value=morning]").check();
  await page.locator("form button[type=submit]").click();
  await expect(page).toHaveURL((url) => url.pathname === `${prefix}/thanh-toan/goi-qua`);
}

/** Step 3 as prefilled (no packaging in self mode); lands on the review. */
async function submitGift(page: Page, prefix: string) {
  await page.locator("form button[type=submit]").click();
  await expect(page).toHaveURL((url) => url.pathname === `${prefix}/thanh-toan/xac-nhan`);
}

/** From a filled cart, through steps 1, 2 and 3, to the review. */
async function toReview(page: Page, prefix: string, zone: "hcmc" | "hanoi") {
  await page.goto(`${prefix}/thanh-toan`);
  await fillBuyer(page, vietnamDateYearsAgo(30));
  await expect(page).toHaveURL((url) => url.pathname === `${prefix}/thanh-toan/giao-hang`);
  await submitDelivery(page, prefix, zone);
  await submitGift(page, prefix);
}

/** Step 4's displayed goods, shipping, total and VAT included. */
async function reviewTotals(page: Page) {
  return Promise.all(["goods", "shipping", "total", "vat"].map((k) => digits(page, `[data-total="${k}"]`)));
}

/** The stored order's goods, shipping, total and VAT included. */
function storedTotals(token: string) {
  return sql(`SELECT concat_ws('|', totals_goods_vnd, totals_shipping_vnd, totals_total_vnd, totals_vat_included_vnd) FROM orders WHERE token = '${token}'`);
}

/**
 * Ticks both consents and submits step 4, capturing the place-order POST and aborting it. Returns
 * its body and a replay that re-sends it (optionally with another body) with the context's cookies.
 */
async function capturePlacePost(page: Page) {
  let captured: { url: string; headers: Record<string, string>; body: Buffer } | undefined;
  const isReview = (url: URL) => url.pathname === "/thanh-toan/xac-nhan";
  await page.route(isReview, async (route) => {
    const r = route.request();
    if (r.method() !== "POST") return route.continue();
    const headers = Object.fromEntries(Object.entries(await r.allHeaders()).filter(([k]) => !["host", "content-length", "cookie"].includes(k)));
    captured = { url: r.url(), headers, body: r.postDataBuffer()! };
    return route.abort();
  });
  await page.locator("input[name=terms]").check();
  await page.locator("input[name=privacy]").check();
  await page.locator("form:has(input[name=clientKey]) button[type=submit]").click();
  await expect.poll(() => captured).toBeDefined();
  await page.unroute(isReview);
  const { url, headers, body } = captured!;
  return { body, replay: (data: Buffer = body) => page.request.post(url, { headers, data, maxRedirects: 0 }) };
}

async function consentAndPlace(page: Page, prefix: string) {
  await page.locator("input[name=terms]").check();
  await page.locator("input[name=privacy]").check();
  await page.locator("form:has(input[name=clientKey]) button[type=submit]").click();
  await expect(page).toHaveURL((url) => url.pathname.startsWith(`${prefix}/don-hang/`));
  return new URL(page.url()).pathname.split("/").pop()!;
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
    await page.locator("#main-content").getByRole("link", { name: vi ? "Thanh toán" : "Check out" }).click();
    await expect(page).toHaveURL((url) => url.pathname === `${prefix}/thanh-toan`);
    await expectNotice(page);
    await expectNoSeriousA11yViolations(page, "step 1");
    // Not normalized: the review and placement must bind the buyer exactly as validated (trimmed only).
    await fillBuyer(page, vietnamDateYearsAgo(30), BUYER_ADDRESS, BUYER_EMAIL);

    // Step 2.
    await expect(page).toHaveURL((url) => url.pathname === `${prefix}/thanh-toan/giao-hang`);
    await expect(page.getByTestId("id-check")).toContainText(vi ? "giấy tờ tùy thân" : "shows ID");
    await expectNotice(page);
    await expectNoSeriousA11yViolations(page, "step 2");
    await submitDelivery(page, prefix, zone);

    // Step 3.
    await expectNotice(page);
    await expectNoSeriousA11yViolations(page, "step 3");
    await submitGift(page, prefix);

    // Step 4: review.
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
    for (const href of ["/gio-hang", "/thanh-toan", "/thanh-toan/giao-hang", "/thanh-toan/goi-qua"]) {
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

    // Placed on the first submit with both consents: no `?changed=1` re-review.
    const token = await consentAndPlace(page, prefix);
    expect(orderCount()).toBe(before + 1);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(sql(`SELECT buyer_email || '|' || buyer_address FROM orders WHERE token = '${token}'`)).toBe(`${BUYER_EMAIL}|${BUYER_ADDRESS}`);

    // Status page before payment; stock is reserved at placement.
    await expect(page.getByTestId("order-status")).toHaveText(vi ? "Đã đặt, chờ thanh toán" : "Placed, awaiting payment");
    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
    await expect(page.locator('head meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
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
    await expect(page.getByTestId("payment-deadline")).toContainText(vi ? "Vui lòng thanh toán trước" : "Please pay by");
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
    // Step 1 as an adult first, so a draft exists; then step 1 again with an under-18 date of birth.
    await page.goto(`${prefix}/thanh-toan`);
    await fillBuyer(page, vietnamDateYearsAgo(30));
    await expect(page).toHaveURL((url) => url.pathname === `${prefix}/thanh-toan/giao-hang`);
    const handle = (await page.context().cookies()).find((c) => c.name === "xenia_checkout")!.value;
    const drafts = () => sql(`SELECT count(*) FROM checkout_drafts WHERE handle = '${handle}'`);
    expect(drafts()).toBe("1");
    await page.goto(`${prefix}/thanh-toan`);
    await fillBuyer(page, vietnamDateYearsAgo(17));
    await expect(page).toHaveURL((url) => url.pathname === `${prefix}/tam-biet`);
    expect(drafts()).toBe("0");
    const names = (await page.context().cookies()).map((c) => c.name);
    expect(names).not.toContain("xenia_age_ok");
    expect(names).not.toContain("xenia_checkout");
    expect(orderCount()).toBe(before);
    await page.goto(`${prefix}/thanh-toan`);
    await expect(page).toHaveURL((url) => url.pathname === `${prefix}/xac-minh-tuoi`);
  });
}

test("an unknown or malformed status token is a 404", async ({ page }) => {
  await declareAdult(page, "/ruou-vang");
  for (const token of ["not-a-token", "A".repeat(43), `${"A".repeat(42)}=`]) {
    const response = await page.goto(`/don-hang/${token}`);
    expect(response?.status(), token).toBe(404);
  }
});

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

test("a payment after due expires the order and restocks once, a not-yet-due order keeps its stock, and racing releases restock once", async ({ page, browser }) => {
  const vintage = vintageId("colle-vento-rosso", 2021, 750);
  const originalStock = stockOf(vintage);
  const count = orderCount();
  await declareAdult(page, "/ruou-vang/colle-vento-rosso");
  await addToCart(page, "", "colle-vento-rosso");
  await toReview(page, "", "hcmc");
  const dueToken = await consentAndPlace(page, "");
  const dueId = Number(sql(`SELECT id FROM orders WHERE token = '${dueToken}'`));
  expect(sql(`SELECT payment_due_at IS NOT NULL FROM orders WHERE id = ${dueId}`)).toBe("t");
  expect(stockOf(vintage)).toBe(originalStock - 1);

  let captured: { url: string; headers: Record<string, string>; body: Buffer } | undefined;
  const actionPath = `/don-hang/${dueToken}`;
  await page.route(actionPath, async (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.continue();
    const headers = Object.fromEntries(Object.entries(await request.allHeaders()).filter(([key]) => !["host", "content-length", "cookie"].includes(key)));
    captured = { url: request.url(), headers, body: request.postDataBuffer()! };
    await route.abort();
  });
  await page.getByRole("button", { name: "Mô phỏng thanh toán thành công" }).click();
  await expect.poll(() => captured).toBeDefined();
  await page.unroute(actionPath);

  await addToCart(page, "", "colle-vento-rosso");
  await toReview(page, "", "hcmc");
  const futureToken = await consentAndPlace(page, "");
  const futureId = Number(sql(`SELECT id FROM orders WHERE token = '${futureToken}'`));
  expect(sql(`SELECT status || '/' || payment_status || '/' || (payment_due_at > NOW()) FROM orders WHERE id = ${futureId}`)).toBe("placed/unpaid/true");
  expect(stockOf(vintage)).toBe(originalStock - 2);

  const concurrentPage = await newPage(browser);
  await declareAdult(concurrentPage, "/ruou-vang/colle-vento-rosso");
  sql(`UPDATE orders SET payment_due_at = TIMESTAMPTZ '2026-01-01 00:00:00+00' WHERE id = ${dueId}`);
  const payment = await page.request.post(captured!.url, { headers: captured!.headers, data: captured!.body, maxRedirects: 0 });
  expect(payment.status()).toBe(200);
  expect(payment.headers()["x-action-redirect"]).toContain("payment=expired");
  expect(sql(`SELECT status || '/' || payment_status FROM orders WHERE id = ${dueId}`)).toBe("expired/unpaid");
  expect(sql(`SELECT status || '/' || payment_status FROM orders WHERE id = ${futureId}`)).toBe("placed/unpaid");
  expect(stockOf(vintage)).toBe(originalStock - 1);

  await page.goto(actionPath);
  await expect(page.getByTestId("order-status")).toHaveText("Hết hạn thanh toán");
  await expect(page.getByTestId("payment-expired")).toContainText("Tồn kho đã được trả lại");
  await expect(page.locator("input[name=method]")).toHaveCount(0);
  await expect(page.locator("form[action]")).toHaveCount(0);

  expect(sql(`SELECT count(*) FROM orders WHERE id = ${dueId}`)).toBe("1");

  await addToCart(page, "", "colle-vento-rosso");
  await toReview(page, "", "hcmc");
  const raceToken = await consentAndPlace(page, "");
  const raceId = Number(sql(`SELECT id FROM orders WHERE token = '${raceToken}'`));
  expect(stockOf(vintage)).toBe(originalStock - 2);

  try {
    sql("CREATE TABLE expiry_claim_attempts (order_id integer NOT NULL)");
    sql(`CREATE FUNCTION record_expiry_claim() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.status = 'placed' AND NEW.status = 'expired' THEN INSERT INTO expiry_claim_attempts VALUES (NEW.id); PERFORM pg_sleep(8); END IF; RETURN NEW; END $$`);
    sql("CREATE TRIGGER record_expiry_claim BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION record_expiry_claim()");
    sql(`UPDATE orders SET payment_due_at = TIMESTAMPTZ '2026-01-01 00:00:00+00' WHERE id = ${raceId}`);
    await Promise.all([page.goto("/ruou-vang/colle-vento-rosso"), concurrentPage.goto("/ruou-vang/colle-vento-rosso")]);
    expect(sql("SELECT count(*) FROM expiry_claim_attempts")).toBe("1");
    expect(sql(`SELECT status FROM orders WHERE id = ${raceId}`)).toBe("expired");
    expect(stockOf(vintage)).toBe(originalStock - 1);
  } finally {
    sql("DROP TRIGGER IF EXISTS record_expiry_claim ON orders");
    sql("DROP FUNCTION IF EXISTS record_expiry_claim()");
    sql("DROP TABLE IF EXISTS expiry_claim_attempts");
  }
  expect(orderCount()).toBe(count + 3);
});

test("a release committing between the payment read and success update prevents payment and restocks once", async ({ page }) => {
  const vintage = vintageId("colle-vento-rosso", 2021, 750);
  sql(`UPDATE vintages SET stock = 1 WHERE id = ${vintage}`);
  expect(stockOf(vintage)).toBe(1);
  await declareAdult(page, "/ruou-vang/colle-vento-rosso");
  await addToCart(page, "", "colle-vento-rosso");
  await toReview(page, "", "hcmc");
  const token = await consentAndPlace(page, "");
  const id = Number(sql(`SELECT id FROM orders WHERE token = '${token}'`));
  expect(stockOf(vintage)).toBe(0);
  expect(sql(`SELECT status || '/' || payment_status || '/' || (payment_due_at > NOW()) FROM orders WHERE id = ${id}`)).toBe("placed/unpaid/true");

  const actionPath = `/don-hang/${token}`;
  let paymentPost: { url: string; headers: Record<string, string>; body: Buffer } | undefined;
  await page.route(actionPath, async (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.continue();
    const headers = Object.fromEntries(Object.entries(await request.allHeaders()).filter(([key]) => !["host", "content-length", "cookie"].includes(key)));
    paymentPost = { url: request.url(), headers, body: request.postDataBuffer()! };
    await route.abort();
  });
  await page.getByRole("button", { name: "Mô phỏng thanh toán thành công" }).click();
  await expect.poll(() => paymentPost).toBeDefined();
  await page.unroute(actionPath);

  const holderApp = "xenia-e2e-release-holder";
  const holder = spawnPsqlTransaction(
    `DO $$ BEGIN UPDATE orders SET status = 'expired', updated_at = NOW() WHERE id = ${id} AND status = 'placed' AND payment_status <> 'paid'; IF NOT FOUND THEN RAISE EXCEPTION 'expected an unpaid placed order'; END IF; UPDATE vintages v SET stock = v.stock + l.qty FROM orders_lines l WHERE l._parent_id = ${id} AND v.id = l.vintage_id; PERFORM pg_sleep(5); END $$;`,
    holderApp,
  );
  let paymentResponse: ReturnType<typeof page.request.post> | undefined;
  let holderExit: Awaited<typeof holder.exited> | undefined;
  try {
    const holderPidQuery = `SELECT pid FROM pg_stat_activity WHERE application_name = '${holderApp}' AND state = 'active' AND query LIKE '%UPDATE orders%' AND query LIKE '%pg_sleep(5)%'`;
    await expect.poll(() => sql(holderPidQuery), { timeout: 8_000, intervals: [100, 200] }).toMatch(/^[1-9][0-9]*$/);
    const holderPid = Number(sql(holderPidQuery));
    expect(sql(`SELECT count(*) FROM pg_locks WHERE pid = ${holderPid} AND relation = 'orders'::regclass AND mode = 'RowExclusiveLock' AND granted`)).toBe("1");
    expect(sql(`SELECT count(*) FROM pg_locks WHERE pid = ${holderPid} AND locktype = 'transactionid' AND granted`)).toBe("1");
    expect(sql(`SELECT status || '/' || payment_status FROM orders WHERE id = ${id}`)).toBe("placed/unpaid");

    paymentResponse = page.request.post(paymentPost!.url, { headers: paymentPost!.headers, data: paymentPost!.body, maxRedirects: 0 });
    await expect.poll(
      () => sql(`SELECT count(*) FROM pg_stat_activity WHERE ${holderPid} = ANY(pg_blocking_pids(pid)) AND query LIKE '%UPDATE orders%' AND wait_event_type = 'Lock'`),
      { timeout: 4_000, intervals: [50, 100, 150] },
    ).toBe("1");
  } finally {
    holderExit = await holder.exited;
  }
  expect(holderExit?.error).toBeUndefined();
  expect(holderExit?.code).toBe(0);
  const payment = await paymentResponse!;
  expect(payment.status()).toBe(200);
  expect(payment.headers()["x-action-redirect"]).toContain("payment=expired");
  expect(sql(`SELECT status || '/' || payment_status FROM orders WHERE id = ${id}`)).toBe("expired/unpaid");
  expect(stockOf(vintage)).toBe(1);
  sql(`UPDATE vintages SET stock = 40 WHERE id = ${vintage}`);
});

test("the first cart read after a due order releases stock before cart normalization", async ({ page }) => {
  const vintage = vintageId("colle-vento-rosso", 2021, 750);
  sql(`UPDATE vintages SET stock = 1 WHERE id = ${vintage}`);
  await declareAdult(page, "/ruou-vang/colle-vento-rosso");
  await addToCart(page, "", "colle-vento-rosso");
  await toReview(page, "", "hcmc");
  const token = await consentAndPlace(page, "");
  const id = Number(sql(`SELECT id FROM orders WHERE token = '${token}'`));
  expect(stockOf(vintage)).toBe(0);

  await page.context().addCookies([{
    name: "xenia_cart",
    value: encodeURIComponent(JSON.stringify([{ v: vintage, q: 1 }])),
    url: test.info().project.use.baseURL!,
    httpOnly: true,
    sameSite: "Lax",
  }]);
  sql(`UPDATE orders SET payment_due_at = TIMESTAMPTZ '2026-01-01 00:00:00+00' WHERE id = ${id}`);
  await page.goto("/gio-hang");

  expect(sql(`SELECT status || '/' || payment_status FROM orders WHERE id = ${id}`)).toBe("expired/unpaid");
  expect(stockOf(vintage)).toBe(1);
  const line = page.locator(`[data-vintage="${vintage}"]`);
  await expect(line).toBeVisible();
  await expect(line.locator("input[name=qty]")).toHaveAttribute("max", "1");
  await expect(line).toContainText("Colle del Vento Rosso");
  expect(await digits(page, '[data-testid="cart-goods"]')).toBe(720_000);
  sql(`UPDATE vintages SET stock = 40 WHERE id = ${vintage}`);
});

test("placement releases a due order before checking the buyer's last bottle", async ({ page, browser }) => {
  const vintage = vintageId("colle-vento-rosso", 2021, 750);
  const holder = await newPage(browser);
  try {
    sql(`UPDATE vintages SET stock = 1 WHERE id = ${vintage}`);
    await declareAdult(page, "/ruou-vang/colle-vento-rosso");
    await addToCart(page, "", "colle-vento-rosso");
    await toReview(page, "", "hcmc");
    expect(stockOf(vintage)).toBe(1);

    await declareAdult(holder, "/ruou-vang/colle-vento-rosso");
    await addToCart(holder, "", "colle-vento-rosso");
    await toReview(holder, "", "hcmc");
    const holdingToken = await consentAndPlace(holder, "");
    const holdingId = Number(sql(`SELECT id FROM orders WHERE token = '${holdingToken}'`));
    expect(stockOf(vintage)).toBe(0);

    const before = orderCount();
    const buyerKey = await page.locator("input[name=clientKey]").inputValue();
    const { replay } = await capturePlacePost(page);
    sql(`UPDATE orders SET payment_due_at = TIMESTAMPTZ '2026-01-01 00:00:00+00' WHERE id = ${holdingId}`);
    const placement = await replay();
    expect(placement.status()).toBe(200);
    const buyerToken = sql(`SELECT token FROM orders WHERE client_key = '${buyerKey}'`);
    expect(buyerToken, "buyer B's reviewed order must be placed after stock release").toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(placement.headers()["x-action-redirect"]).toContain(`/don-hang/${buyerToken}`);
    const buyerId = Number(sql(`SELECT id FROM orders WHERE token = '${buyerToken}'`));
    expect(sql(`SELECT status || '/' || payment_status FROM orders WHERE id = ${holdingId}`)).toBe("expired/unpaid");
    expect(sql(`SELECT status || '/' || payment_status FROM orders WHERE id = ${buyerId}`)).toBe("placed/unpaid");
    expect(orderCount()).toBe(before + 1);
    expect(stockOf(vintage)).toBe(0);
  } finally {
    sql(`UPDATE vintages SET stock = 39 WHERE id = ${vintage}`);
    await holder.context().close();
  }
});

test("a due order with a deleted vintage releases its remaining lines on the catalogue read", async ({ page }) => {
  const seededVintage = vintageId("colle-vento-rosso", 2021, 750);
  const slug = `deleted-vintage-${Date.now()}`;
  let wineId: number | undefined;
  let vintageIdToDelete: number | undefined;
  const admin = page.request;

  sql(`UPDATE vintages SET stock = 1 WHERE id = ${seededVintage}`);
  sql("TRUNCATE users CASCADE");
  try {
    const registration = await admin.post("/api/users/first-register", {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, "confirm-password": ADMIN_PASSWORD },
    });
    expect(registration.ok(), `admin registration ${registration.status()}`).toBe(true);
    const login = await admin.post("/api/users/login", { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
    expect(login.ok(), `admin login ${login.status()}`).toBe(true);

    const producer = Number(sql("SELECT id FROM producers WHERE name = 'Tenuta Colle del Vento'"));
    const wineResponse = await admin.post("/api/wines?locale=vi", {
      data: {
        slug,
        producer,
        name: "Rượu kiểm thử",
        type: "red",
        country: "IT",
        region: "Tuscany",
        grapes: [{ grape: "Sangiovese", pct: 100 }],
        tasting: { nose: "Mùi kiểm thử.", palate: "Vị kiểm thử.", finish: "Dư vị kiểm thử." },
        profile: { body: 3, tannin: 3, sweetness: 1, acidity: 3 },
        pairings: ["beef"],
        servingTempC: 16,
        occasions: ["dinner"],
        status: "published",
      },
    });
    expect(wineResponse.ok(), `test wine creation ${wineResponse.status()}`).toBe(true);
    wineId = (await wineResponse.json()).doc.id;
    const translation = await admin.patch(`/api/wines/${wineId}?locale=en`, {
      data: { name: "Test Wine", tasting: { nose: "Test nose.", palate: "Test palate.", finish: "Test finish." } },
    });
    expect(translation.ok(), `test wine translation ${translation.status()}`).toBe(true);

    const createdVintage = await admin.post("/api/vintages", {
      data: {
        wine: wineId,
        year: 2020,
        bottleMl: "750",
        abvPct: 13,
        priceVnd: 700_000,
        stock: 1,
        importer: "Test importer",
        status: "published",
      },
    });
    expect(createdVintage.ok(), `test vintage creation ${createdVintage.status()}`).toBe(true);
    vintageIdToDelete = (await createdVintage.json()).doc.id;

    await declareAdult(page, "/ruou-vang/colle-vento-rosso");
    await addToCart(page, "", "colle-vento-rosso");
    await addToCart(page, "", slug);
    await toReview(page, "", "hcmc");
    const token = await consentAndPlace(page, "");
    const id = Number(sql(`SELECT id FROM orders WHERE token = '${token}'`));
    expect(sql(`SELECT status || '/' || payment_status FROM orders WHERE id = ${id}`)).toBe("placed/unpaid");
    expect(stockOf(seededVintage)).toBe(0);
    expect(stockOf(vintageIdToDelete!)).toBe(0);

    const deletion = await admin.delete(`/api/vintages/${vintageIdToDelete}`);
    expect(deletion.ok(), `test vintage deletion ${deletion.status()}`).toBe(true);
    vintageIdToDelete = undefined;
    expect(sql(`SELECT count(*) FROM orders_lines WHERE _parent_id = ${id} AND vintage_id IS NULL`)).toBe("1");
    sql(`UPDATE orders SET payment_due_at = TIMESTAMPTZ '2026-01-01 00:00:00+00' WHERE id = ${id}`);

    const catalogue = await page.goto("/ruou-vang");
    expect(catalogue?.status()).toBe(200);
    expect(sql(`SELECT status FROM orders WHERE id = ${id}`)).toBe("expired");
    expect(stockOf(seededVintage)).toBe(1);
    const secondCatalogue = await page.goto("/ruou-vang");
    expect(secondCatalogue?.status()).toBe(200);
    expect(stockOf(seededVintage)).toBe(1);
  } finally {
    if (vintageIdToDelete !== undefined) await admin.delete(`/api/vintages/${vintageIdToDelete}`);
    if (wineId !== undefined) await admin.delete(`/api/wines/${wineId}`);
    sql(`UPDATE vintages SET stock = 40 WHERE id = ${seededVintage}`);
    sql("TRUNCATE users CASCADE");
  }
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

test("the same client key never creates a second order: double submit, replayed POST, forged digest, back-and-resubmit", async ({ page }) => {
  test.setTimeout(300_000);
  await declareAdult(page, "/ruou-vang/colle-vento-rosso");
  await addToCart(page, "", "colle-vento-rosso");
  await toReview(page, "", "hcmc");
  const clientKey = await page.locator("input[name=clientKey]").inputValue();
  const digest = await page.locator("input[name=digest]").inputValue();
  expect(digest).toMatch(/^[0-9a-f]{64}$/);
  const before = orderCount();
  // A second tab holds the review form open; it is the stale page a buyer resubmits after going back.
  const stale = await page.context().newPage();
  await stale.goto("/thanh-toan/xac-nhan");
  await expect(stale.locator("input[name=clientKey]")).toHaveValue(clientKey);

  // The browser's place-order POST is captured and aborted; identical copies of it are replayed
  // with the context's cookies. Each answer redirects to the one order's status page.
  const { body, replay: post } = await capturePlacePost(page);
  const replay = async (data?: Buffer) => JSON.stringify((await post(data)).headers());

  // Double submit: two copies race each other.
  const raced = await Promise.all([replay(), replay()]);
  const token = sql(`SELECT token FROM orders WHERE client_key = '${clientKey}'`);
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  for (const headers of raced) expect(headers).toContain(`/don-hang/${token}`);
  expect(orderCount()).toBe(before + 1);

  // A replayed POST after the order exists (the cart and checkout cookies are now cleared).
  expect(await replay()).toContain(`/don-hang/${token}`);
  expect(orderCount()).toBe(before + 1);

  // The same replay with a forged digest still names the one order.
  const text = body.toString("latin1");
  expect(text).toContain(digest);
  for (const forged of ["0".repeat(64), "f".repeat(64)]) {
    expect(await replay(Buffer.from(text.replace(digest, forged), "latin1"))).toContain(`/don-hang/${token}`);
    expect(orderCount()).toBe(before + 1);
  }

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
  // The review shows database prices, never the cookie's: 720 000 + 30 000 = 750 000 → VAT 68 182.
  expect(await reviewTotals(page)).toEqual([720_000, 30_000, 750_000, 68_182]);
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
  expect(storedTotals(token)).toBe("720000|30000|750000|68182");
  expect(sql(`SELECT l.unit_price_vnd FROM orders_lines l JOIN orders o ON l._parent_id = o.id WHERE o.token = '${token}'`)).toBe("720000");
});

// Law 122 Art. 12: placement places exactly what step 4 showed. The review starts as
// 1 × Colle del Vento 720 000 + 1 × Due Fiumi Moscato 480 000 = 1 200 000, + HCMC 30 000 = 1 230 000,
// VAT 1 230 000 / 11 = 111 818.2 → 111 818. Each case changes one priced input between the review and
// the submit; VAT and total derive from those inputs and cannot change on their own.
const CHANGES: {
  input: string;
  change: (other: Page, ids: { colle: number; moscato: number }) => Promise<void>;
  restore?: (ids: { colle: number; moscato: number }) => void;
  totals: [number, number, number, number];
}[] = [
  {
    input: "a quantity",
    change: async (other, { colle }) => {
      await other.goto("/gio-hang");
      const line = other.locator(`[data-vintage="${colle}"]`);
      await line.locator("input[name=qty]").fill("2");
      await line.getByRole("button", { name: "Cập nhật" }).click();
      await expect.poll(() => digits(other, '[data-testid="cart-goods"]')).toBe(1_920_000);
    },
    // 2 × 720 000 + 480 000 = 1 920 000; + 30 000 = 1 950 000; / 11 = 177 272.7 → 177 273.
    totals: [1_920_000, 30_000, 1_950_000, 177_273],
  },
  {
    input: "an added line",
    change: (other) => addToCart(other, "", "lune-grise-rouge"),
    // + 850 000 = 2 050 000; + 30 000 = 2 080 000; / 11 = 189 090.9 → 189 091.
    totals: [2_050_000, 30_000, 2_080_000, 189_091],
  },
  {
    input: "a removed line",
    change: async (other, { moscato }) => {
      await other.goto("/gio-hang");
      await other.locator(`[data-vintage="${moscato}"]`).getByRole("button", { name: /^Bỏ / }).click();
      await expect(other.getByTestId("cart-lines").locator("li")).toHaveCount(1);
    },
    // 720 000 + 30 000 = 750 000; / 11 = 68 181.8 → 68 182.
    totals: [720_000, 30_000, 750_000, 68_182],
  },
  {
    input: "a unit price",
    change: async (_, { colle }) => void sql(`UPDATE vintages SET price_vnd = 730000 WHERE id = ${colle}`),
    restore: ({ colle }) => void sql(`UPDATE vintages SET price_vnd = 720000 WHERE id = ${colle}`),
    // 730 000 + 480 000 = 1 210 000; + 30 000 = 1 240 000; / 11 = 112 727.3 → 112 727.
    totals: [1_210_000, 30_000, 1_240_000, 112_727],
  },
  {
    input: "the zone fee",
    change: async () => void sql("UPDATE site_settings_zones SET fee_vnd = 35000 WHERE zone = 'hcmc'"),
    restore: () => void sql("UPDATE site_settings_zones SET fee_vnd = 30000 WHERE zone = 'hcmc'"),
    // 1 200 000 + 35 000 = 1 235 000; / 11 = 112 272.7 → 112 273.
    totals: [1_200_000, 35_000, 1_235_000, 112_273],
  },
  {
    input: "the zone",
    change: async (other) => {
      await other.goto("/thanh-toan/giao-hang");
      await submitDelivery(other, "", "hanoi");
    },
    // 1 200 000 + Hà Nội 45 000 = 1 245 000; / 11 = 113 181.8 → 113 182.
    totals: [1_200_000, 45_000, 1_245_000, 113_182],
  },
];

for (const { input, change, restore, totals } of CHANGES) {
  test(`a change to ${input} after the review is refused, re-reviewed, then placed as shown`, async ({ page }) => {
    const ids = {
      colle: vintageId("colle-vento-rosso", 2021, 750),
      moscato: vintageId("due-fiumi-moscato", 2023, 750),
    };
    await declareAdult(page, "/ruou-vang/colle-vento-rosso");
    await addToCart(page, "", "colle-vento-rosso");
    await addToCart(page, "", "due-fiumi-moscato");
    await toReview(page, "", "hcmc");
    expect(await reviewTotals(page)).toEqual([1_200_000, 30_000, 1_230_000, 111_818]);

    try {
      await change(await page.context().newPage(), ids);
      const before = orderCount();
      await page.locator("input[name=terms]").check();
      await page.locator("input[name=privacy]").check();
      await page.locator("form:has(input[name=clientKey]) button[type=submit]").click();

      await expect(page.getByTestId("review-changed")).toContainText("Đơn hàng đã thay đổi sau khi bạn xem lại");
      await expect(page).toHaveURL((url) => url.pathname === "/thanh-toan/xac-nhan");
      expect(orderCount()).toBe(before);
      await expect(page.locator("input[name=terms]")).not.toBeChecked();
      await expect(page.locator("input[name=privacy]")).not.toBeChecked();
      await expect.poll(() => reviewTotals(page)).toEqual(totals);

      const token = await consentAndPlace(page, "");
      expect(orderCount()).toBe(before + 1);
      expect(storedTotals(token)).toBe(totals.join("|"));
    } finally {
      restore?.(ids);
    }
  });
}

for (const { locale, prefix } of LOCALES) {
  test(`an address change in another tab after the review is refused, re-reviewed, then placed at the new address (${locale})`, async ({ page }) => {
    await declareAdult(page, `${prefix}/ruou-vang/colle-vento-rosso`);
    await addToCart(page, prefix, "colle-vento-rosso");
    await toReview(page, prefix, "hcmc");
    await expect(page.getByTestId("review-delivery")).toContainText("12 Lê Lợi, Quận 1");

    // The same buyer, in a second tab, resubmits step 1 with another address.
    const other = await page.context().newPage();
    await other.goto(`${prefix}/thanh-toan`);
    await fillBuyer(other, vietnamDateYearsAgo(30), "99 Nguyễn Huệ, Quận 3");
    await expect(other).toHaveURL((url) => url.pathname === `${prefix}/thanh-toan/giao-hang`);

    const before = orderCount();
    await page.locator("input[name=terms]").check();
    await page.locator("input[name=privacy]").check();
    await page.locator("form:has(input[name=clientKey]) button[type=submit]").click();

    await expect(page.getByTestId("review-changed")).toContainText(
      locale === "vi" ? "Đơn hàng đã thay đổi sau khi bạn xem lại" : "Your order changed after you reviewed it",
    );
    await expect(page).toHaveURL((url) => url.pathname === `${prefix}/thanh-toan/xac-nhan` && url.search === "?changed=1");
    expect(orderCount()).toBe(before);
    await expect(page.getByTestId("review-delivery")).toContainText("99 Nguyễn Huệ, Quận 3");
    await expect(page.locator("input[name=terms]")).not.toBeChecked();
    await expect(page.locator("input[name=privacy]")).not.toBeChecked();

    const token = await consentAndPlace(page, prefix);
    expect(orderCount()).toBe(before + 1);
    expect(sql(`SELECT buyer_address FROM orders WHERE token = '${token}'`)).toBe("99 Nguyễn Huệ, Quận 3");
  });
}

test("duplicates racing for the last bottle all land on the one order and never rewrite the cart", async ({ page }) => {
  const sauvignon = vintageId("southern-light-sauvignon", 2023, 750); // 690 000
  sql(`UPDATE vintages SET stock = 1 WHERE id = ${sauvignon}`);
  await declareAdult(page, "/ruou-vang/southern-light-sauvignon");
  await addToCart(page, "", "southern-light-sauvignon");
  await toReview(page, "", "hcmc");
  const clientKey = await page.locator("input[name=clientKey]").inputValue();
  const before = orderCount();

  const { replay } = await capturePlacePost(page);
  const responses = await Promise.all(Array.from({ length: 6 }, () => replay()));
  const token = sql(`SELECT token FROM orders WHERE client_key = '${clientKey}'`);
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  for (const response of responses) {
    expect(JSON.stringify(response.headers())).toContain(`/don-hang/${token}`);
    const cartCookies = response.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie" && /^xenia_cart=[^;]/.test(h.value));
    expect(cartCookies).toEqual([]);
  }
  expect(orderCount()).toBe(before + 1);
  expect(stockOf(sauvignon)).toBe(0);
  // 690 000 + 30 000 = 720 000; / 11 = 65 454.5… → 65 455.
  expect(storedTotals(token)).toBe("690000|30000|720000|65455");
});

test("orders are admin-only over REST, nobody deletes an order, and the admin order view makes no third-party request", async ({
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
  for (const response of [await request.get("/api/orders"), await request.get(`/api/orders/${id}`)]) {
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
  sql("TRUNCATE users CASCADE");
  const admin = page.request;
  expect((await admin.post("/api/users/first-register", { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, "confirm-password": ADMIN_PASSWORD } })).ok()).toBe(true);
  expect((await admin.post("/api/users/login", { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).ok()).toBe(true);
  const adminDelete = await admin.delete(`/api/orders/${id}`);
  expect(adminDelete.ok(), `admin DELETE ${adminDelete.status()}`).toBe(false);
  expect(orderCount()).toBe(count);
  const expireAttempt = await admin.patch(`/api/orders/${id}`, { data: { status: "expired" } });
  expect(expireAttempt.ok(), `admin PATCH expired ${expireAttempt.status()}`).toBe(false);
  expect(sql(`SELECT status FROM orders WHERE id = ${id}`)).toBe("placed");
  const originalDueAt = sql(`SELECT payment_due_at::text FROM orders WHERE id = ${id}`);
  const patch = await admin.patch(`/api/orders/${id}`, { data: { status: "packed", paymentDueAt: "2000-01-01T00:00:00.000Z", totals: { totalVnd: 1 } } });
  expect(patch.ok(), `admin PATCH ${patch.status()}`).toBe(true);
  expect(sql(`SELECT status || '|' || totals_total_vnd FROM orders WHERE id = ${id}`)).toBe("packed|750000");
  expect(sql(`SELECT payment_due_at::text FROM orders WHERE id = ${id}`)).toBe(originalDueAt);
  const packedDelete = await admin.delete(`/api/orders/${id}`);
  expect(packedDelete.ok(), `admin DELETE packed ${packedDelete.status()}`).toBe(false);
  expect(orderCount()).toBe(count);

  await addToCart(page, "", "colle-vento-rosso");
  await toReview(page, "", "hcmc");
  const expiredToken = await consentAndPlace(page, "");
  const expiredId = Number(sql(`SELECT id FROM orders WHERE token = '${expiredToken}'`));
  const expiredNumber = sql(`SELECT number FROM orders WHERE id = ${expiredId}`);
  expect((await admin.get(`/api/orders/${expiredId}`)).ok()).toBe(true);
  sql(`UPDATE orders SET payment_due_at = TIMESTAMPTZ '2026-01-01 00:00:00+00' WHERE id = ${expiredId}`);
  await page.goto(`/don-hang/${expiredToken}`);
  await expect(page.getByTestId("order-status")).toHaveText("Hết hạn thanh toán");
  expect(sql(`SELECT status FROM orders WHERE id = ${expiredId}`)).toBe("expired");
  const reopenExpired = await admin.patch(`/api/orders/${expiredId}`, { data: { status: "packed" } });
  expect(reopenExpired.ok(), `expired order PATCH ${reopenExpired.status()}`).toBe(false);
  expect(sql(`SELECT status FROM orders WHERE id = ${expiredId}`)).toBe("expired");
  const expiredDelete = await admin.delete(`/api/orders/${expiredId}`);
  expect(expiredDelete.ok(), `expired order DELETE ${expiredDelete.status()}`).toBe(false);
  expect(orderCount()).toBe(count + 1);

  await page.goto("/admin/collections/orders");
  const expiredRow = page.locator(".collection-list tbody tr").filter({ hasText: expiredNumber });
  await expect(expiredRow).toContainText("expired");
  await page.goto(`/admin/collections/orders/${expiredId}`);
  await expect(page.locator('form[data-form-ready="true"]')).toBeVisible({ timeout: 90_000 });
  await expect(page.locator("#field-status")).toContainText("expired");

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

// ---- Delivery modes and dates, gift options, the gift service page, the server-side draft ----
// Packaging from `src/seed/data.ts`: silk (1 bottle, every size) 50 000; box-1 (1 bottle, 750 ml)
// 120 000; box-2 (2 bottles, 750 ml) 200 000. Lead days 1 for both zones.

const RECIPIENT = { name: "Trần Thị Bình", phone: "0912 345 678", address: "5 Hàng Bài, Hoàn Kiếm" };
const MESSAGE = "Chúc mừng sinh nhật chị Bình!\nThân thương, An.";

/** The Vietnamese calendar date `days` after today, as YYYY-MM-DD. */
function vietnamDatePlusDays(days: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Step 2 in gift mode; lands on step 3 unless `expectStep3` is false. */
async function submitGiftDelivery(
  page: Page,
  prefix: string,
  zone: "hcmc" | "hanoi",
  { recipient = RECIPIENT, date = vietnamDatePlusDays(3), window = "afternoon", expectStep3 = true } = {},
) {
  await page.locator("input[name=mode][value=gift]").check();
  await page.locator("#delivery-recipientName").fill(recipient.name);
  await page.locator("#delivery-recipientPhone").fill(recipient.phone);
  await page.locator("#delivery-recipientAddress").fill(recipient.address);
  await page.locator(`input[name=zone][value=${zone}]`).check();
  await page.locator("#delivery-date").fill(date);
  await page.locator(`input[name=window][value=${window}]`).check();
  await page.locator("form button[type=submit]").click();
  if (expectStep3) await expect(page).toHaveURL((url) => url.pathname === `${prefix}/thanh-toan/goi-qua`);
}

/** Step 3 in gift mode with box-2, the tet card, a message and the prefilled sender; lands on the review. */
async function submitGiftOptions(page: Page, prefix: string, { packaging = "box-2", message = MESSAGE } = {}) {
  await page.locator(`input[name=packaging][value="${packaging}"]`).check();
  await page.locator("input[name=card][value=tet]").check();
  await page.locator("#gift-message").fill(message);
  await submitGift(page, prefix);
}

/** From a filled cart, a gift order through steps 1-3 to the review. */
async function toGiftReview(page: Page, prefix: string, zone: "hcmc" | "hanoi", options: Parameters<typeof submitGiftOptions>[2] = {}) {
  await page.goto(`${prefix}/thanh-toan`);
  await fillBuyer(page, vietnamDateYearsAgo(30));
  await expect(page).toHaveURL((url) => url.pathname === `${prefix}/thanh-toan/giao-hang`);
  await submitGiftDelivery(page, prefix, zone);
  await submitGiftOptions(page, prefix, options);
}

const draftCount = (clientKey: string) => Number(sql(`SELECT count(*) FROM checkout_drafts WHERE client_key = '${clientKey}'`));

for (const { locale, prefix } of LOCALES) {
  const vi = locale === "vi";
  const zone = vi ? "hcmc" : "hanoi";
  // 850 000 + 720 000 = 1 570 000; box-2: 2 bottles / capacity 2 = 1 × 200 000.
  // vi: + 30 000 = 1 800 000, VAT 1 800 000 / 11 = 163 636.4 → 163 636.
  // en: + 45 000 = 1 815 000, VAT 1 815 000 / 11 = 165 000.
  const expected = vi
    ? { goods: 1_570_000, wrap: 200_000, shipping: 30_000, total: 1_800_000, vat: 163_636 }
    : { goods: 1_570_000, wrap: 200_000, shipping: 45_000, total: 1_815_000, vat: 165_000 };

  test(`an adult sends two vintages as a wrapped gift and pays with the mock (${locale})`, async ({ page }) => {
    test.setTimeout(300_000);
    const external = await blockThirdParty(page);
    const date = vietnamDatePlusDays(3);
    await declareAdult(page, `${prefix}/ruou-vang/lune-grise-rouge`);
    await addToCart(page, prefix, "lune-grise-rouge");
    await addToCart(page, prefix, "colle-vento-rosso");
    await page.goto(`${prefix}/thanh-toan`);
    await fillBuyer(page, vietnamDateYearsAgo(30));

    // Step 2, gift mode: the recipient 18+ and ID rule (D6).
    await expect(page).toHaveURL((url) => url.pathname === `${prefix}/thanh-toan/giao-hang`);
    await page.locator("input[name=mode][value=gift]").check();
    await expect(page.getByTestId("recipient-id-check")).toContainText(vi ? "đủ 18 tuổi" : "18 or over");
    await expectNotice(page);
    await expectNoSeriousA11yViolations(page, "step 2, gift");
    await submitGiftDelivery(page, prefix, zone, { date });

    // Step 3: box-2 fits two 750 ml bottles; hide prices is on by default; the sender is the buyer.
    await expectNotice(page);
    await expectNoSeriousA11yViolations(page, "step 3, gift");
    await expect(page.locator("input[name=packaging]")).toHaveCount(4); // none, silk, box-1, box-2
    await expect(page.locator("input[name=hidePrices]")).toBeChecked();
    await expect(page.locator("#gift-sender")).toHaveValue("Nguyễn Văn An");
    await expect(page.getByRole("link", { name: vi ? "Xem dịch vụ gói quà" : "About the gift service" })).toHaveAttribute("href", `${prefix}/dich-vu-goi-qua`);
    await submitGiftOptions(page, prefix);

    // Step 4.
    await expectNotice(page);
    await expectNoSeriousA11yViolations(page, "review, gift");
    await expect(page.getByTestId("review-delivery")).toContainText(`${RECIPIENT.name} · 0912345678`);
    await expect(page.getByTestId("review-delivery")).toContainText(RECIPIENT.address);
    await expect(page.getByTestId("review-date")).toContainText(date.slice(0, 4));
    await expect(page.getByTestId("review-date")).toContainText(vi ? "Buổi chiều" : "Afternoon");
    await expect(page.getByTestId("review-id-check")).toContainText(vi ? "đủ 18 tuổi" : "18 or over");
    await expect(page.getByTestId("review-wrap")).toContainText(vi ? "Gói quà: 1 × Hộp cứng đôi = 200.000" : "Gift wrap: 1 × Two-bottle box = ₫200,000");
    await expect(page.locator("[data-gift=card]")).toHaveText("Tết");
    await expect(page.locator("[data-gift=message]")).toHaveText(MESSAGE);
    await expect(page.locator("[data-gift=sender]")).toHaveText("Nguyễn Văn An");
    await expect(page.locator("[data-gift=hide-prices]")).toHaveText(vi ? "Có" : "Yes");
    for (const [k, v] of Object.entries(expected)) expect(await digits(page, `[data-total="${k}"]`), k).toBe(v);
    for (const href of ["/gio-hang", "/thanh-toan", "/thanh-toan/giao-hang", "/thanh-toan/goi-qua"]) {
      await expect(page.locator(`main a[href="${prefix}${href}"]`).first()).toBeVisible();
    }

    const clientKey = await page.locator("input[name=clientKey]").inputValue();
    expect(draftCount(clientKey)).toBe(1);
    const before = orderCount();
    const token = await consentAndPlace(page, prefix);
    expect(orderCount()).toBe(before + 1);
    // Placement deleted the draft in its transaction.
    expect(draftCount(clientKey)).toBe(0);

    await page.locator("input[name=method][value=vietqr_mock]").check();
    await page.getByRole("button", { name: vi ? "Mô phỏng thanh toán thành công" : "Simulate a successful payment" }).click();
    await expect(page.getByTestId("order-status")).toHaveText(vi ? "Đã thanh toán" : "Paid");
    await expect(page.getByTestId("order-delivery")).toContainText(RECIPIENT.address);
    await expect(page.getByTestId("order-wrap")).toContainText(vi ? "1 × Hộp cứng đôi" : "1 × Two-bottle box");
    await expect(page.getByTestId("order-gift")).toContainText(MESSAGE.split("\n")[0]);
    for (const [k, v] of Object.entries(expected)) expect(await digits(page, `[data-total="${k}"]`), k).toBe(v);
    await expectNoSeriousA11yViolations(page, "status, gift");

    expect(
      sql(
        `SELECT concat_ws('|', delivery_mode, delivery_recipient_name, delivery_recipient_phone, delivery_recipient_address, delivery_date, delivery_window, gift_packaging_code, gift_packaging_name_vi, gift_packaging_name_en, gift_packaging_units, gift_packaging_unit_price_vnd, gift_card_code, gift_card_name_vi, gift_card_name_en, gift_sender, gift_anonymous, gift_hide_prices, totals_goods_vnd, totals_wrap_vnd, totals_shipping_vnd, totals_total_vnd, totals_vat_included_vnd) FROM orders WHERE token = '${token}'`,
      ),
    ).toBe(
      `gift|${RECIPIENT.name}|0912345678|${RECIPIENT.address}|${date}|afternoon|box-2|Hộp cứng đôi|Two-bottle box|1|200000|tet|Tết|Tết|Nguyễn Văn An|f|t|` +
        `${expected.goods}|${expected.wrap}|${expected.shipping}|${expected.total}|${expected.vat}`,
    );
    expect(sql(`SELECT gift_message FROM orders WHERE token = '${token}'`)).toBe(MESSAGE);
    expect(external).toEqual([]);
  });
}

test("changing delivery mode clears step 3 gift choices while resubmitting the same mode keeps them", async ({ page }) => {
  await declareAdult(page, "/ruou-vang/lune-grise-rouge");
  await addToCart(page, "", "lune-grise-rouge");
  await addToCart(page, "", "colle-vento-rosso");
  await page.goto("/thanh-toan");
  await fillBuyer(page, vietnamDateYearsAgo(30));
  await expect(page).toHaveURL((url) => url.pathname === "/thanh-toan/giao-hang");
  await submitGiftDelivery(page, "", "hcmc");
  await submitGiftOptions(page, "", { packaging: "box-2" });

  // Re-saving the existing gift delivery mode keeps every non-default step 3 choice.
  await page.getByRole("link", { name: "Sửa giao hàng" }).click();
  await submitGiftDelivery(page, "", "hcmc");
  await expect(page.locator('input[name=packaging][value="box-2"]')).toBeChecked();
  await expect(page.locator('input[name=card][value="tet"]')).toBeChecked();
  await expect(page.locator("#gift-message")).toHaveValue(MESSAGE);
  await expect(page.locator("#gift-sender")).toHaveValue("Nguyễn Văn An");
  await expect(page.locator('input[name=hidePrices]')).toBeChecked();
  await submitGift(page, "");

  // Switching to self clears gift-only choices and resets packaging to the self-mode default.
  await page.getByRole("link", { name: "Sửa giao hàng" }).click();
  await page.locator('input[name=mode][value="self"]').check();
  await page.locator("form button[type=submit]").click();
  await expect(page).toHaveURL((url) => url.pathname === "/thanh-toan/goi-qua");
  const handle = (await page.context().cookies()).find((cookie) => cookie.name === "xenia_checkout")!.value;
  expect(sql(`SELECT concat_ws('|', gift_saved::text, coalesce(gift_packaging, 'null'), coalesce(gift_card, 'null'), coalesce(gift_message, ''), coalesce(gift_sender, 'null'), coalesce(gift_hide_prices::text, 'null')) FROM checkout_drafts WHERE handle = '${handle}' AND delivery_mode = 'self'`)).toBe("false|null|null||null|null");
  await expect(page.locator('input[name=packaging][value="none"]')).toBeChecked();
  for (const name of ["card", "message", "sender", "anonymous", "hidePrices"]) await expect(page.locator(`[name=${name}]`)).toHaveCount(0);
  await submitGift(page, "");
  await expect(page.getByTestId("review-gift")).toHaveCount(0);
  await expect(page.getByTestId("review-wrap")).toContainText("Không gói quà");
});

test("the cart cookie holds only vintage ids and quantities and the checkout cookie only the draft handle, both HttpOnly, SameSite=Lax, path /, for the browser session", async ({ page }) => {
  await declareAdult(page, "/ruou-vang/colle-vento-rosso");
  await addToCart(page, "", "colle-vento-rosso");
  await page.goto("/thanh-toan");
  await fillBuyer(page, vietnamDateYearsAgo(30));
  await expect(page).toHaveURL((url) => url.pathname === "/thanh-toan/giao-hang");
  const cookies = await page.context().cookies();
  const cart = cookies.find((c) => c.name === "xenia_cart")!;
  expect(cart).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/", expires: -1 });
  expect(JSON.parse(decodeURIComponent(cart.value))).toEqual([{ v: vintageId("colle-vento-rosso", 2021, 750), q: 1 }]);
  const cookie = cookies.find((c) => c.name === "xenia_checkout")!;
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/", expires: -1 });
  expect(cookie.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(Number(sql(`SELECT count(*) FROM checkout_drafts WHERE handle = '${cookie.value}' AND buyer_email = 'an@example.test'`))).toBe(1);
});

test("long Vietnamese addresses and a 250-code-point message go through every step and place", async ({ page }) => {
  test.setTimeout(300_000);
  // "ệ" is one code point and one UTF-16 unit, so each field sits exactly at its limit.
  const buyerAddress = `12 Lê Lợi ${"ệ".repeat(490)}`;
  const recipientAddress = `5 Hàng Bài ${"ệ".repeat(489)}`;
  const message = "ệ".repeat(250);
  expect([buyerAddress.length, recipientAddress.length, [...message].length]).toEqual([500, 500, 250]);
  await declareAdult(page, "/ruou-vang/colle-vento-rosso");
  await addToCart(page, "", "colle-vento-rosso", 2);
  await page.goto("/thanh-toan");
  await fillBuyer(page, vietnamDateYearsAgo(30), buyerAddress);
  await expect(page).toHaveURL((url) => url.pathname === "/thanh-toan/giao-hang");
  await submitGiftDelivery(page, "", "hcmc", { recipient: { ...RECIPIENT, address: recipientAddress } });
  await submitGiftOptions(page, "", { message });
  const token = await consentAndPlace(page, "");
  expect(sql(`SELECT buyer_address || '|' || delivery_recipient_address || '|' || gift_message FROM orders WHERE token = '${token}'`)).toBe(
    `${buyerAddress}|${recipientAddress}|${message}`,
  );
});

test("self delivery with silk wrap: step 3 offers no gift-only options, refuses them when forged, and the totals include the wrap", async ({ page }) => {
  test.setTimeout(300_000);
  const external = await blockThirdParty(page);
  await declareAdult(page, "/ruou-vang/colle-vento-rosso");
  await addToCart(page, "", "colle-vento-rosso", 2);
  await page.goto("/thanh-toan");
  await fillBuyer(page, vietnamDateYearsAgo(30));
  await submitDelivery(page, "", "hcmc");

  for (const name of ["card", "message", "sender", "anonymous", "hidePrices"]) await expect(page.locator(`[name=${name}]`)).toHaveCount(0);
  await expectNoSeriousA11yViolations(page, "step 3, self");
  // A forged card and message in self mode are refused.
  await page.locator("input[name=packaging][value=silk]").check();
  await page.locator("form:has(input[name=packaging])").evaluate((form) => {
    for (const [name, value] of [
      ["card", "tet"],
      ["message", "forged"],
    ]) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
  });
  await page.locator("form button[type=submit]").click();
  await expect(page.locator("form [role=alert]")).toContainText("Thiệp, lời nhắn, người gửi và ẩn giá chỉ dành cho đơn gửi quà.");
  await expect(page).toHaveURL((url) => url.pathname === "/thanh-toan/goi-qua");

  await page.reload();
  await page.locator("input[name=packaging][value=silk]").check();
  await submitGift(page, "");
  await expect(page.getByTestId("review-gift")).toHaveCount(0);
  await expect(page.getByTestId("review-wrap")).toContainText("Gói quà: 2 × Giấy lụa và ruy băng = 100.000");
  // 2 × 720 000 = 1 440 000; silk 2 × 50 000 = 100 000; + 30 000 = 1 570 000; / 11 = 142 727.3 → 142 727.
  expect(await Promise.all(["goods", "wrap", "shipping", "total", "vat"].map((k) => digits(page, `[data-total="${k}"]`)))).toEqual([
    1_440_000, 100_000, 30_000, 1_570_000, 142_727,
  ]);
  const token = await consentAndPlace(page, "");
  expect(
    sql(
      `SELECT concat_ws('|', delivery_mode, delivery_recipient_name IS NULL, gift_packaging_code, gift_packaging_units, gift_card_code IS NULL, coalesce(gift_message, ''), totals_wrap_vnd, totals_total_vnd) FROM orders WHERE token = '${token}'`,
    ),
  ).toBe("self|t|silk|2|t||100000|1570000");
  expect(external).toEqual([]);
});

test("a 1500 ml bottle is offered only silk, a forged box-1 is refused, and placement refuses packaging that stopped fitting", async ({ page }) => {
  test.setTimeout(300_000);
  await declareAdult(page, "/ruou-vang/lune-grise-rouge?vintage=2019&size=1500");
  await page.getByTestId("add-to-cart").locator("button[type=submit]").click();
  await expect(page).toHaveURL((url) => url.pathname === "/gio-hang");
  await page.goto("/thanh-toan");
  await fillBuyer(page, vietnamDateYearsAgo(30));
  await submitDelivery(page, "", "hcmc");
  const offered = await page.locator("input[name=packaging]").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  expect(offered).toEqual(["none", "silk"]);
  await page.locator("form:has(input[name=packaging])").evaluate((form) => {
    for (const radio of form.querySelectorAll<HTMLInputElement>("input[name=packaging]")) radio.disabled = true;
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "packaging";
    input.value = "box-1";
    form.appendChild(input);
  });
  await page.locator("form button[type=submit]").click();
  await expect(page.locator("#packaging-error")).toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname === "/thanh-toan/goi-qua");
  expect(sql(`SELECT count(*) FROM checkout_drafts WHERE gift_packaging = 'box-1' AND buyer_email = 'an@example.test' AND updated_at > now() - interval '1 minute'`)).toBe("0");

  // A 750 ml cart reviewed with box-1; a 1500 ml bottle added in another tab before the submit.
  await page.goto("/gio-hang");
  await page.locator("[data-vintage]").first().getByRole("button", { name: /^Bỏ / }).click();
  await expect(page.getByTestId("cart-lines")).toHaveCount(0);
  await addToCart(page, "", "colle-vento-rosso");
  await page.goto("/thanh-toan/goi-qua");
  await page.locator("input[name=packaging][value=box-1]").check();
  await submitGift(page, "");
  const other = await page.context().newPage();
  await other.goto("/ruou-vang/lune-grise-rouge?vintage=2019&size=1500");
  await other.getByTestId("add-to-cart").locator("button[type=submit]").click();
  await expect(other).toHaveURL((url) => url.pathname === "/gio-hang");

  const before = orderCount();
  const { replay } = await capturePlacePost(page);
  const response = await replay();
  expect(JSON.stringify(response.headers())).toContain("/thanh-toan/goi-qua?invalid=packaging");
  expect(orderCount()).toBe(before);
});

test("step 2 refuses a date before the earliest, past the horizon or on a blackout date, and placement refuses a date that became a blackout", async ({ page }) => {
  test.setTimeout(300_000);
  const blackout = vietnamDatePlusDays(5);
  await declareAdult(page, "/ruou-vang/colle-vento-rosso");
  await addToCart(page, "", "colle-vento-rosso");
  await page.goto("/thanh-toan");
  await fillBuyer(page, vietnamDateYearsAgo(30));
  const settingsId = sql("SELECT id FROM site_settings");
  try {
    sql(`INSERT INTO site_settings_blackout_dates (_order, _parent_id, id, date) VALUES (1, ${settingsId}, 'e2e-blackout', '${blackout}')`);
    // A blank recipient in gift mode: every recipient field error, and the visitor stays on step 2.
    await expect(page).toHaveURL((url) => url.pathname === "/thanh-toan/giao-hang");
    await submitGiftDelivery(page, "", "hcmc", { recipient: { name: "", phone: "", address: "" }, expectStep3: false });
    for (const name of ["recipientName", "recipientPhone", "recipientAddress"]) await expect(page.locator(`#delivery-${name}-error`)).toBeVisible();
    await expect(page).toHaveURL((url) => url.pathname === "/thanh-toan/giao-hang");
    // Earliest = today + 1; latest = earliest + 30 = today + 31.
    for (const [date, message] of [
      [vietnamDatePlusDays(0), "sớm hơn ngày sớm nhất"],
      [vietnamDatePlusDays(32), "trong vòng 30 ngày"],
      [blackout, "Không giao hàng vào ngày này"],
    ]) {
      await page.goto("/thanh-toan/giao-hang");
      await submitGiftDelivery(page, "", "hcmc", { date, expectStep3: false });
      await expect(page.locator("#delivery-date-error")).toContainText(message);
      await expect(page).toHaveURL((url) => url.pathname === "/thanh-toan/giao-hang");
    }
    // Both edges of the window are accepted.
    for (const date of [vietnamDatePlusDays(1), vietnamDatePlusDays(31)]) {
      await page.goto("/thanh-toan/giao-hang");
      await submitGiftDelivery(page, "", "hcmc", { date });
    }

    // Reviewed on a valid date, which becomes a blackout before the submit.
    const date = vietnamDatePlusDays(4);
    await page.goto("/thanh-toan/giao-hang");
    await submitGiftDelivery(page, "", "hcmc", { date });
    await submitGiftOptions(page, "");
    sql(`INSERT INTO site_settings_blackout_dates (_order, _parent_id, id, date) VALUES (2, ${settingsId}, 'e2e-blackout-2', '${date}')`);
    const before = orderCount();
    const { replay } = await capturePlacePost(page);
    const response = await replay();
    expect(JSON.stringify(response.headers())).toContain("/thanh-toan/giao-hang?invalid=dateBlackout");
    expect(orderCount()).toBe(before);
    await page.goto("/thanh-toan/giao-hang?invalid=dateBlackout");
    await expect(page.locator("#delivery-date-error")).toBeVisible();
  } finally {
    sql("DELETE FROM site_settings_blackout_dates WHERE id LIKE 'e2e-blackout%'");
  }
});

test("a message over 250 code points or with a control character is refused and not stored", async ({ page }) => {
  await declareAdult(page, "/ruou-vang/colle-vento-rosso");
  await addToCart(page, "", "colle-vento-rosso");
  await page.goto("/thanh-toan");
  await fillBuyer(page, vietnamDateYearsAgo(30));
  await submitGiftDelivery(page, "", "hcmc");
  for (const [message, error] of [
    ["ệ".repeat(251), "Lời nhắn dài quá 250 ký tự."],
    ["Chúc mừng\u0007", "Lời nhắn chỉ được chứa văn bản thường và xuống dòng."],
  ]) {
    await page.locator("input[name=card][value=tet]").check();
    await page.locator("#gift-message").fill(message);
    await page.locator("form button[type=submit]").click();
    await expect(page.locator("#gift-message-error")).toHaveText(error);
    await expect(page).toHaveURL((url) => url.pathname === "/thanh-toan/goi-qua");
  }
  expect(sql("SELECT count(*) FROM checkout_drafts WHERE gift_message LIKE '%ệệệệệệệệệệ%' OR gift_message LIKE '%' || chr(7) || '%'")).toBe("0");
});

test("a posted wrap price, units or total is ignored", async ({ page }) => {
  await declareAdult(page, "/ruou-vang/colle-vento-rosso");
  await addToCart(page, "", "colle-vento-rosso");
  await addToCart(page, "", "due-fiumi-moscato");
  await toGiftReview(page, "", "hcmc");
  await page.locator("form:has(input[name=clientKey])").evaluate((form) => {
    for (const [name, value] of [
      ["wrapVnd", "1"],
      ["units", "0"],
      ["packagingUnits", "0"],
      ["unitPriceVnd", "1"],
      ["packagingUnitPriceVnd", "1"],
      ["packaging", "silk"],
      ["totalVnd", "1"],
    ]) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
  });
  const token = await consentAndPlace(page, "");
  // 720 000 + 480 000 = 1 200 000; box-2 1 × 200 000; + 30 000 = 1 430 000; / 11 = 130 000.
  expect(
    sql(`SELECT concat_ws('|', gift_packaging_code, gift_packaging_units, gift_packaging_unit_price_vnd, totals_wrap_vnd, totals_total_vnd, totals_vat_included_vnd) FROM orders WHERE token = '${token}'`),
  ).toBe("box-2|1|200000|200000|1430000|130000");
});

// The packaging price changes in the database between the review and the submit.
test("a change to the packaging price after the review is refused at ?changed=1 and placed as re-shown", async ({ page }) => {
  await declareAdult(page, "/ruou-vang/colle-vento-rosso");
  await addToCart(page, "", "colle-vento-rosso");
  await addToCart(page, "", "due-fiumi-moscato");
  await toGiftReview(page, "", "hcmc");
  // 720 000 + 480 000 + box-2 200 000 + 30 000 = 1 430 000.
  expect(await digits(page, '[data-total="total"]')).toBe(1_430_000);
  try {
    sql("UPDATE packaging SET price_vnd = 210000 WHERE code = 'box-2'");
    const before = orderCount();
    await page.locator("input[name=terms]").check();
    await page.locator("input[name=privacy]").check();
    await page.locator("form:has(input[name=clientKey]) button[type=submit]").click();
    await expect(page).toHaveURL((url) => url.pathname === "/thanh-toan/xac-nhan" && url.search === "?changed=1");
    await expect(page.getByTestId("review-changed")).toContainText("Đơn hàng đã thay đổi sau khi bạn xem lại");
    expect(orderCount()).toBe(before);
    // 1 200 000 + 210 000 + 30 000 = 1 440 000.
    await expect.poll(() => digits(page, '[data-total="total"]')).toBe(1_440_000);
    await consentAndPlace(page, "");
    expect(orderCount()).toBe(before + 1);
  } finally {
    sql("UPDATE packaging SET price_vnd = 200000 WHERE code = 'box-2'");
  }
});

for (const { locale, prefix } of LOCALES) {
  test(`the gift service page lists packaging, cards and rules, shows no wine, and makes no third-party request (${locale})`, async ({ page }) => {
    const vi = locale === "vi";
    await page.goto(`${prefix}/dich-vu-goi-qua`);
    await expect(page).toHaveURL((url) => url.pathname === `${prefix}/xac-minh-tuoi` && url.searchParams.get("next") === `${prefix}/dich-vu-goi-qua`);
    const external = await blockThirdParty(page);
    await declareAdult(page, `${prefix}/dich-vu-goi-qua`);
    const list = page.getByTestId("service-packaging");
    await expect(list.locator("[data-packaging]")).toHaveCount(3);
    await expect(list.locator("[data-packaging=silk]")).toContainText(vi ? "1 chai mỗi gói" : "1 bottle(s) each");
    await expect(list.locator("[data-packaging=silk]")).toContainText(vi ? "50.000" : "50,000");
    await expect(list.locator("[data-packaging=box-1]")).toContainText(vi ? "120.000" : "120,000");
    await expect(list.locator("[data-packaging=box-2]")).toContainText(vi ? "2 chai mỗi gói" : "2 bottle(s) each");
    await expect(list.locator("[data-packaging=box-2]")).toContainText(vi ? "200.000" : "200,000");
    await expect(page.getByTestId("service-cards").locator("[data-card]")).toHaveCount(4);
    await expect(page.getByTestId("paid-service")).toContainText(vi ? "không có hình thức miễn phí" : "no free tier");
    await expect(page.getByTestId("service-recipient-rule")).toContainText(vi ? "đủ 18 tuổi" : "18 or over");
    await expect(page.locator("main")).toContainText("250");
    await expect(page.locator("main a[href*='/ruou-vang']")).toHaveCount(0);
    for (const wine of ["Lune Grise", "Colle del Vento", "Sept Pierres"]) await expect(page.locator("main")).not.toContainText(wine);
    await expectNotice(page);
    await expectNoSeriousA11yViolations(page, "gift service");
    await page.waitForLoadState("networkidle");
    expect(external).toEqual([]);
  });
}

test("an expired draft reads as absent and sends the buyer back to step 1", async ({ page }) => {
  await declareAdult(page, "/ruou-vang/colle-vento-rosso");
  await addToCart(page, "", "colle-vento-rosso");
  await toReview(page, "", "hcmc");
  const clientKey = await page.locator("input[name=clientKey]").inputValue();
  sql(`UPDATE checkout_drafts SET expires_at = now() - interval '1 second' WHERE client_key = '${clientKey}'`);
  await page.goto("/thanh-toan/xac-nhan");
  await expect(page).toHaveURL((url) => url.pathname === "/thanh-toan");
  await expect(page.locator("#buyer-name")).toHaveValue("");
});

test("gift collections, site settings and checkout drafts are admin-only over REST and nothing is created", async ({ page, request }) => {
  await declareAdult(page, "/ruou-vang/colle-vento-rosso");
  await addToCart(page, "", "colle-vento-rosso");
  await page.goto("/thanh-toan");
  await fillBuyer(page, vietnamDateYearsAgo(30));
  await expect(page).toHaveURL((url) => url.pathname === "/thanh-toan/giao-hang");
  const handle = (await page.context().cookies()).find((c) => c.name === "xenia_checkout")!.value;
  const draftId = sql(`SELECT id FROM checkout_drafts WHERE handle = '${handle}'`);
  const counts = () => sql("SELECT (SELECT count(*) FROM checkout_drafts) || '|' || (SELECT count(*) FROM packaging) || '|' || (SELECT count(*) FROM card_designs)");
  const before = counts();

  for (const path of [
    "/api/checkout-drafts",
    `/api/checkout-drafts/${draftId}`,
    `/api/checkout-drafts?where[handle][equals]=${handle}`,
    "/api/packaging",
    "/api/card-designs",
    "/api/globals/site-settings",
  ]) {
    const response = await request.get(path);
    expect(response.ok(), `${path} ${response.status()}`).toBe(false);
    const body = await response.text();
    for (const secret of [handle, "an@example.test", "Nguyễn Văn An", "box-2", "Hộp cứng", "chuc-mung", "leadDays"]) expect(body, path).not.toContain(secret);
  }
  for (const [path, data] of [
    ["/api/checkout-drafts", { handle: "A".repeat(43), clientKey: "00000000-0000-4000-8000-000000000000", expiresAt: "2099-01-01T00:00:00Z" }],
    ["/api/packaging", { code: "free", name: "Free", capacity: 1, fits: ["750"], priceVnd: 1, active: true }],
    ["/api/card-designs", { code: "forged", name: "Forged", active: true }],
    ["/api/globals/site-settings", { blackoutDates: [] }],
  ] as const) {
    const response = await request.post(path, { data });
    expect(response.ok(), `POST ${path} ${response.status()}`).toBe(false);
  }
  expect(counts()).toBe(before);
});

test("pnpm seed changes no user, order or checkout draft and clears the vintage on existing order lines", async ({ page, request }) => {
  sql("TRUNCATE users CASCADE");
  expect((await request.post("/api/users/first-register", { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, "confirm-password": ADMIN_PASSWORD } })).ok()).toBe(true);
  await declareAdult(page, "/ruou-vang/colle-vento-rosso");
  await addToCart(page, "", "colle-vento-rosso");
  await toReview(page, "", "hcmc");
  const token = await consentAndPlace(page, "");
  await addToCart(page, "", "colle-vento-rosso");
  await page.goto("/thanh-toan");
  await fillBuyer(page, vietnamDateYearsAgo(30));
  await expect(page).toHaveURL((url) => url.pathname === "/thanh-toan/giao-hang");

  const rows = () => sql("SELECT (SELECT count(*) FROM users) || '|' || (SELECT count(*) FROM orders) || '|' || (SELECT count(*) FROM checkout_drafts)");
  const line = () =>
    sql(`SELECT concat_ws('|', l.vintage_id IS NULL, l.wine_name_vi, l.unit_price_vnd, l.qty) FROM orders_lines l JOIN orders o ON o.id = l._parent_id WHERE o.token = '${token}'`);
  const before = rows();
  expect(before.split("|").map(Number).every((n) => n >= 1)).toBe(true);
  expect(line()).toBe("f|Colle del Vento Rosso|720000|1");

  await seedCatalogue(request);
  expect(rows()).toBe(before);
  expect(line()).toBe("t|Colle del Vento Rosso|720000|1");
});
