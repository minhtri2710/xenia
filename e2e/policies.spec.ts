import { expect, type Page, test } from "@playwright/test";

import { POLICY_ROUTES, blockThirdParty, expectNoSeriousA11yViolations, seedCatalogue, sql, vietnamDateYearsAgo } from "./support";

test.beforeAll(async ({ request }) => {
  await seedCatalogue(request);
});

const LOCALES = [
  { locale: "vi", prefix: "", draft: "Bản dự thảo trước khi khai trương" },
  { locale: "en", prefix: "/en", draft: "Pre-launch draft" },
] as const;

async function enterAdult(page: Page, prefix: string, path: string) {
  await page.goto(`${prefix}${path}`);
  if (new URL(page.url()).pathname.endsWith("/xac-minh-tuoi")) {
    await page.locator("#gate-name").fill("Nguyễn Văn An");
    await page.locator("#gate-dob").fill(vietnamDateYearsAgo(30));
    await page.locator("form button[type=submit]").click();
    await expect(page).toHaveURL((url) => url.pathname === `${prefix}${path}`);
  }
}

for (const { locale, prefix, draft } of LOCALES) {
  test.describe(`policies (${locale})`, () => {
    test("all nine pages are gated, drafted, complete and accessible without third-party requests", async ({ page, request }) => {
      for (const { slug, path } of POLICY_ROUTES) {
        const response = await request.get(`${prefix}${path}`, { maxRedirects: 0 });
        expect(response.status(), slug).toBe(307);
        expect(new URL(response.headers().location!, "http://localhost").pathname).toBe(`${prefix}/xac-minh-tuoi`);
      }

      const external = await blockThirdParty(page);
      for (const { slug, path } of POLICY_ROUTES) {
        await enterAdult(page, prefix, path);
        await expect(page.getByTestId("policy-page")).toHaveAttribute("data-policy", slug);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.getByTestId("policy-draft")).toContainText(draft);
        if (["gia", "dieu-kien-ban-hang", "giao-hang"].includes(slug)) {
          await expect(page.locator("#main-content")).toContainText(/30[.,\s\u00a0]*000/);
          await expect(page.locator("#main-content")).toContainText(/45[.,\s\u00a0]*000/);
          await expect(page.locator("#main-content")).toContainText(locale === "en" ? "Ho Chi Minh City" : "TP. Hồ Chí Minh");
          await expect(page.locator("#main-content")).toContainText(locale === "en" ? "1 day" : "1 ngày");
        }
        if (slug === "thong-tin-doanh-nghiep") {
          await expect(page.locator("#main-content")).toContainText("SAMPLE-BUSINESS-REGISTRATION");
          await expect(page.locator("#main-content")).toContainText("SAMPLE-ALCOHOL-LICENCE");
          await expect(page.locator("#main-content")).toContainText("contact@example.test");
        }
        if (slug === "bao-mat") {
          await expect(page.locator("#main-content")).toContainText(locale === "en" ? "Current order retention period: 3 years." : "Thời hạn lưu giữ đơn hàng hiện tại: 3 năm.");
          await expect(page.locator("#main-content")).toContainText(locale === "en" ? "A checkout draft expires 24 hours after its last write." : "Bản nháp checkout hết hạn sau 24 giờ kể từ lần ghi cuối.");
          await expect(page.locator("#main-content")).toContainText("xenia_age_ok");
          await expect(page.locator("#main-content")).toContainText("xenia_cart");
          await expect(page.locator("#main-content")).toContainText("xenia_checkout");
          await expect(page.locator("#main-content")).toContainText(locale === "en" ? "never deletes orders" : "không xóa đơn hàng");
          await expect(page.locator("#main-content")).toContainText(locale === "en" ? "pending legal review" : "đang chờ luật sư rà soát");
        }
        if (slug === "dieu-khoan") {
          await expect(page.locator("#main-content")).toContainText(locale === "en" ? "Current age threshold: 18+." : "Ngưỡng tuổi hiện tại: 18+.");
          await expect(page.locator("#main-content")).toContainText(locale === "en" ? "Current order retention period: 3 years." : "Thời hạn lưu giữ đơn hàng hiện tại: 3 năm.");
          await expect(page.locator("#main-content")).toContainText(locale === "en" ? "Cash on delivery" : "tiền mặt khi nhận hàng");
          await expect(page.locator("#main-content")).toContainText(locale === "en" ? "shows ID" : "xuất trình giấy tờ");
          await expect(page.locator("#main-content")).toContainText(locale === "en" ? "pending legal review" : "đang chờ luật sư rà soát");
        }
        if (slug === "gia") {
          await expect(page.locator("#main-content")).toContainText("10%");
          await expect(page.locator("#main-content")).toContainText(locale === "en" ? "paid service" : "dịch vụ tính phí");
          await expect(page.locator("#main-content")).toContainText(locale === "en" ? "no other amount" : "không có khoản phí nào khác");
        }
        if (slug === "dieu-kien-ban-hang") {
          await expect(page.locator("#main-content")).toContainText("18+");
          await expect(page.locator("#main-content")).toContainText(locale === "en" ? "legal scope" : "phạm vi pháp lý");
        }
        if (slug === "thanh-toan") {
          await expect(page.locator("#main-content")).toContainText("VietQR");
          await expect(page.locator("#main-content")).toContainText(locale === "en" ? "Card" : "Thẻ");
          await expect(page.locator("#main-content")).toContainText(locale === "en" ? "original payment channel" : "kênh thanh toán ban đầu");
        }
        if (slug === "giao-hang") {
          await expect(page.locator("#main-content")).toContainText(locale === "en" ? "30 days" : "30 ngày");
          await expect(page.locator("#main-content")).toContainText(locale === "en" ? "Morning" : "sáng");
          await expect(page.locator("#main-content")).toContainText(locale === "en" ? "show ID" : "xuất trình giấy tờ");
          await expect(page.locator("#main-content")).toContainText(locale === "en" ? "Inspection" : "kiểm tra");
        }
        if (slug === "doi-tra-hoan-tien") {
          await expect(page.locator("#main-content")).toContainText(locale === "en" ? "are to be taken back" : "tiếp nhận hàng");
          await expect(page.locator("#main-content")).toContainText(locale === "en" ? "delivery failed" : "không giao được");
          await expect(page.locator("#main-content")).toContainText(locale === "en" ? "Pending legal review" : "Đang chờ luật sư rà soát");
        }
        await expectNoSeriousA11yViolations(page, `${locale}/${slug}`);
      }
      expect(external).toEqual([]);
    });

    test("policy delivery fees read the current settings on each request", async ({ page }) => {
      const external = await blockThirdParty(page);
      await enterAdult(page, prefix, "/chinh-sach/gia");
      try {
        sql("UPDATE site_settings_zones SET fee_vnd = 31000 WHERE zone = 'hcmc'");
        await page.goto(`${prefix}/chinh-sach/gia`);
        await expect(page.getByTestId("policy-page")).toContainText(locale === "en" ? "31,000" : /31[.,\\s\\u00a0]*000/);
        expect(sql("SELECT fee_vnd FROM site_settings_zones WHERE zone = 'hcmc'")).toBe("31000");
      } finally {
        sql("UPDATE site_settings_zones SET fee_vnd = 30000 WHERE zone = 'hcmc'");
      }
      expect(external).toEqual([]);
    });

    test("footer reads updated owner data on the next request and renders only a configured notification link", async ({ page }) => {
      const originalName = "Xenia Sample Trading Company (SAMPLE DATA)";
      const nextName = "Xenia Request Freshness Check (SAMPLE DATA)";
      const testLink = "https://example.test/notification";
      const external = await blockThirdParty(page);
      await enterAdult(page, prefix, "/xac-minh-tuoi");
      try {
        sql(`UPDATE site_settings SET owner_legal_name = '${nextName}', owner_notification_link = '${testLink}'`);
        await page.goto(`${prefix}/xac-minh-tuoi`);
        await expect(page.locator("footer")).toContainText(nextName);
        const notification = page.locator("footer").getByRole("link", { name: locale === "en" ? "E-commerce notification" : "Thông báo thương mại điện tử" });
        await expect(notification).toHaveAttribute("href", testLink);
        await expect(notification).toHaveAttribute("rel", "noreferrer");
        expect(external).toEqual([]);
      } finally {
        sql(`UPDATE site_settings SET owner_legal_name = '${originalName}', owner_notification_link = ''`);
      }
      await page.goto(`${prefix}/xac-minh-tuoi`);
      await expect(page.locator("footer")).toContainText(originalName);
      await expect(page.locator("footer").getByRole("link", { name: locale === "en" ? "E-commerce notification" : "Thông báo thương mại điện tử" })).toHaveCount(0);
    });
  });
}

for (const { locale, prefix } of LOCALES) {
  test(`review consent link opens the privacy policy (${locale}) without placing an order`, async ({ page }) => {
    const before = Number(sql("SELECT count(*) FROM orders"));
    const external = await blockThirdParty(page);
    const productPath = `${prefix}/ruou-vang/lune-grise-rouge`;
    await page.goto(productPath);
    await expect(page).toHaveURL((url) => url.pathname === `${prefix}/xac-minh-tuoi`);
    await page.locator("#gate-name").fill("Nguyễn Văn An");
    await page.locator("#gate-dob").fill(vietnamDateYearsAgo(30));
    await page.locator("form button[type=submit]").click();
    await expect(page).toHaveURL((url) => url.pathname === productPath);
    await expect(page.getByTestId("add-to-cart")).toBeVisible();

    await page.getByTestId("add-to-cart").locator("button[type=submit]").click();
    await expect(page).toHaveURL((url) => url.pathname === `${prefix}/gio-hang`);
    await page.goto(`${prefix}/thanh-toan`);
    for (const [selector, value] of [
      ["#buyer-name", "Nguyễn Văn An"],
      ["#buyer-dob", vietnamDateYearsAgo(30)],
      ["#buyer-phone", "090 123 4567"],
      ["#buyer-email", "an@example.test"],
      ["#buyer-address", "12 Lê Lợi, Quận 1"],
    ]) await page.locator(selector).fill(value);
    await page.locator("form button[type=submit]").click();
    await expect(page).toHaveURL((url) => url.pathname === `${prefix}/thanh-toan/giao-hang`);
    await page.locator("input[name=zone][value=hcmc]").check();
    await page.locator("input[name=window][value=morning]").check();
    await page.locator("form button[type=submit]").click();
    await expect(page).toHaveURL((url) => url.pathname === `${prefix}/thanh-toan/goi-qua`);
    await page.locator("form button[type=submit]").click();
    await expect(page).toHaveURL((url) => url.pathname === `${prefix}/thanh-toan/xac-nhan`);

    const termsConsent = page.locator("#main-content").getByRole("link", { name: prefix ? "terms of sale" : "điều khoản mua bán" });
    await expect(termsConsent).toHaveAttribute("href", `${prefix}/chinh-sach/dieu-khoan`);
    const consent = page.locator("#main-content").getByRole("link", { name: prefix ? "privacy policy" : "chính sách bảo mật" });
    await expect(consent).toHaveAttribute("href", `${prefix}/chinh-sach/bao-mat`);
    await consent.click();
    await expect(page.getByTestId("policy-page")).toHaveAttribute("data-policy", "bao-mat");
    await expect(page.getByTestId("policy-draft")).toBeVisible();
    expect(external).toEqual([]);
    expect(Number(sql("SELECT count(*) FROM orders"))).toBe(before);
  });
}
