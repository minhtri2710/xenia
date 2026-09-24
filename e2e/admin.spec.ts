import { execFileSync } from "node:child_process";

import { expect, type Page, test } from "@playwright/test";

const EMAIL = "admin@xenia.test";
const PASSWORD = "e2e-dev-only-password";

/** Records every request to a non-localhost origin and aborts it, so nothing leaves the host. */
async function blockThirdParty(page: Page): Promise<string[]> {
  const external: string[] = [];
  await page.route(
    (url) => url.protocol.startsWith("http") && url.hostname !== "localhost" && url.hostname !== "127.0.0.1",
    (route) => {
      external.push(route.request().url());
      return route.abort();
    },
  );
  return external;
}

test.beforeAll(async ({ request }) => {
  // Payload pushes its schema on first use; then empty the users so create-first-user is reachable.
  expect((await request.get("/api/users/init")).ok()).toBe(true);
  execFileSync("docker", ["exec", "xenia-dev-postgres", "psql", "-U", "xenia", "-d", "xenia", "-c", "TRUNCATE users CASCADE"]);
});

test("the admin makes no third-party request in create-first-user, dashboard, account and login", async ({ page }) => {
  const external = await blockThirdParty(page);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/create-first-user/);
  await page.locator("#field-email").fill(EMAIL);
  await page.locator("#field-password").fill(PASSWORD);
  await page.locator("#field-confirm-password").fill(PASSWORD);
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/\/admin\/?$/);
  await page.waitForLoadState("networkidle");

  await page.goto("/admin/account");
  await expect(page.locator("#field-email")).toHaveValue(EMAIL);
  await page.waitForLoadState("networkidle");

  await page.goto("/admin/logout");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.locator("#field-email").fill(EMAIL);
  await page.locator("#field-password").fill(PASSWORD);
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/\/admin\/?$/);
  await page.waitForLoadState("networkidle");

  expect(external).toEqual([]);
});
