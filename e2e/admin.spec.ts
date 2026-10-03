import { expect, type Page, test } from "@playwright/test";

import { blockThirdParty, customerCount, declareAdult, register, seedCatalogue, sql, vintageWineNames } from "./support";

const EMAIL = "admin@xenia.test";
const PASSWORD = "e2e-dev-only-password";

/**
 * Payload's Form ignores a submit while it is mounting, initialising or processing, and marks
 * readiness with `data-form-ready` (Payload's own e2e signal). Clicking earlier can be dropped.
 */
async function waitForFormReady(page: Page) {
  await expect(page.locator('form[data-form-ready="true"]')).toBeVisible({ timeout: 90_000 });
}

/**
 * Submits the Payload form, asserts the API accepted it, then waits for Payload's
 * `router.push("/admin")`. On a cold `next dev` that navigation includes compiling and
 * rendering the dashboard, measured above 30 s under host load, so it gets the navigation budget.
 */
async function submit(page: Page, apiPath: string) {
  await waitForFormReady(page);
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === apiPath),
    page.locator("button[type=submit]").click(),
  ]);
  expect(response.status(), `${apiPath} status`).toBeLessThan(300);
  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 90_000 });
}

test.beforeAll(async ({ request }) => {
  // Payload pushes its schema on first use; then empty the users so create-first-user is reachable.
  await seedCatalogue(request);
  sql("TRUNCATE users CASCADE");
});

test("the admin makes no third-party request in create-first-user, dashboard, account, catalogue lists, a vintage, the gift collections, site settings, customers, the outbox, quote requests and login", async ({ page }) => {
  const external = await blockThirdParty(page);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/create-first-user/);
  await waitForFormReady(page);
  const finalFormState = page.waitForResponse((response) => {
    const request = response.request();
    const body = request.postData() ?? "";
    return request.method() === "POST" &&
      new URL(request.url()).pathname === "/admin/create-first-user" &&
      Boolean(request.headers()["next-action"]) &&
      body.includes('"name":"form-state"') &&
      body.includes(EMAIL) &&
      body.split(PASSWORD).length - 1 === 2;
  });
  await page.locator("#field-email").fill(EMAIL);
  await page.locator("#field-password").fill(PASSWORD);
  await page.locator("#field-confirm-password").fill(PASSWORD);
  const formStateResponse = await finalFormState;
  await formStateResponse.finished();
  expect(formStateResponse.status(), "Payload form-state response").toBeLessThan(300);
  await submit(page, "/api/users/first-register");
  await page.waitForLoadState("networkidle");

  await page.goto("/admin/account");
  await expect(page.locator("#field-email")).toHaveValue(EMAIL);
  await page.waitForLoadState("networkidle");

  // The catalogue collections are managed here; each list's first page shows the last seeded row.
  for (const [collection, row] of [
    ["producers", "Southern Light Estate"],
    ["wines", "Lune Grise Réserve"],
    ["vintages", "2022"],
  ]) {
    await page.goto(`/admin/collections/${collection}`);
    await expect(page.locator(".collection-list table")).toContainText(row);
    await page.waitForLoadState("networkidle");
  }

  // Relationship labels resolve lazily only after their cells enter the viewport. Compare every row
  // to the independent vintage→localized-wine mapping from the scratch database.
  const expectedWineByVintage = vintageWineNames("vi");
  // One page holds every vintage, however many archived rows earlier runs left.
  const limit = expectedWineByVintage.size;
  await page.goto(`/admin/collections/vintages?limit=${limit}`);
  await page.waitForLoadState("networkidle");
  const vintageRows = page.locator(".collection-list tbody tr");
  await expect(vintageRows).toHaveCount(expectedWineByVintage.size);
  for (const row of await vintageRows.all()) {
    const rowLink = row.locator('a[href^="/admin/collections/vintages/"]').first();
    const href = await rowLink.getAttribute("href");
    const id = Number(href?.split("/").pop());
    const expectedWine = expectedWineByVintage.get(id);
    expect(expectedWine, `vintage ${id} must have an independent SQL wine mapping`).toBeDefined();
    const wineCell = row.locator(".cell-wine");
    await wineCell.scrollIntoViewIfNeeded();
    await expect(wineCell).toHaveText(expectedWine!);
    await expect(wineCell).not.toContainText("<No Wine>");
  }

  // The derived ≥15% ABV indicator, filtered on the stored abvPct (the wine column's relationship
  // cell is not a stable row key): the seed's only vintages at 15% or above are the two 20% tawnies.
  const cells = page.locator(".collection-list tbody tr .cell-adRestricted");
  await page.goto(`/admin/collections/vintages?limit=${limit}&where[abvPct][greater_than_equal]=15`);
  await expect(cells).toHaveText(["true", "true"]);
  await page.goto(`/admin/collections/vintages?limit=${limit}&where[abvPct][less_than]=15`);
  // The seed has 25 of them; archived non-seed vintages (an earlier spec's ordered rows) add more.
  await expect(page.locator(".collection-list tbody tr")).toHaveCount(Number(sql("SELECT count(*) FROM vintages WHERE abv_pct < 15")));
  expect(new Set(await cells.allTextContents())).toEqual(new Set(["false"]));
  await page.waitForLoadState("networkidle");

  await page.goto(`/admin/collections/vintages?limit=${limit}&where[abvPct][greater_than_equal]=15`);
  const tawny = page.locator(".collection-list tbody tr");
  await tawny.first().locator("a").first().click();
  await expect(page).toHaveURL(/\/admin\/collections\/vintages\/\d+/);
  const indicator = page.locator("#field-adRestricted");
  await expect(indicator).toBeChecked();
  await expect(indicator).toBeDisabled();
  await expect(page.locator("#field-abvPct")).toHaveValue("20");
  await page.waitForLoadState("networkidle");

  // The gift collections (list and edit view) and the site settings (zones, lead days, blackout dates).
  for (const [collection, row] of [
    ["packaging", "box-2"],
    ["card-designs", "chuc-mung"],
  ]) {
    await page.goto(`/admin/collections/${collection}`);
    await expect(page.locator(".collection-list table")).toContainText(row);
    await page.waitForLoadState("networkidle");
    await page.locator(".collection-list tbody tr").first().locator("a").first().click();
    await expect(page).toHaveURL(new RegExp(`/admin/collections/${collection}/\\d+`));
    await waitForFormReady(page);
    await page.waitForLoadState("networkidle");
  }
  await page.goto("/admin/globals/site-settings");
  await waitForFormReady(page);
  await expect(page.locator("#field-zones")).toBeVisible();
  await page.waitForLoadState("networkidle");

  // Customers (read-only, no hash, salt or token), the mock outbox (read-only) and quote requests (sent
  // fields read-only). The customer and the quote request are made on the storefront, in another
  // browser context, as a buyer would.
  const buyerEmail = `admin-view.${Date.now().toString(36)}@example.test`;
  const buyerContext = await page.context().browser()!.newContext({ baseURL: test.info().project.use.baseURL });
  const buyer = await buyerContext.newPage();
  await declareAdult(buyer, "/tai-khoan/dang-ky");
  await register(buyer, "", buyerEmail);
  await expect(buyer).toHaveURL(/notice=registered/);
  const company = `Admin view ${Date.now().toString(36)}`;
  await buyer.goto("/lien-he");
  await buyer.locator("#quote-company").fill(company);
  await buyer.locator("#quote-name").fill("Trần Thị Bình");
  await buyer.locator("#quote-phone").fill("0901234567");
  await buyer.locator("#quote-email").fill(buyerEmail);
  await buyer.locator("#quote-occasion").selectOption("event");
  await buyer.locator("#quote-quantity").fill("40");
  await buyer.locator("#quote-privacy").check();
  await buyer.getByTestId("quote-form").getByRole("button").click();
  await expect(buyer.getByTestId("quote-sent")).toBeVisible();
  await buyerContext.close();
  expect(customerCount(buyerEmail)).toBe(1);

  await page.goto("/admin/collections/customers");
  await expect(page.locator(".collection-list table")).toContainText(buyerEmail);
  await page.waitForLoadState("networkidle");
  await page.goto(`/admin/collections/customers/${sql(`SELECT id FROM customers WHERE email = '${buyerEmail}'`)}`);
  await waitForFormReady(page);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("#field-email")).toHaveValue(buyerEmail);
  const customerHtml = (await page.content()).toLowerCase();
  const hash = sql(`SELECT hash FROM customers WHERE email = '${buyerEmail}'`);
  const salt = sql(`SELECT salt FROM customers WHERE email = '${buyerEmail}'`);
  const verificationToken = sql(`SELECT _verificationtoken FROM customers WHERE email = '${buyerEmail}'`);
  for (const secret of [hash, salt, verificationToken]) {
    expect(secret.length).toBeGreaterThan(10);
    expect(customerHtml).not.toContain(secret.toLowerCase());
  }
  for (const field of ["#field-name", "#field-phone", "#field-address"]) await expect(page.locator(field)).toBeDisabled();

  await page.goto("/admin/collections/mock-outbox");
  await expect(page.locator(".collection-list table")).toContainText(buyerEmail);
  await page.waitForLoadState("networkidle");
  await page.locator(".collection-list tbody tr").first().locator("a").first().click();
  await expect(page).toHaveURL(/\/admin\/collections\/mock-outbox\/\d+/);
  await waitForFormReady(page);
  for (const field of ["#field-to", "#field-subject", "#field-body"]) await expect(page.locator(field)).toBeDisabled();
  await page.waitForLoadState("networkidle");

  await page.goto("/admin/collections/quote-requests");
  await expect(page.locator(".collection-list table")).toContainText(company);
  await page.waitForLoadState("networkidle");
  await page.goto(`/admin/collections/quote-requests/${sql(`SELECT id FROM quote_requests WHERE company = '${company}'`)}`);
  await waitForFormReady(page);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("#field-company")).toHaveValue(company);
  for (const field of ["#field-company", "#field-name", "#field-email", "#field-phone", "#field-message"]) await expect(page.locator(field)).toBeDisabled();

  await page.goto("/admin/logout");
  await expect(page).toHaveURL(/\/admin\/login/);
  await waitForFormReady(page);
  await page.locator("#field-email").fill(EMAIL);
  await page.locator("#field-password").fill(PASSWORD);
  await submit(page, "/api/users/login");
  await page.waitForLoadState("networkidle");

  expect(external).toEqual([]);
});
