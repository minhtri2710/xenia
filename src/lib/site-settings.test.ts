import { describe, expect, it } from "vitest";

import { validateContactEmail, validateContactPhone, validateOptionalHttpsUrl, validateRequiredText, validateSettingsDate } from "./site-settings";

describe("site-settings validators", () => {
  it("validates required text, real ISO dates, contact email and optional HTTPS URL", () => {
    expect(validateRequiredText("  ")).toBe("This field is required.");
    expect(validateRequiredText("")).not.toBe(true);
    expect(validateRequiredText("Sample name")).toBe(true);
    expect(validateSettingsDate("2026-02-29")).toBe("Use a real date in YYYY-MM-DD format.");
    expect(validateSettingsDate("2024-02-29")).toBe(true);
    expect(validateContactEmail("not-an-email")).toBe("Enter a valid email address.");
    expect(validateContactEmail("contact@example.test")).toBe(true);
    expect(validateContactPhone("  ")).toBe("This field is required.");
    expect(validateContactPhone("+84 000 000 0000 (SAMPLE DATA)")).toBe(true);
    expect(validateOptionalHttpsUrl("http://example.test/notice")).toBe("Use an https URL or leave this field empty.");
    expect(validateOptionalHttpsUrl("https://example.test/notice")).toBe(true);
    expect(validateOptionalHttpsUrl("")).toBe(true);
  });
});
