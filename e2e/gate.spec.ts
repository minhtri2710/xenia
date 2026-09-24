import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { vietnamDateYearsAgo } from "./support";

const LEGAL_NOTICE = "Không bán rượu, bia cho người chưa đủ 18 tuổi";
const EN_TRANSLATION = "No sale of alcohol or beer to anyone under 18";

async function declare(page: Page, name: string, dob: string) {
  await page.locator("#gate-name").fill(name);
  await page.locator("#gate-dob").fill(dob);
  await page.locator("form button[type=submit]").click();
}

async function expectNoSeriousA11yViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const blocking = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
}

test.describe("unverified visitor", () => {
  for (const [path, gate] of [
    ["/", "/xac-minh-tuoi"],
    ["/ruou-vang/vang-do-bat-ky", "/xac-minh-tuoi"],
    ["/en", "/en/xac-minh-tuoi"],
    ["/en/ruou-vang/any-wine", "/en/xac-minh-tuoi"],
  ]) {
    test(`is redirected by the server from ${path} to the gate`, async ({ page, request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(307);
      const location = new URL(response.headers()["location"], "http://x");
      expect(location.pathname).toBe(gate);
      expect(location.searchParams.get("next")).toBe(path);

      await page.goto(path);
      await expect(page).toHaveURL((url) => url.pathname === gate);
      await expect(page.locator("#gate-name")).toBeVisible();
    });
  }
});

test("an under-18 declaration lands on the exit page and / stays gated", async ({ page, context }) => {
  await page.goto("/");
  await declare(page, "Trần Thị Bình", vietnamDateYearsAgo(17));
  await expect(page).toHaveURL((url) => url.pathname === "/tam-biet");
  expect((await context.cookies()).map((c) => c.name)).not.toContain("xenia_age_ok");

  await page.goto("/");
  await expect(page).toHaveURL((url) => url.pathname === "/xac-minh-tuoi");
});

test("an English under-18 declaration lands on the English exit page", async ({ page }) => {
  await page.goto("/en");
  await declare(page, "Jane Doe", vietnamDateYearsAgo(10));
  await expect(page).toHaveURL((url) => url.pathname === "/en/tam-biet");
});

test("an adult declaration on their 18th birthday returns the visitor to /", async ({ page, context }) => {
  await page.goto("/");
  await declare(page, "Nguyễn Văn An", vietnamDateYearsAgo(18));
  await expect(page).toHaveURL((url) => url.pathname === "/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Rượu vang cho những dịp đáng nhớ");

  const marker = (await context.cookies()).find((c) => c.name === "xenia_age_ok");
  expect(marker).toMatchObject({ value: "1", httpOnly: true, sameSite: "Lax" });
  expect(JSON.stringify(await context.cookies())).not.toMatch(/Nguy|\d{4}-\d{2}-\d{2}/);
});

test("an adult declaration returns the visitor to the requested deep path", async ({ page }) => {
  await page.goto("/en/ruou-vang/any-wine?vintage=2019");
  await declare(page, "Jane Doe", vietnamDateYearsAgo(30));
  await expect(page).toHaveURL((url) => url.pathname + url.search === "/en/ruou-vang/any-wine?vintage=2019");
});

test("an open-redirect `next` returns the adult to / instead", async ({ page }) => {
  await page.goto("/xac-minh-tuoi?next=//evil.example");
  await declare(page, "Nguyễn Văn An", vietnamDateYearsAgo(30));
  await expect(page).toHaveURL((url) => url.hostname === "localhost" && url.pathname === "/");
});

test("an adult declaration on the English gate with no `next` returns the visitor to /en", async ({ page }) => {
  await page.goto("/en/xac-minh-tuoi");
  await declare(page, "Jane Doe", vietnamDateYearsAgo(30));
  await expect(page).toHaveURL((url) => url.pathname === "/en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Wine for memorable occasions");
});

test("an open-redirect `next` on the English gate returns the adult to /en instead", async ({ page }) => {
  await page.goto("/en/xac-minh-tuoi?next=//evil.example");
  await declare(page, "Jane Doe", vietnamDateYearsAgo(30));
  await expect(page).toHaveURL((url) => url.hostname === "localhost" && url.pathname === "/en");
});

test.describe("invalid input shows a field error on the gate", () => {
  test("blank name", async ({ page, context }) => {
    await page.goto("/");
    await declare(page, "   ", vietnamDateYearsAgo(30));
    await expect(page.locator("#gate-name-error")).toHaveText("Vui lòng nhập họ và tên.");
    await expect(page.locator("#gate-name")).toHaveAttribute("aria-describedby", "gate-name-error");
    await expect(page).toHaveURL((url) => url.pathname === "/xac-minh-tuoi");
    expect((await context.cookies()).map((c) => c.name)).not.toContain("xenia_age_ok");
  });

  test("future date of birth", async ({ page }) => {
    await page.goto("/en");
    await declare(page, "Jane Doe", vietnamDateYearsAgo(-1));
    await expect(page.locator("#gate-dob-error")).toHaveText("Date of birth cannot be in the future.");
    await expect(page).toHaveURL((url) => url.pathname === "/en/xac-minh-tuoi");
  });
});

test.describe("L19 notice and accessibility", () => {
  for (const locale of ["vi", "en"] as const) {
    const prefix = locale === "en" ? "/en" : "";

    test(`gate and exit page (${locale})`, async ({ page }) => {
      for (const path of [`${prefix}/xac-minh-tuoi`, `${prefix}/tam-biet`]) {
        await page.goto(path);
        await expect(page.getByTestId("age-notice")).toContainText(LEGAL_NOTICE);
        if (locale === "en") await expect(page.getByTestId("age-notice")).toContainText(EN_TRANSLATION);
        await expectNoSeriousA11yViolations(page);
      }
    });

    test(`home (${locale})`, async ({ page }) => {
      await page.goto(`${prefix}/xac-minh-tuoi`);
      await declare(page, "Nguyễn Văn An", vietnamDateYearsAgo(30));
      await page.goto(prefix || "/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByTestId("age-notice")).toContainText(LEGAL_NOTICE);
      if (locale === "en") await expect(page.getByTestId("age-notice")).toContainText(EN_TRANSLATION);
      await expectNoSeriousA11yViolations(page);
    });
  }

  test("gate with field errors (vi)", async ({ page }) => {
    await page.goto("/xac-minh-tuoi");
    await declare(page, "", "");
    await expect(page.locator("#gate-dob-error")).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });
});
