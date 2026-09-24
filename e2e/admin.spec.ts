import { expect, type Page, test } from "@playwright/test";

import { blockThirdParty, seedCatalogue, sql } from "./support";

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

test("the admin makes no third-party request in create-first-user, dashboard, account, catalogue lists, a vintage and login", async ({ page }) => {
  const external = await blockThirdParty(page);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/create-first-user/);
  await waitForFormReady(page);
  await page.locator("#field-email").fill(EMAIL);
  await page.locator("#field-password").fill(PASSWORD);
  await page.locator("#field-confirm-password").fill(PASSWORD);
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

  // The derived ≥15% ABV indicator, filtered on the stored abvPct (the wine column's relationship
  // cell is not a stable row key): the seed's only vintages at 15% or above are the two 20% tawnies.
  const cells = page.locator(".collection-list tbody tr .cell-adRestricted");
  await page.goto("/admin/collections/vintages?limit=100&where[abvPct][greater_than_equal]=15");
  await expect(cells).toHaveText(["true", "true"]);
  await page.goto("/admin/collections/vintages?limit=100&where[abvPct][less_than]=15");
  await expect(page.locator(".collection-list tbody tr")).toHaveCount(25);
  expect(new Set(await cells.allTextContents())).toEqual(new Set(["false"]));
  await page.waitForLoadState("networkidle");

  await page.goto("/admin/collections/vintages?limit=100&where[abvPct][greater_than_equal]=15");
  const tawny = page.locator(".collection-list tbody tr");
  await tawny.first().locator("a").first().click();
  await expect(page).toHaveURL(/\/admin\/collections\/vintages\/\d+/);
  const indicator = page.locator("#field-adRestricted");
  await expect(indicator).toBeChecked();
  await expect(indicator).toBeDisabled();
  await expect(page.locator("#field-abvPct")).toHaveValue("20");
  await page.waitForLoadState("networkidle");

  await page.goto("/admin/logout");
  await expect(page).toHaveURL(/\/admin\/login/);
  await waitForFormReady(page);
  await page.locator("#field-email").fill(EMAIL);
  await page.locator("#field-password").fill(PASSWORD);
  await submit(page, "/api/users/login");
  await page.waitForLoadState("networkidle");

  expect(external).toEqual([]);
});
